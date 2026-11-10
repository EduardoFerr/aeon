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
    if (a && a !== document.body && document.contains(a)) return;
    const h = document.querySelector(sel) || document.querySelector('#page-title');
    if (!h) return;
    if (!h.hasAttribute('tabindex')) h.setAttribute('tabindex', '-1');
    h.focus({ preventScroll: true });
}

const TELAS_PERFIL = {
    perfil: ['perfil-screen', () => import('../components/PerfilScreen.js')],
    'novo-mapa': ['novo-mapa-screen', () => import('../components/NovoMapaScreen.js')],
    mapa: ['mapa-screen', () => import('../components/MapaScreen.js')],
};
let corrida = 0;

export function navigateTo(page, estado = null) {
    const appContainer = document.getElementById('app');
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
            window.scrollTo(0, 0);
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
            navigateTo(page); // Chama a função de navegação com a página correspondente
        });
    });
}


document.addEventListener('DOMContentLoaded', () => {
    setupNavigation(); // Configura os links do menu
    navigateTo('home'); // Carrega a página inicial por padrão
});
