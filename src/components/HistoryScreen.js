import { getHistory } from '../utils/storage.js';

export class HistoryScreen extends HTMLElement {
    connectedCallback() {
        const history = getHistory();
        this.innerHTML = `
            <section class="history-screen">
                <ul>
                    ${history
                        .map((entry) => {
                            const cards = Object.values(entry.cards);
                            return `
                                <li>${entry.date}: ${cards
                                    .map((card) => card.name)
                                    .join(', ')}</li>
                            `;
                        })
                        .join('')}
                </ul>
                <button onclick="navigateTo('home')">Voltar</button>
            </section>
        `;
        document.querySelector('header>h1').textContent = "Histórico de Leituras";
    }
}

customElements.define('history-screen', HistoryScreen);
