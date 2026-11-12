import { dataLocal, hash } from './cartaDoDia.js';
import { copiarItem, indiceAleatorio, validarItem, MAX_TEXTO_GUARDADO } from './biscoito.js';

/**
 * Estado dos biscoitos de hoje: tres lugares por dia, cada um abre uma vez, sem repetir frases vistas recentemente.
 *
 * Chave: "aeon:v2:biscoito"  ->  { v: 1, dias: { "YYYY-MM-DD": { lugares: [item|null, item|null, item|null], ordem: [lugar, ...] } }, vistos: [id, ...] }
 * (o formato antigo, { itens: [...] }, e lido como lugares 0..n-1 na ordem em que estavam)
 * E do aparelho (nao passa pelas chaves por conta de contas.js). Guarda os ultimos 7 dias.
 *
 * Sem localStorage (modo privado, bloqueado, quota cheia) a frase de cada lugar sai da data e do lugar
 * (hash de YYYY-MM-DD, distinta entre os tres lugares), que nao muda a cada recarregamento.
 */
export const CHAVE_BISCOITO = 'aeon:v2:biscoito';
export const LUGARES = 3; // tres biscoitos por dia, um por lugar (0, 1, 2)
export const DIAS_GUARDADOS = 7;
export const JANELA_MAXIMA = 700;
const RE_DATA = /^\d{4}-\d{2}-\d{2}$/;

let memoria = null; // estado desta visita, usado quando o armazenamento falha
let gravacaoFalhou = false;

/** Quantos ids vistos valem no sorteio: ate 700, sempre sobrando pelo menos 100 candidatas (ou metade, em lista pequena). */
export const janela = (n) => Math.max(1, Math.min(JANELA_MAXIMA, n - Math.min(100, Math.floor(n / 2))));

const vazio = () => ({ v: 1, dias: {}, vistos: [] });

function deData(texto) {
    const [a, m, d] = texto.split('-').map(Number);
    return new Date(a, m - 1, d, 12); // meio-dia: evita surpresa de horario de verao
}

/** Itens validos de uma lista, na ordem; o que nao serve vira null (o lugar fica fechado). */
const itensOuNull = (lista) => lista.slice(0, LUGARES).map((x) => (validarItem(x, MAX_TEXTO_GUARDADO) ? copiarItem(x) : null));

/** Aceita so o que tem a forma esperada; o resto e descartado sem quebrar nada. */
export function sanear(bruto) {
    const estado = vazio();
    if (!bruto || typeof bruto !== 'object' || bruto.v !== 1) return estado;
    if (bruto.dias && typeof bruto.dias === 'object' && !Array.isArray(bruto.dias)) {
        for (const [data, dia] of Object.entries(bruto.dias)) {
            if (!RE_DATA.test(data) || !dia || typeof dia !== 'object') continue;
            let lugares;
            if (Array.isArray(dia.lugares)) lugares = itensOuNull(dia.lugares);
            else if (Array.isArray(dia.itens)) lugares = itensOuNull(dia.itens.filter((x) => validarItem(x, MAX_TEXTO_GUARDADO))); // formato antigo: lugares 0..n-1 na ordem
            else continue;
            while (lugares.length < LUGARES) lugares.push(null);
            if (!lugares.some(Boolean)) continue;
            // ordem em que foram abertos: so lugares cheios, sem repetir; os que faltarem entram no fim
            const ordem = [];
            const dada = Array.isArray(dia.ordem) ? dia.ordem : [];
            for (const l of [...dada, 0, 1, 2]) if (Number.isInteger(l) && l >= 0 && l < LUGARES && lugares[l] && !ordem.includes(l)) ordem.push(l);
            estado.dias[data] = { lugares, ordem };
        }
    }
    if (Array.isArray(bruto.vistos)) {
        estado.vistos = bruto.vistos.filter((id) => Number.isInteger(id) && id >= 1).slice(-JANELA_MAXIMA);
    }
    return estado;
}

function podar(estado, hoje) {
    const corte = deData(hoje);
    corte.setDate(corte.getDate() - (DIAS_GUARDADOS - 1));
    const minimo = dataLocal(corte);
    for (const data of Object.keys(estado.dias)) if (data < minimo) delete estado.dias[data];
    return estado;
}

/** Le o estado. `persiste` diz se o armazenamento respondeu; JSON corrompido vira estado vazio. */
function carregar() {
    if (gravacaoFalhou && memoria) return { estado: memoria, persiste: false };
    let bruto;
    try {
        bruto = localStorage.getItem(CHAVE_BISCOITO);
    } catch (e) {
        return { estado: memoria || vazio(), persiste: false };
    }
    if (bruto == null) return { estado: vazio(), persiste: true };
    try {
        return { estado: sanear(JSON.parse(bruto)), persiste: true };
    } catch (e) {
        return { estado: vazio(), persiste: true };
    }
}

function gravar(estado, hoje) {
    podar(estado, hoje);
    memoria = estado;
    try {
        localStorage.setItem(CHAVE_BISCOITO, JSON.stringify(estado));
        gravacaoFalhou = false;
        return true;
    } catch (e) {
        gravacaoFalhou = true;
        return false;
    }
}

/** Frase estavel por data e lugar, distinta entre os tres lugares do mesmo dia. */
export const indiceDaData = (hoje, lugar, n) => (hash(hoje) + lugar * Math.floor(n / LUGARES)) % n;

/** Os tres lugares de hoje (item ou null), a ordem em que foram abertos e se o armazenamento respondeu. */
export function lerHoje(hoje = dataLocal()) {
    const { estado, persiste } = carregar();
    const dia = estado.dias[hoje];
    const lugares = dia ? dia.lugares.map((x) => (x ? copiarItem(x) : null)) : [null, null, null];
    return { lugares, ordem: dia ? [...dia.ordem] : [], persiste };
}

/** O biscoito aberto ha mais tempo hoje (o "de hoje"): e o que o cartao da Home mostra. Null se nenhum foi aberto. */
export function primeiroDeHoje(hoje = dataLocal()) {
    const { lugares, ordem } = lerHoje(hoje);
    return ordem.length ? lugares[ordem[0]] : null;
}

/** Lugar do biscoito aberto ha mais tempo hoje, ou -1. */
export function primeiroLugar(hoje = dataLocal()) {
    const { ordem } = lerHoje(hoje);
    return ordem.length ? ordem[0] : -1;
}

/**
 * Abre o biscoito de um lugar. Lugar ja aberto: devolve o que esta la, sem sortear nem gravar.
 * Lugar fechado: sorteia entre as frases nao vistas na janela e guarda.
 * @param lista frases ja validadas
 * @param lugar 0, 1 ou 2
 * @param fonte (opcional) gerador de uint32, para testes
 * @returns {{item, lugar, novo, persiste}|null} null se o lugar e invalido ou a lista esta vazia
 */
export function quebrar(lista, lugar, hoje = dataLocal(), fonte) {
    const n = lista.length;
    if (!n || !Number.isInteger(lugar) || lugar < 0 || lugar >= LUGARES) return null;
    const { estado, persiste } = carregar();
    const dia = estado.dias[hoje] || (estado.dias[hoje] = { lugares: [null, null, null], ordem: [] });
    if (dia.lugares[lugar]) return { item: copiarItem(dia.lugares[lugar]), lugar, novo: false, persiste };

    const j = janela(n);
    const recentes = new Set(estado.vistos.slice(-j));
    const deHoje = new Set(dia.lugares.filter(Boolean).map((x) => x.id));
    let candidatas = lista.filter((x) => !recentes.has(x.id) && !deHoje.has(x.id));
    if (!candidatas.length) candidatas = lista.filter((x) => !deHoje.has(x.id));
    if (!candidatas.length) candidatas = lista;

    let item = candidatas[indiceAleatorio(candidatas.length, fonte)];
    dia.lugares[lugar] = copiarItem(item);
    dia.ordem.push(lugar);
    estado.vistos.push(item.id);
    estado.vistos = estado.vistos.slice(-j);

    const gravou = gravar(estado, hoje);
    if (!gravou) {
        // sem armazenamento: a frase sai da data e do lugar, para nao mudar a cada recarregamento
        item = lista[indiceDaData(hoje, lugar, n)];
        dia.lugares[lugar] = copiarItem(item);
        estado.vistos[estado.vistos.length - 1] = item.id;
    }
    return { item: copiarItem(item), lugar, novo: true, persiste: gravou };
}

/** So para testes: esquece o que ficou em memoria. */
export function reiniciarMemoria() {
    memoria = null;
    gravacaoFalhou = false;
}
