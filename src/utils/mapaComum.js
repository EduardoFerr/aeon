import { loadCards } from './cardsUtil.js';

/**
 * Apoio das telas do Perfil e do Mapa astral: textos (ids ui.*), motor de calculo e formatacao.
 * Textos e motor sao carregados sob demanda, para nao pesar o pacote inicial.
 */
let textosP = null;
export function carregarTextos() {
    textosP ??= fetch('/data/astro/textos.json')
        .then((r) => {
            if (!r.ok) throw new Error('textos');
            return r.json();
        })
        .catch((e) => {
            textosP = null;
            throw e;
        });
    return textosP;
}

let motorP = null;
export function carregarMotor() {
    motorP ??= import('../astro/index.js').catch((e) => {
        motorP = null;
        throw e;
    });
    return motorP;
}

let tempoP = null;
export function carregarTempo() {
    tempoP ??= import('../astro/tempo.js');
    return tempoP;
}

/** Texto de interface por id; marcadores {nome} trocados por vars. Sem o id devolve o padrao (ou ''). */
export function texto(textos, id, vars = {}, padrao = '') {
    const t = textos && typeof textos[id] === 'string' ? textos[id] : padrao;
    return t.replace(/\{(\w+)\}/g, (m, k) => (k in vars ? vars[k] : m));
}

export const esc = (s) =>
    String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

export const ELEMENTO = { Fogo: 'fogo', Terra: 'terra', Ar: 'ar', 'Água': 'agua' };
export const SIGNO_ELEMENTO = {
    aries: 'fogo', leao: 'fogo', sagitario: 'fogo',
    touro: 'terra', virgem: 'terra', capricornio: 'terra',
    gemeos: 'ar', libra: 'ar', aquario: 'ar',
    cancer: 'agua', escorpiao: 'agua', peixes: 'agua',
};

const MESES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
export const nomeMes = (i) => MESES[i - 1];

export function dataExtenso(iso) {
    const [a, m, d] = iso.split('-').map(Number);
    return `${d} de ${MESES[m - 1]} de ${a}`;
}

export function dataCurta(iso) {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime()) || d.getUTCFullYear() < 2000) return '';
    return d.toLocaleDateString('pt-BR');
}

export const grauTexto = (p) => `${p.grauInteiro}°${String(p.minuto).padStart(2, '0')}′`;

/** Calcula o mapa guardado (ou uma entrada de formulario) com as cartas do tarot ligadas a cada ponto. */
export async function calcular(entrada) {
    const [motor, cartas] = await Promise.all([carregarMotor(), loadCards()]);
    return motor.calcularMapa({ data: entrada.data, hora: entrada.hora, local: entrada.local, escolhaHora: entrada.escolha || 0, cartas });
}

const doisDig = (n) => String(n).padStart(2, '0');
const horaDe = (ms, deslocSeg) => {
    const d = new Date(ms + deslocSeg * 1000);
    return `${doisDig(d.getUTCHours())}:${doisDig(d.getUTCMinutes())}`;
};
const utcRotulo = (s) => s.replace('-', '−');

/**
 * Marcadores {hora1} e {hora2} dos avisos de hora ambigua ou inexistente, com o deslocamento de fuso.
 * Ambigua: as duas leituras da mesma hora no relogio, cada uma com seu UTC.
 * Inexistente: o relogio saltou de {hora1} para {hora2} (hora de parede antes e depois da virada).
 */
export async function marcadoresHora(mapa, tz) {
    const { hora } = mapa;
    const ops = hora.opcoes;
    const pare = mapa.entrada.hora;
    if (hora.estado === 'ambigua') {
        return {
            hora1: `${pare} (${utcRotulo(ops[0].deslocamento)})`,
            hora2: `${pare} (${utcRotulo(ops[1].deslocamento)})`,
            rotulos: ops.map((o) => `${pare} (${utcRotulo(o.deslocamento)})`),
        };
    }
    // inexistente: acha o instante da virada por bisseccao
    const { deslocamentoSegundos } = await carregarTempo();
    let lo = Date.parse(ops[0].utc);
    let hi = Date.parse(ops[1].utc);
    if (lo > hi) [lo, hi] = [hi, lo];
    const antes = deslocamentoSegundos(lo, tz);
    const depois = deslocamentoSegundos(hi, tz);
    for (let i = 0; i < 24 && hi - lo > 1000; i++) {
        const meio = Math.floor((lo + hi) / 2);
        if (deslocamentoSegundos(meio, tz) === antes) lo = meio;
        else hi = meio;
    }
    const virada = Math.ceil(hi / 1000) * 1000;
    return {
        hora1: horaDe(virada, antes),
        hora2: horaDe(virada, depois),
        rotulos: ops.map((o) => `${pare} (${utcRotulo(o.deslocamento)})`),
    };
}

/** Casa (1 a 12) que contem a longitude, dadas as cuspides do mapa (calc.casas.cuspides). */
export function casaDa(lon, cuspides) {
    if (!cuspides) return null;
    for (let i = 0; i < 12; i++) {
        const a = cuspides[i].lon;
        const b = cuspides[(i + 1) % 12].lon;
        if (((lon - a + 360) % 360) < ((b - a + 360) % 360)) return i + 1;
    }
    return 1;
}

/** Atribuicao do GeoNames (ui.geonames) com os dois enderecos viram ancoras. HTML seguro (texto escapado). */
export function atribuicaoGeoNames(textos) {
    const t = esc(texto(textos, 'ui.geonames', {}, 'Dados de lugares do GeoNames (geonames.org), licença CC BY 4.0: creativecommons.org/licenses/by/4.0'));
    return t
        .replace('geonames.org', '<a href="https://www.geonames.org/" target="_blank" rel="noopener noreferrer">geonames.org</a>')
        .replace('creativecommons.org/licenses/by/4.0', '<a href="https://creativecommons.org/licenses/by/4.0/" target="_blank" rel="noopener noreferrer">creativecommons.org/licenses/by/4.0</a>');
}
