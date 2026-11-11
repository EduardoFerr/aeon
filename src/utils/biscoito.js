/**
 * Biscoito da sorte: carregamento das frases, validacao, sorteio e textos.
 *
 * O arquivo (public/data/biscoito.json) so e baixado quando a tela do biscoito precisa dele.
 * Cada item: { id, texto, numeros }, com 6 numeros distintos de 1 a 60 em ordem crescente.
 */
export const URL_BISCOITO = '/data/biscoito.json';
export const MAX_TEXTO = 110; // limite de conteudo das frases (validado por tools/validar-biscoito.mjs)
export const MAX_TEXTO_GUARDADO = 160; // folga ao ler o que ja esta guardado
export const MIN_ITENS = 100; // abaixo disso a lista e considerada quebrada

/** Item valido: id inteiro >= 1, texto nao vazio, 6 inteiros de 1 a 60 em ordem estritamente crescente. */
export function validarItem(x, maxTexto = MAX_TEXTO) {
    if (!x || typeof x !== 'object') return false;
    if (!Number.isInteger(x.id) || x.id < 1) return false;
    if (typeof x.texto !== 'string' || !x.texto.trim() || x.texto.length > maxTexto) return false;
    const n = x.numeros;
    if (!Array.isArray(n) || n.length !== 6) return false;
    for (let i = 0; i < 6; i++) {
        if (!Number.isInteger(n[i]) || n[i] < 1 || n[i] > 60) return false;
        if (i > 0 && n[i] <= n[i - 1]) return false;
    }
    return true;
}

/** Copia so os tres campos conhecidos (nada extra entra no estado). */
export const copiarItem = (x) => ({ id: x.id, texto: x.texto, numeros: [...x.numeros] });

/** Filtra a lista item a item; item invalido e descartado, e id repetido vale so na primeira vez. */
export function filtrarLista(bruto) {
    if (!Array.isArray(bruto)) return [];
    const vistos = new Set();
    const saida = [];
    for (const x of bruto) {
        if (!validarItem(x) || vistos.has(x.id)) continue;
        vistos.add(x.id);
        saida.push(copiarItem(x));
    }
    return saida;
}

let cache = null; // promessa da lista; zerada na falha e ao sair da tela

/** Baixa e valida a lista (uma vez por visita). Falhou: o cache e zerado para "Tentar de novo" refazer. */
export function carregarBiscoito() {
    if (cache) return cache;
    const p = (async () => {
        const resposta = await fetch(URL_BISCOITO);
        if (!resposta || !resposta.ok) throw new Error('biscoito: resposta ruim');
        const lista = filtrarLista(await resposta.json());
        if (lista.length < MIN_ITENS) throw new Error('biscoito: lista curta demais');
        return lista;
    })();
    cache = p;
    p.catch(() => {
        if (cache === p) cache = null;
    });
    return p;
}

/** Solta a lista da memoria (ao sair da tela) e cancela uma carga pendente do ponto de vista do cache. */
export function limparCache() {
    cache = null;
}

/**
 * Inteiro uniforme em [0, n) por rejeicao (sem vies de modulo). `fonte` devolve um uint32; o padrao e o crypto.
 */
export function indiceAleatorio(n, fonte = uint32Crypto) {
    if (!Number.isInteger(n) || n < 1) throw new RangeError('indiceAleatorio: n invalido');
    if (n === 1) return 0;
    const limite = Math.floor(0x100000000 / n) * n;
    for (let i = 0; i < 1000; i++) {
        const v = fonte() >>> 0;
        if (v < limite) return v % n;
    }
    return fonte() % n; // inalcancavel na pratica
}

function uint32Crypto() {
    const a = new Uint32Array(1);
    globalThis.crypto.getRandomValues(a);
    return a[0];
}

/** [7, 14, 23] -> "07 14 23" */
export const formatarNumeros = (numeros) => numeros.map((n) => String(n).padStart(2, '0')).join(' ');

/** Como o leitor de tela deve dizer: "7, 14, 23" (sem zero a esquerda). */
export const numerosFalados = (numeros) => numeros.map((n) => String(n)).join(', ');

export const textoParaCopiar = (item) => `${item.texto}\nNúmeros da sorte: ${formatarNumeros(item.numeros)}\naeonfool.com`;

export const textoParaCompartilhar = (item) =>
    `Meu biscoito da sorte no Aeon Fool: “${item.texto}” Números: ${formatarNumeros(item.numeros)}. aeonfool.com`;

export const anuncioDaQuebra = (item) =>
    `Biscoito quebrado. ${item.texto} Seus números da sorte: ${numerosFalados(item.numeros)}.`;

/** Copia texto simples. Clipboard API; se falhar, textarea + execCommand. Devolve true/false. */
export async function copiarTexto(texto) {
    try {
        const nav = globalThis.navigator;
        if (nav && nav.clipboard && nav.clipboard.writeText) {
            await nav.clipboard.writeText(texto);
            return true;
        }
    } catch (e) {
        /* cai no plano B */
    }
    try {
        const doc = globalThis.document;
        if (!doc) return false;
        const t = doc.createElement('textarea');
        t.value = texto;
        t.setAttribute('readonly', '');
        t.style.cssText = 'position:fixed;top:0;left:0;opacity:0;';
        doc.body.appendChild(t);
        t.select();
        t.setSelectionRange(0, texto.length);
        const ok = doc.execCommand('copy');
        t.remove();
        return !!ok;
    } catch (e) {
        return false;
    }
}
