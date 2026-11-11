import { ic } from '../utils/glifos.js';
import { SYNC_ATIVA } from '../utils/contaEstado.js';
import { aoMudarConta, estadoConta } from '../utils/conta.js';
import { abrirConta } from './ContaSheet.js';

/** Texto de leitor de tela e dica do botao, conforme o estado da conta. Sem dizer o que ou onde se guarda. */
export function rotuloDaConta(e) {
    if (e.fase === 'desligada') return 'Conta do Aeon: crie seu login. Abrir.';
    if (e.fase === 'juntar') return 'Conta do Aeon: falta concluir. Abrir.';
    if (e.sincronizando) return 'Conta do Aeon: atualizando.';
    if (e.erro) return 'Conta do Aeon: houve um problema. Abrir para ver.';
    return 'Conta do Aeon. Abrir.';
}

export const estadoVisual = (e) => (e.fase !== 'ligada' ? 'desligada' : e.erro ? 'erro' : e.sincronizando ? 'sincronizando' : 'ligada');

/**
 * Botao de conta no cabecalho do app, sempre a vista: nuvem, com um pontinho que mostra o estado.
 * So existe no app principal (pagina com #app) e no build com a sincronizacao.
 */
export function montarBotaoConta() {
    if (!SYNC_ATIVA) return;
    const alvo = document.querySelector('.topright');
    if (!alvo || !document.getElementById('app') || alvo.querySelector('.contabtn')) return;
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'iconbtn round contabtn';
    b.setAttribute('aria-haspopup', 'dialog');
    b.innerHTML = `${ic('nuvem')}<span class="ponto" aria-hidden="true"></span>`;
    const atualizar = (e = estadoConta()) => {
        const r = rotuloDaConta(e);
        b.setAttribute('aria-label', r);
        b.title = r.replace(/\. Abrir.*$/, '');
        b.dataset.estado = estadoVisual(e);
    };
    atualizar();
    aoMudarConta(atualizar);
    b.addEventListener('click', () => abrirConta(b));
    alvo.insertBefore(b, alvo.firstChild);
}
