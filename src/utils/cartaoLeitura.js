/**
 * Cartao da leitura de 3 cartas (1080x1920, formato stories), gerado em Canvas so quando a pessoa pede.
 * Carregado por import dinamico a partir da tela de leitura. Reaproveita o desenho do cartao da carta do
 * dia (fundo, moldura, marca, passe-partout e graos que disfarcam a baixa resolucao das imagens, 274x410).
 * Aqui as cartas ficam em 253x379, abaixo do tamanho original: nao ha ampliacao, so reducao.
 */
import {
    W, H, PAL, temaAtual, carregarImagem, esperarFontes, padraoGrao, quebrar, espacar, centro,
    fundoCrepusculo, fundoAurora, moldura, logo, divisor, desenharCarta, paraBlob, baixarCartao,
} from './cartao.js';

const ROTULOS = ['Passado', 'Presente', 'Futuro'];

const TEXTO = {
    titulo: 'Seu cartão da leitura',
    eyebrow: 'SUA LEITURA DE 3 CARTAS',
    site: 'AEONFOOL.COM',
    baixar: 'Baixar',
    compartilhar: 'Compartilhar',
    fechar: 'Fechar',
    fazendo: 'Preparando o cartão…',
    salvo: 'Cartão salvo no seu aparelho.',
    semCompartilhar: 'Este aparelho não compartilha imagens direto, então o cartão foi baixado.',
    falhou: 'Não foi possível montar o cartão agora.',
    previa: (cartas) => `Prévia do cartão da leitura: ${cartas.map((c, i) => `${ROTULOS[i]}, ${c.name}`).join('; ')}.`,
    textoCompartilhar: (cartas) => `Minha leitura no Aeon Fool: ${cartas.map((c, i) => `${ROTULOS[i]}, ${c.name}`).join('; ')}. aeonfool.com`,
};

/** Quebra o texto em ate `max` linhas; se passar, a ultima termina em reticencias (e no fecho, se houver). */
function limitar(ctx, texto, largura, max, fecho = '') {
    let linhas = quebrar(ctx, texto, largura);
    if (linhas.length <= max) return linhas;
    linhas = linhas.slice(0, max - 1).concat(linhas.slice(max - 1).join(' '));
    let ultima = linhas[max - 1].replace(new RegExp(`[${fecho}\\s]+$`), '');
    while (ultima.length > 1 && ctx.measureText(`${ultima}…${fecho}`).width > largura) ultima = ultima.slice(0, -1).trimEnd();
    linhas[max - 1] = `${ultima}…${fecho}`;
    return linhas;
}

/** Menor tamanho que serve: tenta cada tamanho da lista ate o texto caber em `max` linhas dentro da largura. */
function ajustar(ctx, texto, largura, tamanhos, max, fonte) {
    let px = tamanhos[0];
    let linhas = [];
    for (const t of tamanhos) {
        px = t;
        ctx.font = fonte(px);
        linhas = quebrar(ctx, texto, largura);
        if (linhas.length <= max && linhas.every((l) => ctx.measureText(l).width <= largura)) break;
    }
    return { px, linhas: limitar(ctx, texto, largura, max) };
}

/**
 * Desenha o cartao. Medida primeiro, desenho depois: pergunta, nomes e titulos ocupam o que precisam
 * e o bloco das cartas fica centrado no espaco que sobra.
 * @param {{cartas: Array<{order: string|number, name: string, title?: string}>, pergunta?: string, tema?: string}} dados
 * @returns {Promise<HTMLCanvasElement>}
 */
export async function gerarCartaoLeitura({ cartas, pergunta, tema }) {
    const th = tema || temaAtual();
    const P = PAL[th];
    const aurora = th === 'aurora';
    await esperarFontes(P);
    const imgs = await Promise.all(cartas.map((c) => carregarImagem(`assets/cards/crowley-${c.order}.jpg`)));

    const cv = document.createElement('canvas');
    cv.width = W;
    cv.height = H;
    const ctx = cv.getContext('2d');
    const grao = padraoGrao(ctx);

    // ---- geometria: tres cartas lado a lado
    const X0 = 90;
    const GAP = 28;
    const mat = 14;
    const slotW = (W - 2 * X0 - 2 * GAP) / 3;
    const cw = Math.floor(slotW - 2 * mat);
    const ch = Math.round((cw * 410) / 274);
    const texW = Math.floor(slotW - 8);

    // ---- medidas do texto
    const qFonte = (px) => `italic ${aurora ? 400 : 500} ${px}px ${P.fd}`;
    const citada = pergunta ? `“${pergunta}”` : '';
    let qPx = 52;
    let qLinhas = [];
    if (citada) {
        ({ px: qPx, linhas: qLinhas } = ajustar(ctx, citada, 860, [52, 48, 44, 40], 2, qFonte));
        ctx.font = qFonte(qPx);
        qLinhas = limitar(ctx, citada, 860, 2, '”');
    }
    const qLh = Math.round(qPx * 1.25);

    const nomeFonte = (px) => `${P.wd} ${px}px ${P.fd}`;
    const nomes = cartas.map((c) => ajustar(ctx, c.name, texW, [42, 38, 34, 30], 2, nomeFonte));
    const nomePx = Math.min(...nomes.map((n) => n.px));
    ctx.font = nomeFonte(nomePx);
    const nomeLinhas = cartas.map((c) => limitar(ctx, c.name, texW, 2));
    const nomeLh = Math.round(nomePx * 1.1);
    const nNome = Math.max(...nomeLinhas.map((l) => l.length));

    const tFonte = (px) => `italic 400 ${px}px ${P.fd}`;
    const titulos = cartas.map((c) => ajustar(ctx, c.title || '', texW, [30, 27, 24, 22], 2, tFonte));
    const tituloPx = Math.min(...titulos.map((n) => n.px));
    ctx.font = tFonte(tituloPx);
    const tituloLinhas = cartas.map((c) => limitar(ctx, c.title || '', texW, 2));
    const tituloLh = Math.round(tituloPx * 1.2);
    const nTitulo = Math.max(...tituloLinhas.map((l) => l.length));

    const rotuloH = 30;
    const grupoH = rotuloH + 36 + (ch + 2 * mat) + 44 + nNome * nomeLh + 12 + nTitulo * tituloLh;
    const rodapeY = H - 150;
    const topoZona = 330;
    const blocoPerg = pergunta ? qLinhas.length * qLh + 96 : 0;
    const yPerg = topoZona + 30; // a pergunta fica logo abaixo do titulo
    const livre = rodapeY - 80 - (topoZona + blocoPerg);
    const gy = topoZona + blocoPerg + Math.max(0, livre - grupoH) / 2; // as cartas ficam centradas no que sobra

    // ---- desenho
    if (aurora) fundoAurora(ctx, P, grao);
    else fundoCrepusculo(ctx);
    if (!aurora) {
        ctx.globalAlpha = 0.06;
        ctx.globalCompositeOperation = 'overlay';
        ctx.fillStyle = grao;
        ctx.fillRect(0, 0, W, H);
        ctx.globalAlpha = 1;
        ctx.globalCompositeOperation = 'source-over';
    }
    moldura(ctx, aurora);
    logo(ctx, P, W / 2, 128, 280);

    ctx.fillStyle = P.accent;
    ctx.font = `600 28px ${P.fu}`;
    espacar(ctx, 7);
    centro(ctx, TEXTO.eyebrow, 262);
    espacar(ctx, 0);

    let y = yPerg;
    if (pergunta) {
        ctx.fillStyle = P.ink;
        ctx.font = qFonte(qPx);
        y += qPx;
        qLinhas.forEach((l) => {
            centro(ctx, l, y);
            y += qLh;
        });
        divisor(ctx, P, aurora, y + 14);
    }

    cartas.forEach((c, k) => {
        const sx = X0 + k * (slotW + GAP);
        const cx = sx + slotW / 2;
        // rotulo da posicao
        ctx.fillStyle = P.accent;
        ctx.font = `600 26px ${P.fu}`;
        espacar(ctx, 6);
        ctx.textAlign = 'center';
        ctx.fillText(ROTULOS[k].toUpperCase(), cx + 3, gy + 24);
        espacar(ctx, 0);
        const cy = gy + rotuloH + 36 + mat;
        desenharCarta(ctx, aurora, imgs[k], Math.round(cx - cw / 2), cy, cw, ch, grao, mat);
        let ty = cy + ch + mat + 44 + nomePx * 0.75;
        ctx.fillStyle = P.ink;
        ctx.font = nomeFonte(nomePx);
        ctx.textAlign = 'center';
        nomeLinhas[k].forEach((l) => {
            ctx.fillText(l, cx, ty);
            ty += nomeLh;
        });
        ty = cy + ch + mat + 44 + nNome * nomeLh + 12 + tituloPx * 0.8;
        ctx.fillStyle = P.soft;
        ctx.font = tFonte(tituloPx);
        tituloLinhas[k].forEach((l) => {
            ctx.fillText(l, cx, ty);
            ty += tituloLh;
        });
    });

    // filetes que fecham o conjunto (sem pergunta, tambem abrem; com pergunta, o filete dela ja abre)
    if (!pergunta) divisor(ctx, P, aurora, gy - 34);
    divisor(ctx, P, aurora, gy + grupoH + 56);

    ctx.fillStyle = P.mute;
    ctx.font = `500 26px ${P.fu}`;
    espacar(ctx, 7);
    centro(ctx, TEXTO.site, rodapeY);
    espacar(ctx, 0);
    return cv;
}

/**
 * Compartilha a imagem pela Web Share API com arquivo; quando o aparelho nao aceita arquivos,
 * baixa o cartao. Resultado: 'compartilhado' | 'cancelado' | 'baixado' | 'erro'.
 */
export async function compartilharCartaoLeitura(cv, data, cartas) {
    const blob = await paraBlob(cv);
    if (!blob) return 'erro';
    const arquivo = new File([blob], `aeon-leitura-${data}.jpg`, { type: 'image/jpeg' });
    try {
        if (navigator.canShare && navigator.canShare({ files: [arquivo] })) {
            await navigator.share({ files: [arquivo], title: 'Aeon Fool', text: TEXTO.textoCompartilhar(cartas) });
            return 'compartilhado';
        }
    } catch (e) {
        if (e && e.name === 'AbortError') return 'cancelado';
    }
    return (await baixarCartao(cv, data, 'aeon-leitura')) ? 'baixado' : 'erro';
}

let dialogo = null;
let ultimo = null;

function montar() {
    dialogo = document.createElement('dialog');
    dialogo.className = 'sheet cartao-sheet';
    dialogo.setAttribute('aria-labelledby', 'cartao-leitura-titulo');
    dialogo.innerHTML = `
        <div class="sheet-head">
            <h2 id="cartao-leitura-titulo">${TEXTO.titulo}</h2>
            <button class="iconbtn round" type="button" data-f aria-label="${TEXTO.fechar}"><svg class="icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg></button>
        </div>
        <div class="cartao-previa" data-previa></div>
        <div class="btn-row cartao-acoes">
            <button class="btn btn-primary" type="button" data-baixar>${TEXTO.baixar}</button>
            <button class="btn btn-ghost" type="button" data-compartilhar>${TEXTO.compartilhar}</button>
        </div>
        <p class="cartao-msg" role="status" aria-live="polite" data-msg></p>`;
    document.body.appendChild(dialogo);
    const msg = (t) => {
        dialogo.querySelector('[data-msg]').textContent = t;
    };
    dialogo.querySelector('[data-f]').addEventListener('click', () => dialogo.close());
    dialogo.addEventListener('click', (e) => {
        if (e.target === dialogo) dialogo.close();
    });
    dialogo.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') e.stopPropagation();
    });
    dialogo.querySelector('[data-baixar]').addEventListener('click', async () => {
        if (!ultimo) return;
        msg((await baixarCartao(ultimo.cv, ultimo.dados.data, 'aeon-leitura')) ? TEXTO.salvo : TEXTO.falhou);
    });
    dialogo.querySelector('[data-compartilhar]').addEventListener('click', async () => {
        if (!ultimo) return;
        const r = await compartilharCartaoLeitura(ultimo.cv, ultimo.dados.data, ultimo.dados.cartas);
        msg(r === 'baixado' ? TEXTO.semCompartilhar : r === 'erro' ? TEXTO.falhou : '');
    });
    // trocou o tema com o cartao aberto: refaz no tema novo
    document.addEventListener('aeon:tema', () => {
        if (dialogo.open && ultimo) desenhar(ultimo.dados);
    });
}

async function desenhar(dados) {
    const previa = dialogo.querySelector('[data-previa]');
    const msg = dialogo.querySelector('[data-msg]');
    msg.textContent = TEXTO.fazendo;
    const pedido = (desenhar.n = (desenhar.n || 0) + 1);
    try {
        const cv = await gerarCartaoLeitura(dados);
        if (pedido !== desenhar.n) return; // chegou um pedido mais novo
        cv.setAttribute('role', 'img');
        cv.setAttribute('aria-label', TEXTO.previa(dados.cartas));
        previa.replaceChildren(cv);
        ultimo = { cv, dados };
        msg.textContent = '';
        dialogo.dataset.pronto = 'true';
    } catch (e) {
        msg.textContent = TEXTO.falhou;
    }
}

/** Abre a previa do cartao com Baixar e Compartilhar. dados: { cartas, pergunta, data } */
export function abrirCartaoLeitura(dados) {
    if (!dialogo) montar();
    dialogo.dataset.pronto = 'false';
    dialogo.querySelector('[data-previa]').replaceChildren();
    ultimo = null;
    if (!dialogo.open) dialogo.showModal();
    return desenhar(dados);
}
