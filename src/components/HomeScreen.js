import { navigateTo } from '../utils/navigation.js';

export class HomeScreen extends HTMLElement {
    connectedCallback() {
        this.innerHTML = `
            <div class="home-screen">
                <button onclick="navigateTo('all-cards')">Ver Todas as Cartas</button>
                <button onclick="navigateTo('three-card-game')">Jogo das 3 Cartas</button>
                <button onclick="navigateTo('history')">Ver Histórico</button>
            </div>
        `;
    }
}

customElements.define('home-screen', HomeScreen);
