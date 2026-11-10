/**
 * Cartao da carta do dia (1080x1920, formato stories), gerado em Canvas so quando a pessoa pede.
 * Carregado por import dinamico a partir da carta do dia: nao pesa no carregamento da pagina.
 *
 * As imagens das cartas tem 274x410. O cartao disfarca a baixa resolucao com passe-partout,
 * escala moderada (upscale em dois passos), graos, vinheta e moldura. Reexportar as cartas
 * em 1200x1800 resolve de vez (ver relatorio da etapa 2).
 */
export const W = 1080;
export const H = 1920;

const TEXTO = {
    titulo: 'Seu cartão de hoje',
    eyebrow: 'SUA CARTA DE HOJE',
    pergunta: 'PARA LEVAR O DIA',
    site: 'AEONFOOL.COM',
    baixar: 'Baixar',
    compartilhar: 'Compartilhar',
    fechar: 'Fechar',
    fazendo: 'Preparando o cartão…',
    salvo: 'Cartão salvo no seu aparelho.',
    semCompartilhar: 'Este aparelho não compartilha imagens direto, então o cartão foi baixado.',
    falhou: 'Não foi possível montar o cartão agora.',
    previa: (nome) => `Prévia do cartão da carta de hoje: ${nome}.`,
    textoCompartilhar: (nome) => `Minha carta de hoje no Aeon Fool: ${nome}. aeonfool.com`,
};

export const PAL = {
    crepusculo: {
        ink: '#f1e9e0', soft: '#b8abb8', mute: '#9c93aa', accent: '#e8b7a0', key: '#d9a24a', tree: '232,183,160', bg: '#14101c',
        fd: '"Cormorant Garamond", Georgia, serif', fu: '"Inter", system-ui, sans-serif', wd: 500,
        faces: ['italic 500 52px "Cormorant Garamond"', '500 76px "Cormorant Garamond"', '500 26px "Inter"', '600 26px "Inter"'],
    },
    aurora: {
        ink: '#18203a', soft: '#434c63', mute: '#586178', accent: '#2a47a6', key: '#b83a24', tree: '42,71,166', bg: '#f1f3ec',
        fd: '"Fraunces", Georgia, serif', fu: '"Hanken Grotesk", system-ui, sans-serif', wd: 360,
        faces: ['italic 400 52px "Fraunces"', '360 76px "Fraunces"', '500 26px "Hanken Grotesk"', '600 26px "Hanken Grotesk"'],
    },
};

export const temaAtual = () => document.documentElement.getAttribute('data-theme') === 'aurora' ? 'aurora' : 'crepusculo';

export function carregarImagem(src) {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => resolve(img);
        img.onerror = reject;
        img.src = src;
    });
}

/** Espera as fontes do tema (document.fonts.ready e as faces usadas no desenho), com limite de tempo. */
export async function esperarFontes(P) {
    if (!document.fonts) return;
    const faces = Promise.all(P.faces.map((f) => document.fonts.load(f))).catch(() => {});
    const limite = new Promise((r) => setTimeout(r, 2500));
    await Promise.race([Promise.all([document.fonts.ready, faces]), limite]);
}

export function padraoGrao(ctx) {
    const c = document.createElement('canvas');
    c.width = c.height = 220;
    const g = c.getContext('2d');
    const d = g.createImageData(220, 220);
    for (let i = 0; i < d.data.length; i += 4) {
        const v = Math.random() * 255;
        d.data[i] = d.data[i + 1] = d.data[i + 2] = v;
        d.data[i + 3] = 255;
    }
    g.putImageData(d, 0, 0);
    return ctx.createPattern(c, 'repeat');
}

export function quebrar(ctx, texto, largura) {
    const linhas = [];
    let atual = '';
    texto.split(/\s+/).forEach((palavra) => {
        const t = atual ? `${atual} ${palavra}` : palavra;
        if (ctx.measureText(t).width > largura && atual) {
            linhas.push(atual);
            atual = palavra;
        } else atual = t;
    });
    if (atual) linhas.push(atual);
    return linhas;
}

export const espacar = (ctx, px) => { if ('letterSpacing' in ctx) ctx.letterSpacing = `${px}px`; };
export const centro = (ctx, txt, y) => { ctx.textAlign = 'center'; ctx.fillText(txt, W / 2, y); };

export function fundoCrepusculo(ctx) {
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, '#15101d'); g.addColorStop(0.5, '#1b1426'); g.addColorStop(1, '#120e19');
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    const r1 = ctx.createRadialGradient(W / 2, 740, 0, W / 2, 740, 820);
    r1.addColorStop(0, 'rgba(232,183,160,.24)'); r1.addColorStop(1, 'rgba(232,183,160,0)');
    ctx.fillStyle = r1; ctx.fillRect(0, 0, W, H);
    const r2 = ctx.createRadialGradient(W, H, 0, W, H, 900);
    r2.addColorStop(0, 'rgba(130,100,190,.2)'); r2.addColorStop(1, 'rgba(130,100,190,0)');
    ctx.fillStyle = r2; ctx.fillRect(0, 0, W, H);
    // facetas so nas margens
    const c2 = document.createElement('canvas'); c2.width = W; c2.height = H;
    const x = c2.getContext('2d');
    x.strokeStyle = 'rgba(232,183,160,.07)'; x.lineWidth = 1.5;
    for (let i = -H; i < W + H; i += 96) {
        x.beginPath(); x.moveTo(i, 0); x.lineTo(i + H, H); x.stroke();
        x.beginPath(); x.moveTo(i, H); x.lineTo(i + H, 0); x.stroke();
    }
    x.globalCompositeOperation = 'destination-out';
    const r = x.createRadialGradient(W / 2, H / 2, 260, W / 2, H / 2, 760);
    r.addColorStop(0, 'rgba(0,0,0,1)'); r.addColorStop(1, 'rgba(0,0,0,0)');
    x.fillStyle = r; x.fillRect(0, 0, W, H);
    ctx.drawImage(c2, 0, 0);
}

export function fundoAurora(ctx, P, grao) {
    ctx.fillStyle = P.bg; ctx.fillRect(0, 0, W, H);
    const t = document.createElement('canvas'); t.width = W; t.height = H;
    const x = t.getContext('2d');
    x.fillStyle = 'rgba(255,247,214,.85)';
    [[60, 330], [420, 760]].forEach((b) => {
        x.beginPath(); x.moveTo(b[0] + 260, 0); x.lineTo(b[1] + 260, 0); x.lineTo(b[1] - 420, 1180); x.lineTo(b[0] - 420, 1180); x.closePath(); x.fill();
    });
    x.globalCompositeOperation = 'destination-in';
    const m = x.createLinearGradient(0, 0, 0, 1180);
    m.addColorStop(0, 'rgba(0,0,0,1)'); m.addColorStop(1, 'rgba(0,0,0,0)');
    x.fillStyle = m; x.fillRect(0, 0, W, H);
    ctx.drawImage(t, 0, 0);
    ctx.save(); ctx.globalCompositeOperation = 'multiply'; ctx.globalAlpha = 0.07; ctx.fillStyle = grao; ctx.fillRect(0, 0, W, H); ctx.restore();
}

export function moldura(ctx, aurora) {
    if (!aurora) {
        ctx.strokeStyle = 'rgba(232,183,160,.4)'; ctx.lineWidth = 2; ctx.strokeRect(48, 48, W - 96, H - 96);
        ctx.strokeStyle = 'rgba(232,183,160,.16)'; ctx.lineWidth = 1.5; ctx.strokeRect(66, 66, W - 132, H - 132);
        [[48, 48], [W - 48, 48], [48, H - 48], [W - 48, H - 48]].forEach((p) => {
            ctx.save(); ctx.translate(p[0], p[1]); ctx.rotate(Math.PI / 4);
            ctx.fillStyle = '#14101c'; ctx.fillRect(-11, -11, 22, 22);
            ctx.strokeStyle = 'rgba(232,183,160,.75)'; ctx.lineWidth = 2; ctx.strokeRect(-11, -11, 22, 22); ctx.restore();
        });
    } else {
        ctx.strokeStyle = 'rgba(24,32,58,.6)'; ctx.lineWidth = 2; ctx.strokeRect(48, 48, W - 96, H - 96);
        ctx.strokeStyle = 'rgba(24,32,58,.22)'; ctx.lineWidth = 1.5; ctx.strokeRect(66, 66, W - 132, H - 132);
        [[48, 48], [W - 48, 48], [48, H - 48], [W - 48, H - 48]].forEach((p) => {
            ctx.fillStyle = '#f1f3ec'; ctx.fillRect(p[0] - 11, p[1] - 11, 22, 22);
            ctx.strokeStyle = 'rgba(24,32,58,.8)'; ctx.lineWidth = 2; ctx.strokeRect(p[0] - 11, p[1] - 11, 22, 22);
        });
        ctx.strokeStyle = 'rgba(24,32,58,.3)'; ctx.lineWidth = 1.5; ctx.beginPath();
        for (let i = 0, x = 110; x < W - 100; i++, x += 22) {
            const len = i % 5 === 0 ? 16 : 8;
            ctx.moveTo(x, 66); ctx.lineTo(x, 66 + len); ctx.moveTo(x, H - 66); ctx.lineTo(x, H - 66 - len);
        }
        ctx.stroke();
    }
}

/** Marca "AEON" do topo do site (mesmos tracos do SVG da casca), desenhada em Path2D. */
export function logo(ctx, P, cx, y, largura) {
    const s = largura / 134;
    ctx.save(); ctx.translate(cx - largura / 2, y); ctx.scale(s, s); ctx.translate(2, 2);
    ctx.lineWidth = 2.4; ctx.lineJoin = 'miter'; ctx.strokeStyle = P.ink;
    ctx.stroke(new Path2D('M1 30 L13 2 L25 30 M6 19 H20 M37 2 V30 M37 2 H54 M37 16 H51 M37 30 H54 M105 30 V2 L127 30 V2'));
    ctx.strokeStyle = P.accent; ctx.beginPath(); ctx.arc(79, 16, 14, 0, 6.2832); ctx.stroke();
    ctx.lineWidth = 1.4; ctx.stroke(new Path2D('M79 7V25M70 16H88M72.6 9.6L85.4 22.4M85.4 9.6L72.6 22.4'));
    ctx.lineWidth = 2.4; ctx.beginPath(); ctx.arc(79, 16, 2.5, 0, 6.2832); ctx.stroke();
    ctx.restore();
}

export function divisor(ctx, P, aurora, y) {
    ctx.save(); ctx.strokeStyle = `rgba(${P.tree},${aurora ? 0.7 : 0.55})`; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(180, y); ctx.lineTo(W / 2 - 54, y); ctx.moveTo(W / 2 + 54, y); ctx.lineTo(W - 180, y); ctx.stroke();
    ctx.translate(W / 2, y); ctx.beginPath();
    [[0, -16, 0, 16], [-16, 0, 16, 0], [-11, -11, 11, 11], [11, -11, -11, 11]].forEach((l) => { ctx.moveTo(l[0], l[1]); ctx.lineTo(l[2], l[3]); });
    ctx.lineWidth = 1.6; ctx.stroke(); ctx.beginPath(); ctx.arc(0, 0, 5, 0, 6.2832); ctx.stroke(); ctx.restore();
}

/** Carta com passe-partout, graos, vinheta e filete: esconde a baixa resolucao. */
export function desenharCarta(ctx, aurora, img, x, y, w, h, grao, mat) {
    ctx.save();
    if (aurora) {
        ctx.shadowColor = 'rgba(24,32,58,.35)'; ctx.shadowBlur = 36; ctx.shadowOffsetY = 18;
        ctx.fillStyle = '#fbfcf8'; ctx.strokeStyle = 'rgba(24,32,58,.25)';
    } else {
        ctx.fillStyle = 'rgba(241,233,224,.05)'; ctx.strokeStyle = 'rgba(232,183,160,.38)';
    }
    ctx.lineWidth = 2; ctx.beginPath();
    const r = aurora ? 4 : 22;
    if (ctx.roundRect) ctx.roundRect(x - mat, y - mat, w + mat * 2, h + mat * 2, r); else ctx.rect(x - mat, y - mat, w + mat * 2, h + mat * 2);
    ctx.fill(); ctx.shadowColor = 'transparent'; ctx.stroke(); ctx.restore();
    if (!aurora) {
        ctx.save(); ctx.shadowColor = 'rgba(232,183,160,.4)'; ctx.shadowBlur = 90; ctx.fillStyle = '#14101c'; ctx.fillRect(x, y, w, h); ctx.restore();
    }
    const k = Math.min(1.5, w / img.width);
    const t = document.createElement('canvas');
    t.width = Math.round(img.width * k); t.height = Math.round(img.height * k);
    const tx = t.getContext('2d'); tx.imageSmoothingEnabled = true; tx.imageSmoothingQuality = 'high';
    tx.drawImage(img, 0, 0, t.width, t.height); // primeiro passo do upscale
    ctx.save(); ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = 'high';
    ctx.beginPath(); ctx.rect(x, y, w, h); ctx.clip();
    ctx.drawImage(t, x, y, w, h);
    ctx.globalCompositeOperation = aurora ? 'soft-light' : 'overlay'; ctx.globalAlpha = aurora ? 0.3 : 0.16;
    ctx.fillStyle = grao; ctx.fillRect(x, y, w, h);
    ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = 1;
    const v = ctx.createRadialGradient(x + w / 2, y + h / 2, h * 0.3, x + w / 2, y + h / 2, h * 0.74);
    v.addColorStop(0, 'rgba(10,6,16,0)'); v.addColorStop(1, aurora ? 'rgba(24,32,58,.18)' : 'rgba(10,6,16,.3)');
    ctx.fillStyle = v; ctx.fillRect(x, y, w, h); ctx.restore();
    ctx.strokeStyle = aurora ? 'rgba(24,32,58,.55)' : 'rgba(217,162,74,.6)'; ctx.lineWidth = 2; ctx.strokeRect(x + 1, y + 1, w - 2, h - 2);
}

/**
 * Desenha o cartao. Medida primeiro, desenho depois: o texto ocupa o que precisa
 * (nome longo, pergunta longa) e a carta usa o espaco que sobra.
 * @returns {Promise<HTMLCanvasElement>}
 */
export async function gerarCartao({ carta, pergunta, tema }) {
    const th = tema || temaAtual();
    const P = PAL[th];
    const aurora = th === 'aurora';
    await esperarFontes(P);
    const img = await carregarImagem(`assets/cards/crowley-${carta.order}.jpg`);

    const cv = document.createElement('canvas');
    cv.width = W; cv.height = H;
    const ctx = cv.getContext('2d');
    const grao = padraoGrao(ctx);
    const F = (peso, px, fam) => `${peso} ${px}px ${fam}`;

    // ---- medidas do texto
    const nomeFont = (px) => F(P.wd, px, P.fd);
    let nomePx = 88;
    ctx.font = nomeFont(nomePx);
    while (ctx.measureText(carta.name).width > 860 && nomePx > 56) { nomePx -= 4; ctx.font = nomeFont(nomePx); }
    const nomeLinhas = quebrar(ctx, carta.name, 860);
    const nomeLh = Math.round(nomePx * 1.08);

    const titulo = carta.title || '';
    let tituloPx = 46;
    ctx.font = `italic 400 ${tituloPx}px ${P.fd}`;
    while (ctx.measureText(titulo).width > 860 && tituloPx > 30) { tituloPx -= 2; ctx.font = `italic 400 ${tituloPx}px ${P.fd}`; }

    let qPx = 54, qLinhas = [];
    const citada = pergunta ? `“${pergunta}”` : '';
    for (const px of [54, 50, 46, 42, 38]) {
        qPx = px;
        ctx.font = `italic ${aurora ? 400 : 500} ${px}px ${P.fd}`;
        qLinhas = quebrar(ctx, citada, 840);
        if (qLinhas.length <= (px >= 50 ? 4 : 5)) break;
    }
    qLinhas = qLinhas.slice(0, 6);
    const qLh = Math.round(qPx * 1.24);

    const blocoNome = nomeLinhas.length * nomeLh + 30 + tituloPx * 1.2;
    const blocoPergunta = pergunta ? 48 + 60 + qLinhas.length * qLh : 0;
    const rodapeY = H - 150;
    const textoTopoMax = rodapeY - 70 - blocoPergunta - blocoNome;
    const mat = 26;
    const cartaTop = 330;
    const alturaMax = textoTopoMax - 60 - cartaTop - mat; // espaco entre o topo e o texto
    let cw = Math.min(540, Math.floor(alturaMax / 1.4963));
    cw = Math.max(cw, 300);
    const ch = Math.round(cw * 410 / 274);

    // ---- desenho
    if (aurora) fundoAurora(ctx, P, grao); else fundoCrepusculo(ctx);
    if (!aurora) { ctx.globalAlpha = 0.06; ctx.globalCompositeOperation = 'overlay'; ctx.fillStyle = grao; ctx.fillRect(0, 0, W, H); ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over'; }
    moldura(ctx, aurora);
    logo(ctx, P, W / 2, 128, 280);

    ctx.fillStyle = P.accent; ctx.font = F(600, 28, P.fu); espacar(ctx, 7); centro(ctx, TEXTO.eyebrow, 262); espacar(ctx, 0);

    desenharCarta(ctx, aurora, img, (W - cw) / 2, cartaTop, cw, ch, grao, mat);

    let y = cartaTop + ch + mat + 40 + nomePx * 0.8;
    ctx.fillStyle = P.ink; ctx.font = nomeFont(nomePx);
    nomeLinhas.forEach((l) => { centro(ctx, l, y); y += nomeLh; });
    y += 20 - nomeLh + tituloPx;
    ctx.fillStyle = P.soft; ctx.font = `italic 400 ${tituloPx}px ${P.fd}`; centro(ctx, titulo, y);

    if (pergunta) {
        y += 56; divisor(ctx, P, aurora, y); y += 66;
        ctx.fillStyle = P.mute; ctx.font = F(600, 24, P.fu); espacar(ctx, 5); centro(ctx, TEXTO.pergunta, y); espacar(ctx, 0); y += 58;
        ctx.fillStyle = P.ink; ctx.font = `italic ${aurora ? 400 : 500} ${qPx}px ${P.fd}`;
        qLinhas.forEach((l) => { centro(ctx, l, y); y += qLh; });
    }

    ctx.fillStyle = P.mute; ctx.font = F(500, 26, P.fu); espacar(ctx, 7); centro(ctx, TEXTO.site, rodapeY); espacar(ctx, 0);
    return cv;
}

export const paraBlob = (cv) => new Promise((resolve) => cv.toBlob(resolve, 'image/jpeg', 0.92));

function nomeArquivo(data, prefixo = 'aeon-carta-do-dia') {
    return `${prefixo}-${data}.jpg`;
}

/** Baixa o JPEG. Devolve false se o navegador nao entregou a imagem. */
export async function baixarCartao(cv, data, prefixo) {
    const blob = await paraBlob(cv);
    if (!blob) return false;
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = nomeArquivo(data, prefixo);
    document.body.appendChild(a);
    a.click();
    setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 800);
    return true;
}

/**
 * Compartilha a imagem pela Web Share API com arquivo; quando o aparelho nao aceita arquivos,
 * baixa o cartao. Resultado: 'compartilhado' | 'cancelado' | 'baixado' | 'erro'.
 */
export async function compartilharCartao(cv, data, carta) {
    const blob = await paraBlob(cv);
    if (!blob) return 'erro';
    const arquivo = new File([blob], nomeArquivo(data), { type: 'image/jpeg' });
    try {
        if (navigator.canShare && navigator.canShare({ files: [arquivo] })) {
            await navigator.share({ files: [arquivo], title: 'Aeon Fool', text: TEXTO.textoCompartilhar(carta.name) });
            return 'compartilhado';
        }
    } catch (e) {
        if (e && e.name === 'AbortError') return 'cancelado';
    }
    return (await baixarCartao(cv, data)) ? 'baixado' : 'erro';
}

let dialogo = null;
let ultimo = null;

function montar() {
    dialogo = document.createElement('dialog');
    dialogo.className = 'sheet cartao-sheet';
    dialogo.setAttribute('aria-labelledby', 'cartao-titulo');
    dialogo.innerHTML = `
        <div class="sheet-head">
            <h2 id="cartao-titulo">${TEXTO.titulo}</h2>
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
        msg((await baixarCartao(ultimo.cv, ultimo.dados.data)) ? TEXTO.salvo : TEXTO.falhou);
    });
    dialogo.querySelector('[data-compartilhar]').addEventListener('click', async () => {
        if (!ultimo) return;
        const r = await compartilharCartao(ultimo.cv, ultimo.dados.data, ultimo.dados.carta);
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
        const cv = await gerarCartao(dados);
        if (pedido !== desenhar.n) return; // chegou um pedido mais novo
        cv.setAttribute('role', 'img');
        cv.setAttribute('aria-label', TEXTO.previa(dados.carta.name));
        previa.replaceChildren(cv);
        ultimo = { cv, dados };
        msg.textContent = '';
        dialogo.dataset.pronto = 'true';
    } catch (e) {
        msg.textContent = TEXTO.falhou;
    }
}

/** Abre a previa do cartao com Baixar e Compartilhar. dados: { carta, pergunta, data } */
export function abrirCartao(dados) {
    if (!dialogo) montar();
    dialogo.dataset.pronto = 'false';
    dialogo.querySelector('[data-previa]').replaceChildren();
    ultimo = null;
    if (!dialogo.open) dialogo.showModal();
    return desenhar(dados);
}
