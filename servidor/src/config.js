/**
 * Configuração lida do ambiente (arquivo .env no Docker Compose). Falha cedo e em voz alta:
 * é melhor o servidor não subir do que subir com um segredo fraco ou uma origem errada.
 */

export const CODIGO_VALE_MS = 10 * 60 * 1000;
export const CODIGO_TENTATIVAS = 5;
export const CODIGO_REENVIO_MS = 30 * 1000;
/** Depois de 5 erros, o e-mail fica sem receber código novo por 6 horas (vale por e-mail, não por código). */
export const CODIGO_BLOQUEIO_MS = 6 * 60 * 60 * 1000;
export const ENVIOS_POR_HORA_GLOBAL = 100;
export const MAX_SESSOES_POR_USUARIO = 20;
export const MAX_CONTAS_POR_SESSAO = 10;
export const LIMITE_LINHAS_USUARIO = 5000;
export const EXPURGO_MARCAS_MS = 365 * 24 * 60 * 60 * 1000;
export const SESSAO_MS = 365 * 24 * 60 * 60 * 1000;
export const SESSAO_RENOVA_APOS_MS = 60 * 60 * 1000;
export const LIMITE_ITEM_BYTES = 1024 * 1024;
export const LIMITE_USUARIO_BYTES = 5 * 1024 * 1024;
export const LIMITE_DIARIO = 500;
export const LIMITE_ITENS_POR_PEDIDO = 200;
export const LIMITE_CORPO_SYNC = 6 * 1024 * 1024;
export const LIMITE_CORPO_AUTH = 8 * 1024;
export const PAGINA_SYNC = 500;

const LOCAL = new Set(['localhost', '127.0.0.1', '[::1]']);

export function lerConfig(env = process.env) {
    const producao = env.NODE_ENV === 'production';
    const erros = [];

    const segredo = env.SEGREDO || '';
    if (segredo.length < 32) erros.push('SEGREDO precisa ter ao menos 32 caracteres (gere com: openssl rand -base64 48).');

    const origens = (env.ORIGENS_PERMITIDAS || 'https://aeonfool.com')
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);
    if (!origens.length) erros.push('ORIGENS_PERMITIDAS está vazia.');
    for (const o of origens) {
        let u;
        try {
            u = new URL(o);
        } catch {
            erros.push(`ORIGENS_PERMITIDAS: "${o}" não é uma origem válida.`);
            continue;
        }
        if (u.origin !== o) erros.push(`ORIGENS_PERMITIDAS: use só a origem, sem barra no fim nem caminho ("${u.origin}").`);
        const local = LOCAL.has(u.hostname);
        if (u.protocol !== 'https:' && !(local && !producao)) erros.push(`ORIGENS_PERMITIDAS: "${o}" precisa ser https.`);
    }

    const emailModo = env.EMAIL_MODO || 'smtp';
    if (!['smtp', 'console'].includes(emailModo)) erros.push('EMAIL_MODO deve ser "smtp" ou "console".');
    if (emailModo === 'console' && producao) erros.push('EMAIL_MODO=console imprime os códigos no log e não pode ser usado em produção.');
    const smtp = {
        host: env.SMTP_HOST || '',
        porta: Number(env.SMTP_PORTA || 465),
        usuario: env.SMTP_USUARIO || '',
        senha: env.SMTP_SENHA || '',
    };
    const de = env.EMAIL_DE || '';
    if (emailModo === 'smtp') {
        if (!smtp.host || !smtp.usuario || !smtp.senha) erros.push('Defina SMTP_HOST, SMTP_USUARIO e SMTP_SENHA.');
        if (!/^[A-Za-z0-9._%+'-]{1,64}@[A-Za-z0-9-]+(\.[A-Za-z0-9-]+)*\.[A-Za-z]{2,}$/.test(de)) erros.push('EMAIL_DE precisa ser um e-mail (ex.: atendimento@aeonfool.com).');
    }

    // Em produção o cookie é sempre Secure. Fora dela, só com COOKIE_SEGURO=true (o padrão permite http://localhost).
    const cookieSeguro = producao || env.COOKIE_SEGURO === 'true';

    if (erros.length) throw new Error(`Configuração inválida:\n- ${erros.join('\n- ')}`);

    return {
        producao,
        porta: Number(env.PORTA || 8787),
        host: env.HOST || '127.0.0.1',
        caminhoBanco: env.CAMINHO_BANCO || './dados/aeon.sqlite',
        segredo,
        origens,
        cookieSeguro,
        confiarProxy: env.CONFIAR_PROXY === 'true',
        emailModo,
        smtp,
        de,
    };
}
