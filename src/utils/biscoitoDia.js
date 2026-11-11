import { dataLocal, hash } from './cartaDoDia.js';
import { copiarItem, indiceAleatorio, validarItem, MAX_TEXTO_GUARDADO } from './biscoito.js';

/**
 * Estado dos biscoitos de hoje: ate 3 por dia, sem repetir frases vistas recentemente.
 *
 * Chave: "aeon:v2:biscoito"  ->  { v: 1, dias: { "YYYY-MM-DD": { itens: [{ id, texto, numeros }] } }, vistos: [id, ...] }
 * E do aparelho (nao passa pelas chaves por conta de contas.js). Guarda os ultimos 7 dias.
 *
 * Sem localStorage (modo privado, bloqueado, quota cheia) o primeiro biscoito do dia sai da data
 * (hash de YYYY-MM-DD), que nao muda a cada recarregamento; os extras vivem so em memoria.
 */
export const CHAVE_BISCOITO = 'aeon:v2:biscoito';
export const LIMITE_DIA = 3;
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

/** Aceita so o que tem a forma esperada; o resto e descartado sem quebrar nada. */
export function sanear(bruto) {
    const estado = vazio();
    if (!bruto || typeof bruto !== 'object' || bruto.v !== 1) return estado;
    if (bruto.dias && typeof bruto.dias === 'object' && !Array.isArray(bruto.dias)) {
        for (const [data, dia] of Object.entries(bruto.dias)) {
            if (!RE_DATA.test(data) || !dia || typeof dia !== 'object' || !Array.isArray(dia.itens)) continue;
            const itens = dia.itens.filter((x) => validarItem(x, MAX_TEXTO_GUARDADO)).map(copiarItem).slice(0, LIMITE_DIA);
            if (itens.length) estado.dias[data] = { itens };
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

/** Os biscoitos de hoje, do primeiro ao ultimo, e quantos ainda podem ser quebrados. */
export function lerHoje(hoje = dataLocal()) {
    const { estado, persiste } = carregar();
    const dia = estado.dias[hoje];
    const itens = dia ? dia.itens.map(copiarItem) : [];
    return { itens, restantes: Math.max(0, LIMITE_DIA - itens.length), persiste };
}

export const restantes = (hoje = dataLocal()) => lerHoje(hoje).restantes;

/** O ultimo biscoito quebrado hoje (o que a tela mostra ao voltar), ou null. */
export function ultimoDeHoje(hoje = dataLocal()) {
    const { itens } = lerHoje(hoje);
    return itens.length ? itens[itens.length - 1] : null;
}

/** O biscoito "de hoje" (o primeiro do dia), ou null. E o que o cartao da Home mostra. */
export function primeiroDeHoje(hoje = dataLocal()) {
    const { itens } = lerHoje(hoje);
    return itens.length ? itens[0] : null;
}

/**
 * Quebra um biscoito: sorteia entre as frases nao vistas na janela e guarda.
 * @param lista frases ja validadas
 * @param fonte (opcional) gerador de uint32, para testes
 * @returns {{item, indice, restantes, persiste}|null} null se acabaram os de hoje ou a lista esta vazia
 */
export function quebrar(lista, hoje = dataLocal(), fonte) {
    const n = lista.length;
    if (!n) return null;
    const { estado } = carregar();
    const dia = estado.dias[hoje] || (estado.dias[hoje] = { itens: [] });
    if (dia.itens.length >= LIMITE_DIA) return null;

    const j = janela(n);
    const recentes = new Set(estado.vistos.slice(-j));
    const deHoje = new Set(dia.itens.map((x) => x.id));
    let candidatas = lista.filter((x) => !recentes.has(x.id) && !deHoje.has(x.id));
    if (!candidatas.length) candidatas = lista.filter((x) => !deHoje.has(x.id));
    if (!candidatas.length) candidatas = lista;

    let item = candidatas[indiceAleatorio(candidatas.length, fonte)];
    const primeiro = dia.itens.length === 0;
    dia.itens.push(copiarItem(item));
    estado.vistos.push(item.id);
    estado.vistos = estado.vistos.slice(-j);

    const gravou = gravar(estado, hoje);
    if (!gravou && primeiro) {
        // sem armazenamento: o primeiro do dia sai da data, para nao mudar a cada recarregamento
        item = lista[hash(hoje) % n];
        dia.itens[0] = copiarItem(item);
        estado.vistos[estado.vistos.length - 1] = item.id;
    }
    return { item: copiarItem(item), indice: dia.itens.length, restantes: LIMITE_DIA - dia.itens.length, persiste: gravou };
}

/** So para testes: esquece o que ficou em memoria. */
export function reiniciarMemoria() {
    memoria = null;
    gravacaoFalhou = false;
}
