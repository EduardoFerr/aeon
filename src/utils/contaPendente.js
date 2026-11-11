import { contaAtiva } from './contas.js';

/**
 * Entrada por e-mail em andamento: a pessoa pediu o codigo e foi ler o e-mail. No celular o navegador costuma descarregar
 * ou recarregar a pagina nesse intervalo, e a tela do codigo se perdia. Guardamos o que falta para voltar a ela:
 * "aeon:v2:login-pendente" -> { email, vincular, contaId, pedidoEm (ms) }. Vale pelo mesmo tempo que o codigo (10 minutos).
 */
export const CHAVE_PENDENTE = 'aeon:v2:login-pendente';
export const VALE_MS = 10 * 60 * 1000;

export function guardarPendente({ email, vincular = false }, agora = Date.now()) {
    try {
        localStorage.setItem(CHAVE_PENDENTE, JSON.stringify({ email, vincular: !!vincular, contaId: contaAtiva(), pedidoEm: agora }));
        return true;
    } catch (e) {
        return false;
    }
}

/** O que esta pendente para a conta em uso, ou null (nada, vencido, ou de outra conta). */
export function lerPendente(agora = Date.now()) {
    try {
        const p = JSON.parse(localStorage.getItem(CHAVE_PENDENTE));
        if (!p || typeof p.email !== 'string' || p.email.length > 254 || typeof p.pedidoEm !== 'number') return null;
        if (p.pedidoEm > agora + 60 * 1000 || agora - p.pedidoEm > VALE_MS) return null; // futuro (relogio errado) ou vencido
        if (p.contaId !== contaAtiva()) return null;
        return { email: p.email, vincular: p.vincular === true, pedidoEm: p.pedidoEm };
    } catch (e) {
        return null;
    }
}

export function limparPendente() {
    try {
        localStorage.removeItem(CHAVE_PENDENTE);
    } catch (e) {
        /* nada a apagar */
    }
}
