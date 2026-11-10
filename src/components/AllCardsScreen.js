import('./TarotCard.js');
import('./TarotCardInfo.js');

import { loadCards } from '../utils/cardsUtil.js';

const CHAVE_FILTRO = 'aeon.cartas.filtro';

const GRUPOS = [
    { id: 'todas', rotulo: 'Todas', casa: () => true },
    { id: 'maiores', rotulo: 'Maiores', casa: (c) => c.isMajorArcana },
    { id: 'bastoes', rotulo: 'Bastões', casa: (c) => c.suit === 'Bastões' },
    { id: 'tacas', rotulo: 'Taças', casa: (c) => c.suit === 'Taças' },
    { id: 'espadas', rotulo: 'Espadas', casa: (c) => c.suit === 'Espadas' },
    { id: 'discos', rotulo: 'Discos', casa: (c) => c.suit === 'Discos' },
];

const reduzMovimento = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

function lerFiltroSalvo() {
    try {
        const id = sessionStorage.getItem(CHAVE_FILTRO);
        return GRUPOS.some((g) => g.id === id) ? id : 'todas';
    } catch (e) {
        return 'todas'; // sem armazenamento: o filtro vale só nesta visita
    }
}

function salvarFiltro(id) {
    try { sessionStorage.setItem(CHAVE_FILTRO, id); } catch (e) { /* sem armazenamento */ }
}

export class AllCardsScreen extends HTMLElement {
    async connectedCallback() {
        this.grupo = lerFiltroSalvo();
        this.innerHTML = `
            <section class="all-cards-screen">
                <div class="grade-ferramentas">
                    <div class="chips" id="grade-chips" role="group" aria-label="Filtrar por grupo"></div>
                    <p class="grade-contagem" id="grade-contagem" role="status" aria-live="polite"></p>
                </div>
                <div class="card-container" id="all-cards"></div>
                <div class="screen-actions"><button class="btn btn-ghost" onclick="navigateTo('home')">Voltar</button></div>
            </section>
        `;

        document.querySelector('#page-title').textContent = "Tarot de Thoth"
        // Carregar e renderizar as cartas
        await this.renderCards()
    }

    async renderCards() {
        try {
            // Obtém as cartas do utilitário (usando o cache)
            const cards = [...(await loadCards())].sort((a, b) => a.order - b.order); // cópia: não reordena o cache
            const container = this.querySelector('#all-cards');

            // Renderiza as cartas no container usando TarotCard (só o número de ordem vai no HTML)
            container.innerHTML = cards
                .map(
                    (card) => `
                        <tarot-card data-order="${Number(card.order)}"></tarot-card>
                    `
                )
                .join('');

            // As 78 cartas são montadas uma única vez; filtrar só mostra e esconde
            this.cartas = cards;
            this.elementos = [...container.children];
            this.montarFiltros();
            this.aplicar(false);
        } catch (error) {
            console.error('Erro ao carregar as cartas:', error);
        }
    }

    montarFiltros() {
        const barra = this.querySelector('#grade-chips');
        barra.innerHTML = GRUPOS.map((g) => {
            const total = this.cartas.filter(g.casa).length;
            return `<button class="chip" type="button" data-grupo="${g.id}" aria-pressed="${g.id === this.grupo}">${g.rotulo} <small>${total}</small></button>`;
        }).join('');
        this.barra = barra;

        barra.addEventListener('click', (e) => {
            const botao = e.target.closest('button.chip');
            if (!botao || botao.dataset.grupo === this.grupo) return;
            this.grupo = botao.dataset.grupo;
            salvarFiltro(this.grupo);
            this.aplicar(true);
        });

        // Setas movem o foco entre os chips; Enter e espaço escolhem (comportamento do botão)
        barra.addEventListener('keydown', (e) => {
            const chips = [...barra.querySelectorAll('button.chip')];
            const i = chips.indexOf(document.activeElement);
            if (i < 0) return;
            const destino = { ArrowRight: i + 1, ArrowLeft: i - 1, Home: 0, End: chips.length - 1 }[e.key];
            if (destino === undefined) return;
            e.preventDefault();
            chips[(destino + chips.length) % chips.length].focus();
        });
    }

    /** Mostra só as cartas do grupo ativo, sem remontar nada. */
    aplicar(animar) {
        const grupo = GRUPOS.find((g) => g.id === this.grupo);
        let visiveis = 0;
        this.cartas.forEach((carta, i) => {
            const mostrar = grupo.casa(carta);
            this.elementos[i].hidden = !mostrar;
            if (mostrar) visiveis++;
        });

        this.barra.querySelectorAll('button.chip').forEach((b) => {
            b.setAttribute('aria-pressed', String(b.dataset.grupo === this.grupo));
        });
        this.querySelector('#grade-contagem').textContent = `${visiveis} ${visiveis === 1 ? 'carta' : 'cartas'}`;

        if (animar) this.revelarGrade();
    }

    /** Volta ao topo da grade e faz uma entrada suave (sem animação se o usuário pediu menos movimento). */
    revelarGrade() {
        const grade = this.querySelector('#all-cards');
        const topbar = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--topbar-h')) || 60;
        const ferramentas = this.querySelector('.grade-ferramentas');
        if (ferramentas.getBoundingClientRect().top < topbar) {
            window.scrollTo({ top: window.scrollY + ferramentas.getBoundingClientRect().top - topbar - 8, behavior: 'auto' });
        }
        if (!reduzMovimento() && grade.animate) {
            grade.animate(
                [{ opacity: 0, transform: 'translateY(8px)' }, { opacity: 1, transform: 'none' }],
                { duration: 260, easing: 'cubic-bezier(0.2, 0.7, 0.2, 1)' }
            );
        }
    }
}

customElements.define('all-cards-screen', AllCardsScreen);
