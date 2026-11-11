/**
 * Estado da sincronizacao com a conta (so no aparelho, fora do arquivo de backup).
 *
 * Chave: "aeon:v2:conta" -> {
 *   v: 1,
 *   email,            e-mail da conta (so para mostrar na tela)
 *   ligada,           a sincronizacao esta ligada neste aparelho
 *   entrou,           ja confirmou o codigo (a sessao e um cookie do servidor, nunca fica aqui)
 *   cursor,           ultimo "seq" recebido do servidor
 *   enviados,         { "tipo/id": atualizado_em } o que o servidor ja tem igual a este aparelho
 *   apagados,         { "tipo/id": ISO } exclusoes feitas aqui que ainda nao foram enviadas
 *   ultima,           ISO da ultima sincronizacao que deu certo
 *   erro              codigo do ultimo erro ("rede", "sessao", ...) ou ""
 * }
 *
 * Chave de configuracao do build (Vite define): __SYNC_ATIVA__ liga a funcionalidade e __API_URL__ aponta para o
 * servidor. Sem a chave ligada nada disto aparece nem roda.
 */
export const CHAVE_CONTA = 'aeon:v2:conta';
export const SYNC_ATIVA = typeof __SYNC_ATIVA__ !== 'undefined' ? __SYNC_ATIVA__ === true : false;
export const API_URL = typeof __API_URL__ !== 'undefined' ? __API_URL__ : 'https://api.aeonfool.com';
/** Exclusoes recentes esperam este tempo antes de ir ao servidor, para o "Desfazer" do aviso ainda valer. */
export const ESPERA_EXCLUSAO_MS = 15 * 1000;

const RE_CHAVE = /^(diario|mapa)\/[A-Za-z0-9_-]{1,64}$/;
const vazio = () => ({ v: 1, email: '', ligada: false, entrou: false, cursor: 0, enviados: {}, apagados: {}, ultima: '', erro: '' });

function dataOuVazio(v) {
    return typeof v === 'string' && v.length < 40 && Number.isFinite(Date.parse(v)) ? v : '';
}

function mapaDeDatas(obj) {
    const saida = {};
    if (!obj || typeof obj !== 'object' || Array.isArray(obj)) return saida;
    for (const [k, v] of Object.entries(obj).slice(0, 20000)) {
        if (RE_CHAVE.test(k) && dataOuVazio(v)) saida[k] = v;
    }
    return saida;
}

export function lerEstado() {
    try {
        const bruto = JSON.parse(localStorage.getItem(CHAVE_CONTA));
        if (!bruto || typeof bruto !== 'object' || bruto.v !== 1) return vazio();
        return {
            v: 1,
            email: typeof bruto.email === 'string' ? bruto.email.slice(0, 254) : '',
            ligada: bruto.ligada === true,
            entrou: bruto.entrou === true,
            cursor: Number.isInteger(bruto.cursor) && bruto.cursor >= 0 ? bruto.cursor : 0,
            enviados: mapaDeDatas(bruto.enviados),
            apagados: mapaDeDatas(bruto.apagados),
            ultima: dataOuVazio(bruto.ultima),
            erro: typeof bruto.erro === 'string' ? bruto.erro.slice(0, 30) : '',
        };
    } catch (e) {
        return vazio();
    }
}

export function salvarEstado(parte) {
    const novo = { ...lerEstado(), ...parte };
    try {
        localStorage.setItem(CHAVE_CONTA, JSON.stringify(novo));
    } catch (e) {
        /* sem armazenamento: a sincronizacao nao liga */
    }
    return novo;
}

export function limparEstado() {
    try {
        localStorage.removeItem(CHAVE_CONTA);
    } catch (e) {
        /* nada a apagar */
    }
}

/** Anota que a pessoa apagou um item aqui. So conta se a sincronizacao esta ligada. */
export function marcarApagado(tipo, id, agora = new Date()) {
    if (!SYNC_ATIVA) return;
    const est = lerEstado();
    if (!est.ligada) return;
    salvarEstado({ apagados: { ...est.apagados, [`${tipo}/${id}`]: agora.toISOString() } });
}

/** O Desfazer trouxe o item de volta: some a exclusao pendente. */
export function desmarcarApagado(tipo, id) {
    if (!SYNC_ATIVA) return;
    const est = lerEstado();
    const k = `${tipo}/${id}`;
    if (!(k in est.apagados)) return;
    const { [k]: _, ...resto } = est.apagados;
    salvarEstado({ apagados: resto });
}
