import './CartaDoDia.js';
import { SYNC_ATIVA } from '../utils/contaEstado.js';
if (SYNC_ATIVA) import('./ConviteConta.js');

export class HomeScreen extends HTMLElement {
    connectedCallback() {
        this.innerHTML = `
            <section class="home-screen">
                <header class="home-cab">
                    <p class="eyebrow">Aeon Fool · Tarot de Thoth</p>
                    <h1 id="home-titulo" class="home-titulo">Sua carta de hoje</h1>
                </header>

                <carta-do-dia></carta-do-dia>

                ${SYNC_ATIVA ? '<convite-conta></convite-conta>' : ''}

                <section class="home-sobre" aria-labelledby="sobre-t">
                    <h2 id="sobre-t">O baralho de Thoth</h2>
                    <p>Setenta e oito cartas onde Hermetismo, Cabala, astrologia e alquimia se encontram.</p>
                    <details>
                        <summary>Saiba mais</summary>
                        <div class="home-sobre-texto">
                            <p>O Tarot de Thoth une Hermetismo, Cabala, Astrologia e Alquimia num só caminho de autoconhecimento. Cada carta guarda um símbolo antigo, e é por ele que ela fala com você.</p>
                            <p>O nome vem de Thoth, o deus egípcio da sabedoria, da escrita e da magia, e de Hermes Trismegisto, que ensinava: o que está acima é como o que está abaixo.</p>
                            <p>A Árvore da Vida liga as 22 cartas dos Arcanos Maiores aos 22 caminhos da Cabala, e a Astrologia dá a cada uma um signo, um planeta ou um elemento. O baralho foi desenhado por Aleister Crowley e pintado por Lady Frieda Harris.</p>
                        </div>
                    </details>
                </section>
            </section>
        `;

        // a Home traz o proprio h1; o titulo global fica fora (navigateTo o reexibe nas outras telas)
        const global = document.querySelector('.page-title');
        if (global) global.hidden = true;
    }
}

customElements.define('home-screen', HomeScreen);
