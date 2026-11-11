import { chaveDe } from './contas.js';
/**
 * Rascunhos das notas do Diario: o que a pessoa digitou e ainda NAO salvou.
 *
 * A nota salva so muda quando a pessoa toca em "Salvar". Enquanto digita, o texto vai para o rascunho, que
 * sobrevive a recarregar a pagina, a atualizar o app e a trocar de dia ou de tela. "Descartar" apaga o rascunho.
 *
 * Chave: "aeon:v2:rascunhos" -> { v: 1, itens: { [idDaEntrada]: { texto, em } } } (so no aparelho; fora do backup
 * e da sincronizacao). Tudo em try/catch: sem armazenamento, o rascunho vale so enquanto a tela esta aberta.
 */
export const CHAVE_RASCUNHOS = 'aeon:v2:rascunhos';
const LIMITE_TEXTO = 2000;
const LIMITE_ITENS = 50;
const RE_ID = /^[A-Za-z0-9_-]{1,64}$/;

function ler() {
    try {
        const b = JSON.parse(localStorage.getItem(chaveDe('rascunhos')));
        if (!b || typeof b !== 'object' || b.v !== 1 || !b.itens || typeof b.itens !== 'object' || Array.isArray(b.itens)) return {};
        const saida = {};
        for (const [id, it] of Object.entries(b.itens).slice(0, LIMITE_ITENS * 2)) {
            if (RE_ID.test(id) && it && typeof it.texto === 'string') saida[id] = { texto: it.texto.slice(0, LIMITE_TEXTO), em: typeof it.em === 'string' ? it.em.slice(0, 40) : '' };
        }
        return saida;
    } catch (e) {
        return {};
    }
}

function gravar(itens) {
    try {
        if (Object.keys(itens).length) localStorage.setItem(chaveDe('rascunhos'), JSON.stringify({ v: 1, itens }));
        else localStorage.removeItem(chaveDe('rascunhos'));
        return true;
    } catch (e) {
        return false;
    }
}

/** O texto do rascunho da entrada, ou null se nao ha. */
export function lerRascunho(id) {
    const it = ler()[id];
    return it ? it.texto : null;
}

export function gravarRascunho(id, texto, agora = new Date()) {
    if (!RE_ID.test(id)) return false;
    const itens = ler();
    itens[id] = { texto: String(texto).slice(0, LIMITE_TEXTO), em: agora.toISOString() };
    const ids = Object.keys(itens);
    if (ids.length > LIMITE_ITENS) {
        ids.sort((a, b) => (itens[a].em < itens[b].em ? -1 : 1)).slice(0, ids.length - LIMITE_ITENS).forEach((k) => delete itens[k]);
    }
    return gravar(itens);
}

export function limparRascunho(id) {
    const itens = ler();
    if (!(id in itens)) return;
    delete itens[id];
    gravar(itens);
}

export function limparTodosRascunhos() {
    gravar({});
}

export const idsComRascunho = () => Object.keys(ler());
