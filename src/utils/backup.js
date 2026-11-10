import { exportar } from './perfil.js';
import { dataLocal } from './cartaDoDia.js';

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
        return true;
    } catch (e) {
        return false;
    }
}
