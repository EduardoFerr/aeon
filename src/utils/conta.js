import {
    API_URL, ESPERA_EXCLUSAO_MS, SYNC_ATIVA, lerEstado, limparEstado, salvarEstado,
} from './contaEstado.js';
import {
    aoMudar as aoMudarDiario, aplicarRemotos as aplicarDiario, atualizadoEm, entradasParaSync, persiste,
} from './diario.js';
import {
    aoMudar as aoMudarPerfil, aplicarRemotosPerfil, mapasParaSync, perfilParaSync,
} from './perfil.js';
import { chaveDe, criarContaLocal } from './contas.js';

/**
 * Sincronizacao OPCIONAL com a conta do Aeon (servidor em api.aeonfool.com). Desligada por padrao.
 *
 * - O diario, os mapas e o apelido continuam sendo guardados no aparelho. A conta e uma copia.
 * - Login por e-mail e codigo de 6 digitos. A sessao e um cookie HttpOnly do servidor: este codigo nunca a ve.
 * - Cada item (entrada do diario, mapa, apelido) tem uma data de ultima edicao; vale a mais recente.
 * - Nenhuma exclusao e deduzida pela ausencia de dados: so o que a pessoa apagou aqui (marcarApagado) vai como
 *   exclusao. Limpar os dados do navegador nunca apaga nada na conta: ligar de novo traz tudo de volta.
 * - Ao ligar pela primeira vez os dois lados sao JUNTADOS: nada e trocado nem apagado.
 */

let cfg = { api: API_URL, fetch: (...a) => globalThis.fetch(...a), esperaExclusaoMs: ESPERA_EXCLUSAO_MS };
/** Para testes: troca o endereco da API e o fetch (com cookie jar, por exemplo). */
export function configurar(parte) {
    cfg = { ...cfg, ...parte };
}

const ouvintes = new Set();
let sincronizando = false;
let aplicando = false;
let emAndamento = null;
let outraVez = false;
let timer = null;

/* ---------- estado publico ---------- */

export function estadoConta() {
    const e = lerEstado();
    const fase = e.ligada ? 'ligada' : e.entrou ? 'juntar' : 'desligada';
    return {
        ativa: SYNC_ATIVA, fase, email: e.email, ultima: e.ultima, erro: e.erro, sincronizando,
        servidorId: e.servidorId, temChave: !!e.chave, anonima: !!e.servidorId && !e.email,
    };
}

export function aoMudarConta(fn) {
    ouvintes.add(fn);
    return () => ouvintes.delete(fn);
}

function avisarConta() {
    ouvintes.forEach((fn) => {
        try {
            fn(estadoConta());
        } catch (e) {
            /* um ouvinte quebrado nao derruba os outros */
        }
    });
}

/* ---------- API ---------- */

export class ErroConta extends Error {
    constructor(status, codigo, extra = {}) {
        super(codigo);
        this.status = status;
        this.codigo = codigo;
        this.extra = extra;
    }
}

/**
 * Chama a API. Cada pedido diz qual conta do aparelho esta em uso (cabecalho X-Aeon-Conta), pois a sessao do aparelho
 * pode estar ligada a varias. `semConta` e para entrar e criar conta: ai o cabecalho nao existe.
 */
async function chamar(metodo, caminho, corpo, { semConta = false } = {}) {
    let r;
    const headers = {};
    if (corpo !== undefined) headers['Content-Type'] = 'application/json';
    const id = semConta ? 0 : lerEstado().servidorId;
    if (id) headers['X-Aeon-Conta'] = String(id);
    try {
        r = await cfg.fetch(`${cfg.api}/v1${caminho}`, {
            method: metodo,
            credentials: 'include',
            headers: Object.keys(headers).length ? headers : undefined,
            body: corpo !== undefined ? JSON.stringify(corpo) : undefined,
        });
    } catch (e) {
        throw new ErroConta(0, 'rede');
    }
    let json = null;
    try {
        json = await r.json();
    } catch (e) {
        /* resposta sem corpo */
    }
    if (!r.ok) throw new ErroConta(r.status, (json && json.erro) || 'servidor', json || {});
    return json;
}

/** Codigo curto do erro, para a tela escolher a frase. */
export function motivoDoErro(e) {
    if (!(e instanceof ErroConta)) return 'servidor';
    if (e.codigo === 'rede') return 'rede';
    if (e.status === 401 || e.status === 403) return 'sessao';
    if (e.status === 429) return 'limite';
    if (e.status === 413) return 'espaco';
    return e.codigo === 'email_ocupado' || e.codigo === 'codigo_invalido' || e.codigo === 'email_invalido' || e.codigo === 'chave_invalida' ? e.codigo : 'servidor';
}

function nomeDoAparelho() {
    const ua = typeof navigator !== 'undefined' ? navigator.userAgent || '' : '';
    const sistema = /iPhone/.test(ua) ? 'iPhone' : /iPad/.test(ua) ? 'iPad' : /Android/.test(ua) ? 'Android' : /Mac OS X/.test(ua) ? 'Mac' : /Windows/.test(ua) ? 'Windows' : /Linux/.test(ua) ? 'Linux' : 'Aparelho';
    const nav = /Edg\//.test(ua) ? 'Edge' : /OPR\//.test(ua) ? 'Opera' : /Firefox\//.test(ua) ? 'Firefox' : /Chrome\//.test(ua) ? 'Chrome' : /Safari\//.test(ua) ? 'Safari' : '';
    return nav ? `${sistema}, ${nav}` : sistema;
}

/* ---------- entrar ---------- */

export const pedirCodigo = (email) => chamar('POST', '/auth/pedir', { email }, { semConta: true });

/**
 * Guarda no estado de uma conta local o que o servidor devolveu num login. `destino`:
 *  - 'esta' (padrao): a conta ativa daqui passa a estar ligada a conta do servidor e fica em "juntar", esperando ligar();
 *  - 'nova': cria uma conta local so para ela, ja ligada e sem nada para juntar. -> { contaLocal } (quem chamou troca para ela).
 * A conta que esta conta local tinha no servidor antes (se tinha outra) sai deste aparelho; os dados locais ficam.
 */
async function guardarLogin(usuario, chave, destino) {
    const novo = { email: usuario.email || '', servidorId: usuario.id, chave: chave || '', erro: '' };
    if (destino === 'nova') {
        const contaLocal = criarContaLocal();
        if (!contaLocal) throw new ErroConta(409, 'muitas_contas');
        salvarEstado({ ...novo, entrou: true, ligada: true, cursor: 0, enviados: {}, apagados: {}, ultima: '' }, contaLocal);
        avisarConta();
        return { contaLocal };
    }
    const antes = lerEstado();
    // Voltou a entrar na MESMA conta que ja estava ligada (a sessao acabou): segue de onde parou, sem refazer a juncao.
    if (antes.ligada && antes.servidorId === usuario.id) salvarEstado({ ...novo, entrou: true, chave: chave || antes.chave });
    else {
        salvarEstado({ ...novo, entrou: true, ligada: false, cursor: 0, enviados: {}, apagados: {}, ultima: '' });
        if (antes.servidorId && antes.servidorId !== usuario.id) {
            try {
                await chamar('DELETE', `/contas/${antes.servidorId}`, {}, { semConta: true });
            } catch (e) {
                /* sem rede ou ja desligada: a conta antiga some do servidor sozinha quando ficar sem aparelho */
            }
        }
    }
    avisarConta();
    return {};
}

/**
 * Confirma o codigo. Se der certo, a pessoa esta dentro da conta, mas a sincronizacao so liga em ligar().
 * `destino: 'vincular'` e para quem ja tem conta (com chave) e quer ACRESCENTAR um e-mail a ela: se o e-mail ainda nao
 * tem conta, passa a ser dela; se ja tem, nada muda e o erro e 'email_ocupado'.
 */
export async function confirmarCodigo(email, codigo, { destino = 'esta' } = {}) {
    if (destino === 'vincular') {
        const r = await chamar('POST', '/auth/confirmar', { email, codigo, aparelho: nomeDoAparelho(), modo: 'adicionar' });
        if (r.acao !== 'vinculou') {
            if (r.acao === 'adicionar') {
                try {
                    await chamar('DELETE', `/contas/${r.usuario.id}`, {});
                } catch (e) {
                    /* a conta so ficou ligada a este aparelho; some sozinha da sessao com o tempo */
                }
            }
            throw new ErroConta(409, 'email_ocupado');
        }
        salvarEstado({ email: r.usuario.email, erro: '' });
        avisarConta();
        return r.usuario;
    }
    const r = await chamar('POST', '/auth/confirmar', { email, codigo, aparelho: nomeDoAparelho(), modo: 'adicionar' }, { semConta: true });
    const extra = await guardarLogin(r.usuario, '', destino);
    return { ...r.usuario, ...extra };
}

/** Entra com a chave de recuperacao (12 palavras). Mesmo desfecho do e-mail. */
export async function entrarComChave(frase, { destino = 'esta' } = {}) {
    const r = await chamar('POST', '/auth/chave', { chave: frase, aparelho: nomeDoAparelho(), modo: 'adicionar' }, { semConta: true });
    const extra = await guardarLogin(r.usuario, frase, destino);
    return { ...r.usuario, ...extra };
}

/**
 * Cria a conta no servidor para esta conta local e liga a sincronizacao. So acontece quando a pessoa pede: o app nunca
 * cria conta sozinho. A frase de 12 palavras aparece nesta resposta; fica guardada aqui para poder mostrar de novo.
 * Se a conta ja esta ligada, devolve a chave que ja existe (ou gera uma, se ela nasceu por e-mail e nao tem).
 * -> { chave, nova }
 */
export async function gerarChave() {
    const est = lerEstado();
    if (est.servidorId && est.chave) return { chave: est.chave, nova: false };
    if (est.servidorId) return { chave: await gerarNovaChave(), nova: true };
    let r;
    try {
        r = await chamar('POST', '/contas/anonima', {}, { semConta: true }); // aproveita a sessao deste aparelho
    } catch (e) {
        if (!(e instanceof ErroConta) || e.status !== 401) throw e;
        r = await chamar('POST', '/auth/anonimo', { aparelho: nomeDoAparelho() }, { semConta: true }); // aparelho sem sessao
    }
    salvarEstado({ email: '', servidorId: r.usuario.id, chave: r.chave, entrou: true, ligada: true, cursor: 0, enviados: {}, apagados: {}, ultima: '', erro: '' });
    avisarConta();
    iniciarConta();
    sincronizar();
    return { chave: r.chave, nova: true };
}

/** A chave guardada neste aparelho, ou '' (conta que nasceu por e-mail e nunca pediu uma, ou chave ja descartada). */
export function verChave() {
    return lerEstado().chave;
}

/** Chave nova para a conta em uso: a anterior deixa de valer. */
export async function gerarNovaChave() {
    const r = await chamar('POST', '/contas/chave', {});
    salvarEstado({ chave: r.chave });
    avisarConta();
    return r.chave;
}

let ultimaReentrada = 0;
/** A sessao deste aparelho acabou (cookie limpo ou vencido): quem tem a chave guardada volta sozinho, no maximo a cada 10 minutos. */
async function reentrar() {
    const est = lerEstado();
    if (!est.chave || Date.now() - ultimaReentrada < 10 * 60 * 1000) return false;
    ultimaReentrada = Date.now();
    try {
        const r = await chamar('POST', '/auth/chave', { chave: est.chave, aparelho: nomeDoAparelho(), modo: 'adicionar' }, { semConta: true });
        salvarEstado({ servidorId: r.usuario.id, email: r.usuario.email || est.email, erro: '' });
        return true;
    } catch (e) {
        return false;
    }
}

/** Quantos registros ha na conta local ativa, para a tela decidir se ha o que perguntar. */
export function registrosLocais() {
    return { diario: entradasParaSync().length, mapas: mapasParaSync().length };
}

/** Apaga so os registros da conta local ativa (diario, mapas, apelido, rascunhos). Nao anota exclusao, nao mexe no estado da conta. */
export function apagarRegistrosLocais() {
    ['perfil', 'diario', 'rascunhos', 'dia', 'verso-signo'].forEach((b) => {
        try {
            localStorage.removeItem(chaveDe(b));
        } catch (e) {
            /* sem armazenamento: nada a apagar */
        }
    });
}

/**
 * "Ficar com as duas": a conta do servidor em que a pessoa acabou de entrar sai desta conta local e ganha uma conta local
 * propria (ja ligada, vai receber os registros dela); esta volta a ser so deste aparelho, com os registros intactos.
 * -> o id da conta local nova (quem chamou troca para ela).
 */
export function moverLigacaoParaNovaConta() {
    const est = lerEstado();
    const id = criarContaLocal();
    if (!id) throw new ErroConta(409, 'muitas_contas');
    salvarEstado({ ...est, ligada: true, entrou: true, cursor: 0, enviados: {}, apagados: {}, ultima: '', erro: '' }, id);
    limparEstado();
    avisarConta();
    return id;
}

/** Quanto ha na conta e aqui, para a tela mostrar antes de juntar. */
export async function resumoParaJuntar() {
    const naConta = { diario: 0, mapas: 0 };
    let desde = 0;
    for (let i = 0; i < 50; i++) {
        const r = await chamar('GET', `/sync?desde=${desde}`);
        for (const it of r.itens) {
            if (it.apagado) continue;
            if (it.tipo === 'diario') naConta.diario++;
            else if (it.tipo === 'mapa') naConta.mapas++;
        }
        if (!r.mais) break;
        desde = r.proximo;
    }
    return { aqui: { diario: entradasParaSync().length, mapas: mapasParaSync().length }, naConta };
}

/** Liga a sincronizacao neste aparelho e faz a primeira (junta os dois lados). */
export async function ligar() {
    salvarEstado({ ligada: true, erro: '' });
    avisarConta();
    iniciarConta();
    return sincronizar();
}

/** Desliga neste aparelho: encerra a sessao e esquece a conta aqui. Os registros do aparelho e da conta ficam. */
export async function sair() {
    const id = lerEstado().servidorId;
    try {
        // so esta conta sai deste aparelho; as outras contas dele continuam. Estado antigo, sem id: encerra a sessao.
        if (id) await chamar('DELETE', `/contas/${id}`, {});
        else await chamar('POST', '/auth/sair', {});
    } catch (e) {
        /* sem rede: a sessao some sozinha do servidor com o tempo; aqui a pessoa ja saiu */
    }
    limparEstado();
    avisarConta();
}

export async function sairDeTodos() {
    await chamar('POST', '/auth/sair-todos', {});
    limparEstado();
    avisarConta();
}

export async function aparelhos() {
    return (await chamar('GET', '/aparelhos')).aparelhos;
}

export async function encerrarAparelho(id) {
    await chamar('DELETE', `/aparelhos/${encodeURIComponent(id)}`, {});
}

/** Apaga tudo da conta no servidor e encerra a conta. O que esta neste aparelho fica. */
export async function apagarDadosDoServidor() {
    await chamar('DELETE', '/conta', { confirmo: 'apagar' });
    limparEstado();
    avisarConta();
}

/** Baixa tudo o que a conta tem, em JSON legivel. */
export async function baixarDadosDaConta() {
    const dados = await chamar('GET', '/exportar');
    const blob = new Blob([JSON.stringify(dados, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `aeon-minha-conta-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 5000);
}

/* ---------- sincronizar ---------- */

const MIN_DATA = '2000-01-01T00:00:00.000Z';
const noMinimo = (iso) => (iso && iso > MIN_DATA ? iso : MIN_DATA);

/** Tudo o que existe aqui, no formato do servidor: Map "tipo/id" -> { tipo, id, dados, atualizado_em }. */
function itensLocais() {
    const m = new Map();
    for (const e of entradasParaSync()) m.set(`diario/${e.id}`, { tipo: 'diario', id: e.id, dados: e, atualizado_em: noMinimo(atualizadoEm(e)) });
    for (const x of mapasParaSync()) m.set(`mapa/${x.id}`, { tipo: 'mapa', id: x.id, dados: x, atualizado_em: noMinimo(x.atualizado) });
    const p = perfilParaSync();
    if (p) m.set('perfil/perfil', { tipo: 'perfil', id: 'perfil', dados: { apelido: p.apelido }, atualizado_em: noMinimo(p.atualizado) });
    return m;
}

/** Aplica o que veio do servidor e devolve as chaves que agora estao iguais. */
function aplicarDoServidor(itens) {
    const diario = [];
    const mapas = [];
    let perfil = null;
    for (const it of itens) {
        if (it.tipo === 'diario') diario.push({ id: it.id, dados: it.dados, atualizado_em: it.atualizado_em, apagado: it.apagado });
        else if (it.tipo === 'mapa') mapas.push({ id: it.id, dados: it.dados, atualizado_em: it.atualizado_em, apagado: it.apagado });
        else if (it.tipo === 'perfil' && !it.apagado) perfil = { dados: it.dados, atualizado_em: it.atualizado_em };
    }
    const iguais = new Set();
    aplicando = true;
    try {
        if (diario.length) aplicarDiario(diario).marcados.forEach((id) => iguais.add(`diario/${id}`));
        if (mapas.length || perfil) aplicarRemotosPerfil({ mapas, perfil }).marcados.forEach((k) => iguais.add(k));
    } finally {
        aplicando = false;
    }
    return iguais;
}

function registrarResposta(est, resp, enviadosAgora) {
    const iguais = aplicarDoServidor(resp.itens);
    const enviados = { ...est.enviados };
    for (const k of enviadosAgora) enviados[k.chave] = k.atualizado_em;
    for (const it of resp.itens) {
        const k = `${it.tipo}/${it.id}`;
        if (it.apagado) delete enviados[k];
        else if (iguais.has(k)) enviados[k] = it.atualizado_em;
    }
    return enviados;
}

async function rodar(jaReentrou = false) {
    let est = lerEstado();
    if (!SYNC_ATIVA || !est.ligada) return { ok: false, motivo: 'desligada' };
    if (!persiste()) return fim({ ok: false, motivo: 'sem-armazenamento' }, 'armazenamento');

    const locais = itensLocais();
    const agora = Date.now();
    // Item que a conta tem como igual ao daqui mas que SUMIU daqui sem a pessoa apagar (leitura que falhou, outra aba,
    // armazenamento corrompido): nunca vira exclusao. Recomeca a leitura da conta do zero para trazer de volta.
    const sumidos = Object.keys(est.enviados).filter((k) => !locais.has(k) && !(k in est.apagados));
    if (sumidos.length) {
        const enviados = { ...est.enviados };
        sumidos.forEach((k) => delete enviados[k]);
        est = salvarEstado({ cursor: 0, enviados });
    }
    const envios = [];
    for (const [chave, it] of locais) {
        if (est.enviados[chave] !== it.atualizado_em) envios.push({ chave, item: { tipo: it.tipo, id: it.id, dados: it.dados, atualizado_em: it.atualizado_em } });
    }
    let aindaEsperando = 0;
    for (const [chave, em] of Object.entries(est.apagados)) {
        const idade = agora - Date.parse(em);
        if (idade < cfg.esperaExclusaoMs) {
            aindaEsperando = Math.max(aindaEsperando, cfg.esperaExclusaoMs - idade);
            continue; // o Desfazer ainda pode valer
        }
        const [tipo, id] = chave.split('/');
        envios.push({ chave, item: { tipo, id, apagado: true, atualizado_em: noMinimo(em) }, exclusao: true });
    }

    try {
        // conta ligada antes de existirem varias contas por aparelho: descobre o id dela uma vez
        if (!est.servidorId) {
            const eu = await chamar('GET', '/eu');
            if (eu && Array.isArray(eu.contas) && eu.contas.length === 1) est = salvarEstado({ servidorId: eu.id });
        }
        let cursor = est.cursor;
        for (let i = 0; i < envios.length; i += 200) {
            const lote = envios.slice(i, i + 200);
            const resp = await chamar('POST', '/sync', { desde: cursor, itens: lote.map((x) => x.item) });
            est = lerEstado();
            const enviados = registrarResposta(est, resp, lote.filter((x) => !x.exclusao).map((x) => ({ chave: x.chave, atualizado_em: x.item.atualizado_em })));
            const apagados = { ...est.apagados };
            for (const x of lote) if (x.exclusao) delete apagados[x.chave];
            if (resp.reinicio) for (const k of Object.keys(enviados)) delete enviados[k];
            cursor = resp.proximo;
            salvarEstado({ cursor, enviados, apagados });
            let pagina = resp;
            while (pagina.mais) {
                pagina = await chamar('GET', `/sync?desde=${cursor}`);
                est = lerEstado();
                cursor = pagina.proximo;
                salvarEstado({ cursor, enviados: registrarResposta(est, pagina, []) });
            }
        }
        // sem nada para enviar (ou depois do envio): busca o que mudou no servidor
        let pagina;
        do {
            pagina = await chamar('GET', `/sync?desde=${cursor}`);
            est = lerEstado();
            const enviados = registrarResposta(est, pagina, []);
            if (pagina.reinicio) for (const k of Object.keys(enviados)) delete enviados[k];
            cursor = pagina.proximo;
            salvarEstado({ cursor, enviados });
        } while (pagina.mais);
        if (aindaEsperando) agendar(aindaEsperando + 500);
        return fim({ ok: true }, '');
    } catch (e) {
        if (!jaReentrou && e instanceof ErroConta && (e.status === 401 || e.status === 403) && (await reentrar())) return rodar(true);
        return fim({ ok: false, motivo: motivoDoErro(e) }, motivoDoErro(e));
    }
}

function fim(resultado, erro) {
    if (resultado.ok) salvarEstado({ ultima: new Date().toISOString(), erro: '' });
    else salvarEstado({ erro });
    return resultado;
}

/** Sincroniza agora. Pedidos que chegam durante uma sincronizacao viram uma segunda rodada, uma so. */
export function sincronizar() {
    if (emAndamento) {
        outraVez = true;
        return emAndamento;
    }
    sincronizando = true;
    avisarConta();
    emAndamento = rodar().finally(async () => {
        emAndamento = null;
        sincronizando = false;
        avisarConta();
        if (outraVez) {
            outraVez = false;
            sincronizar();
        }
    });
    return emAndamento;
}

/** Sincroniza daqui a pouco (junta varias mudancas seguidas, como digitar uma nota). */
export function agendar(ms = 5000) {
    if (!SYNC_ATIVA || !lerEstado().ligada) return;
    clearTimeout(timer);
    timer = setTimeout(() => sincronizar(), ms);
}

/* ---------- automatico ---------- */

let iniciada = false;
let ultimaVisivel = 0;

/** Liga os gatilhos automaticos (mudou algo, voltou para a aba, voltou a rede, abriu o app). Seguro chamar de novo. */
export function iniciarConta() {
    if (!SYNC_ATIVA || iniciada || typeof window === 'undefined') return;
    if (!lerEstado().ligada) return;
    iniciada = true;
    const aoMudar = () => {
        if (!aplicando) agendar();
    };
    aoMudarDiario(aoMudar);
    aoMudarPerfil(aoMudar);
    document.addEventListener('visibilitychange', () => {
        if (document.visibilityState !== 'visible') return;
        if (Date.now() - ultimaVisivel > 60 * 1000) sincronizar();
        ultimaVisivel = Date.now();
    });
    window.addEventListener('online', () => agendar(1000));
    setTimeout(() => sincronizar(), 2000);
}
