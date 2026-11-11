import { esconderAviso } from '../components/Sobreposicao.js';
import { iniciarAtualizacao } from './atualizacao.js';
import { SYNC_ATIVA } from './contaEstado.js';
import { iniciarVerso } from './verso.js';

// Todas as paginas carregam este arquivo: e daqui que o service worker e registrado e que a versao nova e avisada.
iniciarAtualizacao();

// Verso das cartas: o do signo solar de quem tem mapa principal, ou o padrao do Aeon.
iniciarVerso();

// Sincronizacao com a conta: so existe no build com VITE_SYNC=1 (o if some do pacote quando desligada).
if (SYNC_ATIVA) import('./conta.js').then((m) => m.iniciarConta());

/**
 * Tema da pagina (Crepusculo e Aurora). O script inline do <head> escolhe o tema antes da primeira
 * pintura e define window.AEON_THEMES. Aqui ficam o botao "Tema", o painel com as duas opcoes e a
 * troca ao vivo: so muda data-theme, entao leitura em andamento e modal aberto continuam como estao.
 */
const KEY = 'aeon.tema';

const TEXTO = {
    rotulo: 'Tema',
    grupo: 'Escolha o tema da página. Dois temas disponíveis.',
    ordem: ['crepusculo', 'aurora'],
    opcoes: {
        crepusculo: {
            nome: 'Crepúsculo',
            desc: 'Escuro e pêssego.',
            aria: 'Tema Crepúsculo, versão escura, fundo ameixa com detalhes dourados.',
        },
        aurora: {
            nome: 'Aurora',
            desc: 'Claro e ultramar.',
            aria: 'Tema Aurora, versão clara, fundo de papel com azul ultramar.',
        },
    },
    selecionado: 'Selecionado.',
    naoSelecionado: 'Não selecionado.',
    fechar: 'Fechar',
    abrir: (nome) => `Tema: ${nome}. Abrir o seletor de tema.`,
};

const ICONE_FECHAR = '<svg class="icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg>';
const ICONE_OK = '<svg class="icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>';
const html = document.documentElement;
const TEMAS = window.AEON_THEMES || {};

let dialogo = null;
let grupo = null;

const atual = () => html.getAttribute('data-theme') || 'crepusculo';
const nome = (t) => TEXTO.opcoes[t].nome;
const reduz = () => window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;

function carregarFontes(t) {
    const info = TEMAS[t];
    if (!info) return Promise.resolve();
    const id = `font-${t}`;
    const pronto = new Promise((resolve) => {
        if (document.getElementById(id)) return resolve();
        const link = document.createElement('link');
        link.rel = 'stylesheet';
        link.href = info.fonts;
        link.id = id;
        link.onload = resolve;
        link.onerror = resolve;
        document.head.appendChild(link);
        setTimeout(resolve, 3000);
    });
    return pronto.then(() => {
        if (!document.fonts || !document.fonts.load) return;
        const faces = Promise.all(info.faces.map((f) => document.fonts.load(f))).catch(() => {});
        return Promise.race([faces, new Promise((r) => setTimeout(r, 1600))]);
    });
}

function salvar(t) {
    try { localStorage.setItem(KEY, t); } catch (e) { /* sem armazenamento: o tema vale so nesta visita */ }
}

function aplicar(t, persistir) {
    html.setAttribute('data-theme', t);
    if (TEMAS[t]) {
        html.style.colorScheme = TEMAS[t].scheme;
        const meta = document.querySelector('meta[name="theme-color"]');
        if (meta) meta.setAttribute('content', TEMAS[t].color);
    }
    if (persistir) salvar(t);
    pintar();
    document.dispatchEvent(new CustomEvent('aeon:tema', { detail: t }));
}

/** Troca o tema sem recarregar. So o par de fontes do tema pedido e baixado, na primeira vez. */
export function definirTema(t, persistir = true) {
    if (!TEXTO.opcoes[t] || t === atual()) return Promise.resolve();
    return carregarFontes(t).then(() => {
        if (document.startViewTransition && !reduz() && !document.hidden) {
            html.classList.add('theme-vt');
            let feito = false;
            const rodar = () => { if (feito) return; feito = true; aplicar(t, persistir); };
            const vt = document.startViewTransition(rodar);
            // ready e updateCallbackDone tambem rejeitam quando a transicao e abortada
            // (por exemplo se a janela muda de tamanho no meio da troca): sem isto o
            // navegador registra "Uncaught (in promise) InvalidStateError" no console.
            vt.ready.catch(() => {});
            vt.updateCallbackDone.catch(() => {});
            // se a transicao travar, troca mesmo assim
            setTimeout(() => { if (!feito) { try { vt.skipTransition(); } catch (e) { /* ok */ } rodar(); } }, 1500);
            return vt.finished.catch(() => {}).then(() => html.classList.remove('theme-vt'));
        }
        if (!reduz()) {
            html.classList.add('theme-anim');
            aplicar(t, persistir);
            setTimeout(() => html.classList.remove('theme-anim'), 520);
        } else {
            aplicar(t, persistir);
        }
    });
}

function pintar() {
    const cur = atual();
    if (!TEXTO.opcoes[cur]) return;
    document.querySelectorAll('.themebtn').forEach((b) => {
        b.setAttribute('aria-label', TEXTO.abrir(nome(cur)));
        b.title = `${TEXTO.rotulo}: ${nome(cur)}`;
        const tl = b.querySelector('.tl');
        if (tl) tl.textContent = TEXTO.rotulo;
    });
    if (!grupo) return;
    grupo.querySelectorAll('[role="radio"]').forEach((r) => {
        const t = r.dataset.t;
        const ligado = t === cur;
        r.setAttribute('aria-checked', String(ligado));
        r.tabIndex = ligado ? 0 : -1;
        r.setAttribute('aria-label', `${TEXTO.opcoes[t].aria} ${ligado ? TEXTO.selecionado : TEXTO.naoSelecionado}`);
    });
}

function montarPainel() {
    dialogo = document.createElement('dialog');
    dialogo.className = 'sheet';
    dialogo.id = 'themeDlg';
    dialogo.setAttribute('aria-labelledby', 'themeDlgTitulo');
    dialogo.innerHTML = `
        <div class="sheet-head">
            <h2 id="themeDlgTitulo">${TEXTO.rotulo}</h2>
            <button class="iconbtn round" type="button" id="themeDlgFechar" aria-label="${TEXTO.fechar}">${ICONE_FECHAR}</button>
        </div>
        <div class="themes" role="radiogroup" aria-label="${TEXTO.grupo}">
            ${TEXTO.ordem.map((t) => `
                <div class="themeopt" role="radio" data-t="${t}" aria-checked="false" tabindex="-1">
                    <span class="pv" data-theme="${t}" aria-hidden="true">
                        <span><span class="pv-eb">Tarot de Thoth</span><span class="pv-ti" style="display:block">Carta do dia</span></span>
                        <span class="pv-ca"><span class="pv-carta"></span><span class="pv-lin"><i></i><i></i></span></span>
                        <span><span class="pv-bt">Virar</span></span>
                        <span class="pv-ck">${ICONE_OK}</span>
                    </span>
                    <span class="tx"><b>${TEXTO.opcoes[t].nome}</b><span>${TEXTO.opcoes[t].desc}</span></span>
                </div>`).join('')}
        </div>`;
    document.body.appendChild(dialogo);
    grupo = dialogo.querySelector('.themes');

    dialogo.querySelector('#themeDlgFechar').addEventListener('click', () => dialogo.close());
    dialogo.addEventListener('click', (e) => { if (e.target === dialogo) dialogo.close(); });
    // Esc fecha so o painel: sem isto o modal da carta, por baixo, tambem fecharia e a leitura aberta se perderia
    dialogo.addEventListener('keydown', (e) => { if (e.key === 'Escape') e.stopPropagation(); });

    const escolher = (r) => definirTema(r.dataset.t, true);
    grupo.addEventListener('click', (e) => {
        const r = e.target.closest('[role="radio"]');
        if (r) escolher(r);
    });
    grupo.addEventListener('keydown', (e) => {
        const radios = [...grupo.querySelectorAll('[role="radio"]')];
        const i = radios.indexOf(document.activeElement);
        if (i < 0) return;
        let n = -1;
        if (e.key === 'ArrowRight' || e.key === 'ArrowDown') n = (i + 1) % radios.length;
        else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') n = (i - 1 + radios.length) % radios.length;
        if (e.key === 'Home') n = 0;
        else if (e.key === 'End') n = radios.length - 1;
        if (n >= 0) {
            e.preventDefault();
            radios[n].focus();
            escolher(radios[n]);
        } else if (e.key === ' ' || e.key === 'Enter') {
            e.preventDefault();
            escolher(radios[i]);
        }
    });
    pintar();
}

export function abrirSeletor() {
    esconderAviso();
    TEXTO.ordem.forEach((t) => carregarFontes(t)); // as miniaturas mostram a fonte de cada tema
    if (!dialogo) montarPainel();
    pintar();
    if (!dialogo.open) dialogo.showModal();
    const ligado = grupo.querySelector('[aria-checked="true"]');
    if (ligado) ligado.focus();
}

document.addEventListener('click', (e) => {
    if (e.target.closest('.themebtn')) abrirSeletor();
});
pintar();
document.addEventListener('DOMContentLoaded', pintar);
