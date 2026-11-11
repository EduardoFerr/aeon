import {
    API_URL, ESPERA_EXCLUSAO_MS, SYNC_ATIVA, lerEstado, limparEstado, salvarEstado,
} from './contaEstado.js';
import {
    aoMudar as aoMudarDiario, aplicarRemotos as aplicarDiario, atualizadoEm, entradasParaSync, persiste,
} from './diario.js';
import {
    aoMudar as aoMudarPerfil, aplicarRemotosPerfil, mapasParaSync, perfilParaSync,
} from './perfil.js';

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
    return { ativa: SYNC_ATIVA, fase, email: e.email, ultima: e.ultima, erro: e.erro, sincronizando };
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

/** Texto de privacidade que muda com a conta: onde os registros ficam. */
export function registrosFicam(padrao, comConta) {
    return SYNC_ATIVA && lerEstado().ligada ? comConta : padrao;
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

async function chamar(metodo, caminho, corpo) {
    let r;
    try {
        r = await cfg.fetch(`${cfg.api}/v1${caminho}`, {
            method: metodo,
            credentials: 'include',
            headers: corpo !== undefined ? { 'Content-Type': 'application/json' } : undefined,
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
    if (e.status === 401) return 'sessao';
    if (e.status === 429) return 'limite';
    if (e.status === 413) return 'espaco';
    return e.codigo === 'codigo_invalido' || e.codigo === 'email_invalido' ? e.codigo : 'servidor';
}

function nomeDoAparelho() {
    const ua = typeof navigator !== 'undefined' ? navigator.userAgent || '' : '';
    const sistema = /iPhone/.test(ua) ? 'iPhone' : /iPad/.test(ua) ? 'iPad' : /Android/.test(ua) ? 'Android' : /Mac OS X/.test(ua) ? 'Mac' : /Windows/.test(ua) ? 'Windows' : /Linux/.test(ua) ? 'Linux' : 'Aparelho';
    const nav = /Edg\//.test(ua) ? 'Edge' : /OPR\//.test(ua) ? 'Opera' : /Firefox\//.test(ua) ? 'Firefox' : /Chrome\//.test(ua) ? 'Chrome' : /Safari\//.test(ua) ? 'Safari' : '';
    return nav ? `${sistema}, ${nav}` : sistema;
}

/* ---------- entrar ---------- */

export const pedirCodigo = (email) => chamar('POST', '/auth/pedir', { email });

/** Confirma o codigo. Se der certo, a pessoa esta dentro da conta, mas a sincronizacao so liga em ligar(). */
export async function confirmarCodigo(email, codigo) {
    const r = await chamar('POST', '/auth/confirmar', { email, codigo, aparelho: nomeDoAparelho() });
    const antes = lerEstado();
    // Voltou a entrar na MESMA conta que ja estava ligada (a sessao acabou): segue de onde parou, sem refazer a juncao.
    if (antes.ligada && antes.email === r.usuario.email) salvarEstado({ entrou: true, erro: '' });
    else salvarEstado({ email: r.usuario.email, entrou: true, ligada: false, cursor: 0, enviados: {}, apagados: {}, ultima: '', erro: '' });
    avisarConta();
    return r.usuario;
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
    try {
        await chamar('POST', '/auth/sair', {});
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

async function rodar() {
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
