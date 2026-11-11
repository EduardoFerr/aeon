import { createServer } from 'node:http';
import { abrirBanco } from './db.js';
import {
    ANONIMA_IP_ESPERA_MS, ANONIMAS_POR_DIA_GLOBAL, ANONIMAS_POR_HORA_GLOBAL, ANONIMAS_POR_IP_POR_DIA, ENVIOS_POR_HORA_GLOBAL, LIMITE_CORPO_AUTH, LIMITE_CORPO_SYNC, SESSAO_MS,
} from './config.js';
import {
    ErroHttp, criarRoteador, lerCookies, lerCorpo, montarCookie, responder,
} from './http.js';
import { baseDoEmail, chaveIp } from './ip.js';
import { criarLimitador } from './limites.js';
import { criarAuth, normalizarEmail } from './auth.js';
import { criarSync } from './sync.js';
import { mensagemCodigo, mensagemContaEncerrada } from './email.js';

const METODOS_QUE_MUDAM = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);
const HORA = 60 * 60 * 1000;

/**
 * Monta o servidor. Tudo o que depende do mundo de fora entra por parâmetro (banco, e-mail, relógio, log),
 * para os testes controlarem o tempo e lerem os e-mails enviados.
 *
 * Os logs têm só rota, status, duração e id do usuário. Nunca e-mail, código, IP nem conteúdo dos dados.
 */
export function criarApp({ config, db = abrirBanco(config.caminhoBanco), email, relogio = Date.now, log = () => {} }) {
    const sync = criarSync({ db, relogio });
    const auth = criarAuth({ db, config, relogio, fundir: sync.fundir });
    const limites = criarLimitador(relogio);
    const origens = new Set(config.origens);
    const nomeCookie = config.cookieSeguro ? '__Host-aeon' : 'aeon';
    const envios = new Set();

    /** Envia sem esperar, para o tempo de resposta não revelar nada. Falha vai para o log, sem o endereço. */
    function enviarEmail(para, mensagem) {
        const p = Promise.resolve()
            .then(() => email.enviar({ para, ...mensagem }))
            .catch((e) => log({ evento: 'email_falhou', motivo: String((e && (e.code || e.responseCode)) || 'erro').slice(0, 40) }))
            .finally(() => envios.delete(p));
        envios.add(p);
    }

    const ipDe = (req) => {
        if (config.confiarProxy) {
            const lista = String(req.headers['x-forwarded-for'] || '').split(',').map((s) => s.trim()).filter(Boolean);
            if (lista.length) return lista[lista.length - 1]; // o que o proxy de confiança acrescentou
        }
        return req.socket.remoteAddress || 'desconhecido';
    };

    const cookieSessao = (token, maxAgeS) => montarCookie(nomeCookie, token, { maxAgeS, seguro: config.cookieSeguro });
    const limiteOuErro = (chave, max, janela) => {
        const r = limites.tentar(chave, max, janela);
        if (!r.ok) throw new ErroHttp(429, 'muitos_pedidos', { espera_s: r.esperaS });
    };

    const rotas = criarRoteador();

    rotas.adicionar('GET', '/v1/saude', { livre: true, semOrigem: true }, async () => ({ corpo: { ok: true } }));

    rotas.adicionar('POST', '/v1/auth/pedir', { livre: true, limiteCorpo: LIMITE_CORPO_AUTH }, async ({ req, corpo }) => {
        const e = normalizarEmail(corpo.email);
        if (!e) throw new ErroHttp(400, 'email_invalido');
        const ip = chaveIp(ipDe(req));
        const caixa = baseDoEmail(e);
        limiteOuErro('pedir-global', ENVIOS_POR_HORA_GLOBAL, HORA); // protege a cota do SMTP e a reputação do domínio
        limiteOuErro(`pedir-ip:${ip}`, 20, HORA);
        limiteOuErro(`pedir-ip-email:${ip}:${caixa}`, 5, HORA); // um IP só não esgota o limite da caixa de outra pessoa
        limiteOuErro(`pedir-email:${caixa}`, 15, HORA);
        const codigo = auth.novoCodigo(e);
        enviarEmail(e, mensagemCodigo(codigo));
        return { status: 202, corpo: { ok: true } };
    });

    // Conta anonima so existe quando a pessoa pede (gerar a chave de recuperacao). Nunca ao abrir o app. Freios severos.
    const freioCriacao = (ip) => {
        limiteOuErro(`anonima-ip-espera:${ip}`, 1, ANONIMA_IP_ESPERA_MS);
        limiteOuErro(`anonima-ip-dia:${ip}`, ANONIMAS_POR_IP_POR_DIA, 24 * HORA);
        limiteOuErro('anonima-global-hora', ANONIMAS_POR_HORA_GLOBAL, HORA);
        limiteOuErro('anonima-global-dia', ANONIMAS_POR_DIA_GLOBAL, 24 * HORA);
    };
    rotas.adicionar('POST', '/v1/auth/anonimo', { livre: true, limiteCorpo: LIMITE_CORPO_AUTH }, async ({ req, corpo }) => {
        freioCriacao(chaveIp(ipDe(req)));
        const r = auth.criarAnonimo(corpo.aparelho);
        return { status: 201, corpo: { usuario: r.usuario, chave: r.chave, contas: r.contas }, cabecalhos: { 'Set-Cookie': cookieSessao(r.token, Math.floor(SESSAO_MS / 1000)) } };
    });

    rotas.adicionar('POST', '/v1/auth/confirmar', { livre: true, limiteCorpo: LIMITE_CORPO_AUTH }, async ({ req, corpo }) => {
        const e = normalizarEmail(corpo.email);
        if (!e) throw new ErroHttp(400, 'codigo_invalido');
        limiteOuErro(`confirmar-ip:${chaveIp(ipDe(req))}`, 10, 15 * 60 * 1000);
        const r = auth.confirmar(e, corpo.codigo, corpo.aparelho, lerCookies(req)[nomeCookie], req.headers['x-aeon-conta'], corpo.modo);
        return {
            corpo: { usuario: r.usuario, contas: r.contas, acao: r.acao },
            // com sessao no aparelho ela continua a mesma; so uma sessao nova leva cookie novo
            cabecalhos: r.token ? { 'Set-Cookie': cookieSessao(r.token, Math.floor(SESSAO_MS / 1000)) } : {},
        };
    });

    // Entrar com a chave de recuperacao (12 palavras). Mesmo desfecho do e-mail: 409 pede o modo, depois adicionar/unir/descartar.
    rotas.adicionar('POST', '/v1/auth/chave', { livre: true, limiteCorpo: LIMITE_CORPO_AUTH }, async ({ req, corpo }) => {
        limiteOuErro(`chave-ip:${chaveIp(ipDe(req))}`, 10, 15 * 60 * 1000);
        limiteOuErro('chave-global', 300, HORA);
        const r = auth.entrarComChave(corpo.chave, corpo.aparelho, lerCookies(req)[nomeCookie], req.headers['x-aeon-conta'], corpo.modo);
        return {
            corpo: { usuario: r.usuario, contas: r.contas, acao: r.acao },
            cabecalhos: r.token ? { 'Set-Cookie': cookieSessao(r.token, Math.floor(SESSAO_MS / 1000)) } : {},
        };
    });

    rotas.adicionar('POST', '/v1/auth/sair', {}, async ({ sessao }) => {
        auth.sair(sessao.sessaoId);
        return { corpo: { ok: true }, cabecalhos: { 'Set-Cookie': cookieSessao('', 0) } };
    });

    rotas.adicionar('POST', '/v1/auth/sair-todos', {}, async ({ sessao }) => {
        auth.sairTodos(sessao.usuario.id);
        return { corpo: { ok: true }, cabecalhos: { 'Set-Cookie': cookieSessao('', 0) } };
    });

    rotas.adicionar('GET', '/v1/eu', {}, async ({ sessao }) => ({
        corpo: { id: sessao.usuario.id, email: sessao.usuario.email, anonimo: sessao.usuario.email === null, criado_em: sessao.usuario.criado_em, contas: sessao.contas },
    }));

    // Varias contas no mesmo aparelho: a sessao (um cookie) liga-se a elas; o cabecalho X-Aeon-Conta escolhe a em uso.
    rotas.adicionar('GET', '/v1/contas', {}, async ({ sessao }) => ({ corpo: { contas: sessao.contas } }));

    rotas.adicionar('POST', '/v1/contas/anonima', { limiteCorpo: LIMITE_CORPO_AUTH }, async ({ req, sessao }) => {
        freioCriacao(chaveIp(ipDe(req)));
        limiteOuErro(`anonima-sessao:${sessao.sessaoId}`, 3, 24 * HORA);
        const r = auth.adicionarAnonima(sessao.sessaoId);
        return { status: 201, corpo: { usuario: r.usuario, chave: r.chave, contas: r.contas } };
    });

    // Chave nova para a conta em uso (a anterior deixa de valer). A frase aparece so nesta resposta.
    rotas.adicionar('POST', '/v1/contas/chave', { limiteCorpo: LIMITE_CORPO_AUTH }, async ({ sessao }) => {
        limiteOuErro(`nova-chave:${sessao.usuario.id}`, 10, HORA);
        return { corpo: { chave: auth.novaChave(sessao.usuario.id) } };
    });

    rotas.adicionar('DELETE', '/v1/contas/:id', {}, async ({ sessao, params }) => {
        const uid = Number(params.id);
        const r = Number.isInteger(uid) ? auth.desvincular(sessao.sessaoId, uid) : null;
        if (!r) throw new ErroHttp(404, 'nao_encontrado');
        return { corpo: { ok: true, contas: r.contas }, cabecalhos: r.sessaoFechada ? { 'Set-Cookie': cookieSessao('', 0) } : {} };
    });

    rotas.adicionar('GET', '/v1/aparelhos', {}, async ({ sessao }) => ({
        corpo: { aparelhos: auth.aparelhos(sessao.usuario.id, sessao.sessaoId) },
    }));

    rotas.adicionar('DELETE', '/v1/aparelhos/:id', {}, async ({ sessao, params }) => {
        const era = params.id === sessao.sessaoId;
        if (!auth.encerrarAparelho(sessao.usuario.id, params.id)) throw new ErroHttp(404, 'nao_encontrado');
        return { corpo: { ok: true }, cabecalhos: era && !auth.sessaoAberta(params.id) ? { 'Set-Cookie': cookieSessao('', 0) } : {} };
    });

    rotas.adicionar('GET', '/v1/sync', {}, async ({ sessao, url }) => {
        limiteOuErro(`sync:${sessao.usuario.id}`, 60, 60 * 1000);
        return { corpo: sync.ler(sessao.usuario.id, url.searchParams.get('desde')) };
    });

    rotas.adicionar('POST', '/v1/sync', { limiteCorpo: LIMITE_CORPO_SYNC }, async ({ sessao, corpo }) => {
        limiteOuErro(`sync:${sessao.usuario.id}`, 60, 60 * 1000);
        return { corpo: sync.enviar(sessao.usuario.id, corpo.desde, corpo.itens) };
    });

    rotas.adicionar('GET', '/v1/exportar', {}, async ({ sessao }) => {
        limiteOuErro(`exportar:${sessao.usuario.id}`, 10, 60 * 1000);
        return await exportarDe(sessao);
    });

    const exportarDe = async (sessao) => ({
        corpo: {
            versao: 1,
            exportado_em: new Date(relogio()).toISOString(),
            usuario: { email: sessao.usuario.email, criado_em: sessao.usuario.criado_em },
            itens: sync.exportar(sessao.usuario.id),
        },
        cabecalhos: { 'Content-Disposition': 'attachment; filename="aeon-meus-dados.json"' },
    });

    rotas.adicionar('DELETE', '/v1/conta', { limiteCorpo: LIMITE_CORPO_AUTH }, async ({ sessao, corpo }) => {
        if (corpo.confirmo !== 'apagar') throw new ErroHttp(400, 'confirmacao_necessaria');
        const emailDoUsuario = sessao.usuario.email;
        sync.encerrarConta(sessao.usuario.id);
        auth.varrer();
        if (emailDoUsuario) enviarEmail(emailDoUsuario, mensagemContaEncerrada());
        // se o aparelho ainda tem outras contas, a sessao (e o cookie) continua
        const resta = auth.sessaoAberta(sessao.sessaoId) ? auth.contas(sessao.sessaoId) : [];
        return { corpo: { ok: true, contas: resta }, cabecalhos: resta.length ? {} : { 'Set-Cookie': cookieSessao('', 0) } };
    });

    async function tratar(req, res) {
        const inicio = relogio();
        let url;
        let caminho = '?';
        let status = 500;
        let usuarioId;
        const cabecalhos = {
            'Cache-Control': 'no-store',
            'X-Content-Type-Options': 'nosniff',
            'Referrer-Policy': 'no-referrer',
            'Content-Security-Policy': "default-src 'none'; frame-ancestors 'none'",
            Vary: 'Origin, Cookie',
        };
        if (config.cookieSeguro) cabecalhos['Strict-Transport-Security'] = 'max-age=31536000; includeSubDomains';

        try {
            try {
                url = new URL(req.url, 'http://x');
            } catch {
                throw new ErroHttp(400, 'url_invalida'); // ex.: "GET //[": não pode derrubar o processo
            }
            caminho = url.pathname.replace(/\/+$/, '') || '/';
            const origem = req.headers.origin;
            const origemOk = typeof origem === 'string' && origens.has(origem);
            const achado = rotas.achar(req.method, caminho);
            const semOrigem = achado.rota && achado.rota.opcoes.semOrigem;

            if (origem !== undefined && !origemOk && !semOrigem) throw new ErroHttp(403, 'origem_nao_permitida');
            if (origemOk) {
                cabecalhos['Access-Control-Allow-Origin'] = origem;
                cabecalhos['Access-Control-Allow-Credentials'] = 'true';
            }
            if (req.method === 'OPTIONS') {
                if (!origemOk) throw new ErroHttp(403, 'origem_nao_permitida');
                status = 204;
                res.writeHead(204, {
                    ...cabecalhos,
                    'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
                    'Access-Control-Allow-Headers': 'Content-Type, X-Aeon-Conta',
                    'Access-Control-Max-Age': '600',
                });
                return res.end();
            }
            // Pedidos que mudam dados só valem se vierem do app (checagem de Origin, além do SameSite do cookie).
            if (METODOS_QUE_MUDAM.has(req.method) && !origemOk) throw new ErroHttp(403, 'origem_nao_permitida');

            if (!achado.rota) throw new ErroHttp(achado.existe ? 405 : 404, achado.existe ? 'metodo_nao_permitido' : 'nao_encontrado');
            const { rota, params } = achado;

            let sessao = null;
            if (!rota.opcoes.livre) {
                const token = lerCookies(req)[nomeCookie];
                sessao = auth.sessaoDoToken(token, req.headers['x-aeon-conta']);
                if (!sessao) throw new ErroHttp(401, 'nao_autenticado');
                usuarioId = sessao.usuario.id;
            }
            const corpo = METODOS_QUE_MUDAM.has(req.method) ? await lerCorpo(req, rota.opcoes.limiteCorpo || LIMITE_CORPO_AUTH) : {};
            const r = await rota.handler({ req, url, params, corpo, sessao });
            status = r.status || 200;
            const extras = { ...(r.cabecalhos || {}) };
            // Sessão usada: quando o prazo foi renovado no banco, renova também o do cookie.
            if (sessao && sessao.renovou && !extras['Set-Cookie']) {
                extras['Set-Cookie'] = cookieSessao(lerCookies(req)[nomeCookie], Math.floor(SESSAO_MS / 1000));
            }
            responder(res, status, r.corpo, { ...cabecalhos, ...extras });
        } catch (e) {
            if (e instanceof ErroHttp) {
                status = e.status;
                const extra = { ...cabecalhos };
                if (e.extra && e.extra.espera_s) extra['Retry-After'] = String(e.extra.espera_s);
                responder(res, status, { erro: e.codigo, ...e.extra }, extra);
            } else {
                status = 500;
                log({ evento: 'erro_interno', rota: caminho, motivo: String(e && e.message).slice(0, 200) });
                if (!res.headersSent) responder(res, 500, { erro: 'interno' }, cabecalhos);
                else res.end();
            }
        } finally {
            log({ evento: 'pedido', metodo: req.method, rota: caminho.replace(/\/aparelhos\/[^/]+$/, '/aparelhos/:id').replace(/\/contas\/\d+$/, '/contas/:id'), status, ms: relogio() - inicio, usuario: usuarioId });
        }
    }

    const servidor = createServer((req, res) => {
        tratar(req, res).catch(() => {
            // última barreira: nada que escape do tratamento pode derrubar o processo
            try { res.destroy(); } catch { /* já fechado */ }
        });
    });
    servidor.requestTimeout = 120_000;
    servidor.headersTimeout = 10_000;
    servidor.keepAliveTimeout = 5_000;

    return {
        servidor,
        db,
        auth,
        limites,
        escutar: (porta, host) => new Promise((ok) => servidor.listen(porta, host, () => ok(servidor.address().port))),
        /** Espera os e-mails em andamento (usado nos testes e ao desligar). */
        async ocioso() {
            while (envios.size) await Promise.allSettled([...envios]);
        },
        limpar() {
            auth.limpar();
            limites.limpar();
        },
        async fechar() {
            await new Promise((ok) => servidor.close(ok));
            await this.ocioso();
            db.close();
        },
    };
}
