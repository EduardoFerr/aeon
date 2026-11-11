/**
 * O Templo de Afrodite: regras puras (sem DOM), usadas pela tela, pelo cartao e pelos testes.
 *
 * Sete cartas: duas colunas de tres (1 a 3 = voce, 4 a 6 = a outra pessoa) e a sétima, a Sintese, no centro
 * da base. Cada linha horizontal e um plano da relacao: mental (1 e 4), afetivo (2 e 5), fisico (3 e 6).
 * Os indices abaixo (0 a 6) seguem a numeracao das cartas (carta 1 = indice 0).
 *
 * Nenhum texto novo por carta: cada posicao le campos que as 78 cartas ja tem em cards.json. O valor novo
 * da tiragem e a comparacao por linha, calculada so pelo elemento de cada carta (sem texto por carta).
 */
export const POSICOES = [
    { id: 'mental-voce', plano: 'mental', lado: 'voce', col: 0, lin: 0 },
    { id: 'afetivo-voce', plano: 'afetivo', lado: 'voce', col: 0, lin: 1 },
    { id: 'fisico-voce', plano: 'fisico', lado: 'voce', col: 0, lin: 2 },
    { id: 'mental-outra', plano: 'mental', lado: 'outra', col: 1, lin: 0 },
    { id: 'afetivo-outra', plano: 'afetivo', lado: 'outra', col: 1, lin: 1 },
    { id: 'fisico-outra', plano: 'fisico', lado: 'outra', col: 1, lin: 2 },
    { id: 'sintese', plano: 'sintese', lado: null, col: null, lin: 3 },
];
export const IDS_POSICAO = POSICOES.map((p) => p.id);
export const TOTAL = POSICOES.length;
export const SINTESE = 6;
export const PLANOS = ['mental', 'afetivo', 'fisico'];
/** Indices das duas cartas de cada plano: [voce, outra pessoa]. */
export const LINHAS = [[0, 3], [1, 4], [2, 5]];

/* ---------- ordem de leitura, Sintese e vizinhanca ---------- */

/** Quantas das seis primeiras posicoes ainda nao foram viradas (a Sintese so abre quando e zero). */
export const faltamSeis = (vir) => [0, 1, 2, 3, 4, 5].filter((k) => !vir[k]).length;

/** A Sintese so abre depois das seis viradas. */
export const sinteseLiberada = (vir) => faltamSeis(vir) === 0;

/** Primeira vaga livre na ordem das cartas (1 a 7), ou -1. */
export const proximaVaga = (col) => col.findIndex((x) => !x);

/** Posicao sugerida para ler: a primeira nao lida entre as seis, depois a Sintese. -1 quando todas foram lidas. */
export function proximaLeitura(lida) {
    for (let i = 0; i < SINTESE; i++) if (!lida[i]) return i;
    return lida[SINTESE] ? -1 : SINTESE;
}

/** Posicao anterior e seguinte na numeracao das cartas (o rodape do painel). */
export const anterior = (i) => (i > 0 ? i - 1 : null);
export const seguinte = (i) => (i < TOTAL - 1 ? i + 1 : null);

/**
 * Setas andam pela mesa como ela e desenhada (duas colunas e a sétima embaixo); Home vai a carta 1 e End a
 * Sintese. `colPref` (0 ou 1) diz para qual coluna a seta para cima volta a partir da Sintese. Devolve o indice ou null.
 */
export function vizinho(i, tecla, colPref = 0) {
    if (tecla === 'Home') return 0;
    if (tecla === 'End') return SINTESE;
    if (i === SINTESE) {
        if (tecla === 'ArrowUp') return colPref === 1 ? 5 : 2;
        if (tecla === 'ArrowLeft') return 2;
        if (tecla === 'ArrowRight') return 5;
        return null;
    }
    const { col, lin } = POSICOES[i];
    if (tecla === 'ArrowRight') return col === 0 ? i + 3 : null;
    if (tecla === 'ArrowLeft') return col === 1 ? i - 3 : null;
    if (tecla === 'ArrowUp') return lin > 0 ? i - 1 : null;
    if (tecla === 'ArrowDown') return lin < 2 ? i + 1 : SINTESE;
    return null;
}

/* ---------- elemento de cada carta ---------- */

const ELEMENTO_DO_NAIPE = { 'Bastões': 'Fogo', 'Taças': 'Água', Espadas: 'Ar', Discos: 'Terra' };
export const ELEMENTOS = ['Fogo', 'Água', 'Ar', 'Terra'];

/**
 * Elemento da carta e se ela e um Arcano Maior. Naipe: Bastoes = Fogo, Tacas = Agua, Espadas = Ar, Discos = Terra.
 * Arcano Maior: o campo `element` da carta. Devolve { elemento, maior }; elemento e null se a carta nao tiver um.
 */
export function elementoDe(carta) {
    if (!carta) return { elemento: null, maior: false };
    const maior = carta.isMajorArcana === true;
    const doCampo = ELEMENTOS.includes(carta.element) ? carta.element : null;
    const elemento = maior ? doCampo : ELEMENTO_DO_NAIPE[carta.suit] || doCampo;
    return { elemento, maior };
}

/* ---------- comparacao por linha ---------- */

const PARES_QUE_COMBINAM = [['Fogo', 'Ar'], ['Água', 'Terra']];
const PARES_EM_TENSAO = [['Fogo', 'Água'], ['Ar', 'Terra']];
const mesmoPar = (par, a, b) => (par[0] === a && par[1] === b) || (par[0] === b && par[1] === a);

/** Relacao entre dois elementos: sintonia (iguais), combina (Fogo+Ar, Agua+Terra), tensao (Fogo+Agua, Ar+Terra) ou distinto (o resto). */
export function relacaoEntre(a, b) {
    if (!a || !b) return null;
    if (a === b) return 'sintonia';
    if (PARES_QUE_COMBINAM.some((p) => mesmoPar(p, a, b))) return 'combina';
    if (PARES_EM_TENSAO.some((p) => mesmoPar(p, a, b))) return 'tensao';
    return 'distinto';
}

/** Pontos de cada relacao para o quadro de equilibrio (4 = mais sintonizado, 1 = mais em tensao). */
export const NIVEL = { sintonia: 4, combina: 3, distinto: 2, tensao: 1 };

/**
 * Compara as duas cartas de uma linha. `peso` diz de que lado ha um Arcano Maior (peso maior nesse plano):
 * 'voce', 'outra', 'ambos' ou null. Devolve null se faltar carta ou elemento.
 */
export function compararLinha(cartaVoce, cartaOutra) {
    const a = elementoDe(cartaVoce);
    const b = elementoDe(cartaOutra);
    const relacao = relacaoEntre(a.elemento, b.elemento);
    if (!relacao) return null;
    const peso = a.maior && b.maior ? 'ambos' : a.maior ? 'voce' : b.maior ? 'outra' : null;
    return { elementos: [a.elemento, b.elemento], relacao, peso, nivel: NIVEL[relacao] };
}

/** As tres linhas comparadas: [{ plano, indices, ...compararLinha }]. Exige as seis cartas; senao devolve []. */
export function compararPlanos(cartas) {
    if (!Array.isArray(cartas) || [0, 1, 2, 3, 4, 5].some((k) => !cartas[k])) return [];
    const linhas = LINHAS.map(([v, o], k) => ({ plano: PLANOS[k], indices: [v, o], ...compararLinha(cartas[v], cartas[o]) }));
    return linhas.some((l) => !l.relacao) ? [] : linhas;
}

/**
 * Equilibrio entre os tres planos: qual esta mais sintonizado e qual mais descompassado.
 * Se os tres tem o mesmo nivel, `igual` e true e nenhum se destaca. Empates entram juntos na lista.
 */
export function equilibrio(linhas) {
    if (!linhas || linhas.length !== 3) return null;
    const niveis = linhas.map((l) => l.nivel);
    const alto = Math.max(...niveis);
    const baixo = Math.min(...niveis);
    if (alto === baixo) return { igual: true, mais: [], menos: [], alto, baixo };
    return {
        igual: false,
        mais: linhas.filter((l) => l.nivel === alto).map((l) => l.plano),
        menos: linhas.filter((l) => l.nivel === baixo).map((l) => l.plano),
        alto,
        baixo,
    };
}

/** "Mental", "Mental e Físico", "Mental, Afetivo e Físico": lista de nomes ja traduzidos. */
export function juntar(nomes) {
    if (nomes.length <= 1) return nomes.join('');
    return `${nomes.slice(0, -1).join(', ')} e ${nomes[nomes.length - 1]}`;
}

/* ---------- texto de cada posicao (campos que ja existem em cards.json) ---------- */

/**
 * Blocos de texto de uma posicao. Cada bloco: { id, texto, cor? }; `id` e o rotulo, traduzido pela tela.
 *   Mental   (1, 4) = past_present_future.present
 *   Afetivo  (2, 5) = eighth_greater (a Luz) com eighth_lesser (a Sombra) como contraste
 *   Fisico   (3, 6) = message_esoteric
 *   Sintese  (7)    = past_present_future.future + meditation_reflection[0]
 */
export function blocos(i, carta) {
    const ppf = carta.past_present_future || {};
    const plano = POSICOES[i].plano;
    if (plano === 'mental') return [{ id: 'mostra', texto: ppf.present || '' }];
    if (plano === 'afetivo') {
        return [{ id: 'luz', texto: carta.eighth_greater || '', cor: 'luz' }, { id: 'sombra', texto: carta.eighth_lesser || '', cor: 'sombra' }];
    }
    if (plano === 'fisico') return [{ id: 'recado', texto: carta.message_esoteric || '' }];
    const med = Array.isArray(carta.meditation_reflection) ? carta.meditation_reflection[0] : '';
    return [{ id: 'leva', texto: ppf.future || '' }, { id: 'levar', texto: med || '', cor: 'pergunta' }];
}

/** Uma linha de resumo da posicao (lista das sete posicoes): o primeiro texto. */
export const linhaResumo = (i, carta) => blocos(i, carta)[0].texto;

/* ---------- montagem: a ordem em que se coloca decide qual carta cai onde ---------- */

/**
 * A k-esima carta colocada (na ordem do baralho embaralhado) cai na posicao que a pessoa escolheu.
 * `baralho` e a lista embaralhada das 78; `cartas` guarda a carta de cada posicao (ou undefined).
 * Nunca repete: cada indice do baralho so e usado uma vez.
 */
export function colocarCarta(baralho, cartas, posicao) {
    if (posicao < 0 || posicao >= TOTAL || cartas[posicao]) return cartas;
    const usadas = cartas.filter(Boolean).length;
    if (usadas >= TOTAL || !baralho[usadas]) return cartas;
    const novas = [...cartas];
    novas[posicao] = baralho[usadas];
    return novas;
}

/** [{ order, pos }] na ordem das cartas (1 a 7), pronto para o diario. */
export const paraDiario = (cartas) => cartas.map((c, i) => ({ order: Number(c.order), pos: IDS_POSICAO[i] }));
