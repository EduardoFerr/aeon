import { abrir } from './Sobreposicao.js';

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
