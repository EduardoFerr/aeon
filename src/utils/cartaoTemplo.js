/**
 * Cartao do Templo de Afrodite (1080x1920, formato stories), gerado em Canvas so quando a pessoa pede.
 * Layout proprio: duas colunas de tres cartas (voce e a outra pessoa) com o plano e a relacao de cada linha no
 * meio, e a Sintese ao centro, embaixo. Cada carta leva so o nome, sem texto longo.
 * A pergunta fica fora por padrao (e o dado mais pessoal da leitura); a previa tem um interruptor que a coloca.
 * Reaproveita o desenho do cartao da carta do dia (fundo, moldura, marca, passe-partout e graos que
 * disfarcam a baixa resolucao das imagens, 274x410). As cartas aqui ficam em ate 212x317: so reducao, nunca ampliacao.
 * A janela de previa segue o mesmo molde do cartao da cruz (cartaoCruz.js).
 */
import {
    W, H, PAL, temaAtual, carregarImagem, esperarFontes, padraoGrao, espacar, centro,
    fundoCrepusculo, fundoAurora, moldura, logo, divisor, desenharCarta, paraBlob, baixarCartao, TEXTO_PERGUNTA_NO_CARTAO,
} from './cartao.js';
import { ajustar, limitar } from './cartaoLeitura.js';

/* Nome da posicao e coluna/linha na grade: voce (coluna 0), plano (meio) e a outra pessoa (coluna 2); a Sintese e a linha 3. */
const NOS = [
    { nome: 'Mental', quem: 'você', col: 0, lin: 0 },
    { nome: 'Afetivo', quem: 'você', col: 0, lin: 1 },
    { nome: 'Físico', quem: 'você', col: 0, lin: 2 },
    { nome: 'Mental', quem: 'a outra pessoa', col: 2, lin: 0 },
    { nome: 'Afetivo', quem: 'a outra pessoa', col: 2, lin: 1 },
    { nome: 'Físico', quem: 'a outra pessoa', col: 2, lin: 2 },
    { nome: 'Síntese', quem: '', col: 1, lin: 3 },
];
const PLANOS = ['MENTAL', 'AFETIVO', 'FÍSICO'];
const RELACAO = { sintonia: 'Sintonia', combina: 'Combinam', distinto: 'Distintos', tensao: 'Em tensão' };
const descricao = (cartas) => cartas.map((c, i) => `${NOS[i].nome}${NOS[i].quem ? `, ${NOS[i].quem}` : ''}, ${c.name}`).join('; ');

const TEXTO = {
    titulo: 'Seu cartão do templo',
    eyebrow: 'O TEMPLO DE AFRODITE',
    voce: 'VOCÊ',
    outra: 'A OUTRA PESSOA',
    site: 'AEONFOOL.COM',
    baixar: 'Baixar',
    compartilhar: 'Compartilhar',
    fechar: 'Fechar',
    fazendo: 'Preparando o cartão…',
    salvo: 'Cartão salvo no seu aparelho.',
    semCompartilhar: 'Este aparelho não compartilha imagens direto, então o cartão foi baixado.',
    falhou: 'Não foi possível montar o cartão agora.',
    previa: (cartas) => `Prévia do cartão do templo: ${descricao(cartas)}.`,
    textoCompartilhar: (cartas) => `Meu Templo de Afrodite no Aeon Fool: ${descricao(cartas)}. aeonfool.com`,
};

/**
 * Desenha o cartao. Medida primeiro, desenho depois: a pergunta (quando entra) ocupa o que precisa e as quatro
 * linhas de cartas tomam o resto da altura, no maximo com a carta em 212x317.
 * @param {{cartas: Array<{order: string|number, name: string}>, pergunta?: string, relacoes?: string[], tema?: string}} dados cartas na ordem de 1 a 7; relacoes: as tres linhas (sintonia, combina, distinto, tensao)
 * @returns {Promise<HTMLCanvasElement>}
 */
export async function gerarCartaoTemplo({ cartas, pergunta, relacoes = [], tema }) {
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
    const topoZona = 320;
    const blocoPerg = pergunta ? qLinhas.length * qLh + 150 : 0;

    // ---- geometria: cabecalho das colunas, quatro linhas de cartas e o que sobra de altura
    const mat = 10;
    const folgaX = 70;
    const folgaY = 22;
    const cabH = 64; // "VOCE" e "A OUTRA PESSOA"
    const legendaH = 14 + 22 + 12; // respiro e o nome da carta
    const rotuloSinteseH = 36; // "SINTESE" acima da setima carta
    const base = H - 230; // o rodape comeca em H - 150
    const zona = base - (topoZona + blocoPerg) - cabH;
    const imgH0 = Math.floor((zona - 3 * folgaY - rotuloSinteseH - 4 * (2 * mat + legendaH)) / 4);
    const iw = Math.min(212, Math.floor((imgH0 * 274) / 410));
    const ih = Math.round((iw * 410) / 274);
    const colW = iw + 2 * mat;
    const meioW = Math.max(colW, 230);
    const nodeH = ih + 2 * mat + legendaH;
    const gradeW = 2 * colW + meioW + 2 * folgaX;
    const gradeH = 4 * nodeH + 3 * folgaY + rotuloSinteseH;
    const x0 = Math.round((W - gradeW) / 2);
    const y0 = Math.round(topoZona + blocoPerg + cabH + Math.max(0, zona - gradeH) / 2);
    const xCol = [x0 + colW / 2, x0 + colW + folgaX + meioW / 2, x0 + colW + 2 * folgaX + meioW + colW / 2]; // centros: voce, meio, outra pessoa
    const largNome = colW + folgaX - 12;
    const topoLinha = (lin) => y0 + lin * (nodeH + folgaY) + (lin === 3 ? rotuloSinteseH : 0);

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

    // cabecalho das colunas
    const yCab = topoZona + blocoPerg + 36;
    ctx.textAlign = 'center';
    ctx.fillStyle = P.accent;
    ctx.font = `600 24px ${P.fu}`;
    espacar(ctx, 5);
    ctx.fillText(TEXTO.voce, xCol[0] + 2, yCab);
    ctx.fillText(TEXTO.outra, xCol[2] + 2, yCab);
    espacar(ctx, 0);

    // cartas e nomes
    NOS.forEach((no, i) => {
        const cx = xCol[no.col];
        const top = topoLinha(no.lin);
        desenharCarta(ctx, aurora, imgs[i], Math.round(cx - iw / 2), top + mat, iw, ih, grao, mat);
        const nomeFonte = (px) => `italic 400 ${px}px ${P.fd}`;
        const { px, linhas } = ajustar(ctx, cartas[i].name, largNome, [26, 24, 22, 20, 19], 1, nomeFonte);
        ctx.font = nomeFonte(px);
        ctx.fillStyle = P.ink;
        ctx.textAlign = 'center';
        ctx.fillText(linhas[0], cx, top + 2 * mat + ih + 14 + 22);
    });

    // rotulo do plano e relacao de cada linha, no meio, na altura das cartas; "SINTESE" acima da setima carta
    PLANOS.forEach((plano, k) => {
        const meio = topoLinha(k) + mat + ih / 2;
        ctx.textAlign = 'center';
        ctx.fillStyle = P.accent;
        ctx.font = `600 26px ${P.fu}`;
        espacar(ctx, 6);
        ctx.fillText(plano, xCol[1] + 3, relacoes[k] ? meio - 4 : meio + 9);
        espacar(ctx, 0);
        if (relacoes[k]) {
            ctx.fillStyle = P.soft;
            ctx.font = `italic 400 28px ${P.fd}`;
            ctx.fillText(RELACAO[relacoes[k]] || '', xCol[1], meio + 36);
        }
    });
    ctx.textAlign = 'center';
    ctx.fillStyle = P.accent;
    ctx.font = `600 24px ${P.fu}`;
    espacar(ctx, 6);
    ctx.fillText('SÍNTESE', xCol[1] + 3, topoLinha(3) - 8);
    espacar(ctx, 0);

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
export async function compartilharCartaoTemplo(cv, data, cartas) {
    const blob = await paraBlob(cv);
    if (!blob) return 'erro';
    const arquivo = new File([blob], `aeon-templo-${data}.jpg`, { type: 'image/jpeg' });
    try {
        if (navigator.canShare && navigator.canShare({ files: [arquivo] })) {
            await navigator.share({ files: [arquivo], title: 'Aeon Fool', text: TEXTO.textoCompartilhar(cartas) });
            return 'compartilhado';
        }
    } catch (e) {
        if (e && e.name === 'AbortError') return 'cancelado';
    }
    return (await baixarCartao(cv, data, 'aeon-templo')) ? 'baixado' : 'erro';
}

let dialogo = null;
let ultimo = null;

function montar() {
    dialogo = document.createElement('dialog');
    dialogo.className = 'sheet cartao-sheet';
    dialogo.setAttribute('aria-labelledby', 'cartao-templo-titulo');
    dialogo.innerHTML = `
        <div class="sheet-head">
            <h2 id="cartao-templo-titulo">${TEXTO.titulo}</h2>
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
        msg((await baixarCartao(ultimo.cv, ultimo.dados.data, 'aeon-templo')) ? TEXTO.salvo : TEXTO.falhou);
    });
    dialogo.querySelector('[data-compartilhar]').addEventListener('click', async () => {
        if (!ultimo) return;
        const r = await compartilharCartaoTemplo(ultimo.cv, ultimo.dados.data, ultimo.dados.cartas);
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
        const cv = await gerarCartaoTemplo({ ...dados, pergunta: dados.comPergunta ? dados.pergunta : '' });
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

/** Abre a previa do cartao com Baixar e Compartilhar. dados: { cartas (de 1 a 7), pergunta, data, relacoes }. A pergunta so entra se a pessoa ligar o interruptor. */
export function abrirCartaoTemplo(dados) {
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
