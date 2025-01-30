import { getHistory } from '../utils/storage.js';

export class HistoryScreen extends HTMLElement {
    connectedCallback() {
        const history = getHistory();
        this.innerHTML = `
            <div class="history-screen">
                <h1>Histórico de Leituras</h1>
                <ul>
                    ${history
                        .map(
                            (entry) => `
                            <li>${entry.date}: ${entry.cards
                                .map((card) => card.name)
                                .join(', ')}</li>
                        `
                        )
                        .join('')}
                </ul>
                <button onclick="navigateTo('home')">Voltar</button>
            </div>
        `;
    }
}

customElements.define('history-screen', HistoryScreen);
