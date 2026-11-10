import { navigateTo } from '../utils/navigation.js';
import './CartaDoDia.js';
import { listar, principal } from '../utils/perfil.js';

const icone = (corpo) => `<svg class="ico" viewBox="0 0 24 24" aria-hidden="true">${corpo}</svg>`;

const ICONES = {
    tirar: icone('<rect x="6" y="3" width="12" height="18" rx="2"/><path d="M12 9l1.2 2.4 2.6.3-1.9 1.8.5 2.6L12 14.8 9.6 16.1l.5-2.6-1.9-1.8 2.6-.3z"/>'),
    diario: icone('<path d="M6 3.5h10.5a1.5 1.5 0 011.5 1.5v14a1.5 1.5 0 01-1.5 1.5H6z"/><path d="M6 3.5v17M10 8h5M10 11.5h5"/>'),
    cartas: icone('<rect x="4" y="5" width="10" height="15" rx="1.5"/><path d="M8 3h10a2 2 0 012 2v12"/>'),
    mapa: icone('<circle cx="12" cy="12" r="8.5"/><circle cx="12" cy="12" r="2.5"/><path d="M12 3.5v5M12 15.5v5M3.5 12h5M15.5 12h5"/>'),
};

const acao = (ir, icon, nome, linha, extra = '') =>
    `<li><button type="button" class="acao-card${extra}" data-ir="${ir}">${icon}<b>${nome}</b><span>${linha}</span></button></li>`;

export class HomeScreen extends HTMLElement {
    connectedCallback() {
        const temMapa = listar().length > 0;
        this.innerHTML = `
            <section class="home-screen">
                <header class="home-cab">
                    <p class="eyebrow">Aeon Fool · Tarot de Thoth</p>
                    <h1 id="home-titulo" class="home-titulo">Sua carta de hoje</h1>
                </header>

                <carta-do-dia></carta-do-dia>

                <nav aria-label="Por onde começar">
                    <ul class="home-acoes">
                        ${acao('three-card-game', ICONES.tirar, 'Tirar cartas', 'Leitura de três', ' destaque')}
                        ${acao('all-cards', ICONES.cartas, 'Cartas', 'As 78 do baralho')}
                        ${temMapa
                            ? acao('mapa', ICONES.mapa, 'Seu mapa', 'O mapa principal')
                            : acao('novo-mapa', ICONES.mapa, 'Mapa astral', 'Crie o seu')}
                        ${acao('history', ICONES.diario, 'Diário', 'Suas leituras')}
                    </ul>
                </nav>

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
        this.querySelectorAll('[data-ir]').forEach((botao) => {
            botao.addEventListener('click', () => {
                const ir = botao.dataset.ir;
                if (ir === 'mapa') {
                    const m = principal() || listar()[0];
                    navigateTo('mapa', m ? { id: m.id } : null);
                } else navigateTo(ir);
            });
        });
    }
}

customElements.define('home-screen', HomeScreen);
