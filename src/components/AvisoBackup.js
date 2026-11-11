import { avisoBackupAtivo, baixarBackup, dispensarAvisoBackup } from '../utils/backup.js';
import { focarCabecalho } from '../utils/navigation.js';
import { avisar } from './Sobreposicao.js';

/**
 * Lembrete discreto de backup (Perfil, aba Dados, e topo do Diario). Aparece so quando ha registros
 * (diario com 5 ou mais entradas ou pelo menos 1 mapa) e o ultimo backup tem mais de 30 dias ou nao existe.
 * "Dispensar" esconde por 14 dias. As regras ficam em utils/versao.js.
 */
export const TEXTO_BACKUP = {
    aviso: 'Faça um backup dos seus registros para não perdê-los.',
    exportar: 'Exportar agora',
    dispensar: 'Dispensar',
    rotulo: 'Lembrete de backup',
    exportado: 'Backup baixado.',
    erro: 'Não foi possível gerar o backup.',
    dispensado: 'Lembrete escondido por 14 dias.',
};

/**
 * Mostra ou tira o lembrete dentro de `alvo`. Pode ser chamada de novo a qualquer momento (so desenha se mudou).
 * `foco`: seletor do titulo da tela, que recebe o foco quando o lembrete some por um clique.
 * `antes`: roda antes de exportar (o Diario guarda a nota que ainda esta pendente).
 */
export function desenharAvisoBackup(alvo, { foco, antes } = {}) {
    if (!alvo) return;
    const ativo = avisoBackupAtivo();
    if (!ativo) {
        if (alvo.firstElementChild) alvo.replaceChildren();
        return;
    }
    if (alvo.firstElementChild) return;
    const el = document.createElement('aside');
    el.className = 'aviso-backup';
    el.setAttribute('aria-label', TEXTO_BACKUP.rotulo);
    el.innerHTML = `<p></p><div class="btn-row"><button class="btn btn-ghost" type="button" data-backup-exportar></button><button class="btn btn-terciario" type="button" data-backup-dispensar></button></div>`;
    el.querySelector('p').textContent = TEXTO_BACKUP.aviso;
    el.querySelector('[data-backup-exportar]').textContent = TEXTO_BACKUP.exportar;
    el.querySelector('[data-backup-dispensar]').textContent = TEXTO_BACKUP.dispensar;
    const sair = (mensagem, erro = false) => {
        alvo.replaceChildren();
        if (foco) focarCabecalho(foco);
        avisar(mensagem, { erro });
    };
    el.querySelector('[data-backup-exportar]').addEventListener('click', () => {
        if (antes) antes();
        if (baixarBackup()) sair(TEXTO_BACKUP.exportado);
        else avisar(TEXTO_BACKUP.erro, { erro: true });
    });
    el.querySelector('[data-backup-dispensar]').addEventListener('click', () => {
        dispensarAvisoBackup();
        sair(TEXTO_BACKUP.dispensado);
    });
    alvo.append(el);
}
