import { abrir } from './Sobreposicao.js';
import { lerPendente } from '../utils/contaPendente.js';
import { estadoConta } from '../utils/conta.js';

/**
 * Abre o painel "Conta" numa gaveta (celular) ou janela (computador), de qualquer tela.
 * E o mesmo painel da aba Dados do Perfil.
 */
export async function abrirConta(gatilho) {
    await import('./ContaPanel.js');
    return abrir({
        tipo: 'sheet',
        titulo: 'Conta',
        gatilho: gatilho || document.activeElement,
        classe: 'sob-conta',
        corpo: '<conta-panel></conta-panel>',
    });
}

/**
 * Voltou para o app com um codigo por e-mail esperando (a pessoa foi ler o e-mail): reabre o painel na tela do codigo.
 * Nao reabre se o painel ja esta na tela.
 */
export function retomarPendente() {
    const p = lerPendente();
    if (!p || p.vincular !== (estadoConta().fase === 'ligada') || document.querySelector('.sob-conta')) return;
    abrirConta();
}
