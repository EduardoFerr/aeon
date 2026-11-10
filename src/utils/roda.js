import { glifoTracos } from './glifos.js';

/**
 * Roda do zodiaco em SVG, desenhada a partir do mapa calculado (calcularMapa).
 * Ascendente a esquerda, sentido anti-horario. Nada depende so de cor: signos e astros levam glifo,
 * aspectos tem tracos diferentes (cheio grosso, tracejado, fino, pontilhado) e o retrogrado leva o glifo R.
 *
 * Na pagina, as cores vem de classes (.r-*) lidas dos tokens do tema (styles/perfil.css).
 * Para os cartoes, `paleta` embute um <style> com cores concretas, porque um SVG usado como imagem
 * nao enxerga o CSS da pagina.
 */
const SIGNOS = [
    ['aries', 'fogo'], ['touro', 'terra'], ['gemeos', 'ar'], ['cancer', 'agua'], ['leao', 'fogo'], ['virgem', 'terra'],
    ['libra', 'ar'], ['escorpiao', 'agua'], ['sagitario', 'fogo'], ['capricornio', 'terra'], ['aquario', 'ar'], ['peixes', 'agua'],
];
const CORPOS = ['sol', 'lua', 'mercurio', 'venus', 'marte', 'jupiter', 'saturno', 'urano', 'netuno', 'plutao', 'nodo_norte'];
const GLIFO_DE = { nodo_norte: 'nodo' };
const CLASSE_ASPECTO = { oposicao: 'r-opos', quadratura: 'r-quad', trigono: 'r-trig', sextil: 'r-sext' };

const rad = (d) => (d * Math.PI) / 180;
const f = (n) => n.toFixed(1);
const C = 300;
const R1 = 284, R2 = 238, R3 = 128, RP = 202, RD = 168;

/** Cores concretas por tema, para o SVG usado como imagem. */
export const PALETA_RODA = {
    crepusculo: {
        el: { fogo: '#e58e7a', terra: '#d4b36a', ar: '#8fc9a9', agua: '#8fb0e8' },
        text: '#f1e9e0', soft: '#b8abb8', mute: '#9c93aa', line: 'rgba(241,233,224,0.3)', surface: '#1e1828', accent: '#e8b7a0', key: '#d9a24a', sombra: '#a99bc4', fam: 'Inter, system-ui, sans-serif',
    },
    aurora: {
        el: { fogo: '#b83a24', terra: '#8a5a00', ar: '#1f6b45', agua: '#2a47a6' },
        text: '#18203a', soft: '#434c63', mute: '#586178', line: '#76806a', surface: '#fbfcf8', accent: '#2a47a6', key: '#b83a24', sombra: '#38397e', fam: '"Hanken Grotesk", system-ui, sans-serif',
    },
};

function estiloExportado(p) {
    const el = (n) => `.r-el-${n}{--el:${p.el[n]}}.r-sg.r-el-${n}{fill:${p.el[n]};fill-opacity:.16}`;
    return `<style>text{font-family:${p.fam}}.gl{fill:none;stroke:currentColor;stroke-linecap:round;stroke-linejoin:round;overflow:visible}
${['fogo', 'terra', 'ar', 'agua'].map(el).join('')}
.r-sg{stroke:none}.r-linha{fill:none;stroke:${p.line};stroke-width:1.4}.r-linha.fina{stroke-width:1}.r-tick{stroke:${p.line};stroke-width:1}
.r-casa{stroke:${p.line};stroke-width:1;stroke-dasharray:3 4}.r-eixo{stroke:${p.soft};stroke-width:1.8}.r-marca{stroke:${p.accent};stroke-width:3;stroke-linecap:round}
.r-eixotxt{fill:${p.accent};font-weight:700;font-size:17px}.r-num{fill:${p.soft};font-size:13px}.r-grau{fill:${p.text};font-size:13px;font-weight:600}
.r-glsg{stroke-width:1.7;color:var(--el);stroke:var(--el)}.r-fundo{fill:${p.surface};stroke:${p.line};stroke-width:1}
.r-glp{color:${p.text};stroke:${p.text};stroke-width:1.6}.r-retro{stroke:${p.accent};stroke-width:2.2}.r-lig{stroke:${p.mute};stroke-width:1}.r-pt{fill:${p.soft}}
.r-asp{fill:none;stroke-linecap:round}.r-opos{stroke:${p.key};stroke-width:2.6}.r-quad{stroke:${p.key};stroke-width:2;stroke-dasharray:9 6}
.r-trig{stroke:${p.sombra};stroke-width:1.8}.r-sext{stroke:${p.sombra};stroke-width:2;stroke-dasharray:1 6}</style>`;
}

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);

function simbolos(id, chaves) {
    return `<defs>${[...new Set(chaves)].map((k) => `<symbol id="${id}-g-${k}" viewBox="0 0 24 24">${glifoTracos(k)}</symbol>`).join('')}</defs>`;
}

/** Descricao falada da roda: o que um leitor de tela precisa para entender o mapa sem ver o desenho. */
export function descricaoRoda(calc, titulos = {}) {
    const p = calc.pontos;
    const pos = (x) => `${x.grauInteiro} graus de ${x.signoNome}`;
    const partes = [];
    if (!calc.semHora) partes.push(`Ascendente a ${pos(p.asc)}`, `Meio do Céu a ${pos(p.mc)}`);
    for (const id of CORPOS) {
        const x = p[id];
        if (!x) continue;
        partes.push(`${x.nome} a ${pos(x)}${x.casa ? `, casa ${x.casa}` : ''}${x.retrogrado ? ', retrógrado' : ''}`);
    }
    const n = calc.aspectos.filter((a) => a.tipo !== 'conjuncao').length;
    return `${titulos.cabeca || 'Roda do zodíaco do mapa'}. ${partes.join('; ')}. ${n} linhas de aspecto ligam os astros. As mesmas posições estão na tabela.`;
}

/**
 * @param {object} calc resultado de calcularMapa
 * @param {{id?:string, titulo?:string, desc?:string, paleta?:object, graus?:boolean, numeros?:boolean, decorativa?:boolean}} o
 */
export function rodaSVG(calc, o = {}) {
    const id = o.id || 'roda';
    const graus = o.graus !== false;
    const semHora = calc.semHora;
    const ascLon = semHora ? 0 : calc.pontos.asc.lon;
    const ang = (lon) => 180 + (lon - ascLon);
    const P = (lon, r) => [C + r * Math.cos(rad(ang(lon))), C - r * Math.sin(rad(ang(lon)))];
    const arc = (l1, l2, r1, r2) => {
        const a = P(l1, r2), b = P(l2, r2), c = P(l2, r1), d = P(l1, r1);
        return `M${f(a[0])} ${f(a[1])}A${r2} ${r2} 0 0 0 ${f(b[0])} ${f(b[1])}L${f(c[0])} ${f(c[1])}A${r1} ${r1} 0 0 1 ${f(d[0])} ${f(d[1])}Z`;
    };
    const corpos = CORPOS.filter((k) => calc.pontos[k]).map((k) => ({ k, g: GLIFO_DE[k] || k, p: calc.pontos[k] }));
    const usados = [...SIGNOS.map((s) => s[0]), ...corpos.map((c) => c.g), 'retro'];
    const cusp = calc.casas ? calc.casas.cuspides.map((c) => c.lon) : null;

    const aria = o.decorativa ? 'aria-hidden="true" focusable="false"' : `role="img" aria-labelledby="${id}-t ${id}-d"`;
    let s = `<svg class="roda" viewBox="-44 -44 688 688" ${aria} xmlns="http://www.w3.org/2000/svg">`;
    if (!o.decorativa) s += `<title id="${id}-t">${esc(o.titulo || 'Roda do zodíaco do mapa')}</title><desc id="${id}-d">${esc(o.desc || descricaoRoda(calc))}</desc>`;
    if (o.paleta) s += estiloExportado(o.paleta);
    s += simbolos(id, usados);
    SIGNOS.forEach(([, el], i) => { s += `<path class="r-sg r-el-${el}" d="${arc(i * 30, i * 30 + 30, R2, R1)}"/>`; });
    s += `<circle class="r-linha" cx="300" cy="300" r="${R1}"/><circle class="r-linha" cx="300" cy="300" r="${R2}"/><circle class="r-linha fina" cx="300" cy="300" r="${R3}"/>`;
    for (let i = 0; i < 12; i++) {
        const a = P(i * 30, R1), b = P(i * 30, R2);
        s += `<line class="r-linha" x1="${f(a[0])}" y1="${f(a[1])}" x2="${f(b[0])}" y2="${f(b[1])}"/>`;
    }
    for (let g = 0; g < 360; g += 5) {
        if (g % 30 === 0) continue;
        const a = P(g, R2), b = P(g, R2 - (g % 10 === 0 ? 9 : 5));
        s += `<line class="r-tick" x1="${f(a[0])}" y1="${f(a[1])}" x2="${f(b[0])}" y2="${f(b[1])}"/>`;
    }
    SIGNOS.forEach(([k, el], i) => {
        const p = P(i * 30 + 15, (R1 + R2) / 2);
        s += `<use href="#${id}-g-${k}" class="gl r-glsg r-el-${el}" x="${f(p[0] - 15)}" y="${f(p[1] - 15)}" width="30" height="30"/>`;
    });
    if (cusp) {
        cusp.forEach((c, i) => {
            const eixo = i % 3 === 0;
            const a = P(c, R2), b = P(c, R3);
            s += `<line class="${eixo ? 'r-eixo' : 'r-casa'}" x1="${f(a[0])}" y1="${f(a[1])}" x2="${f(b[0])}" y2="${f(b[1])}"/>`;
        });
        if (o.numeros !== false) {
            cusp.forEach((c, i) => {
                const n = cusp[(i + 1) % 12];
                const m = c + ((((n - c) % 360) + 360) % 360) / 2;
                const p = P(m, R3 + 14);
                s += `<text class="r-num" x="${f(p[0])}" y="${f(p[1])}" text-anchor="middle" dominant-baseline="central">${i + 1}</text>`;
            });
        }
    }
    // aspectos: linhas entre os pontos (a conjuncao nao leva linha, os astros ficam lado a lado)
    const lonDe = (k) => (calc.pontos[k] ? calc.pontos[k].lon : null);
    calc.aspectos.forEach((x) => {
        const cl = CLASSE_ASPECTO[x.tipo];
        const la = lonDe(x.a), lb = lonDe(x.b);
        if (!cl || la == null || lb == null) return;
        const a = P(la, R3 - 2), b = P(lb, R3 - 2);
        s += `<line class="r-asp ${cl}" x1="${f(a[0])}" y1="${f(a[1])}" x2="${f(b[0])}" y2="${f(b[1])}"/>`;
    });
    corpos.forEach((c) => { const p = P(c.p.lon, R3 - 2); s += `<circle class="r-pt" cx="${f(p[0])}" cy="${f(p[1])}" r="2.6"/>`; });
    // corpos: afasta os que ficam perto demais
    const L = corpos.map((c) => ({ c, a: c.p.lon })).sort((x, y) => x.a - y.a);
    for (let it = 0; it < 40; it++) {
        for (let i = 0; i < L.length; i++) {
            const j = (i + 1) % L.length;
            let d = L[j].a - L[i].a;
            if (d < 0) d += 360;
            if (d < 11 && L.length > 1) { const k = (11 - d) / 2 + 0.01; L[i].a -= k; L[j].a += k; }
        }
    }
    L.forEach(({ c, a }) => {
        const retro = c.p.retrogrado === true;
        const p = P(a, RP), t = P(c.p.lon, R2 - 1), e = P(c.p.lon, R2);
        s += `<line class="r-lig" x1="${f(e[0])}" y1="${f(e[1])}" x2="${f(t[0])}" y2="${f(t[1])}"/>`;
        s += `<circle class="r-fundo" cx="${f(p[0])}" cy="${f(p[1])}" r="17"/><use href="#${id}-g-${c.g}" class="gl r-glp" x="${f(p[0] - 14)}" y="${f(p[1] - 14)}" width="28" height="28"/>`;
        if (retro) { const q = P(a, RP - 25); s += `<use href="#${id}-g-retro" class="gl r-retro" x="${f(q[0] - 6)}" y="${f(q[1] - 6)}" width="12" height="12"/>`; }
        if (graus) { const q = P(a, RD - 4 + (retro ? -6 : 0)); s += `<text class="r-grau" x="${f(q[0])}" y="${f(q[1])}" text-anchor="middle" dominant-baseline="central">${c.p.grauInteiro}°</text>`; }
    });
    if (!semHora) {
        [['AC', calc.pontos.asc.lon], ['MC', calc.pontos.mc.lon]].forEach(([t, lon]) => {
            const a = P(lon, R1 + 2), b = P(lon, R1 + 22), tx = P(lon, R1 + 32);
            s += `<line class="r-marca" x1="${f(a[0])}" y1="${f(a[1])}" x2="${f(b[0])}" y2="${f(b[1])}"/>`;
            s += `<text class="r-eixotxt" x="${f(tx[0])}" y="${f(tx[1])}" text-anchor="middle" dominant-baseline="central">${t}</text>`;
        });
    }
    return `${s}</svg>`;
}

/** Roda sem astros (Home): so os doze signos, decorativa. */
export function rodaVazia() {
    let s = '<svg class="roda" viewBox="-44 -44 688 688" aria-hidden="true" focusable="false" xmlns="http://www.w3.org/2000/svg">';
    SIGNOS.forEach(([, el], i) => {
        const a1 = rad(180 + i * 30), a2 = rad(180 + i * 30 + 30);
        const pt = (a, r) => `${f(C + r * Math.cos(a))} ${f(C - r * Math.sin(a))}`;
        s += `<path class="r-sg r-el-${el}" d="M${pt(a1, R1)}A${R1} ${R1} 0 0 0 ${pt(a2, R1)}L${pt(a2, R2)}A${R2} ${R2} 0 0 1 ${pt(a1, R2)}Z"/>`;
    });
    s += `<circle class="r-linha" cx="300" cy="300" r="${R1}"/><circle class="r-linha" cx="300" cy="300" r="${R2}"/><circle class="r-linha fina" cx="300" cy="300" r="${R3}"/>`;
    for (let i = 0; i < 12; i++) {
        const a = rad(180 + i * 30);
        s += `<line class="r-linha" x1="${f(C + R1 * Math.cos(a))}" y1="${f(C - R1 * Math.sin(a))}" x2="${f(C + R2 * Math.cos(a))}" y2="${f(C - R2 * Math.sin(a))}"/>`;
    }
    return `${s}</svg>`;
}
