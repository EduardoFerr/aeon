import { exportar, listar as listarMapas } from './perfil.js';
import { listar as listarDiario } from './diario.js';
import { dataLocal } from './cartaDoDia.js';
import { CHAVE_ULTIMO_BACKUP, CHAVE_BACKUP_DISPENSADO, precisaAvisoBackup } from './versao.js';

const ler = (chave) => {
    try {
        return localStorage.getItem(chave);
    } catch (e) {
        return null;
    }
};
const gravar = (chave) => {
    try {
        localStorage.setItem(chave, new Date().toISOString());
    } catch (e) {
        /* sem armazenamento: o lembrete so volta a aparecer */
    }
};

/** Anota que a pessoa exportou os registros agora. */
export function registrarBackup() {
    gravar(CHAVE_ULTIMO_BACKUP);
}

/** "Dispensar" no lembrete: some por 14 dias. */
export function dispensarAvisoBackup() {
    gravar(CHAVE_BACKUP_DISPENSADO);
}

/** O lembrete de backup deve aparecer agora (Perfil, aba Dados, e topo do Diario)? */
export function avisoBackupAtivo() {
    return precisaAvisoBackup({
        entradas: listarDiario().length,
        mapas: listarMapas().length,
        ultimoBackup: ler(CHAVE_ULTIMO_BACKUP),
        dispensadoEm: ler(CHAVE_BACKUP_DISPENSADO),
    });
}

/** Baixa o backup (perfil e diario) como arquivo JSON. Devolve true se o download foi disparado. */
export function baixarBackup() {
    try {
        const blob = new Blob([JSON.stringify(exportar(), null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `aeon-backup-${dataLocal()}.json`;
        document.body.appendChild(a);
        a.click();
        a.remove();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
        registrarBackup();
        return true;
    } catch (e) {
        return false;
    }
}
