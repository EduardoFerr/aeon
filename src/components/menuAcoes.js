import { ic } from '../utils/glifos.js';
import { abrir, ehDesktop } from './Sobreposicao.js';

const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

/** HTML do menu: grupos [[titulo, [{id, rot, ic, perigo}]]]. Grupo sem titulo vira so um separador. */
export function menuHtml(grupos, rotulo) {
    return `<nav aria-label="${esc(rotulo)}">${grupos.map(([titulo, itens]) => `${titulo ? `<p class="sob-grupo">${esc(titulo)}</p>` : '<div class="sob-sep"></div>'}${itens.map((a) => `<button class="sob-acao${a.perigo ? ' perigo' : ''}" type="button" data-exec="${a.id}">${ic(a.ic)}${esc(a.rot)}</button>`).join('')}`).join('')}</nav>`;
}

/**
 * Abre o menu "Ações": popover junto do botão no desktop, menu lateral (gaveta) no celular.
 * Devolve o controle da sobreposicao; `aoEscolher(id, botao)` roda depois de fechar o menu.
 */
export function abrirMenuAcoes({ botao, titulo, contexto, grupos, aoEscolher }) {
    const botoes = [...document.querySelectorAll('[data-abrir-acoes]')];
    botoes.forEach((b) => b.setAttribute('aria-expanded', 'true'));
    const c = abrir({
        tipo: ehDesktop() ? 'popover' : 'gaveta',
        titulo,
        gatilho: botao,
        contexto,
        corpo: menuHtml(grupos, titulo),
        aoFechar: () => botoes.forEach((b) => b.setAttribute('aria-expanded', 'false')),
    });
    c.corpo.addEventListener('click', (e) => {
        const b = e.target.closest('[data-exec]');
        if (!b) return;
        c.fechar();
        aoEscolher(b.dataset.exec, botao);
    });
    return c;
}
