import { principal, aoMudar as aoMudarPerfil } from './perfil.js';
import { chaveDe } from './contas.js';

/**
 * Verso das cartas.
 *
 * - Todo mundo tem o verso padrao do Aeon.
 * - Quem tem um mapa principal ganha o verso do SIGNO SOLAR dele, ligado automaticamente, em todas as cartas
 *   viradas para baixo (leitura, cruz, templo, carta do dia). Em Perfil, aba Dados, a pessoa pode voltar ao padrao.
 *
 * Guardado so no aparelho:
 *   "aeon:v2:verso"        -> { modo: "auto" | "padrao" }
 *   "aeon:v2:verso-signo"  -> { assinatura, signo }   o signo solar do mapa principal, calculado uma vez
 *                             (a assinatura muda se data, hora, lugar ou a escolha de hora do mapa mudarem)
 *
 * O verso aparece pela variavel CSS --verso na raiz da pagina; todo estilo de verso le essa variavel.
 */
export const CHAVE_PREFERENCIA = 'aeon:v2:verso';
export const CHAVE_SIGNO = 'aeon:v2:verso-signo';
export const EVENTO_VERSO = 'aeon:verso';

export const NOMES = {
    aries: 'Áries', touro: 'Touro', gemeos: 'Gêmeos', cancer: 'Câncer', leao: 'Leão', virgem: 'Virgem',
    libra: 'Libra', escorpiao: 'Escorpião', sagitario: 'Sagitário', capricornio: 'Capricórnio', aquario: 'Aquário', peixes: 'Peixes',
};
const SIGNOS = Object.keys(NOMES);

export const urlDoVerso = (id) => `/assets/versos/verso-${SIGNOS.includes(id) ? id : 'padrao'}.webp`;

function ler(chave) {
    try {
        return JSON.parse(localStorage.getItem(chave));
    } catch (e) {
        return null;
    }
}

function gravar(chave, valor) {
    try {
        localStorage.setItem(chave, JSON.stringify(valor));
        return true;
    } catch (e) {
        return false;
    }
}

/** 'auto' (verso do signo, se houver mapa) ou 'padrao'. Sem escolha guardada vale 'auto'. */
export function lerPreferencia() {
    const p = ler(CHAVE_PREFERENCIA);
    return p && p.modo === 'padrao' ? 'padrao' : 'auto';
}

export function definirPreferencia(modo) {
    gravar(CHAVE_PREFERENCIA, { modo: modo === 'padrao' ? 'padrao' : 'auto' });
    return aplicarVerso();
}

/** O que identifica o mapa para o cache do signo. Nao e dado novo: so junta campos que o mapa ja tem. */
export function assinaturaDoMapa(m) {
    return [m.id, m.data, m.hora || '-', m.local.lat, m.local.lon, m.local.tz, m.escolha || 0].join('|');
}

/** Signo solar guardado para o mapa principal atual, ou null se ainda nao foi calculado (ou o mapa mudou). */
export function signoGuardado(m = principal()) {
    if (!m) return null;
    const c = ler(chaveDe('verso-signo'));
    return c && c.assinatura === assinaturaDoMapa(m) && SIGNOS.includes(c.signo) ? c.signo : null;
}

/**
 * O verso em uso agora, sem calcular nada.
 * -> { id: 'padrao' | signo, url, signo (o do mapa, mesmo com o padrao escolhido), modo, temMapa }
 */
export function versoAtual() {
    const m = principal();
    const signo = signoGuardado(m);
    const modo = lerPreferencia();
    const id = modo === 'auto' && signo ? signo : 'padrao';
    return { id, url: urlDoVerso(id), signo, modo, temMapa: !!m };
}

/** Calcula e guarda o signo solar do mapa principal (so se ainda nao esta guardado). -> o signo, ou null. */
export async function atualizarSigno(calcularFn) {
    const m = principal();
    if (!m) return null;
    const guardado = signoGuardado(m);
    if (guardado) return guardado;
    try {
        const calcular = calcularFn || (await import('./mapaComum.js')).calcular; // (os testes passam o calculo)
        const calc = await calcular(m);
        const signo = calc && calc.pontos && calc.pontos.sol && calc.pontos.sol.signo;
        if (!SIGNOS.includes(signo)) return null;
        const atual = principal();
        if (atual && assinaturaDoMapa(atual) === assinaturaDoMapa(m)) gravar(chaveDe('verso-signo'), { assinatura: assinaturaDoMapa(m), signo });
        return signo;
    } catch (e) {
        return null;
    }
}

/** Aplica o verso atual na pagina (variavel CSS) e avisa as telas. */
export function aplicarVerso() {
    const v = versoAtual();
    if (typeof document !== 'undefined') {
        document.documentElement.style.setProperty('--verso', `url("${v.url}")`);
        window.dispatchEvent(new CustomEvent(EVENTO_VERSO, { detail: v }));
    }
    return v;
}

let iniciado = false;
let espera = null;

/** Liga o verso: aplica o que ja esta guardado (sem piscar), calcula o signo se faltar e acompanha mudancas no mapa. */
export function iniciarVerso() {
    if (iniciado || typeof window === 'undefined') return;
    iniciado = true;
    aplicarVerso();
    atualizarSigno().then(() => aplicarVerso());
    aoMudarPerfil(() => {
        clearTimeout(espera);
        espera = setTimeout(() => {
            aplicarVerso();
            atualizarSigno().then(() => aplicarVerso());
        }, 300);
    });
}
