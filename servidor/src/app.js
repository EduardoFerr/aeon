import { createServer } from 'node:http';
import { abrirBanco } from './db.js';
import {
    LIMITE_CORPO_AUTH, LIMITE_CORPO_SYNC, SESSAO_MS,
} from './config.js';
import {
    ErroHttp, criarRoteador, lerCookies, lerCorpo, montarCookie, responder,
} from './http.js';
import { criarLimitador } from './limites.js';
import { criarAuth, normalizarEmail } from './auth.js';
import { criarSync } from './sync.js';
import { mensagemCodigo, mensagemContaApagada } from './email.js';

const METODOS_QUE_MUDAM = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);
const HORA = 60 * 60 * 1000;

/**
 * Monta o servidor. Tudo o que depende do mundo de fora entra por parâmetro (banco, e-mail, relógio, log),
 * para os testes controlarem o tempo e lerem os e-mails enviados.
 *
 * Os logs têm só rota, status, duração e id do usuário. Nunca e-mail, código, IP nem conteúdo dos dados.
 */
export function criarApp({ config, db = abrirBanco(config.caminhoBanco), email, relogio = Date.now, log = () => {} }) {
    const auth = criarAuth({ db, config, relogio });
    const sync = criarSync({ db, relogio });
    const limites = criarLimitador(relogio);
    const origens = new Set(config.origens);
    const nomeCookie = config.cookieSeguro ? '__Host-aeon' : 'aeon';
    const envios = new Set();

    /** Envia sem esperar, para o tempo de resposta não revelar nada. Falha vai para o log, sem o endereço. */
    function enviarEmail(para, mensagem) {
        const p = Promise.resolve()
            .then(() => email.enviar({ para, ...mensagem }))
            .catch((e) => log({ evento: 'email_falhou', motivo: String(e && e.message).slice(0, 120) }))
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
        const ip = ipDe(req);
        limiteOuErro(`pedir-ip:${ip}`, 20, HORA);
        limiteOuErro(`pedir-email:${e}`, 5, HORA);
        const codigo = auth.novoCodigo(e);
        enviarEmail(e, mensagemCodigo(codigo));
        return { status: 202, corpo: { ok: true } };
    });

    rotas.adicionar('POST', '/v1/auth/confirmar', { livre: true, limiteCorpo: LIMITE_CORPO_AUTH }, async ({ req, corpo }) => {
        const e = normalizarEmail(corpo.email);
        if (!e) throw new ErroHttp(400, 'codigo_invalido');
        limiteOuErro(`confirmar-ip:${ipDe(req)}`, 10, 15 * 60 * 1000);
        const r = auth.confirmar(e, corpo.codigo, corpo.aparelho);
        return {
            corpo: { usuario: r.usuario },
            cabecalhos: { 'Set-Cookie': cookieSessao(r.token, Math.floor(SESSAO_MS / 1000)) },
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
        corpo: { email: sessao.usuario.email, criado_em: sessao.usuario.criado_em },
    }));

    rotas.adicionar('GET', '/v1/aparelhos', {}, async ({ sessao }) => ({
        corpo: { aparelhos: auth.aparelhos(sessao.usuario.id, sessao.sessaoId) },
    }));

    rotas.adicionar('DELETE', '/v1/aparelhos/:id', {}, async ({ sessao, params }) => {
        const era = params.id === sessao.sessaoId;
        if (!auth.encerrarAparelho(sessao.usuario.id, params.id)) throw new ErroHttp(404, 'nao_encontrado');
        return { corpo: { ok: true }, cabecalhos: era ? { 'Set-Cookie': cookieSessao('', 0) } : {} };
    });

    rotas.adicionar('GET', '/v1/sync', {}, async ({ sessao, url }) => ({
        corpo: sync.ler(sessao.usuario.id, url.searchParams.get('desde')),
    }));

    rotas.adicionar('POST', '/v1/sync', { limiteCorpo: LIMITE_CORPO_SYNC }, async ({ sessao, corpo }) => ({
        corpo: sync.enviar(sessao.usuario.id, corpo.desde, corpo.itens),
    }));

    rotas.adicionar('GET', '/v1/exportar', {}, async ({ sessao }) => ({
        corpo: {
            versao: 1,
            exportado_em: new Date(relogio()).toISOString(),
            usuario: { email: sessao.usuario.email, criado_em: sessao.usuario.criado_em },
            itens: sync.exportar(sessao.usuario.id),
        },
        cabecalhos: { 'Content-Disposition': 'attachment; filename="aeon-meus-dados.json"' },
    }));

    rotas.adicionar('DELETE', '/v1/conta', { limiteCorpo: LIMITE_CORPO_AUTH }, async ({ sessao, corpo }) => {
        if (corpo.confirmo !== 'apagar') throw new ErroHttp(400, 'confirmacao_necessaria');
        const emailDoUsuario = sessao.usuario.email;
        sync.apagarConta(sessao.usuario.id);
        enviarEmail(emailDoUsuario, mensagemContaApagada());
        return { corpo: { ok: true }, cabecalhos: { 'Set-Cookie': cookieSessao('', 0) } };
    });

    async function tratar(req, res) {
        const inicio = relogio();
        const url = new URL(req.url, 'http://x');
        const caminho = url.pathname.replace(/\/+$/, '') || '/';
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
                    'Access-Control-Allow-Headers': 'Content-Type',
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
                sessao = auth.sessaoDoToken(token);
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
            log({ evento: 'pedido', metodo: req.method, rota: caminho.replace(/\/aparelhos\/[^/]+$/, '/aparelhos/:id'), status, ms: relogio() - inicio, usuario: usuarioId });
        }
    }

    const servidor = createServer((req, res) => {
        tratar(req, res);
    });
    servidor.requestTimeout = 30_000;
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
