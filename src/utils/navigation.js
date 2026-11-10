/** Marca no menu a pagina atual (so visual e aria-current; a navegacao em si nao muda). */
function marcarNavAtual(page) {
    const atual = ['all-cards', 'three-card-game', 'history'].includes(page) ? page : 'home';
    document.querySelectorAll('.mainnav a[data-page]').forEach((link) => {
        if (link.dataset.page === atual) link.setAttribute('aria-current', 'page');
        else link.removeAttribute('aria-current');
    });
}

export function navigateTo(page) {
    const appContainer = document.getElementById('app');
    appContainer.innerHTML = '';
    marcarNavAtual(page);

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
