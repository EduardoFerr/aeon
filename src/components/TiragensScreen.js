import { carregarTextos, texto, esc } from '../utils/mapaComum.js';
import { ic } from '../utils/glifos.js';
import { navigateTo } from '../utils/navigation.js';

const PIC_CRUZ = '<svg class="tir-pic" viewBox="0 0 72 88" aria-hidden="true"><rect x="27" y="2" width="18" height="27" rx="2.5"/><rect x="6" y="31" width="18" height="27" rx="2.5"/><rect x="48" y="31" width="18" height="27" rx="2.5"/><rect x="27" y="60" width="18" height="27" rx="2.5"/><rect x="27" y="31" width="18" height="27" rx="2.5" class="c"/></svg>';
const PIC_TRES = '<svg class="tir-pic" viewBox="0 0 72 88" aria-hidden="true"><rect x="2" y="24" width="20" height="40" rx="3"/><rect x="26" y="24" width="20" height="40" rx="3"/><rect x="50" y="24" width="20" height="40" rx="3"/></svg>';

/** Tiragens: duas escolhas (Cruz e Tres cartas). Sem etapa extra: cada uma abre a propria leitura. */
export class TiragensScreen extends HTMLElement {
    async connectedCallback() {
        let textos = null;
        try {
            textos = await carregarTextos();
        } catch (e) {
            /* sem os textos a tela mostra so os nomes fixos abaixo */
        }
        if (!this.isConnected) return;
        const t = (id, padrao) => texto(textos, id, {}, padrao);
        const op = (ir, pic, nome, linha, n) => `<li><button type="button" class="tir-op" data-ir="${ir}">${pic}<span class="tir-t"><b>${esc(nome)}</b><span>${esc(linha)}</span><small>${esc(n)}</small></span>${ic('seta')}</button></li>`;
        this.innerHTML = `
            <section class="tiragens" aria-label="${esc(t('ui.cruz.tir.titulo', 'Tiragens'))}">
                <p class="tir-lead">${esc(t('ui.cruz.tir.lead', ''))}</p>
                <ul class="tir-lista">
                    ${op('cruz', PIC_CRUZ, t('ui.cruz.tir.cruz.nome', 'Cruz'), t('ui.cruz.tir.cruz.linha', ''), t('ui.cruz.tir.cruz.n', '5 cartas'))}
                    ${op('three-card-game', PIC_TRES, t('ui.cruz.tir.tres.nome', 'Três cartas'), t('ui.cruz.tir.tres.linha', ''), t('ui.cruz.tir.tres.n', '3 cartas'))}
                </ul>
            </section>`;
        document.querySelector('#page-title').textContent = t('ui.cruz.tir.titulo', 'Tiragens');
        this.querySelectorAll('[data-ir]').forEach((b) => b.addEventListener('click', () => navigateTo(b.dataset.ir)));
    }
}

customElements.define('tiragens-screen', TiragensScreen);
