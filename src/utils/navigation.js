export function navigateTo(page) {
    const appContainer = document.getElementById('app');
    appContainer.innerHTML = '';

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
