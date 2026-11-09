// Glossário clicável: termos técnicos dos textos das cartas viram botões que
// abrem um popup curto. Os verbetes ficam em /data/glossario.json.
//
// Formato de cada verbete:
//   { id, termo, aliases: [grafias exatas que aparecem nos textos],
//     auto: true|false  (true = a primeira ocorrência na carta vira botão),
//     curto, mais, ver_tambem: [ids] }

let verbetes = null; // lista
let porId = new Map();
let indice = null; // { regex, porAlias }
let carregando = null;

function escaparRegex(texto) {
    return texto.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export function escaparHtml(texto) {
    return String(texto)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function montarIndice(lista) {
    const porAlias = new Map();
    for (const verbete of lista) {
        if (!verbete.auto) continue;
        for (const alias of verbete.aliases ?? []) {
            if (alias && !porAlias.has(alias)) porAlias.set(alias, verbete.id);
        }
    }
    if (porAlias.size === 0) return null;
    // Aliases mais longos primeiro, para "Livro da Lei" ganhar de "Lei".
    const aliases = [...porAlias.keys()].sort((a, b) => b.length - a.length);
    // Limite de palavra com suporte a acentos (\b do JS não entende letras acentuadas).
    const regex = new RegExp(
        `(?<![\\p{L}\\p{N}_])(?:${aliases.map(escaparRegex).join('|')})(?![\\p{L}\\p{N}_])`,
        'gu'
    );
    return { regex, porAlias };
}

/**
 * Carrega o glossário uma vez. Se o arquivo não existir ou falhar, o site
 * continua funcionando, só sem os termos clicáveis.
 */
export function carregarGlossario() {
    if (verbetes) return Promise.resolve(verbetes);
    if (carregando) return carregando;
    carregando = fetch('/data/glossario.json')
        .then((resposta) => (resposta.ok ? resposta.json() : []))
        .catch(() => [])
        .then((lista) => {
            verbetes = Array.isArray(lista) ? lista : [];
            porId = new Map(verbetes.map((v) => [v.id, v]));
            indice = montarIndice(verbetes);
            return verbetes;
        });
    return carregando;
}

export function getVerbete(id) {
    return porId.get(id) ?? null;
}

/**
 * Devolve HTML seguro: o texto é escapado e a primeira ocorrência de cada termo
 * (por conjunto `usados`, normalmente um por carta) vira um botão .termo.
 * @param {string} texto
 * @param {Set<string>} usados ids já ligados nesta carta
 */
export function linkarTermos(texto, usados = new Set()) {
    if (!texto) return '';
    if (!indice) return escaparHtml(texto);
    let saida = '';
    let ultimo = 0;
    for (const achado of texto.matchAll(indice.regex)) {
        const id = indice.porAlias.get(achado[0]);
        if (!id || usados.has(id)) continue;
        usados.add(id);
        saida += escaparHtml(texto.slice(ultimo, achado.index));
        saida += `<button type="button" class="termo" data-termo="${escaparHtml(id)}" aria-haspopup="dialog">${escaparHtml(achado[0])}</button>`;
        ultimo = achado.index + achado[0].length;
    }
    return saida + escaparHtml(texto.slice(ultimo));
}
