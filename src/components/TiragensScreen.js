import { carregarTextos, texto, esc } from '../utils/mapaComum.js';
import { ic } from '../utils/glifos.js';
import { navigateTo } from '../utils/navigation.js';
import { principal } from '../utils/perfil.js';

const PIC_CRUZ = '<svg class="tir-pic" viewBox="0 0 72 88" aria-hidden="true"><rect x="27" y="2" width="18" height="27" rx="2.5"/><rect x="6" y="31" width="18" height="27" rx="2.5"/><rect x="48" y="31" width="18" height="27" rx="2.5"/><rect x="27" y="60" width="18" height="27" rx="2.5"/><rect x="27" y="31" width="18" height="27" rx="2.5" class="c"/></svg>';
const PIC_TEMPLO = '<svg class="tir-pic" viewBox="0 0 72 88" aria-hidden="true"><rect x="6" y="4" width="18" height="22" rx="2.5"/><rect x="6" y="30" width="18" height="22" rx="2.5"/><rect x="6" y="56" width="18" height="22" rx="2.5"/><rect x="48" y="4" width="18" height="22" rx="2.5"/><rect x="48" y="30" width="18" height="22" rx="2.5"/><rect x="48" y="56" width="18" height="22" rx="2.5"/><rect x="27" y="62" width="18" height="22" rx="2.5" class="c"/></svg>';
const PIC_TRES = '<svg class="tir-pic" viewBox="0 0 72 88" aria-hidden="true"><rect x="2" y="24" width="20" height="40" rx="3"/><rect x="26" y="24" width="20" height="40" rx="3"/><rect x="50" y="24" width="20" height="40" rx="3"/></svg>';
const PIC_MAPA = '<svg class="tir-pic" viewBox="0 0 72 88" aria-hidden="true"><circle cx="36" cy="44" r="31"/><circle cx="36" cy="44" r="18"/><circle cx="36" cy="44" r="7" class="c"/><path d="M36 13v13M36 62v13M5 44h13M54 44h13"/></svg>';
const BISCOITO = (x, y, c = '') => `<path${c ? ` class="${c}"` : ''} transform="translate(${x - 7} ${y - 11.6}) scale(2)" stroke-width="0.8" d="M3.5 14c0-5.2 3.8-8.2 8.5-8.2s8.5 3 8.5 8.2c0 1.9-1.6 3-3.3 2.5-2.2-.6-3.5-2.2-5.2-2.2s-3 1.6-5.2 2.2c-1.7.5-3.3-.6-3.3-2.5z"/>`;
const PIC_BISCOITO = `<svg class="tir-pic" viewBox="0 0 72 88" aria-hidden="true">${BISCOITO(4, 12)}${BISCOITO(34, 36, 'c')}${BISCOITO(4, 60)}</svg>`;

/** Tiragens: cinco escolhas (Cruz, Tres cartas, Templo de Afrodite, Mapa astral e Biscoito da sorte). Sem etapa extra: cada uma abre a propria leitura. */
export class TiragensScreen extends HTMLElement {
    async connectedCallback() {
        let textos = null;
        try {
            textos = await carregarTextos();
        } catch (e) {
            /* sem os textos a tela mostra so os nomes fixos abaixo */
        }
        if (!this.isConnected) return;
        const temMapa = !!principal(); // o cartao do mapa e do mapa principal; so o mapa de outra pessoa nao conta
        const t = (id, padrao) => texto(textos, id, {}, padrao);
        const op = (ir, pic, nome, linha, n) => `<li><button type="button" class="tir-op" data-ir="${ir}">${pic}<span class="tir-t"><b>${esc(nome)}</b><span>${esc(linha)}</span><small>${esc(n)}</small></span>${ic('seta')}</button></li>`;
        this.innerHTML = `
            <section class="tiragens" aria-label="${esc(t('ui.cruz.tir.titulo', 'Tiragens'))}">
                <p class="tir-lead">${esc(t('ui.cruz.tir.lead', ''))}</p>
                <ul class="tir-lista">
                    ${op('cruz', PIC_CRUZ, t('ui.cruz.tir.cruz.nome', 'Cruz'), t('ui.cruz.tir.cruz.linha', ''), t('ui.cruz.tir.cruz.n', '5 cartas'))}
                    ${op('three-card-game', PIC_TRES, t('ui.cruz.tir.tres.nome', 'Três cartas'), t('ui.cruz.tir.tres.linha', ''), t('ui.cruz.tir.tres.n', '3 cartas'))}
                    ${op('templo', PIC_TEMPLO, t('ui.templo.tir.nome', 'Templo de Afrodite'), t('ui.templo.tir.linha', ''), t('ui.templo.tir.n', '7 cartas'))}
                    ${op(temMapa ? 'mapa' : 'novo-mapa', PIC_MAPA, temMapa ? 'Seu mapa' : 'Mapa astral', temMapa ? 'O mapa principal' : 'Crie o seu', temMapa ? 'Mapa astral' : 'Dados de nascimento')}
                    ${op('biscoito', PIC_BISCOITO, 'Biscoito da sorte', 'Quebre os três de hoje e leia a mensagem de cada um.', '3 biscoitos')}
                </ul>
            </section>`;
        document.querySelector('#page-title').textContent = t('ui.cruz.tir.titulo', 'Tiragens');
        this.querySelectorAll('[data-ir]').forEach((b) => b.addEventListener('click', () => {
            const ir = b.dataset.ir;
            if (ir === 'mapa') {
                const m = principal();
                navigateTo('mapa', m ? { id: m.id, de: 'tiragens' } : null);
            } else if (ir === 'novo-mapa') navigateTo('novo-mapa', { meusDados: true, de: 'tiragens' }); // sem mapa guardado: a tela "Meus dados"
            else navigateTo(ir);
        }));
    }
}

customElements.define('tiragens-screen', TiragensScreen);
