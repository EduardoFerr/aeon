import { navigateTo, consumirEstado } from '../utils/navigation.js';
import { gl, ic } from '../utils/glifos.js';
import { loadCards } from '../utils/cardsUtil.js';
import { obter, principal } from '../utils/perfil.js';
import { carregarTextos, texto, esc, calcular, dataExtenso, grauTexto, SIGNO_ELEMENTO } from '../utils/mapaComum.js';

/**
 * Resumo simples do mapa (Fase 3a): posicoes em tabela. A roda e a leitura por secao chegam na Fase 3b.
 */
const ICONE_CORPO = { sol: 'sol', lua: 'lua', mercurio: 'mercurio', venus: 'venus', marte: 'marte', jupiter: 'jupiter', saturno: 'saturno', urano: 'urano', netuno: 'netuno', plutao: 'plutao', nodo_norte: 'nodo' };

export class MapaScreen extends HTMLElement {
    async connectedCallback() {
        const est = consumirEstado() || {};
        const m = (est.id && obter(est.id)) || principal();
        document.querySelector('#page-title').textContent = 'Mapa astral';
        if (!m) {
            navigateTo('perfil');
            return;
        }
        this.innerHTML = '<div class="mapa-tela" aria-busy="true"></div>';
        let textos = {};
        let calc = null;
        try {
            [textos] = await Promise.all([carregarTextos(), loadCards()]);
            calc = await calcular(m);
        } catch (e) {
            /* mostra a mensagem de erro abaixo */
        }
        if (!this.isConnected) return;
        const t = (id, v) => texto(textos, id, v);
        document.querySelector('#page-title').textContent = t('ui.titulo', {}, 'Mapa astral');
        if (!calc) {
            this.innerHTML = `<div class="mapa-tela"><section class="aviso erro" role="alert">${ic('erro')}<h3>Mapa astral</h3><div><p>${esc(t('ui.erro.geral'))}</p></div></section><div><button class="btn btn-ghost" type="button" data-voltar>Voltar ao perfil</button></div></div>`;
        } else {
            const ids = Object.keys(calc.pontos).filter((id) => calc.pontos[id] && id !== 'nodo_sul');
            const linhas = ids
                .map((id) => {
                    const p = calc.pontos[id];
                    const g = ICONE_CORPO[id] || (id === 'asc' ? 'asc' : id === 'mc' ? 'mc' : 'sol');
                    return `<tr><th scope="row">${gl(g)}${esc(p.nome)}${p.retrogrado ? ' <span class="rx" aria-hidden="true">R</span><span class="sr"> retrógrado</span>' : ''}</th>
                        <td><span class="sgc el-${SIGNO_ELEMENTO[p.signo]}">${gl(p.signo)}${esc(p.signoNome)}</span></td><td>${grauTexto(p)}</td><td>${p.casa || '—'}</td></tr>`;
                })
                .join('');
            let avisos = '';
            if (!m.hora) avisos += `<section class="aviso atencao" role="status">${ic('relogio')}<h3>Mapa sem hora de nascimento</h3><div><p>${esc(t('ui.aviso.semhora'))}</p></div></section>`;
            this.innerHTML = `<div class="mapa-tela">
                <div><span class="eyebrow">${esc(m.rotulo)}</span><p class="mute">${esc(t('ui.sub'))}</p><p class="mute">${dataExtenso(m.data)}${m.hora ? `, ${m.hora}` : ''}, ${esc(m.local.nome)}</p></div>
                ${avisos}
                <div class="tabela-wrap"><table class="tabela-pos"><caption>Posições no mapa</caption><thead><tr><th scope="col">Corpo</th><th scope="col">Signo</th><th scope="col">Grau</th><th scope="col">Casa</th></tr></thead><tbody>${linhas}</tbody></table></div>
                <p class="nota-geonames">${esc(t('ui.roda.alt'))}</p>
                <div><button class="btn btn-ghost" type="button" data-voltar>Voltar ao perfil</button></div></div>`;
        }
        this.querySelector('[data-voltar]').addEventListener('click', () => navigateTo('perfil', { selecionar: m.id }));
    }
}

customElements.define('mapa-screen', MapaScreen);
