/**
 * Convite para ligar a sincronizacao com a conta (Home e Diario). Opcional e dispensavel.
 *
 * Aparece so quando:
 *  - a sincronizacao existe neste build e ainda esta desligada neste aparelho;
 *  - a pessoa ja tem algo a proteger (pelo menos 1 entrada no diario ou 1 mapa);
 *  - o lembrete de backup nao esta na tela (um aviso por vez);
 *  - ela nao dispensou o convite nos ultimos 30 dias.
 *
 * Chave (so a data, fora do backup e da sincronizacao): "aeon:v2:convite-conta" -> { dispensadoEm: ISO }
 */
export const CHAVE_CONVITE = 'aeon:v2:convite-conta';
export const DIAS_DISPENSA = 30;
const MS_DIA = 24 * 60 * 60 * 1000;

export function lerDispensa() {
    try {
        const c = JSON.parse(localStorage.getItem(CHAVE_CONVITE));
        return c && typeof c.dispensadoEm === 'string' ? c.dispensadoEm : null;
    } catch (e) {
        return null;
    }
}

export function dispensarConvite(agora = new Date()) {
    try {
        localStorage.setItem(CHAVE_CONVITE, JSON.stringify({ dispensadoEm: agora.toISOString() }));
        return true;
    } catch (e) {
        return false;
    }
}

/** Data de dispensa valida em ms, ou null. Data no futuro (relogio errado) nao vale: esconderia o convite para sempre. */
function dispensaEmMs(iso, agora) {
    if (typeof iso !== 'string') return null;
    const t = Date.parse(iso);
    return Number.isFinite(t) && t <= agora + MS_DIA ? t : null;
}

/**
 * O convite deve aparecer?
 * @param {{ativa:boolean, fase:string, registros:number, backupAtivo?:boolean, dispensadoEm?:string|null, agora?:number}} o
 */
export function conviteAtivo({ ativa, fase, registros, backupAtivo = false, dispensadoEm = null, agora = Date.now() }) {
    if (!ativa || fase !== 'desligada') return false;
    if (!(registros >= 1) || backupAtivo) return false;
    const d = dispensaEmMs(dispensadoEm, agora);
    return d === null || agora - d >= DIAS_DISPENSA * MS_DIA;
}
