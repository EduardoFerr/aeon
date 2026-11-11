import { ic } from '../utils/glifos.js';

/**
 * Sobreposicoes do app: menu lateral (gaveta), bottom sheet, dialogo, popover e confirmacao.
 * Todas: role dialog (alertdialog na confirmacao), aria-modal, foco preso e devolvido ao gatilho,
 * Esc, fundo inert, rolagem do fundo travada, animacao so com transform e opacity (240 a 320 ms)
 * e sem animacao com prefers-reduced-motion. O sheet arrasta pela alca (desce mais de 60 px fecha)
 * e tem o botao ampliar/reduzir como alternativa ao gesto.
 */
const FOCAVEL = 'a[href],button:not([disabled]),input:not([disabled]):not([type="hidden"]),select:not([disabled]),textarea:not([disabled]),summary,[tabindex]:not([tabindex="-1"])';
const T = { fechar: 'Fechar', ampliar: 'Ampliar painel', reduzir: 'Reduzir painel', alca: 'Arrastar para fechar ou ampliar' };
const DURACAO = { gaveta: 300, sheet: 300, dialogo: 260, confirmacao: 260, popover: 240 };

export const ehDesktop = () => matchMedia('(min-width: 900px)').matches;
export const reduzMovimento = () => matchMedia('(prefers-reduced-motion: reduce)').matches;

export function focaveis(raiz) {
    return [...raiz.querySelectorAll(FOCAVEL)].filter((e) => !e.closest('[inert]') && e.getClientRects().length > 0 && getComputedStyle(e).visibility !== 'hidden');
}

let travas = 0;
let overflowAntes = '';
function travarRolagem() {
    if (travas++ === 0) {
        overflowAntes = document.body.style.overflow;
        document.body.style.overflow = 'hidden';
    }
}
function liberarRolagem() {
    if (--travas <= 0) {
        travas = 0;
        document.body.style.overflow = overflowAntes;
    }
}

/**
 * Torna `raiz` a unica parte interativa da pagina: irmaos de cada ancestral ficam inert, a rolagem
 * do fundo trava e Tab/Shift+Tab circulam dentro dela. Devolve { liberar }.
 */
export function ativarModal(raiz, { aoEsc, modal = true } = {}) {
    const inertes = [];
    if (modal) {
        let no = raiz;
        while (no && no !== document.body && no.parentElement) {
            const pai = no.parentElement;
            for (const irmao of pai.children) {
                if (irmao !== no && !irmao.inert && !['SCRIPT', 'STYLE', 'LINK'].includes(irmao.tagName)) {
                    irmao.inert = true;
                    inertes.push(irmao);
                }
            }
            no = pai;
        }
        travarRolagem();
    }
    const aoTeclar = (e) => {
        if (e.key === 'Escape' && aoEsc) {
            e.preventDefault();
            e.stopPropagation();
            aoEsc();
            return;
        }
        if (e.key !== 'Tab' || !modal) return;
        const f = focaveis(raiz);
        if (!f.length) {
            e.preventDefault();
            return;
        }
        const a = document.activeElement;
        const p = f[0];
        const u = f[f.length - 1];
        if (e.shiftKey && (a === p || !raiz.contains(a))) {
            e.preventDefault();
            u.focus();
        } else if (!e.shiftKey && (a === u || !raiz.contains(a))) {
            e.preventDefault();
            p.focus();
        }
    };
    raiz.addEventListener('keydown', aoTeclar);
    let feito = false;
    return {
        liberar() {
            if (feito) return;
            feito = true;
            raiz.removeEventListener('keydown', aoTeclar);
            inertes.forEach((e) => {
                e.inert = false;
            });
            if (modal) liberarRolagem();
        },
    };
}

let seq = 0;

/**
 * Abre uma sobreposicao.
 * @param {{tipo:'gaveta'|'sheet'|'dialogo'|'popover'|'confirmacao', titulo:string, corpo:string|Node,
 *   gatilho?:HTMLElement, ancora?:HTMLElement, foco?:string, fecharFora?:boolean, contexto?:string,
 *   aoFechar?:Function, classe?:string, descricao?:string}} o
 * `sheet` vira dialogo no desktop; `popover` vira sheet no celular.
 * @returns {{raiz:HTMLElement, painel:HTMLElement, corpo:HTMLElement, fechar:Function, trocarCorpo:Function, aberto:boolean}}
 */
export function abrir(o) {
    esconderAviso();
    const desk = ehDesktop();
    let tipo = o.tipo;
    if (tipo === 'sheet' && desk) tipo = 'dialogo';
    if (tipo === 'popover' && !desk) tipo = 'sheet';
    const modal = tipo !== 'popover';
    const gatilho = o.gatilho || document.activeElement;
    const id = `sob-t-${++seq}`;
    const ehSheet = tipo === 'sheet';
    const raiz = document.createElement('div');
    raiz.className = `sob sob-r-${tipo}`;
    const papel = tipo === 'confirmacao' ? 'alertdialog' : 'dialog';
    const alca = ehSheet ? `<button type="button" class="sob-alca" aria-label="${T.alca}"><span></span></button>` : '';
    const ampliar = ehSheet ? `<button type="button" class="iconbtn round" data-sob-alt aria-label="${T.ampliar}">${ic('subir')}</button>` : '';
    raiz.innerHTML = `<div class="sob-fundo"></div>
        <section class="sob-pn sob-${tipo} ${o.classe || ''}" role="${papel}" aria-modal="${modal}" aria-labelledby="${id}"${o.descricao ? ` aria-describedby="${id}-d"` : ''} data-h="meia">
            ${alca}
            <header class="sob-cab"><h2 id="${id}" tabindex="-1">${o.titulo}</h2><span class="sob-bt">${ampliar}<button type="button" class="iconbtn round" data-sob-x aria-label="${T.fechar}">${ic('x')}</button></span></header>
            ${o.contexto ? `<div class="sob-ctx">${o.contexto}</div>` : ''}
            <div class="sob-corpo"></div>
        </section>`;
    const painel = raiz.querySelector('.sob-pn');
    const corpo = raiz.querySelector('.sob-corpo');
    const poe = (c) => {
        if (typeof c === 'string') corpo.innerHTML = c;
        else {
            corpo.textContent = '';
            corpo.append(c);
        }
    };
    poe(o.corpo);
    if (o.descricao) {
        const p1 = corpo.querySelector('p');
        if (p1) p1.id = `${id}-d`;
        else painel.removeAttribute('aria-describedby');
    }
    document.body.append(raiz);

    // popover: posiciona junto da ancora sem sair da janela
    if (tipo === 'popover') {
        const a = o.ancora || gatilho;
        const r = a && a.getBoundingClientRect ? a.getBoundingClientRect() : { left: 24, bottom: 120, top: 100 };
        const larg = Math.min(360, innerWidth - 24);
        painel.style.width = `${larg}px`;
        const left = Math.max(12, Math.min(r.left, innerWidth - larg - 12));
        painel.style.left = `${left}px`;
        const abaixo = innerHeight - r.bottom - 16;
        const acima = r.top - 16;
        if (abaixo >= 260 || abaixo >= acima) {
            painel.style.top = `${r.bottom + 8}px`;
            painel.style.maxHeight = `${Math.max(160, abaixo - 8)}px`;
        } else {
            painel.style.bottom = `${innerHeight - r.top + 8}px`;
            painel.style.maxHeight = `${Math.max(160, acima - 8)}px`;
        }
    }

    let aberto = true;
    const ctrl = { raiz, painel, corpo, trocarCorpo: poe, get aberto() { return aberto; } };
    const instante = reduzMovimento();
    const modalCtl = ativarModal(raiz, { aoEsc: () => fechar(), modal });

    function fechar(devolver = true) {
        if (!aberto) return;
        aberto = false;
        document.removeEventListener('pointerdown', fora, true);
        raiz.classList.remove('on');
        modalCtl.liberar();
        const sair = () => raiz.remove();
        if (instante) sair();
        else setTimeout(sair, (DURACAO[tipo] || 300) + 40);
        if (devolver && gatilho && gatilho.isConnected && gatilho.focus) gatilho.focus({ preventScroll: true });
        if (o.aoFechar) o.aoFechar();
    }
    ctrl.fechar = fechar;

    const fora = (e) => {
        if (!painel.contains(e.target) && e.target !== gatilho && !(gatilho && gatilho.contains && gatilho.contains(e.target))) fechar();
    };
    if (tipo === 'popover') document.addEventListener('pointerdown', fora, true);
    else if (o.fecharFora !== false && tipo !== 'confirmacao') raiz.querySelector('.sob-fundo').addEventListener('click', () => fechar());
    painel.querySelector('[data-sob-x]').addEventListener('click', () => fechar());

    // popover nao prende o foco: Tab para fora do ultimo item fecha e volta ao gatilho
    if (tipo === 'popover') {
        painel.addEventListener('keydown', (e) => {
            if (e.key !== 'Tab') return;
            const f = focaveis(painel);
            const a = document.activeElement;
            if ((!e.shiftKey && a === f[f.length - 1]) || (e.shiftKey && a === f[0])) {
                e.preventDefault();
                fechar();
            }
        });
    }

    if (ehSheet) {
        const alt = painel.querySelector('[data-sob-alt]');
        const alcaBtn = painel.querySelector('.sob-alca');
        const alternar = (para) => {
            const cheio = para ? para === 'cheia' : painel.dataset.h !== 'cheia';
            painel.dataset.h = cheio ? 'cheia' : 'meia';
            alt.setAttribute('aria-label', cheio ? T.reduzir : T.ampliar);
            alt.innerHTML = ic(cheio ? 'descer' : 'subir');
        };
        alt.addEventListener('click', () => alternar());
        let y0 = null;
        let moveu = false;
        alcaBtn.addEventListener('pointerdown', (e) => {
            y0 = e.clientY;
            moveu = false;
            alcaBtn.setPointerCapture(e.pointerId);
            painel.classList.add('arrastando');
        });
        alcaBtn.addEventListener('pointermove', (e) => {
            if (y0 == null) return;
            const d = e.clientY - y0;
            if (Math.abs(d) > 4) moveu = true;
            painel.style.transform = `translateY(${Math.max(0, d)}px)`;
        });
        const soltar = (e) => {
            if (y0 == null) return;
            const d = e.clientY - y0;
            y0 = null;
            painel.classList.remove('arrastando');
            painel.style.transform = '';
            if (d > 60) fechar();
            else if (d < -40) alternar('cheia');
            else if (!moveu) alternar();
        };
        alcaBtn.addEventListener('pointerup', soltar);
        alcaBtn.addEventListener('pointercancel', () => {
            y0 = null;
            painel.classList.remove('arrastando');
            painel.style.transform = '';
        });
        // sem gesto: setas na alca ampliam e reduzem
        alcaBtn.addEventListener('keydown', (e) => {
            if (e.key === 'ArrowUp') {
                e.preventDefault();
                alternar('cheia');
            } else if (e.key === 'ArrowDown') {
                e.preventDefault();
                if (painel.dataset.h === 'cheia') alternar('meia');
                else fechar();
            }
        });
    }

    const ligar = () => raiz.classList.add('on');
    if (instante) ligar();
    else requestAnimationFrame(() => requestAnimationFrame(ligar));

    // foco inicial: o seletor pedido, o botao seguro da confirmacao, ou o botao de fechar
    const iniciar = () => {
        const alvo = (o.foco && corpo.querySelector(o.foco)) || corpo.querySelector('[data-foco]') || painel.querySelector('[data-sob-x]');
        if (alvo) alvo.focus({ preventScroll: true });
    };
    iniciar();
    requestAnimationFrame(() => {
        if (aberto && !painel.contains(document.activeElement)) iniciar();
    });
    return ctrl;
}

let toastEl = null;
let toastTimer = 0;
let agendarAtual = null;
/** Fecha o aviso na tela (e apaga o texto depois da saida), para o proximo dialogo ou menu nao herdar a mensagem. */
export function esconderAviso() {
    if (!toastEl) return;
    clearTimeout(toastTimer);
    agendarAtual = null;
    toastEl.classList.remove('on');
    const el = toastEl;
    setTimeout(() => { if (!el.classList.contains('on')) el.innerHTML = ''; }, 300);
}
/**
 * Confirmacao curta ("Mapa guardado", "Texto copiado"). Fica numa regiao role=status, some sozinha.
 * Com `desfazer: { rotulo, aoClicar }` vira o aviso de uma exclusao: o botao "Desfazer" fica 8 s
 * (pausa com o ponteiro ou o foco em cima), e um novo aviso fecha o anterior sem desfazer nada.
 */
export function avisar(msg, { erro = false, desfazer = null } = {}) {
    if (!toastEl) {
        toastEl = document.createElement('div');
        toastEl.className = 'toast';
        toastEl.setAttribute('role', 'status');
        toastEl.setAttribute('aria-live', 'polite');
        document.body.append(toastEl);
        for (const a of ['pointerenter', 'focusin']) toastEl.addEventListener(a, () => clearTimeout(toastTimer));
        for (const a of ['pointerleave', 'focusout']) toastEl.addEventListener(a, () => agendarAtual && agendarAtual());
    }
    clearTimeout(toastTimer);
    toastEl.innerHTML = `${ic(erro ? 'erro' : 'ok')}<span></span>${desfazer ? `<button type="button" class="btn btn-terciario toast-acao">${desfazer.rotulo || 'Desfazer'}</button>` : ''}`;
    toastEl.classList.toggle('erro', erro);
    toastEl.classList.toggle('com-acao', !!desfazer);
    const esconder = () => toastEl && toastEl.classList.remove('on');
    const agendar = () => {
        clearTimeout(toastTimer);
        toastTimer = setTimeout(esconder, desfazer ? 8000 : 3200);
    };
    agendarAtual = agendar;
    if (desfazer) {
        const b = toastEl.querySelector('.toast-acao');
        b.addEventListener('click', () => {
            clearTimeout(toastTimer);
            esconder();
            desfazer.aoClicar();
        });
    }
    requestAnimationFrame(() => {
        toastEl.querySelector('span').textContent = msg;
        toastEl.classList.add('on');
    });
    agendar();
}
