/**
 * Cartoes do mapa astral (1080x1920, PNG), gerados em Canvas so quando a pessoa pede.
 * Dois modelos, como no prototipo aprovado: o cartao do MAPA (roda e as tres cartas de visita) e o cartao
 * da SECAO (Sol, Lua ou Ascendente: glifo, fatos, carta do decano e uma frase da carta).
 *
 * Privacidade: sem `dados` (padrao) o cartao nao leva data, hora, local nem apelido. So com a caixa marcada
 * a tela passa `nome` e `dados`.
 * Reaproveita o desenho de src/utils/cartao.js (fundo, moldura, marca, passe-partout e graos).
 */
import {
    W, H, PAL, temaAtual, carregarImagem, esperarFontes, padraoGrao, quebrar, espacar, centro,
    fundoCrepusculo, fundoAurora, moldura, logo, divisor, desenharCarta,
} from './cartao.js';
import { rodaSVG, PALETA_RODA } from './roda.js';
import { glifoTracos } from './glifos.js';

const imgCarta = (order) => `assets/cards/crowley-${String(order).padStart(2, '0')}.jpg`;
const PAPEL = { sol: 'SOL', lua: 'LUA', asc: 'ASCENDENTE' };

/** SVG (texto) -> imagem, para desenhar a roda e os glifos no canvas. */
function svgParaImagem(svg, w, h) {
    const comTamanho = svg.replace('<svg ', `<svg width="${w}" height="${h}" `);
    const url = URL.createObjectURL(new Blob([comTamanho], { type: 'image/svg+xml;charset=utf-8' }));
    return carregarImagem(url).finally(() => setTimeout(() => URL.revokeObjectURL(url), 2000));
}

const svgGlifo = (k, cor, traco = 1.3) =>
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="${cor}" stroke-width="${traco}" stroke-linecap="round" stroke-linejoin="round" style="overflow:visible">${glifoTracos(k)}</svg>`;

function base(th) {
    const cv = document.createElement('canvas');
    cv.width = W;
    cv.height = H;
    const ctx = cv.getContext('2d');
    const P = PAL[th];
    const aurora = th === 'aurora';
    const grao = padraoGrao(ctx);
    if (aurora) fundoAurora(ctx, P, grao);
    else {
        fundoCrepusculo(ctx);
        ctx.globalAlpha = 0.06; ctx.globalCompositeOperation = 'overlay'; ctx.fillStyle = grao; ctx.fillRect(0, 0, W, H);
        ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
    }
    moldura(ctx, aurora);
    logo(ctx, P, W / 2, 128, 280);
    return { cv, ctx, P, aurora, grao };
}

const rodape = (ctx, P) => {
    ctx.fillStyle = P.mute; ctx.font = `500 26px ${P.fu}`; espacar(ctx, 7); centro(ctx, 'AEONFOOL.COM', H - 150); espacar(ctx, 0);
};
const eyebrow = (ctx, P, txt, y = 262) => {
    ctx.fillStyle = P.accent; ctx.font = `600 28px ${P.fu}`; espacar(ctx, 7); centro(ctx, txt, y); espacar(ctx, 0);
};
const reduzir = (ctx, texto, larg, px, min, fonte) => {
    let t = px;
    ctx.font = fonte(t);
    while (ctx.measureText(texto).width > larg && t > min) { t -= 2; ctx.font = fonte(t); }
    return t;
};

/**
 * Cartao do mapa.
 * @param {{calc:object, tema?:string, nome?:string, dados?:string}} o nome e dados so quando a pessoa marcou a caixa.
 */
export async function gerarCartaoMapa({ calc, tema, nome, dados }) {
    const th = tema || temaAtual();
    const { cv, ctx, P, aurora, grao } = (await esperarFontes(PAL[th]), base(th));
    const pal = PALETA_RODA[th];
    const papeis = [['sol', calc.pontos.sol], ['lua', calc.pontos.lua], ['asc', calc.semHora ? null : calc.pontos.asc]];
    const imgs = await Promise.all(papeis.map(([, p]) => (p && p.ponte && p.ponte.cartaDecano ? carregarImagem(imgCarta(p.ponte.cartaDecano.order)) : null)));
    const roda = await svgParaImagem(rodaSVG(calc, { id: 'rc', graus: false, numeros: false, decorativa: true, paleta: pal }), 690, 690);

    eyebrow(ctx, P, nome ? `MAPA DE ${nome.toUpperCase()}` : 'MAPA ASTRAL');
    divisor(ctx, P, aurora, 297);
    ctx.drawImage(roda, (W - 690) / 2, 330, 690, 690);

    const cw = 230, mat = 14, ch = Math.round((cw * 410) / 274), top = 1105 + mat;
    const centros = [244, 540, 836];
    for (let i = 0; i < 3; i++) {
        const [papel, p] = papeis[i];
        const cx = centros[i];
        ctx.fillStyle = P.accent; ctx.font = `600 26px ${P.fu}`; espacar(ctx, 5); centro2(ctx, PAPEL[papel], cx, 1080); espacar(ctx, 0);
        if (p && imgs[i]) {
            desenharCarta(ctx, aurora, imgs[i], cx - cw / 2, top, cw, ch, grao, mat);
            const gl = await svgParaImagem(svgGlifo(p.signo, pal.el[elemento(p.signo)], 1.6), 40, 40);
            ctx.font = `${P.wd} 46px ${P.fd}`;
            const larg = ctx.measureText(p.signoNome).width + 52;
            ctx.drawImage(gl, cx - larg / 2, 1496, 40, 40);
            ctx.fillStyle = P.ink; ctx.textAlign = 'left'; ctx.fillText(p.signoNome, cx - larg / 2 + 52, 1532);
            ctx.fillStyle = P.soft; ctx.font = `400 28px ${P.fu}`; centro2(ctx, `${p.grauInteiro}°${String(p.minuto).padStart(2, '0')}′`, cx, 1578);
            ctx.font = `400 26px ${P.fu}`;
            const linhas = quebrar(ctx, `${p.ponte.cartaDecano.nome}, ${p.decano}º decano`, 270);
            linhas.slice(0, 3).forEach((l, k) => centro2(ctx, l, cx, 1618 + k * 34));
        } else {
            ctx.save();
            ctx.strokeStyle = P.mute; ctx.lineWidth = 2; ctx.setLineDash([10, 8]);
            if (ctx.roundRect) { ctx.beginPath(); ctx.roundRect(cx - cw / 2 - mat, top - mat, cw + mat * 2, ch + mat * 2, aurora ? 4 : 22); ctx.stroke(); }
            ctx.restore();
            ctx.fillStyle = P.soft; ctx.font = `400 26px ${P.fu}`;
            quebrar(ctx, 'Sem a hora, sem Ascendente', 200).forEach((l, k) => centro2(ctx, l, cx, top + ch / 2 - 14 + k * 34));
        }
    }
    if (dados) { ctx.fillStyle = P.soft; ctx.font = `500 28px ${P.fu}`; espacar(ctx, 1); centro(ctx, dados, 1712); espacar(ctx, 0); }
    rodape(ctx, P);
    return cv;
}

const ELEMENTO = { aries: 'fogo', leao: 'fogo', sagitario: 'fogo', touro: 'terra', virgem: 'terra', capricornio: 'terra', gemeos: 'ar', libra: 'ar', aquario: 'ar', cancer: 'agua', escorpiao: 'agua', peixes: 'agua' };
const elemento = (s) => ELEMENTO[s];
function centro2(ctx, txt, x, y) { ctx.textAlign = 'center'; ctx.fillText(txt, x, y); }

/** Primeira(s) frase(s) de um texto, ate `max` caracteres, para a citacao do cartao. */
export function citacao(texto, max = 150) {
    const t = String(texto || '').replace(/\s+/g, ' ').trim();
    if (!t) return '';
    const frases = t.match(/[^.!?]+[.!?]+/g) || [t];
    let r = frases[0].trim();
    if (frases[1] && (r + ' ' + frases[1].trim()).length <= max) r += ' ' + frases[1].trim();
    if (r.length > max) r = r.slice(0, max - 1).replace(/\s+\S*$/, '') + '…';
    return r;
}

/**
 * Cartao da secao (Sol, Lua ou Ascendente).
 * @param {{secao:object, frase?:string, tema?:string}} o secao.ponto traz glifo, fatos e carta do decano.
 */
export async function gerarCartaoSecao({ secao, frase, tema, nome, dados }) {
    const th = tema || temaAtual();
    const { cv, ctx, P, aurora, grao } = (await esperarFontes(PAL[th]), base(th));
    const pal = PALETA_RODA[th];
    const p = secao.ponto;
    const img = await carregarImagem(imgCarta(p.cartaDecano.order));
    const gl = await svgParaImagem(svgGlifo(secao.glifo, pal.accent, 1.1), 100, 100);

    eyebrow(ctx, P, nome ? `LEITURA DE ${nome.toUpperCase()}` : 'LEITURA DO MAPA');
    const tf = (px) => `${P.wd} ${px}px ${P.fd}`;
    const tpx = reduzir(ctx, secao.titulo, 860, 92, 56, tf);
    ctx.fillStyle = P.ink; centro2(ctx, secao.titulo, W / 2, 355);
    ctx.drawImage(gl, W / 2 - 50, 422, 100, 100);

    const chips = [p.grau, ...(p.casa ? [`Casa ${p.casa}`] : []), `${p.decano}º decano`];
    ctx.font = `400 30px ${P.fu}`;
    const larg = chips.map((c) => ctx.measureText(c).width + 48);
    let x = (W - (larg.reduce((a, b) => a + b, 0) + 14 * (chips.length - 1))) / 2;
    chips.forEach((c, i) => {
        ctx.strokeStyle = P.mute; ctx.lineWidth = 1.5; ctx.beginPath();
        if (ctx.roundRect) ctx.roundRect(x, 551, larg[i], 66, aurora ? 4 : 33); else ctx.rect(x, 551, larg[i], 66);
        ctx.stroke(); ctx.fillStyle = P.soft; ctx.textAlign = 'center'; ctx.fillText(c, x + larg[i] / 2, 594); x += larg[i] + 14;
    });

    const cw = 406, mat = 20, ch = Math.round((cw * 410) / 274);
    desenharCarta(ctx, aurora, img, (W - cw) / 2, 685, cw, ch, grao, mat);
    const yn = 685 + ch + mat + 90;
    reduzir(ctx, p.cartaDecano.nome, 860, 76, 52, tf);
    ctx.fillStyle = P.ink; centro2(ctx, p.cartaDecano.nome, W / 2, yn);
    ctx.fillStyle = P.accent; ctx.font = `600 28px ${P.fu}`; espacar(ctx, 5); centro(ctx, `CARTA DO ${p.decano}º DECANO`, yn + 56); espacar(ctx, 0);
    if (frase) {
        let linhas = [];
        let px = 48;
        for (const t of [48, 44, 40, 36]) {
            px = t; ctx.font = `italic ${aurora ? 400 : 500} ${t}px ${P.fd}`;
            linhas = quebrar(ctx, `“${frase}”`, 780);
            if (linhas.length <= 3) break;
        }
        ctx.fillStyle = P.ink;
        linhas.slice(0, 3).forEach((l, i) => centro2(ctx, l, W / 2, yn + 140 + i * Math.round(px * 1.3)));
    }
    if (dados) { ctx.fillStyle = P.soft; ctx.font = `500 28px ${P.fu}`; espacar(ctx, 1); centro(ctx, dados, 1712); espacar(ctx, 0); }
    rodape(ctx, P);
    return cv;
}

/** Baixa o canvas como PNG. Devolve false se o navegador nao entregou a imagem. */
export async function baixarPNG(cv, nome) {
    const blob = await new Promise((r) => cv.toBlob(r, 'image/png'));
    if (!blob) return false;
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = nome;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 800);
    return true;
}
