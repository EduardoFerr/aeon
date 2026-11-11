/**
 * Regras puras da atualizacao do app e do lembrete de backup (sem DOM, sem localStorage: testaveis em node).
 *
 * Chaves novas do localStorage (so a data, em texto ISO; nao entram no arquivo de backup):
 *   "aeon:v2:ultimo-backup"      quando a pessoa exportou o backup pela ultima vez
 *   "aeon:v2:backup-dispensado"  quando a pessoa dispensou o lembrete (esconde por 14 dias)
 *   "aeon:v2:persist-pedido"     marca de que o pedido de armazenamento persistente ja foi feito
 */
export const CHAVE_ULTIMO_BACKUP = 'aeon:v2:ultimo-backup';
export const CHAVE_BACKUP_DISPENSADO = 'aeon:v2:backup-dispensado';
export const CHAVE_PERSIST_PEDIDO = 'aeon:v2:persist-pedido';

/** Evento da janela: a pagina vai recarregar para aplicar a versao nova; as telas guardam o que estiver pendente. */
export const EVENTO_ANTES = 'aeon:antes-de-atualizar';

export const MS_DIA = 24 * 60 * 60 * 1000;
export const DIAS_BACKUP_VELHO = 30;
export const DIAS_DISPENSA = 14;
export const MIN_ENTRADAS_DIARIO = 5;
export const MIN_MAPAS = 1;

/** Data ISO valida em ms, ou null. Data no futuro (relogio errado) nao vale: apagaria o lembrete para sempre. */
export function lerData(iso, agora) {
    if (typeof iso !== 'string') return null;
    const t = Date.parse(iso);
    if (!Number.isFinite(t)) return null;
    if (t > agora + MS_DIA) return null;
    return t;
}

/** Ha registros que valem proteger: diario com 5 ou mais entradas, ou pelo menos 1 mapa guardado. */
export function temRegistros({ entradas = 0, mapas = 0 } = {}) {
    return entradas >= MIN_ENTRADAS_DIARIO || mapas >= MIN_MAPAS;
}

/**
 * O lembrete de backup deve aparecer?
 * Sim quando ha registros, o ultimo backup tem mais de 30 dias (ou nao existe) e a pessoa nao dispensou o
 * lembrete nos ultimos 14 dias.
 * @param {{entradas:number, mapas:number, ultimoBackup?:string|null, dispensadoEm?:string|null, agora?:number}} o
 */
export function precisaAvisoBackup({ entradas = 0, mapas = 0, ultimoBackup = null, dispensadoEm = null, agora = Date.now() } = {}) {
    if (!temRegistros({ entradas, mapas })) return false;
    const backup = lerData(ultimoBackup, agora);
    if (backup !== null && agora - backup <= DIAS_BACKUP_VELHO * MS_DIA) return false;
    const dispensa = lerData(dispensadoEm, agora);
    if (dispensa !== null && agora - dispensa < DIAS_DISPENSA * MS_DIA) return false;
    return true;
}

/** Numeros de "1.2.3" (aceita "v1.2.3" e sufixo "-beta"; o que nao for numero vira 0). */
function partes(v) {
    return String(v ?? '')
        .trim()
        .replace(/^v/i, '')
        .split(/[-+]/)[0]
        .split('.')
        .map((x) => (/^\d+$/.test(x) ? Number(x) : 0));
}

/** Compara duas versoes "1.2.3": -1 se a < b, 0 se iguais, 1 se a > b. */
export function compararVersao(a, b) {
    const x = partes(a);
    const y = partes(b);
    const n = Math.max(x.length, y.length);
    for (let i = 0; i < n; i++) {
        const d = (x[i] || 0) - (y[i] || 0);
        if (d !== 0) return d < 0 ? -1 : 1;
    }
    return 0;
}

/**
 * A versao publicada e mais nova que a que esta rodando? Compara o numero da versao e, se for o mesmo, a data
 * do build (texto ISO, que ordena como texto).
 * @param {{versao:string, build?:string}} rodando
 * @param {{versao:string, build?:string}} publicada
 */
export function haVersaoNova(rodando, publicada) {
    if (!rodando || !publicada) return false;
    const c = compararVersao(publicada.versao, rodando.versao);
    if (c !== 0) return c > 0;
    const a = Date.parse(rodando.build);
    const b = Date.parse(publicada.build);
    return Number.isFinite(a) && Number.isFinite(b) && b > a;
}

/** "11/11/2026 14:32" na hora local (ou no fuso dado, para teste). */
export function formatarBuild(iso, timeZone) {
    const t = Date.parse(iso);
    if (!Number.isFinite(t)) return '';
    const opcoes = { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false };
    if (timeZone) opcoes.timeZone = timeZone;
    return new Intl.DateTimeFormat('pt-BR', opcoes).format(new Date(t)).replace(',', '');
}

/** "1.0.0, gerada em 11/11/2026 14:32" */
export function rotuloVersao({ versao, build }, timeZone) {
    const quando = formatarBuild(build, timeZone);
    return quando ? `${versao}, gerada em ${quando}` : String(versao);
}
