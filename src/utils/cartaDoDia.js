import { shuffle } from './cardsUtil.js';
import { chaveDe } from './contas.js';

/**
 * Carta do dia: sorteio unico por dia, guardado so no aparelho.
 *
 * Chave: "aeon:v2:dia"  ->  { v: 2, dias: { "YYYY-MM-DD": { order: 0..77, virada: true|false } } }
 * Guarda os ultimos 60 dias. A chave do historico das leituras (storage.js) nao e tocada.
 *
 * Sem localStorage (modo privado, bloqueado, quota cheia) o site continua: o sorteio vira
 * deterministico pela data local (hash de YYYY-MM-DD), que nao muda a cada recarregamento,
 * e o que a pessoa fez na visita fica em memoria ate fechar a pagina.
 */
export const CHAVE_DIA = 'aeon:v2:dia';
const DIAS_GUARDADOS = 60;
const RE_DATA = /^\d{4}-\d{2}-\d{2}$/;

const NOMES_DIA = ['domingo', 'segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado'];
const LETRAS_DIA = ['D', 'S', 'T', 'Q', 'Q', 'S', 'S'];

let memoria = null; // estado desta visita, usado quando o armazenamento falha
let gravacaoFalhou = false;

/** Data local no formato YYYY-MM-DD (nunca UTC, para virar a carta no dia que a pessoa vive). */
export function dataLocal(d = new Date()) {
    const mes = String(d.getMonth() + 1).padStart(2, '0');
    const dia = String(d.getDate()).padStart(2, '0');
    return `${d.getFullYear()}-${mes}-${dia}`;
}

function deData(texto) {
    const [a, m, d] = texto.split('-').map(Number);
    return new Date(a, m - 1, d, 12); // meio-dia: evita surpresa de horario de verao
}

const vazio = () => ({ v: 2, dias: {} });

/** Aceita so o que tem a forma esperada; o resto e descartado sem quebrar nada. */
function sanear(bruto) {
    const estado = vazio();
    if (!bruto || typeof bruto !== 'object' || bruto.v !== 2 || !bruto.dias || typeof bruto.dias !== 'object') {
        return estado;
    }
    for (const [data, item] of Object.entries(bruto.dias)) {
        if (!RE_DATA.test(data) || !item || typeof item !== 'object') continue;
        const order = Number(item.order);
        if (!Number.isInteger(order) || order < 0 || order > 77) continue;
        estado.dias[data] = { order, virada: item.virada === true };
    }
    return estado;
}

function podar(estado, hoje) {
    const corte = new Date(deData(hoje));
    corte.setDate(corte.getDate() - DIAS_GUARDADOS);
    const minimo = dataLocal(corte);
    for (const data of Object.keys(estado.dias)) {
        if (data < minimo) delete estado.dias[data];
    }
    return estado;
}

/** Le o estado. `persiste` diz se o armazenamento respondeu; JSON corrompido vira estado vazio. */
function carregar() {
    let bruto;
    try {
        bruto = localStorage.getItem(chaveDe('dia'));
    } catch (e) {
        return { estado: memoria || vazio(), persiste: false };
    }
    if (bruto == null) return { estado: gravacaoFalhou && memoria ? memoria : vazio(), persiste: !gravacaoFalhou };
    try {
        return { estado: sanear(JSON.parse(bruto)), persiste: true };
    } catch (e) {
        return { estado: vazio(), persiste: true }; // corrompido: recomeca limpo na proxima gravacao
    }
}

function gravar(estado, hoje) {
    podar(estado, hoje);
    memoria = estado;
    try {
        localStorage.setItem(chaveDe('dia'), JSON.stringify(estado));
        gravacaoFalhou = false;
        return true;
    } catch (e) {
        gravacaoFalhou = true; // quota excedida ou bloqueado
        return false;
    }
}

/** FNV-1a de 32 bits: pequeno, rapido e estavel entre aparelhos. */
export function hash(texto) {
    let h = 0x811c9dc5;
    for (let i = 0; i < texto.length; i++) {
        h ^= texto.charCodeAt(i);
        h = Math.imul(h, 0x01000193) >>> 0;
    }
    return h >>> 0;
}

/**
 * Carta de hoje. Primeira vez no dia: sorteia (shuffle com crypto) e guarda. Depois: a mesma.
 * @returns {{carta: Object, virada: boolean, persiste: boolean, data: string}}
 */
export function obterCartaDoDia(cartas, hoje = dataLocal()) {
    const porOrdem = (order) => cartas.find((c) => Number(c.order) === order) || null;
    const { estado, persiste } = carregar();
    const salvo = estado.dias[hoje];
    if (salvo && porOrdem(salvo.order)) {
        return { carta: porOrdem(salvo.order), virada: salvo.virada, persiste, data: hoje };
    }

    const ordenadas = [...cartas].sort((a, b) => Number(a.order) - Number(b.order));
    let carta = shuffle(ordenadas)[0];
    estado.dias[hoje] = { order: Number(carta.order), virada: false };
    const gravou = gravar(estado, hoje);
    if (!gravou) {
        // sem armazenamento: a carta do dia sai da data, para nao mudar a cada recarregamento
        carta = ordenadas[hash(hoje) % ordenadas.length];
        estado.dias[hoje] = { order: Number(carta.order), virada: false };
        memoria = estado;
    }
    return { carta, virada: false, persiste: gravou, data: hoje };
}

/** Registra que a pessoa virou a carta de hoje. */
export function marcarVirada(carta, hoje = dataLocal()) {
    const { estado } = carregar();
    estado.dias[hoje] = { order: Number(carta.order), virada: true };
    return gravar(estado, hoje);
}

/** Os 7 dias da semana de `hoje` (domingo a sabado), com o que foi virado em cada um. */
export function diasDaSemana(hoje = dataLocal()) {
    const base = deData(hoje);
    const inicio = new Date(base);
    inicio.setDate(base.getDate() - base.getDay());
    const { estado } = carregar();
    return Array.from({ length: 7 }, (_, i) => {
        const d = new Date(inicio);
        d.setDate(inicio.getDate() + i);
        const data = dataLocal(d);
        const item = estado.dias[data];
        return {
            data,
            numero: d.getDate(),
            letra: LETRAS_DIA[i],
            nome: NOMES_DIA[i],
            hoje: data === hoje,
            futuro: data > hoje,
            virada: Boolean(item && item.virada),
        };
    });
}

const plural = (n, um, varios) => (n === 1 ? um : varios);

/**
 * Frase de convite. Sempre acolhedora e neutra: conta o que foi virado, nunca o que ficou de fora.
 * A escolha entre as variantes e estavel no dia (hash da data), para nao piscar a cada atualizacao.
 */
export function fraseDaSemana(semana, hoje = dataLocal()) {
    const n = semana.filter((d) => d.virada).length;
    const viradaHoje = semana.some((d) => d.hoje && d.virada);
    const total = `${n} ${plural(n, 'carta', 'cartas')}`;
    const opcoes = viradaHoje
        ? [
              `Você virou ${total} nesta semana.`,
              'Amanhã tem uma carta nova esperando.',
              `${plural(n, 'Uma carta', `${n} cartas`)} nesta semana. Amanhã vem outra.`,
          ]
        : n > 0
          ? [
                `Você virou ${total} nesta semana.`,
                'Hoje também tem uma carta esperando por você.',
                'A carta de hoje está de costas, esperando o seu toque.',
            ]
          : [
                'A carta de hoje espera por você, quando quiser.',
                'Uma semana nova de cartas começa no seu tempo.',
            ];
    return opcoes[hash(hoje) % opcoes.length];
}

/** Uma das perguntas de meditacao da carta, sempre a mesma para a mesma carta no mesmo dia. */
export function perguntaDoDia(carta, hoje = dataLocal()) {
    const lista = Array.isArray(carta.meditation_reflection) ? carta.meditation_reflection.filter(Boolean) : [];
    if (!lista.length) return '';
    return lista[hash(`${hoje}:${carta.order}`) % lista.length];
}
