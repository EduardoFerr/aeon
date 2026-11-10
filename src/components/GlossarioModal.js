import { getVerbete, escaparHtml } from '../utils/glossario.js';
import { abrir } from './Sobreposicao.js';

/**
 * Verbete do glossario: popover ancorado ao termo no desktop e bottom sheet no celular.
 * Usa a sobreposicao unica: foco no botao de fechar e devolvido ao termo, Esc fecha so o verbete
 * (nao o modal da carta por baixo), clique fora fecha.
 */
function corpoDe(verbete) {
    const relacionados = (verbete.ver_tambem ?? []).map(getVerbete).filter(Boolean);
    return `<div class="sob-verbete"><p class="sob-rodape">Glossário</p>
        <p class="curto">${escaparHtml(verbete.curto || '')}</p>
        ${verbete.mais ? `<p class="mais">${escaparHtml(verbete.mais)}</p>` : ''}
        ${relacionados.length ? `<div class="ver-tambem"><span>Ver também:</span> ${relacionados.map((r) => `<button type="button" class="rel" data-termo="${escaparHtml(r.id)}">${escaparHtml(r.termo)}</button>`).join(' ')}</div>` : ''}</div>`;
}

let atual = null;

/** Abre o verbete do termo (`id`); `origem` e o botao do termo, que recebe o foco de volta ao fechar. */
export function abrirGlossario(id, origem) {
    const verbete = getVerbete(id);
    if (!verbete) return;
    if (atual && atual.aberto) atual.fechar(false);
    const c = abrir({ tipo: 'popover', titulo: escaparHtml(verbete.termo), corpo: corpoDe(verbete), gatilho: origem || document.activeElement, ancora: origem, aoFechar: () => { atual = null; } });
    c.corpo.addEventListener('click', (e) => {
        const b = e.target.closest('[data-termo]');
        const v = b && getVerbete(b.dataset.termo);
        if (!v) return;
        c.painel.querySelector('h2').textContent = v.termo;
        c.trocarCorpo(corpoDe(v));
        c.painel.querySelector('[data-sob-x]').focus();
    });
    atual = c;
}
