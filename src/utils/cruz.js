/**
 * Cruz de cinco cartas: regras puras (sem DOM), usadas pela tela, pelo cartao e pelos testes.
 *
 * Desenho em sinal de mais: 1 Ajuda (esquerda), 2 Obstaculo (direita), 3 Momento (topo), 4 Caminho (base),
 * 5 Sintese (centro). Os indices abaixo seguem a ordem de leitura e do rodape do painel:
 * Momento, Ajuda, Obstaculo, Caminho, Sintese. Nenhum texto novo por carta: cada posicao le campos que as
 * 78 cartas ja tem em cards.json.
 */
export const POSICOES = [
    { id: 'momento', area: 't' },
    { id: 'ajuda', area: 'l' },
    { id: 'obstaculo', area: 'r' },
    { id: 'caminho', area: 'b' },
    { id: 'sintese', area: 'c' },
];
export const IDS_POSICAO = POSICOES.map((p) => p.id);
export const TOTAL = POSICOES.length;
const SINTESE = 4;

/* ---------- ordem de leitura e vizinhanca ---------- */

/** Quantas das quatro primeiras posicoes ainda nao foram viradas (a Sintese so abre quando e zero). */
export const faltamQuatro = (vir) => [0, 1, 2, 3].filter((k) => !vir[k]).length;

/** A Sintese so abre depois das quatro viradas. */
export const sinteseLiberada = (vir) => faltamQuatro(vir) === 0;

/** Primeira vaga livre na ordem de leitura, ou -1. */
export const proximaVaga = (col) => col.findIndex((x) => !x);

/** Posicao sugerida para ler: a primeira nao lida entre as quatro, depois a Sintese. -1 quando todas foram lidas. */
export function proximaLeitura(lida) {
    for (let i = 0; i < SINTESE; i++) if (!lida[i]) return i;
    return lida[SINTESE] ? -1 : SINTESE;
}

/** Posicao anterior e seguinte na ordem de leitura (o rodape do painel). */
export const anterior = (i) => (i > 0 ? i - 1 : null);
export const seguinte = (i) => (i < TOTAL - 1 ? i + 1 : null);

const VIZINHO = {
    t: { ArrowDown: 'c' },
    c: { ArrowUp: 't', ArrowLeft: 'l', ArrowRight: 'r', ArrowDown: 'b' },
    l: { ArrowRight: 'c' },
    r: { ArrowLeft: 'c' },
    b: { ArrowUp: 'c' },
};

/** Setas andam pela cruz como ela e desenhada; Home vai ao Momento e End a Sintese. Devolve o indice ou null. */
export function vizinho(i, tecla) {
    if (tecla === 'Home') return 0;
    if (tecla === 'End') return SINTESE;
    const area = VIZINHO[POSICOES[i].area][tecla];
    return area ? POSICOES.findIndex((p) => p.area === area) : null;
}

/* ---------- frase da Sintese: so nomes e posicoes ---------- */

/** Artigo e resto do nome: "A Estrela" -> a + Estrela; "Princesa de Taças" -> a; "Ás de Bastões" -> o. */
export function artigo(nome) {
    const m = /^(O|A|Os|As) (.+)$/.exec(nome);
    if (m) return { a: m[1].toLowerCase(), resto: m[2] };
    if (/^(Princesa|Rainha)\b/.test(nome)) return { a: 'a', resto: nome };
    return { a: 'o', resto: nome };
}

const comArtigo = (nome) => {
    const x = artigo(nome);
    return `${x.a} ${x.resto}`;
};
const plural = (nome) => {
    const a = artigo(nome).a;
    return a === 'os' || a === 'as';
};

/**
 * "A Estrela ajuda, a Torre atrapalha e o Louco indica o caminho."
 * So repete as posicoes: nao afirma nenhuma relacao entre as cartas que ninguem escreveu.
 */
export function frase(ajuda, obstaculo, caminho) {
    const v = (nome, s, p) => (plural(nome) ? p : s);
    const t = `${comArtigo(ajuda)} ${v(ajuda, 'ajuda', 'ajudam')}, ${comArtigo(obstaculo)} ${v(obstaculo, 'atrapalha', 'atrapalham')} e ${comArtigo(caminho)} ${v(caminho, 'indica', 'indicam')} o caminho.`;
    return t.charAt(0).toUpperCase() + t.slice(1);
}

/** Frase da cruz a partir das cinco cartas (indices de leitura), ou '' se faltar alguma das tres. */
export function fraseDaCruz(cartas) {
    const [, aj, ob, ca] = cartas;
    return aj && ob && ca ? frase(aj.name, ob.name, ca.name) : '';
}

/* ---------- texto de cada posicao (campos que ja existem em cards.json) ---------- */

/**
 * Blocos de texto de uma posicao. Cada bloco: { id, texto, cor?, nota?, espera? }; `id` e o rotulo
 * (dilema, luz, sombra, leva, levar, recado, desenho), traduzido pela tela.
 *   Momento  = past_present_future.present
 *   Ajuda    = eighth_greater      (a Luz)
 *   Obstaculo= eighth_lesser       (a Sombra)
 *   Caminho  = past_present_future.future + meditation_reflection[0]
 *   Sintese  = message_esoteric + a frase montada (so quando as quatro foram viradas)
 */
export function blocos(i, carta, { fraseOk = false, fraseTexto = '' } = {}) {
    const ppf = carta.past_present_future || {};
    if (i === 0) return [{ id: 'dilema', texto: ppf.present || '' }];
    if (i === 1) return [{ id: 'luz', texto: carta.eighth_greater || '', cor: 'luz' }];
    if (i === 2) return [{ id: 'sombra', texto: carta.eighth_lesser || '', cor: 'sombra' }];
    if (i === 3) {
        const med = Array.isArray(carta.meditation_reflection) ? carta.meditation_reflection[0] : '';
        return [{ id: 'leva', texto: ppf.future || '' }, { id: 'levar', texto: med || '', cor: 'pergunta' }];
    }
    return [
        { id: 'recado', texto: carta.message_esoteric || '' },
        fraseOk ? { id: 'desenho', texto: fraseTexto, cor: 'nota', nota: true } : { id: 'desenho', texto: '', cor: 'espera', espera: true },
    ];
}

/** Uma linha de resumo da posicao (lista "As cinco posicoes"): o primeiro texto, ou a frase na Sintese. */
export function linhaResumo(i, carta, { fraseOk = false, fraseTexto = '' } = {}) {
    if (i === SINTESE) return fraseOk ? fraseTexto : carta.message_esoteric || '';
    return blocos(i, carta)[0].texto;
}

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

/** [{ order, pos }] na ordem de leitura, pronto para o diario. */
export const paraDiario = (cartas) => cartas.map((c, i) => ({ order: Number(c.order), pos: IDS_POSICAO[i] }));
