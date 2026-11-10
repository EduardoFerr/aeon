// Árvore da Vida em SVG inline: 10 esferas, 22 caminhos, e o destaque da carta aberta.
// Só é carregada (import dinâmico) quando o detalhe de uma carta abre.
// Cores vêm dos tokens do tema ativo (var(--...)), definidos em styles/detalhe.css.

// viewBox 240 x 334. Colunas: esquerda 52, centro 120, direita 188.
export const ESFERAS = {
    Kether: [120, 30],
    Chokmah: [188, 70],
    Binah: [52, 70],
    Chesed: [188, 140],
    Geburah: [52, 140],
    Tiphareth: [120, 172],
    Netzach: [188, 232],
    Hod: [52, 232],
    Yesod: [120, 266],
    Malkuth: [120, 304],
};

// Os 22 caminhos: número -> [esfera de cima, esfera de baixo]
export const CAMINHOS = {
    11: ['Kether', 'Chokmah'],
    12: ['Kether', 'Binah'],
    13: ['Kether', 'Tiphareth'],
    14: ['Chokmah', 'Binah'],
    15: ['Chokmah', 'Tiphareth'],
    16: ['Chokmah', 'Chesed'],
    17: ['Binah', 'Tiphareth'],
    18: ['Binah', 'Geburah'],
    19: ['Chesed', 'Geburah'],
    20: ['Chesed', 'Tiphareth'],
    21: ['Chesed', 'Netzach'],
    22: ['Geburah', 'Tiphareth'],
    23: ['Geburah', 'Hod'],
    24: ['Tiphareth', 'Netzach'],
    25: ['Tiphareth', 'Yesod'],
    26: ['Tiphareth', 'Hod'],
    27: ['Netzach', 'Hod'],
    28: ['Netzach', 'Yesod'],
    29: ['Netzach', 'Malkuth'],
    30: ['Hod', 'Yesod'],
    31: ['Hod', 'Malkuth'],
    32: ['Yesod', 'Malkuth'],
};

// Cada esfera escreve o nome para o lado (e = esquerda, d = direita); Kether em cima, Malkuth embaixo.
const LADO = { Binah: 'e', Geburah: 'e', Hod: 'e', Tiphareth: 'e', Yesod: 'e', Chokmah: 'd', Chesed: 'd', Netzach: 'd' };

const R = 11;

function rotulo(nome, marcada) {
    const [x, y] = ESFERAS[nome];
    let tx = x, ty, anchor = 'middle';
    if (LADO[nome] === 'e') { tx = x - R - 6; ty = y + 4; anchor = 'end'; }
    else if (LADO[nome] === 'd') { tx = x + R + 6; ty = y + 4; anchor = 'start'; }
    else if (nome === 'Kether') { ty = y - R - 11; }
    else { ty = y + R + 15; }
    return `<text class="av-rotulo${marcada ? ' on' : ''}" x="${tx}" y="${ty}" text-anchor="${anchor}" aria-hidden="true">${nome}</text>`;
}

/**
 * @param {{caminho?: number, esfera?: string}} destaque
 * @param {string} titulo texto do <title> e do aria-label
 */
export function arvoreSvg({ caminho, esfera } = {}, titulo = 'Árvore da Vida') {
    const ligadas = caminho ? CAMINHOS[caminho] : null;
    const marcadas = new Set(ligadas ?? (esfera ? [esfera] : []));
    let linhas = '';
    let lit = '';
    for (const [num, [a, b]] of Object.entries(CAMINHOS)) {
        const [x1, y1] = ESFERAS[a];
        const [x2, y2] = ESFERAS[b];
        const tag = `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}"`;
        if (Number(num) === caminho) lit = `${tag} class="av-caminho on"/>`;
        else linhas += `${tag} class="av-caminho"/>`;
    }
    let numero = '';
    if (ligadas) {
        const [x1, y1] = ESFERAS[ligadas[0]];
        const [x2, y2] = ESFERAS[ligadas[1]];
        // o número fica ao lado do traço aceso (nunca em cima), para não cortar a linha
        const dx = x2 - x1, dy = y2 - y1, len = Math.hypot(dx, dy);
        let nx = dy / len, ny = -dx / len;
        // traços de pé ficam com o número à direita (os rótulos do centro estão à esquerda); os demais, acima ou à esquerda
        if (Math.abs(ny) > Math.abs(nx) ? ny > 0 : nx < 0) { nx = -nx; ny = -ny; }
        numero = `<text class="av-numero" x="${((x1 + x2) / 2 + nx * 12).toFixed(1)}" y="${((y1 + y2) / 2 + ny * 12 + 4).toFixed(1)}" text-anchor="middle" aria-hidden="true">${caminho}</text>`;
    }
    let bolas = '';
    let rotulos = '';
    for (const [nome, [x, y]] of Object.entries(ESFERAS)) {
        const on = marcadas.has(nome);
        bolas += `<g class="av-esfera${on ? ' on' : ''}">${on ? `<circle class="av-anel" cx="${x}" cy="${y}" r="${R + 5}"/>` : ''}<circle class="av-bola" cx="${x}" cy="${y}" r="${R}"/></g>`;
        rotulos += rotulo(nome, on);
    }
    return `<svg class="arvore-svg" viewBox="0 0 240 334" role="img" aria-labelledby="arvore-titulo" focusable="false"><title id="arvore-titulo">${titulo}</title>` +
        `<g aria-hidden="true">${linhas}${lit}${bolas}${numero}${rotulos}</g></svg>`;
}

function grau(degrees) {
    // "20 a 30 graus de Áries" -> "20 a 30 graus"
    return String(degrees ?? '').replace(/\s+de\s+\S+$/, '');
}

/**
 * Monta o bloco "Na Árvore da Vida" de uma carta: o SVG e a legenda em texto.
 * `linkar` é o linkarTermos do glossário, já com o conjunto `usados` da carta.
 * Devolve null se a carta não tem dado para a árvore.
 */
export function blocoArvore(carta, linkar) {
    const L = (t) => linkar(t);
    let destaque = null;
    let titulo = '';
    let legenda = '';

    if (carta.isMajorArcana && carta.path?.number) {
        const { number, from, to } = carta.path;
        const [nomeLetra, glifo] = String(carta.hebrew_letter ?? '').split(/\s*\((.*)\)\s*/);
        destaque = { caminho: number };
        titulo = `Árvore da Vida: caminho ${number}, de ${from} a ${to}`;
        const letra = nomeLetra ? ` · ${L(nomeLetra)}${glifo ? ` <span class="av-glifo" lang="he">${glifo}</span>` : ''}` : '';
        legenda = `Caminho ${number}${letra} · liga ${L(from)} e ${L(to)}`;
    } else if (carta.court_rank && carta.sephirah) {
        destaque = { esfera: carta.sephirah };
        titulo = `Árvore da Vida: esfera ${carta.sephirah}, patente ${carta.court_rank}`;
        const faixa = carta.zodiac_range ? L(`zodíaco de ${carta.zodiac_range}`) : L('quadrantes do céu');
        legenda = `${L(carta.court_rank)} · ${carta.court_element ? L(carta.court_element) + ' · ' : ''}esfera ${L(carta.sephirah)} · ${faixa}`;
    } else if (!carta.isMajorArcana && carta.sephirah) {
        destaque = { esfera: carta.sephirah };
        if (carta.number === 1 || carta.sephirah === 'Kether') {
            titulo = 'Árvore da Vida: esfera Kether, a raiz do naipe';
            legenda = `Raiz em ${L('Kether')}`;
        } else {
            const d = carta.decan;
            titulo = `Árvore da Vida: esfera ${carta.sephirah}`;
            const dec = d ? ` · ${d.number}º ${L('decano')}: ${d.planet} em ${d.sign}, de ${grau(d.degrees)}` : '';
            legenda = `Esfera ${L(carta.sephirah)}${dec}`;
        }
    }
    if (!destaque) return null;
    return `<h4 class="av-titulo">Na Árvore da Vida</h4><figure class="av-figura">${arvoreSvg(destaque, titulo)}<figcaption>${legenda}</figcaption></figure>`;
}
