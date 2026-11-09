import { getVerbete, escaparHtml } from '../utils/glossario.js';

/**
 * Popup do glossário. Fica acima do modal da carta (z-index maior), fecha com
 * Esc, clique no fundo ou no botão, e devolve o foco a quem o abriu.
 */
class GlossarioModal extends HTMLElement {
    connectedCallback() {
        this.hidden = true;
        this.innerHTML = `
            <div class="glossario-fundo">
                <div class="glossario-painel" role="dialog" aria-modal="true" aria-labelledby="glossario-titulo" tabindex="-1">
                    <button type="button" class="glossario-fechar" aria-label="Fechar explicação">&times;</button>
                    <p class="glossario-rotulo">Glossário</p>
                    <h4 id="glossario-titulo"></h4>
                    <p class="glossario-curto"></p>
                    <p class="glossario-mais"></p>
                    <div class="glossario-ver-tambem"></div>
                </div>
            </div>
        `;
        this.painel = this.querySelector('.glossario-painel');
        this.querySelector('.glossario-fechar').addEventListener('click', () => this.fechar());
        this.querySelector('.glossario-fundo').addEventListener('click', (evento) => {
            if (evento.target === evento.currentTarget) this.fechar();
        });
        this.querySelector('.glossario-ver-tambem').addEventListener('click', (evento) => {
            const botao = evento.target.closest('[data-termo]');
            if (botao) this.mostrar(botao.dataset.termo);
        });
        // Em captura, para o Esc fechar só o glossário e não o modal da carta por baixo
        this.aoTeclar = (evento) => {
            if (evento.key !== 'Escape') return;
            evento.stopImmediatePropagation();
            evento.preventDefault();
            this.fechar();
        };
    }

    mostrar(id) {
        const verbete = getVerbete(id);
        if (!verbete) return false;
        this.querySelector('#glossario-titulo').textContent = verbete.termo;
        this.querySelector('.glossario-curto').textContent = verbete.curto || '';
        const mais = this.querySelector('.glossario-mais');
        mais.textContent = verbete.mais || '';
        mais.hidden = !verbete.mais;

        const relacionados = (verbete.ver_tambem ?? []).map(getVerbete).filter(Boolean);
        const rodape = this.querySelector('.glossario-ver-tambem');
        rodape.hidden = relacionados.length === 0;
        rodape.innerHTML = relacionados.length
            ? `<span>Ver também:</span> ${relacionados
                  .map((r) => `<button type="button" class="glossario-relacionado" data-termo="${escaparHtml(r.id)}">${escaparHtml(r.termo)}</button>`)
                  .join(' ')}`
            : '';
        this.painel.scrollTop = 0;
        return true;
    }

    abrir(id, origem) {
        if (!this.mostrar(id)) return;
        this.origem = origem || null;
        this.hidden = false;
        document.addEventListener('keydown', this.aoTeclar, true);
        this.painel.focus({ preventScroll: true });
    }

    fechar() {
        this.hidden = true;
        document.removeEventListener('keydown', this.aoTeclar, true);
        if (this.origem && this.origem.isConnected) this.origem.focus();
        this.origem = null;
    }
}

customElements.define('glossario-modal', GlossarioModal);

/** Abre o popup do termo, criando o componente na primeira vez. */
export function abrirGlossario(id, origem) {
    let modal = document.querySelector('glossario-modal');
    if (!modal) {
        modal = document.createElement('glossario-modal');
        document.body.appendChild(modal);
    }
    modal.abrir(id, origem);
}
