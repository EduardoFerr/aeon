/** Marca no menu a pagina atual (so visual e aria-current; a navegacao em si nao muda). */
function marcarNavAtual(page) {
    const PERFIL = ['perfil', 'novo-mapa', 'mapa'];
    const atual = PERFIL.includes(page) ? 'perfil' : ['all-cards', 'three-card-game', 'history'].includes(page) ? page : 'home';
    document.querySelectorAll('.mainnav a[data-page]').forEach((link) => {
        if (link.dataset.page === atual) link.setAttribute('aria-current', 'page');
        else link.removeAttribute('aria-current');
    });
}

/* Estado de uma navegacao para outra (so em memoria; dados de nascimento nunca vao para URL, hash nem query). */
let estadoNav = null;
export function consumirEstado() {
    const e = estadoNav;
    estadoNav = null;
    return e;
}

/**
 * Depois de trocar de tela por um botao (que sai do DOM), o foco cairia no body e o teclado voltaria
 * ao inicio da pagina. Leva o foco ao titulo da nova tela, so se ninguem mais o tem.
 */
export function focarCabecalho(sel) {
    const a = document.activeElement;
    if (a && a !== document.body && document.getElementById('app').contains(a)) return;
    const h = document.querySelector(sel) || document.querySelector('#page-title');
    if (!h) return;
    if (!h.hasAttribute('tabindex')) h.setAttribute('tabindex', '-1');
    h.focus({ preventScroll: true });
}

/* Rolagem por tela (so em memoria: sem URL, hash nem localStorage). */
const posicoes = {};
let telaAtual = null;
let primeira = true;
let montada = false; // so guarda a rolagem de uma tela que chegou a montar
const abaDe = (page) => (['perfil', 'novo-mapa', 'mapa'].includes(page) ? 'perfil' : page);
const reduz = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
const irPara = (y) => window.scrollTo({ top: y, left: 0, behavior: 'auto' }); // nunca animado: nao e um gesto do usuario

/**
 * Posiciona a tela recem-montada. y = 0 abre no topo; y > 0 restaura e reaplica por um instante,
 * porque cartas/imagens/fontes podem mudar a altura depois da montagem. Qualquer gesto do usuario
 * (roda, toque, teclado) cancela a reaplicacao.
 */
let cancelarAjuste = null;
function posicionar(y) {
    if (cancelarAjuste) cancelarAjuste();
    irPara(y);
    if (!y) return;
    const alvo = () => Math.min(y, Math.max(0, document.documentElement.scrollHeight - innerHeight));
    let vivo = true;
    const fim = () => {
        vivo = false;
        cancelarAjuste = null;
        ['wheel', 'touchstart', 'keydown', 'mousedown'].forEach((t) => removeEventListener(t, fim, true));
        ro.disconnect();
    };
    const reaplicar = () => { if (vivo && Math.abs(scrollY - alvo()) > 1) irPara(alvo()); };
    const ro = new ResizeObserver(reaplicar);
    ro.observe(document.getElementById('app'));
    ['wheel', 'touchstart', 'keydown', 'mousedown'].forEach((t) => addEventListener(t, fim, { capture: true, passive: true }));
    cancelarAjuste = fim;
    requestAnimationFrame(reaplicar);
    setTimeout(fim, 900);
}

/** Depois de montar: rolagem + foco no titulo da tela (sem rolar). */
function concluir(page, y) {
    posicionar(y);
    telaAtual = page;
    montada = true;
    if (primeira) { primeira = false; return; } // na carga nao rouba o foco
    if (TELAS_PERFIL[page]) return; // essas telas focam o proprio titulo quando terminam de montar
    const a = document.activeElement;
    const dentro = a && document.getElementById('app').contains(a);
    if (dentro) return;
    const h = document.querySelector('#page-title');
    if (!h || h.closest('[hidden]')) return;
    if (!h.hasAttribute('tabindex')) h.setAttribute('tabindex', '-1');
    h.focus({ preventScroll: true });
}

const TELAS_PERFIL = {
    perfil: ['perfil-screen', () => import('../components/PerfilScreen.js')],
    'novo-mapa': ['novo-mapa-screen', () => import('../components/NovoMapaScreen.js')],
    mapa: ['mapa-screen', () => import('../components/MapaScreen.js')],
};
let corrida = 0;

/**
 * opts.aba: veio da barra de navegacao, entao restaura a rolagem guardada da aba (senao, topo).
 * Voltar para a tela raiz da mesma aba (ex.: mapa -> perfil) tambem restaura. O resto abre no topo.
 */
export function navigateTo(page, estado = null, opts = {}) {
    const appContainer = document.getElementById('app');
    const de = telaAtual;
    if (de && montada) posicoes[de] = window.scrollY;
    montada = false;
    const voltando = !!de && de !== page && abaDe(de) === abaDe(page) && page === abaDe(page);
    const y = (opts.aba || voltando) ? posicoes[page] || 0 : 0;
    appContainer.innerHTML = '';
    marcarNavAtual(page);
    const minha = ++corrida;
    const titulo = document.querySelector('.page-title');
    if (titulo) titulo.hidden = page === 'perfil'; // o perfil tem o proprio h1
    estadoNav = estado;

    if (TELAS_PERFIL[page]) {
        const [tag, carregar] = TELAS_PERFIL[page];
        carregar().then(() => {
            if (minha !== corrida) return;
            appContainer.innerHTML = `<${tag}></${tag}>`;
            concluir(page, y);
        });
        return;
    }

    if (page === 'all-cards') {
        appContainer.innerHTML = '<all-cards-screen></all-cards-screen>';
    } else if (page === 'three-card-game') {
        appContainer.innerHTML = '<three-card-game-screen></three-card-game-screen>';
    } else if (page === 'history') {
        appContainer.innerHTML = '<history-screen></history-screen>';
    } else {
        appContainer.innerHTML = '<home-screen></home-screen>';
    }
    concluir(page, y);
}
export function setupNavigation() {
    const links = document.querySelectorAll('nav a'); // Seleciona todos os links no menu
    links.forEach(link => {
        link.addEventListener('click', (event) => {
            const href = link.getAttribute('href'); // Obtém o valor do atributo href

            // Permite a navegação padrão para links que levam a páginas externas (como .html)
            if (href && href.endsWith('.html')) {
                return; // Não interrompe a navegação
            }

            // Intercepta a navegação apenas para links internos (data-page)
            event.preventDefault(); // Evita o comportamento padrão do link
            const page = link.getAttribute('data-page'); // Obtém o valor do atributo data-page
            navigateTo(page, null, { aba: true }); // Chama a função de navegação com a página correspondente
        });
    });
}


document.addEventListener('DOMContentLoaded', () => {
    setupNavigation(); // Configura os links do menu
    navigateTo('home'); // Carrega a página inicial por padrão
});
