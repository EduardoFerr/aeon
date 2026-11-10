import { loadCards } from '../utils/cardsUtil.js';
import { dataLocal, obterCartaDoDia, marcarVirada, perguntaDoDia } from '../utils/cartaDoDia.js';
import { escaparHtml } from '../utils/glossario.js';

const TEXTO = {
    titulo: 'Sua carta de hoje',
    convite: 'Toque para virar',
    conviteApoio: 'Uma carta por dia, só sua.',
    luz: 'A luz de hoje',
    pergunta: 'Para levar o dia',
    abrir: 'Abrir a carta',
    rotuloVerso: 'Sua carta de hoje, de costas. Ative para virar.',
    anuncio: (carta) => `Carta virada: ${carta.name}, ${carta.title}.`,
    erro: 'Não foi possível tirar a carta agora. Recarregue a página.',
};

/**
 * "Sua carta de hoje": a carta de costas que a pessoa toca para virar. O sorteio e o estado
 * (virada ou nao) ficam em cartaDoDia.js e so no aparelho.
 */
export class CartaDoDia extends HTMLElement {
    connectedCallback() {
        this.innerHTML = `
            <section class="dia panel-card" aria-labelledby="dia-titulo">
                <h3 id="dia-titulo" class="dia-titulo">${TEXTO.titulo}</h3>
                <div class="dia-corpo" aria-busy="true"></div>
            </section>
        `;
        this.aoVoltar = () => {
            // a pessoa deixou a aba aberta e o dia virou: mostra a carta nova
            if (!document.hidden && this.data && dataLocal() !== this.data) this.montar();
        };
        document.addEventListener('visibilitychange', this.aoVoltar);
        this.montar();
    }

    disconnectedCallback() {
        document.removeEventListener('visibilitychange', this.aoVoltar);
    }

    async montar() {
        const corpo = this.querySelector('.dia-corpo');
        let cartas;
        try {
            cartas = await loadCards();
        } catch (e) {
            corpo.removeAttribute('aria-busy');
            corpo.innerHTML = `<p class="dia-erro">${TEXTO.erro}</p>`;
            return;
        }
        if (!this.isConnected) return;

        const hoje = dataLocal();
        const sorteio = obterCartaDoDia(cartas, hoje);
        this.data = hoje;
        this.carta = sorteio.carta;
        this.pergunta = perguntaDoDia(this.carta, hoje);
        this.virada = sorteio.virada;

        const c = this.carta;
        corpo.removeAttribute('aria-busy');
        corpo.dataset.virada = String(this.virada);
        corpo.innerHTML = `
            <div class="dia-carta">
                <tarot-card data-order="${Number(c.order)}" ${this.virada ? '' : 'show-back'} rotulo-verso="${TEXTO.rotuloVerso}"></tarot-card>
            </div>
            <div class="dia-texto">
                <div class="dia-estado dia-fechada">
                    <p class="dia-convite">${TEXTO.convite}</p>
                    <p class="dia-apoio">${TEXTO.conviteApoio}</p>
                </div>
                <div class="dia-estado dia-aberta">
                    <p class="dia-nome">${escaparHtml(c.name)}</p>
                    <p class="dia-subtitulo">${escaparHtml(c.title || '')}</p>
                    <div class="dia-luz">
                        <p class="dia-rotulo">${TEXTO.luz}</p>
                        <p class="dia-frase">${escaparHtml(c.eighth_greater || '')}</p>
                    </div>
                    ${this.pergunta ? `
                    <div class="dia-pergunta">
                        <p class="dia-rotulo">${TEXTO.pergunta}</p>
                        <p class="dia-frase">${escaparHtml(this.pergunta)}</p>
                    </div>` : ''}
                    <div class="btn-row dia-acoes">
                        <button type="button" class="btn btn-primary" data-acao="abrir">${TEXTO.abrir}</button>
                    </div>
                </div>
            </div>
            <p class="sr" role="status" aria-live="polite" data-anuncio></p>
        `;

        this.querySelector('tarot-card').addEventListener('carta-virada', () => this.aoVirar());
        this.querySelector('[data-acao="abrir"]').addEventListener('click', (e) => {
            const info = document.querySelector('tarot-card-info');
            if (info) info.showInfo(this.carta, e.currentTarget);
        });
        this.atualizarEstado();
    }

    aoVirar() {
        if (this.virada) return;
        this.virada = true;
        marcarVirada(this.carta, this.data);
        this.atualizarEstado();
        this.querySelector('[data-anuncio]').textContent = TEXTO.anuncio(this.carta);
        this.dispatchEvent(new CustomEvent('dia-virada', { bubbles: true, detail: { carta: this.carta } }));
    }

    /** Mostra so um dos dois estados; o outro fica invisivel e fora da ordem de foco, mas ocupa o mesmo lugar. */
    atualizarEstado() {
        const corpo = this.querySelector('.dia-corpo');
        corpo.dataset.virada = String(this.virada);
        this.querySelector('.dia-fechada').inert = this.virada;
        this.querySelector('.dia-aberta').inert = !this.virada;
    }
}

customElements.define('carta-do-dia', CartaDoDia);
