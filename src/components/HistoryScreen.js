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
                                <li><span class="entry-date">${entry.date}:</span> <span class="entry-cards">${cards
                                    .map((card) => card.name)
                                    .join(', ')}</span></li>
                            `;
                        })
                        .join('')}
                </ul>
                <div class="screen-actions"><button class="btn btn-ghost" onclick="navigateTo('home')">Voltar</button></div>
            </section>
        `;
        document.querySelector('#page-title').textContent = "Histórico de Leituras";
    }
}

customElements.define('history-screen', HistoryScreen);
