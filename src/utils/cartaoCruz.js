/**
 * Cartao da cruz de cinco cartas (1080x1920, formato stories), gerado em Canvas so quando a pessoa pede.
 * Layout proprio: a cruz inteira, com a posicao e uma frase pequena sob cada carta, e nenhum texto longo.
 * A pergunta fica fora por padrao (e o dado mais pessoal da leitura); a previa tem um interruptor que a coloca.
 * Reaproveita o desenho do cartao da carta do dia (fundo, moldura, marca, passe-partout e graos que
 * disfarcam a baixa resolucao das imagens, 274x410). As cartas aqui ficam em ate 212x317: so reducao, nunca ampliacao.
 */
import {
    W, H, PAL, temaAtual, carregarImagem, esperarFontes, padraoGrao, espacar, centro,
    fundoCrepusculo, fundoAurora, moldura, logo, divisor, desenharCarta, paraBlob, baixarCartao, TEXTO_PERGUNTA_NO_CARTAO,
} from './cartao.js';
import { ajustar, limitar } from './cartaoLeitura.js';

/* Posicao (legenda) e frase pequena, na ordem de leitura; col e linha na grade 3 x 3 da cruz. */
const NOS = [
    { nome: 'Momento', leg: 'onde você está', col: 1, lin: 0 },
    { nome: 'Ajuda', leg: 'o que sustenta', col: 0, lin: 1 },
    { nome: 'Obstáculo', leg: 'o que pesa', col: 2, lin: 1 },
    { nome: 'Caminho', leg: 'o que fazer', col: 1, lin: 2 },
    { nome: 'Síntese', leg: 'o recado final', col: 1, lin: 1 },
];

const TEXTO = {
    titulo: 'Seu cartão da cruz',
    eyebrow: 'SUA CRUZ DE CINCO CARTAS',
    site: 'AEONFOOL.COM',
    baixar: 'Baixar',
    compartilhar: 'Compartilhar',
    fechar: 'Fechar',
    fazendo: 'Preparando o cartão…',
    salvo: 'Cartão salvo no seu aparelho.',
    semCompartilhar: 'Este aparelho não compartilha imagens direto, então o cartão foi baixado.',
    falhou: 'Não foi possível montar o cartão agora.',
    previa: (cartas) => `Prévia do cartão da cruz: ${cartas.map((c, i) => `${NOS[i].nome}, ${c.name}`).join('; ')}.`,
    textoCompartilhar: (cartas) => `Minha cruz no Aeon Fool: ${cartas.map((c, i) => `${NOS[i].nome}, ${c.name}`).join('; ')}. aeonfool.com`,
};

/**
 * Desenha o cartao. Medida primeiro, desenho depois: a pergunta (quando entra) ocupa o que precisa e a cruz
 * toma o resto da altura, no maximo com a carta em 212x317.
 * @param {{cartas: Array<{order: string|number, name: string}>, pergunta?: string, tema?: string}} dados cartas na ordem de leitura
 * @returns {Promise<HTMLCanvasElement>}
 */
export async function gerarCartaoCruz({ cartas, pergunta, tema }) {
    const th = tema || temaAtual();
    const P = PAL[th];
    const aurora = th === 'aurora';
    await esperarFontes(P);
    const imgs = await Promise.all(cartas.map((c) => carregarImagem(`assets/cards/crowley-${String(c.order).padStart(2, '0')}.jpg`)));

    const cv = document.createElement('canvas');
    cv.width = W;
    cv.height = H;
    const ctx = cv.getContext('2d');
    const grao = padraoGrao(ctx);

    // ---- pergunta (so se a pessoa ligou o interruptor)
    const qFonte = (px) => `italic ${aurora ? 400 : 500} ${px}px ${P.fd}`;
    const citada = pergunta ? `“${pergunta}”` : '';
    let qPx = 52;
    let qLinhas = [];
    if (citada) {
        ({ px: qPx } = ajustar(ctx, citada, 860, [52, 48, 44, 40], 2, qFonte));
        ctx.font = qFonte(qPx);
        qLinhas = limitar(ctx, citada, 860, 2, '”');
    }
    const qLh = Math.round(qPx * 1.25);
    const topoZona = 330;
    const blocoPerg = pergunta ? qLinhas.length * qLh + 150 : 0; // o filete fecha a pergunta e a cruz comeca abaixo dele, com respiro

    // ---- geometria da cruz: o que sobra de altura, repartido nas tres linhas
    const mat = 10;
    const folgaX = 40;
    const folgaY = 26;
    const legendaH = 16 + 24 + 10 + 30; // respiro, posicao, respiro, frase
    const base = H - 230; // o rodape comeca em H - 150
    const zona = base - (topoZona + blocoPerg);
    const imgH0 = Math.floor((zona - 2 * folgaY - 3 * (2 * mat + legendaH)) / 3);
    const iw = Math.min(212, Math.floor(((imgH0 * 274) / 410)));
    const ih = Math.round((iw * 410) / 274);
    const colW = iw + 2 * mat;
    const nodeH = ih + 2 * mat + legendaH;
    const cruzW = 3 * colW + 2 * folgaX;
    const cruzH = 3 * nodeH + 2 * folgaY;
    const x0 = Math.round((W - cruzW) / 2);
    const y0 = Math.round(topoZona + blocoPerg + Math.max(0, zona - cruzH) / 2);

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

    if (pergunta) {
        ctx.fillStyle = P.ink;
        ctx.font = qFonte(qPx);
        let y = topoZona + 30 + qPx;
        qLinhas.forEach((l) => {
            centro(ctx, l, y);
            y += qLh;
        });
        divisor(ctx, P, aurora, y + 14);
    }

    NOS.forEach((no, i) => {
        const cx = x0 + no.col * (colW + folgaX) + colW / 2;
        const top = y0 + no.lin * (nodeH + folgaY);
        desenharCarta(ctx, aurora, imgs[i], Math.round(cx - iw / 2), top + mat, iw, ih, grao, mat);
        const yRot = top + 2 * mat + ih + 16 + 20;
        ctx.textAlign = 'center';
        ctx.fillStyle = P.accent;
        ctx.font = `600 24px ${P.fu}`;
        espacar(ctx, 6);
        ctx.fillText(no.nome.toUpperCase(), cx + 3, yRot);
        espacar(ctx, 0);
        ctx.fillStyle = P.soft;
        ctx.font = `italic 400 28px ${P.fd}`;
        ctx.fillText(no.leg, cx, yRot + 10 + 24);
    });

    ctx.fillStyle = P.mute;
    ctx.font = `500 26px ${P.fu}`;
    espacar(ctx, 7);
    centro(ctx, TEXTO.site, H - 150);
    espacar(ctx, 0);
    return cv;
}

/**
 * Compartilha a imagem pela Web Share API com arquivo; quando o aparelho nao aceita arquivos,
 * baixa o cartao. Resultado: 'compartilhado' | 'cancelado' | 'baixado' | 'erro'.
 */
export async function compartilharCartaoCruz(cv, data, cartas) {
    const blob = await paraBlob(cv);
    if (!blob) return 'erro';
    const arquivo = new File([blob], `aeon-cruz-${data}.jpg`, { type: 'image/jpeg' });
    try {
        if (navigator.canShare && navigator.canShare({ files: [arquivo] })) {
            await navigator.share({ files: [arquivo], title: 'Aeon Fool', text: TEXTO.textoCompartilhar(cartas) });
            return 'compartilhado';
        }
    } catch (e) {
        if (e && e.name === 'AbortError') return 'cancelado';
    }
    return (await baixarCartao(cv, data, 'aeon-cruz')) ? 'baixado' : 'erro';
}

let dialogo = null;
let ultimo = null;

function montar() {
    dialogo = document.createElement('dialog');
    dialogo.className = 'sheet cartao-sheet';
    dialogo.setAttribute('aria-labelledby', 'cartao-cruz-titulo');
    dialogo.innerHTML = `
        <div class="sheet-head">
            <h2 id="cartao-cruz-titulo">${TEXTO.titulo}</h2>
            <button class="iconbtn round" type="button" data-f aria-label="${TEXTO.fechar}"><svg class="icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg></button>
        </div>
        <div class="cartao-previa" data-previa></div>
        <label class="cartao-pergunta" data-pergunta hidden><input type="checkbox" data-com-pergunta><span>${TEXTO_PERGUNTA_NO_CARTAO}</span></label>
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
        msg((await baixarCartao(ultimo.cv, ultimo.dados.data, 'aeon-cruz')) ? TEXTO.salvo : TEXTO.falhou);
    });
    dialogo.querySelector('[data-compartilhar]').addEventListener('click', async () => {
        if (!ultimo) return;
        const r = await compartilharCartaoCruz(ultimo.cv, ultimo.dados.data, ultimo.dados.cartas);
        msg(r === 'baixado' ? TEXTO.semCompartilhar : r === 'erro' ? TEXTO.falhou : '');
    });
    dialogo.querySelector('[data-com-pergunta]').addEventListener('change', (e) => {
        if (ultimo) desenhar({ ...ultimo.dados, comPergunta: e.target.checked });
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
        const cv = await gerarCartaoCruz({ ...dados, pergunta: dados.comPergunta ? dados.pergunta : '' });
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

/** Abre a previa do cartao com Baixar e Compartilhar. dados: { cartas (ordem de leitura), pergunta, data }. A pergunta so entra se a pessoa ligar o interruptor. */
export function abrirCartaoCruz(dados) {
    if (!dialogo) montar();
    dialogo.dataset.pronto = 'false';
    const tg = dialogo.querySelector('[data-pergunta]');
    tg.hidden = !dados.pergunta;
    tg.querySelector('input').checked = false;
    dados = { ...dados, comPergunta: false };
    dialogo.querySelector('[data-previa]').replaceChildren();
    ultimo = null;
    if (!dialogo.open) dialogo.showModal();
    return desenhar(dados);
}
