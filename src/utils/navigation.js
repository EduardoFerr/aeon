export function navigateTo(page) {
    const appContainer = document.getElementById('app');
    appContainer.innerHTML = ''; // Limpa o conteúdo anterior

    let pageTitle = ''; // Definirá o título da página dinamicamente

    let pageImport; // O módulo a ser importado depende da página
    let componentTag; // O componente customizado a ser renderizado

    switch (page) {
        case 'all-cards':
            pageTitle = "Todas as cartas";
            pageImport = import('../components/AllCardsScreen.js');
            componentTag = '<all-cards-screen></all-cards-screen>';
            break;
        case 'three-card-game':
            pageTitle = "Jogo das 3 cartas";
            pageImport = import('../components/ThreeCardGameScreen.js');
            componentTag = '<three-card-game-screen></three-card-game-screen>';
            break;
        case 'history':
            pageImport = import('../components/HistoryScreen.js');
            componentTag = '<history-screen></history-screen>';
            break;
        default: // Página inicial
            pageTitle = "Home";
            pageImport = import('../components/HomeScreen.js');
            componentTag = '<home-screen></home-screen>';
            break;
    }

    pageImport.then(() => {
        if (pageTitle) {
            const headerTitle = document.querySelector('header > h1');
            if (headerTitle) {
                headerTitle.textContent = pageTitle;
            }
        }
        appContainer.innerHTML = componentTag;
    });
}

export function setupNavigation() {
    const links = document.querySelectorAll('nav a');
    links.forEach(link => {
        link.addEventListener('click', (event) => {
            const href = link.getAttribute('href');
            if (href && href.endsWith('.html')) {
                return;
            }

            event.preventDefault();
            const page = link.getAttribute('data-page');
            console.log('Navegando para:', page);
            navigateTo(page);
        });
    });
}

document.addEventListener('DOMContentLoaded', () => {
    setupNavigation();
    navigateTo('home');
});
