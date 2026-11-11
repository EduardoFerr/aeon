import('./TarotCard.js');
import('./TarotCardInfo.js');

import { loadCards } from '../utils/cardsUtil.js';
import { abrir } from './Sobreposicao.js';
import { ic } from '../utils/glifos.js';
import { escaparHtml } from '../utils/glossario.js';

const CHAVE_FILTRO = 'aeon.cartas.filtro';

const GRUPOS = [
    { id: 'todas', rotulo: 'Todas', casa: () => true },
    { id: 'maiores', rotulo: 'Maiores', casa: (c) => c.isMajorArcana },
    { id: 'bastoes', rotulo: 'Bastões', casa: (c) => c.suit === 'Bastões' },
    { id: 'tacas', rotulo: 'Taças', casa: (c) => c.suit === 'Taças' },
    { id: 'espadas', rotulo: 'Espadas', casa: (c) => c.suit === 'Espadas' },
    { id: 'discos', rotulo: 'Discos', casa: (c) => c.suit === 'Discos' },
];

/** Minúsculas e sem acento: "Estrêla" e "estrela" são a mesma busca. */
const normalizar = (t) => String(t ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();

/**
 * Apelidos de busca por patente da corte. No baralho de Thoth o antigo Rei é o Cavaleiro e o antigo Pajem é a
 * Princesa; quem procura pelo nome do baralho comum acha a carta certa. Os nomes e os dados não mudam.
 */
const APELIDOS_DA_CORTE = { Cavaleiro: 'rei', Princesa: 'pajem' };

/** Palavras pelas quais cada carta pode ser achada: nome, título, número, naipe, patente (e apelido) e elemento. */
function palavrasDaCarta(c) {
    const campos = [c.name, c.title, c.numeral, c.suit, c.court_rank, APELIDOS_DA_CORTE[c.court_rank], c.element];
    if (c.isMajorArcana) campos.push(c.number); // XVII também se acha por 17
    return normalizar(campos.filter((x) => x !== undefined && x !== null).join(' ')).split(/[^a-z0-9]+/).filter(Boolean);
}

/** Todas as palavras da busca precisam casar (E lógico). Número (arábico ou romano) casa inteiro; texto casa pelo começo da palavra. */
function casaBusca(palavras, termos) {
    return termos.every((t) => palavras.some((p) => (/^(\d+|[ivx]+)$/.test(t) ? p === t : p.startsWith(t))));
}

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
                <div class="grade-ferramentas" role="search" aria-label="Buscar e filtrar cartas">
                  <div class="grade-topo">
                    <div class="grade-busca">
                        <svg class="icon" viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="6.5"/><path d="m16 16 4.5 4.5"/></svg>
                        <label class="sr" for="grade-busca">Buscar carta</label>
                        <input id="grade-busca" type="search" placeholder="Buscar carta, naipe ou número" autocomplete="off" autocapitalize="off" spellcheck="false" enterkeyhint="search" aria-controls="all-cards">
                        <button class="grade-limpar" type="button" aria-label="Limpar busca" hidden><svg class="icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18"/></svg></button>
                    </div>
                    <button class="btn btn-ghost grade-entenda" id="abrir-entenda" type="button" aria-haspopup="dialog" aria-expanded="false">${ic('guia')}Entenda o baralho</button>
                  </div>
                    <div class="chips" id="grade-chips" role="group" aria-label="Filtrar por grupo"></div>
                    <p class="grade-contagem" id="grade-contagem" role="status" aria-live="polite"></p>
                </div>
                <div class="card-container" id="all-cards"></div>
                <div class="grade-vazio" id="grade-vazio" hidden>
                    <svg class="icon" viewBox="0 0 24 24" aria-hidden="true"><rect x="6" y="3" width="12" height="18" rx="2"/><circle cx="12" cy="12" r="2.5"/></svg>
                    <p class="grade-vazio-titulo">Nenhuma carta responde a essa busca.</p>
                    <p class="grade-vazio-dica">Tente um nome, um naipe ou um número romano.</p>
                    <button class="btn btn-ghost" type="button">Limpar busca</button>
                </div>
            </section>
        `;

        document.querySelector('#page-title').textContent = "Tarot de Thoth"
        this.querySelector('#abrir-entenda').addEventListener('click', (e) => this.abrirEntenda(e.currentTarget));
        // Carregar e renderizar as cartas
        await this.renderCards()
    }

    /** Menu lateral "Entenda o baralho": o que complementa o tarô (Árvore da Vida, letras, naipes, decanos, Corte, nomes de Thoth). */
    async abrirEntenda(botao) {
        botao.setAttribute('aria-expanded', 'true');
        let dados = null;
        try {
            const r = await fetch('/data/entenda-baralho.json');
            dados = r.ok ? await r.json() : null;
        } catch (e) {
            dados = null;
        }
        const topicos = dados && Array.isArray(dados.topicos) ? dados.topicos : [];
        const item = (i) => `<div class="ent-item"><dt>${escaparHtml(i.rotulo)}</dt><dd>${escaparHtml(i.texto)}</dd></div>`;
        const corpo = topicos.length
            ? `${dados.intro ? `<p class="ent-intro">${escaparHtml(dados.intro)}</p>` : ''}<div class="ent-lista">${topicos
                  .map(
                      (t) => `<details class="ent-top" id="ent-${escaparHtml(t.id)}"><summary><span class="ent-tit">${escaparHtml(t.titulo)}</span><span class="ent-res">${escaparHtml(t.resumo)}</span></summary><div class="ent-corpo">${String(t.texto)
                          .split(/\n+/)
                          .map((p) => `<p>${escaparHtml(p)}</p>`)
                          .join('')}${Array.isArray(t.itens) && t.itens.length ? `<dl class="ent-itens">${t.itens.map(item).join('')}</dl>` : ''}</div></details>`
                  )
                  .join('')}</div>`
            : '<p class="ent-intro">Não foi possível carregar este conteúdo agora. Tente de novo em instantes.</p>';
        abrir({ tipo: 'gaveta', classe: 'entenda', titulo: escaparHtml((dados && dados.titulo) || 'Entenda o baralho'), gatilho: botao, corpo, aoFechar: () => botao.setAttribute('aria-expanded', 'false') });
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
            this.palavras = cards.map(palavrasDaCarta);
            this.termos = [];
            this.montarBusca();
            this.montarFiltros();
            this.aplicar(false);
        } catch (error) {
            console.error('Erro ao carregar as cartas:', error);
        }
    }

    montarBusca() {
        const campo = this.querySelector('#grade-busca');
        const limpar = this.querySelector('.grade-limpar');
        let espera;
        campo.addEventListener('input', () => {
            limpar.hidden = campo.value === '';
            clearTimeout(espera);
            espera = setTimeout(() => this.buscar(campo.value), 120); // debounce curto: tecla rápida não trava
        });
        // Enter só confirma: filtra já, sem esperar o debounce
        campo.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') { e.preventDefault(); clearTimeout(espera); this.buscar(campo.value); }
            if (e.key === 'Escape' && campo.value) { e.preventDefault(); this.limparBusca(); }
        });
        limpar.addEventListener('click', () => this.limparBusca());
        this.querySelector('#grade-vazio button').addEventListener('click', () => this.limparBusca());
        this.campo = campo;
        this.limpar = limpar;
        this.espera = () => clearTimeout(espera);
    }

    limparBusca() {
        this.espera();
        this.campo.value = '';
        this.limpar.hidden = true;
        this.buscar('');
        this.campo.focus();
    }

    buscar(texto) {
        const termos = normalizar(texto).split(/\s+/).filter(Boolean);
        if (termos.join(' ') === this.termos.join(' ')) return; // nada mudou de fato
        this.termos = termos;
        this.aplicar(true);
    }

    montarFiltros() {
        const barra = this.querySelector('#grade-chips');
        barra.innerHTML = GRUPOS.map((g) => {
            const total = this.cartas.filter(g.casa).length;
            return `<button class="chip" type="button" data-grupo="${g.id}" aria-pressed="${g.id === this.grupo}">${g.rotulo} <small>${total}</small></button>`;
        }).join('');
        this.barra = barra;

        // Sugestão de que há mais chips: o fade só aparece do lado em que ainda há o que rolar
        const bordas = () => {
            barra.dataset.esq = String(barra.scrollLeft > 4);
            barra.dataset.dir = String(barra.scrollLeft + barra.clientWidth < barra.scrollWidth - 4);
        };
        barra.addEventListener('scroll', bordas, { passive: true });
        window.addEventListener('resize', bordas);
        this.bordas = bordas;

        barra.addEventListener('click', (e) => {
            const botao = e.target.closest('button.chip');
            if (!botao || botao.dataset.grupo === this.grupo) return;
            this.grupo = botao.dataset.grupo;
            salvarFiltro(this.grupo);
            this.aplicar(true);
        });

        barra.addEventListener('focusin', (e) => {
            const chip = e.target.closest('button.chip');
            if (!chip) return;
            const folga = 24;
            if (chip.offsetLeft - folga < barra.scrollLeft) barra.scrollTo({ left: chip.offsetLeft - folga });
            else if (chip.offsetLeft + chip.offsetWidth + folga > barra.scrollLeft + barra.clientWidth) barra.scrollTo({ left: chip.offsetLeft + chip.offsetWidth + folga - barra.clientWidth });
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
            const mostrar = grupo.casa(carta) && (!this.termos.length || casaBusca(this.palavras[i], this.termos));
            this.elementos[i].hidden = !mostrar;
            if (mostrar) visiveis++;
        });

        this.barra.querySelectorAll('button.chip').forEach((b) => {
            b.setAttribute('aria-pressed', String(b.dataset.grupo === this.grupo));
        });
        this.querySelector('#grade-contagem').textContent = visiveis === 0 ? 'Nenhuma carta' : `${visiveis} ${visiveis === 1 ? 'carta' : 'cartas'}`;

        const vazio = visiveis === 0;
        this.querySelector('#all-cards').hidden = vazio;
        this.querySelector('#grade-vazio').hidden = !vazio;
        this.trazerChipAtivo(animar);

        if (animar) this.revelarGrade();
    }

    /** No celular os chips rolam: o ativo fica sempre à vista. */
    trazerChipAtivo(suave) {
        const ativo = this.barra.querySelector('button.chip[aria-pressed="true"]');
        if (ativo && this.barra.scrollWidth > this.barra.clientWidth) {
            const alvo = ativo.offsetLeft - (this.barra.clientWidth - ativo.offsetWidth) / 2;
            this.barra.scrollTo({ left: alvo, behavior: suave && !reduzMovimento() ? 'smooth' : 'auto' });
        }
        this.bordas();
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
