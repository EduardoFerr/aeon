/* Telas da aba Tiragens: a escolha, a cruz, o templo e a leitura de tres cartas. */
const TIRAGENS = ['tiragens', 'cruz', 'templo', 'three-card-game'];

/** Marca no menu a pagina atual (so visual e aria-current; a navegacao em si nao muda). */
function marcarNavAtual(page) {
    const PERFIL = ['perfil', 'novo-mapa', 'mapa'];
    const atual = PERFIL.includes(page) ? 'perfil' : TIRAGENS.includes(page) ? 'tiragens' : ['all-cards', 'history'].includes(page) ? page : 'home';
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
const abaDe = (page) => (['perfil', 'novo-mapa', 'mapa'].includes(page) ? 'perfil' : TIRAGENS.includes(page) ? 'tiragens' : page);
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

/** Fade curto (so opacidade, 180 ms) da tela recem-montada. Sem movimento reduzido; nao mexe em rolagem nem foco. */
function entrarSuave() {
    const app = document.getElementById('app');
    app.classList.remove('tela-in');
    if (reduz()) return;
    void app.offsetWidth; // reinicia a animacao se a troca foi rapida
    app.classList.add('tela-in');
    app.addEventListener('animationend', () => app.classList.remove('tela-in'), { once: true });
}

/** Depois de montar: rolagem + foco no titulo da tela (sem rolar). */
function concluir(page, y) {
    posicionar(y);
    telaAtual = page;
    montada = true;
    if (primeira) { primeira = false; return; } // na carga nao rouba o foco
    entrarSuave();
    if (TELAS_PERFIL[page] || page === 'cruz' || page === 'templo') return; // essas telas focam o proprio titulo (ou o campo) quando terminam de montar
    const a = document.activeElement;
    const dentro = a && document.getElementById('app').contains(a);
    if (dentro) return;
    let h = document.querySelector('#page-title');
    if (!h || h.closest('[hidden]')) h = document.querySelector('#app h1'); // a Home tem o proprio h1
    if (!h) return;
    if (!h.hasAttribute('tabindex')) h.setAttribute('tabindex', '-1');
    h.focus({ preventScroll: true });
}

const TELAS_PERFIL = {
    perfil: ['perfil-screen', () => import('../components/PerfilScreen.js')],
    'novo-mapa': ['novo-mapa-screen', () => import('../components/NovoMapaScreen.js')],
    mapa: ['mapa-screen', () => import('../components/MapaScreen.js')],
};
/* Telas da aba Tiragens, carregadas sob demanda como as do Perfil. */
const TELAS_TIRAGENS = {
    tiragens: ['tiragens-screen', () => import('../components/TiragensScreen.js')],
    cruz: ['cruz-screen', () => import('../components/CruzScreen.js')],
    templo: ['templo-screen', () => import('../components/TemploScreen.js')],
};
let corrida = 0;

/*
 * Endereco de cada tela raiz (links reais: /?all-cards abre Cartas, e assim por diante). So o NOME da tela entra na
 * URL, nunca dado de nascimento, nome, mapa ou diario: mapa, novo mapa e edicao mostram o endereco do Perfil e,
 * aberto direto, caem no Perfil. O estado em history.state guarda so o nome da tela.
 */
const CHAVES = { 'all-cards': 'all-cards', tiragens: 'tiragens', cruz: 'cruz', templo: 'templo', 'three-card-game': 'three-card-game', history: 'history', perfil: 'profile' };
const SEM_URL = ['novo-mapa', 'mapa'];
const raizDe = (page) => (SEM_URL.includes(page) ? 'perfil' : page);
const buscaDe = (page) => (CHAVES[raizDe(page)] ? `?${CHAVES[raizDe(page)]}` : '');
const ALIAS = { 'all-cards': 'all-cards', tiragens: 'tiragens', cruz: 'cruz', templo: 'templo', 'three-card-game': 'three-card-game', history: 'history', profile: 'perfil', perfil: 'perfil', mapa: 'perfil', 'novo-mapa': 'perfil', editar: 'perfil' };
/** Tela pedida pela URL atual (a primeira chave conhecida da busca); sem chave conhecida, a Home. */
function paginaDaUrl() {
    for (const k of new URLSearchParams(location.search).keys()) if (ALIAS[k]) return ALIAS[k];
    return 'home';
}
function registrarHistorico(page, de, inicial) {
    const url = `${location.pathname}${buscaDe(page)}`;
    const estadoUrl = { tela: raizDe(page) };
    try {
        if (inicial) history.replaceState(estadoUrl, '', page === 'home' ? location.href : url);
        else if (de && de !== page) history.pushState(estadoUrl, '', url);
        else history.replaceState(estadoUrl, '', url);
    } catch (e) { /* ambiente sem History API: a navegacao segue funcionando sem URL */ }
}

/**
 * opts.aba: veio da barra de navegacao, entao restaura a rolagem guardada da aba (senao, topo).
 * opts.semHistorico: a URL ja esta certa (Voltar/Avancar do navegador); opts.inicial: primeira tela da pagina.
 * Voltar para a tela raiz da mesma aba (ex.: mapa -> perfil) tambem restaura. O resto abre no topo.
 */
export function navigateTo(page, estado = null, opts = {}) {
    if (!opts.semHistorico) registrarHistorico(page, telaAtual, !!opts.inicial);
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

    if (TELAS_PERFIL[page] || TELAS_TIRAGENS[page]) {
        const [tag, carregar] = TELAS_PERFIL[page] || TELAS_TIRAGENS[page];
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
            // Ctrl/Cmd/Shift/Alt ou botao do meio: deixa o navegador abrir o link real em outra aba
            if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button) return;

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


/* Voltar e Avancar do navegador: a tela vem do estado da entrada (so o nome) ou, sem ele, da URL. */
window.addEventListener('popstate', (e) => {
    const alvo = raizDe((e.state && e.state.tela) || paginaDaUrl());
    if (alvo === telaAtual) return; // so mudou o fragmento (#main) ou a entrada e a mesma tela
    navigateTo(alvo, null, { aba: true, semHistorico: true });
});

document.addEventListener('DOMContentLoaded', () => {
    try { history.scrollRestoration = 'manual'; } catch (e) { /* a rolagem por tela e nossa */ }
    setupNavigation(); // Configura os links do menu
    navigateTo(paginaDaUrl(), null, { inicial: true }); // abre a tela da URL (Home sem chave conhecida)
});
