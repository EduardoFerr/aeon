import {
    W, H, PAL, temaAtual, carregarImagem, esperarFontes, padraoGrao, quebrar as quebrarLinhas, espacar, centro,
    fundoCrepusculo, fundoAurora, moldura, logo, paraBlob, baixarCartao,
} from './cartao.js';
import { SVG_METADE_ESQ, SVG_METADE_DIR, CORES_BISCOITO, svgComCores } from './biscoitoArte.js';
import { textoParaCompartilhar } from './biscoito.js';

/**
 * Cartao do biscoito (1080x1920, formato stories), gerado em Canvas so quando a pessoa pede.
 * Carregado por import dinamico a partir da tela do biscoito. Reaproveita o fundo, a moldura e a marca de cartao.js.
 */
const TEXTO = {
    titulo: 'Seu biscoito em imagem',
    eyebrow: 'BISCOITO DA SORTE',
    rotulo: 'SEUS NÚMEROS DA SORTE',
    site: 'AEONFOOL.COM',
    baixar: 'Baixar',
    compartilhar: 'Compartilhar',
    fechar: 'Fechar',
    fazendo: 'Preparando a imagem…',
    salvo: 'Imagem salva no seu aparelho.',
    semCompartilhar: 'Este aparelho não compartilha imagens direto, então a imagem foi baixada.',
    falhou: 'Não foi possível montar a imagem agora.',
    previa: (frase) => `Prévia da imagem do biscoito: ${frase}`,
};

/** Medidas do cartao. Zona segura: nada importante acima de y = 300 nem abaixo de y = 1560 (barras dos stories). */
export const MEDIDAS = {
    zonaTopo: 300,
    zonaBase: 1560,
    tirinhaX: 90,
    tirinhaW: 900,
    tirinhaTopo: 690,
    tirinhaMax: 1500, // a base da tirinha fica aqui no maximo (sobra espaco para a nota abaixo, ainda na zona segura)
    larguraFrase: 740,
    padTopo: 80,
    padBase: 70,
    divisor: 34,
    rotulo: 56,
    fichasTopo: 28,
    ficha: 112,
    fichaGap: 20,
    tamanhos: [68, 64, 60, 56, 52],
};
const ALTURA_FIXA = MEDIDAS.padTopo + MEDIDAS.divisor + MEDIDAS.rotulo + MEDIDAS.fichasTopo + MEDIDAS.ficha + MEDIDAS.padBase;

/**
 * Escolhe o corpo da frase: o maior tamanho (68 a 52 px, de 4 em 4) com no maximo 6 linhas e a tirinha dentro da zona segura.
 * `ctx` so precisa de `font` e `measureText`; `fonteDe(px)` devolve a string de fonte.
 * @returns {{px:number, linhas:string[], lh:number, altura:number}} altura = altura total da tirinha
 */
export function layoutFrase(ctx, texto, fonteDe) {
    const { tamanhos, larguraFrase, tirinhaTopo, tirinhaMax } = MEDIDAS;
    let ultimo = null;
    for (const px of tamanhos) {
        ctx.font = fonteDe(px);
        const linhas = quebrarLinhas(ctx, texto, larguraFrase);
        const lh = Math.round(px * 1.28);
        const altura = ALTURA_FIXA + linhas.length * lh;
        ultimo = { px, linhas, lh, altura };
        if (linhas.length <= 6 && tirinhaTopo + altura <= tirinhaMax) return ultimo;
    }
    return ultimo;
}

const urlSvg = (svg) => `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;

function tirinhaPath(ctx, x, y, w, h) {
    const v = 40;
    ctx.beginPath();
    ctx.moveTo(x, y); ctx.lineTo(x + w, y); ctx.lineTo(x + w - v, y + h / 2); ctx.lineTo(x + w, y + h);
    ctx.lineTo(x, y + h); ctx.lineTo(x + v, y + h / 2); ctx.closePath();
}

/**
 * Monta o cartao do biscoito.
 * @param {{item: {id:number, texto:string, numeros:number[]}, tema?: 'crepusculo'|'aurora'}} dados
 * @returns {Promise<HTMLCanvasElement>}
 */
export async function gerarCartaoBiscoito({ item, tema }) {
    const th = tema || temaAtual();
    const P = PAL[th];
    const C = CORES_BISCOITO[th];
    const aurora = th === 'aurora';
    await esperarFontes(P);
    const [metadeE, metadeD] = await Promise.all([
        carregarImagem(urlSvg(svgComCores(SVG_METADE_ESQ, th, 134, 170))),
        carregarImagem(urlSvg(svgComCores(SVG_METADE_DIR, th, 134, 170))),
    ]);

    const cv = document.createElement('canvas');
    cv.width = W; cv.height = H;
    const ctx = cv.getContext('2d');
    const grao = padraoGrao(ctx);
    const M = MEDIDAS;
    const fonteFrase = (px) => `${P.wd} ${px}px ${P.fd}`;
    const L = layoutFrase(ctx, item.texto, fonteFrase);

    // ---- fundo, moldura e marca
    if (aurora) fundoAurora(ctx, P, grao); else fundoCrepusculo(ctx);
    if (!aurora) { ctx.globalAlpha = 0.06; ctx.globalCompositeOperation = 'overlay'; ctx.fillStyle = grao; ctx.fillRect(0, 0, W, H); ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over'; }
    moldura(ctx, aurora);
    logo(ctx, P, W / 2, 128, 280);
    ctx.fillStyle = P.accent; ctx.font = `600 28px ${P.fu}`; espacar(ctx, 7); centro(ctx, TEXTO.eyebrow, 262); espacar(ctx, 0);

    // ---- tirinha (por baixo das metades, como na tela)
    const x = M.tirinhaX, y = M.tirinhaTopo, w = M.tirinhaW, h = L.altura;
    ctx.save();
    ctx.shadowColor = aurora ? 'rgba(24,32,58,.28)' : 'rgba(0,0,0,.45)'; ctx.shadowBlur = 40; ctx.shadowOffsetY = 18;
    tirinhaPath(ctx, x, y, w, h);
    ctx.fillStyle = C.papel; ctx.fill();
    ctx.restore();
    if (aurora) { tirinhaPath(ctx, x, y, w, h); ctx.strokeStyle = 'rgba(24,32,58,.45)'; ctx.lineWidth = 2; ctx.stroke(); }
    ctx.save();
    ctx.strokeStyle = C.tinta; ctx.globalAlpha = 0.28; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(x + 70, y + 30); ctx.lineTo(x + w - 70, y + 30); ctx.moveTo(x + 70, y + h - 30); ctx.lineTo(x + w - 70, y + h - 30); ctx.stroke();
    ctx.restore();

    // frase
    ctx.fillStyle = C.tinta; ctx.font = fonteFrase(L.px); ctx.textAlign = 'center';
    let ty = y + M.padTopo + L.px * 0.82;
    L.linhas.forEach((l) => { centro(ctx, l, ty); ty += L.lh; });
    const fimFrase = y + M.padTopo + L.linhas.length * L.lh;

    // divisor curto
    const dy = fimFrase + M.divisor;
    ctx.save();
    ctx.strokeStyle = C.tinta; ctx.globalAlpha = 0.4; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(W / 2 - 150, dy); ctx.lineTo(W / 2 - 30, dy); ctx.moveTo(W / 2 + 30, dy); ctx.lineTo(W / 2 + 150, dy);
    ctx.moveTo(W / 2, dy - 12); ctx.lineTo(W / 2, dy + 12); ctx.moveTo(W / 2 - 12, dy); ctx.lineTo(W / 2 + 12, dy); ctx.stroke();
    ctx.restore();

    // rotulo e fichas
    const ry = dy + M.rotulo; // baseline do rotulo
    ctx.fillStyle = C.tinta; ctx.globalAlpha = 0.75; ctx.font = `600 24px ${P.fu}`; espacar(ctx, 5); centro(ctx, TEXTO.rotulo, ry); espacar(ctx, 0); ctx.globalAlpha = 1;
    const total = 6 * M.ficha + 5 * M.fichaGap;
    const fy = ry + M.fichasTopo + M.ficha / 2;
    item.numeros.forEach((n, i) => {
        const cx = (W - total) / 2 + M.ficha / 2 + i * (M.ficha + M.fichaGap);
        ctx.beginPath(); ctx.arc(cx, fy, M.ficha / 2, 0, Math.PI * 2);
        ctx.fillStyle = C.ficha; ctx.fill();
        ctx.strokeStyle = C['ficha-borda']; ctx.lineWidth = 2; ctx.stroke();
        ctx.fillStyle = C['ficha-tinta']; ctx.font = `600 44px ${P.fu}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText(String(n).padStart(2, '0'), cx, fy + 2);
        ctx.textBaseline = 'alphabetic';
    });

    // ---- metades do biscoito, por cima da tirinha, afastadas como na tela (escala 2,2)
    const esc = 2.2, mw = 134 * esc, mh = 170 * esc;
    const x0 = W / 2 - (240 * esc) / 2, topo = 340;
    const metade = (img, mx, pivoX, dx, graus) => {
        ctx.save();
        const px = mx + pivoX * mw, py = topo + 0.9 * mh;
        ctx.translate(px, py); ctx.translate(dx, 10); ctx.rotate((graus * Math.PI) / 180); ctx.translate(-px, -py);
        ctx.drawImage(img, mx, topo, mw, mh);
        ctx.restore();
    };
    metade(metadeE, x0, 0.1, -30, -10);
    metade(metadeD, x0 + 106 * esc, 0.9, 30, 10);

    // ---- nota e rodape
    ctx.textAlign = 'center';
    espacar(ctx, 7); centro(ctx, TEXTO.site, H - 150); espacar(ctx, 0);
    return cv;
}

/** Compartilha a imagem com a Web Share API (arquivo); sem suporte, baixa. 'compartilhado' | 'cancelado' | 'baixado' | 'erro'. */
export async function compartilharCartaoBiscoito(cv, data, item) {
    const blob = await paraBlob(cv);
    if (!blob) return 'erro';
    const arquivo = new File([blob], `aeon-biscoito-${data}.jpg`, { type: 'image/jpeg' });
    try {
        if (navigator.canShare && navigator.canShare({ files: [arquivo] })) {
            await navigator.share({ files: [arquivo], title: 'Aeon Fool', text: textoParaCompartilhar(item) });
            return 'compartilhado';
        }
    } catch (e) {
        if (e && e.name === 'AbortError') return 'cancelado';
    }
    return (await baixarCartao(cv, data, 'aeon-biscoito')) ? 'baixado' : 'erro';
}

let dialogo = null;
let ultimo = null;

function montar() {
    dialogo = document.createElement('dialog');
    dialogo.className = 'sheet cartao-sheet';
    dialogo.setAttribute('aria-labelledby', 'cartao-biscoito-titulo');
    dialogo.innerHTML = `
        <div class="sheet-head">
            <h2 id="cartao-biscoito-titulo">${TEXTO.titulo}</h2>
            <button class="iconbtn round" type="button" data-f aria-label="${TEXTO.fechar}"><svg class="icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg></button>
        </div>
        <div class="cartao-previa" data-previa></div>
        <div class="btn-row cartao-acoes">
            <button class="btn btn-primary" type="button" data-baixar>${TEXTO.baixar}</button>
            <button class="btn btn-ghost" type="button" data-compartilhar>${TEXTO.compartilhar}</button>
        </div>
        <p class="cartao-msg" role="status" aria-live="polite" data-msg></p>`;
    document.body.appendChild(dialogo);
    const msg = (t) => { dialogo.querySelector('[data-msg]').textContent = t; };
    dialogo.querySelector('[data-f]').addEventListener('click', () => dialogo.close());
    dialogo.addEventListener('click', (e) => { if (e.target === dialogo) dialogo.close(); });
    dialogo.addEventListener('keydown', (e) => { if (e.key === 'Escape') e.stopPropagation(); });
    dialogo.querySelector('[data-baixar]').addEventListener('click', async () => {
        if (!ultimo) return;
        msg((await baixarCartao(ultimo.cv, ultimo.dados.data, 'aeon-biscoito')) ? TEXTO.salvo : TEXTO.falhou);
    });
    dialogo.querySelector('[data-compartilhar]').addEventListener('click', async () => {
        if (!ultimo) return;
        const r = await compartilharCartaoBiscoito(ultimo.cv, ultimo.dados.data, ultimo.dados.item);
        msg(r === 'baixado' ? TEXTO.semCompartilhar : r === 'erro' ? TEXTO.falhou : '');
    });
    // trocou o tema com o cartao aberto: refaz no tema novo
    document.addEventListener('aeon:tema', () => { if (dialogo.open && ultimo) desenhar(ultimo.dados); });
}

async function desenhar(dados) {
    const previa = dialogo.querySelector('[data-previa]');
    const msg = dialogo.querySelector('[data-msg]');
    msg.textContent = TEXTO.fazendo;
    const pedido = (desenhar.n = (desenhar.n || 0) + 1);
    try {
        const cv = await gerarCartaoBiscoito({ item: dados.item });
        if (pedido !== desenhar.n) return; // chegou um pedido mais novo
        cv.setAttribute('role', 'img');
        cv.setAttribute('aria-label', TEXTO.previa(dados.item.texto));
        previa.replaceChildren(cv);
        ultimo = { cv, dados };
        msg.textContent = '';
        dialogo.dataset.pronto = 'true';
    } catch (e) {
        msg.textContent = TEXTO.falhou;
    }
}

/** Abre a previa do cartao com Baixar e Compartilhar. dados: { item, data } */
export function abrirCartaoBiscoito(dados) {
    if (!dialogo) montar();
    dialogo.dataset.pronto = 'false';
    dialogo.querySelector('[data-previa]').replaceChildren();
    ultimo = null;
    if (!dialogo.open) dialogo.showModal();
    return desenhar(dados);
}
