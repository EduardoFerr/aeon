// Copia consistente do banco (VACUUM INTO) para o caminho dado. Uso: node scripts/backup.mjs /dados/instantaneo.sqlite
import { DatabaseSync } from 'node:sqlite';
import { existsSync, unlinkSync } from 'node:fs';

const origem = process.env.CAMINHO_BANCO || './dados/aeon.sqlite';
const destino = process.argv[2];
if (!destino) {
    console.error('Uso: node scripts/backup.mjs <arquivo-de-destino>');
    process.exit(1);
}
if (!existsSync(origem)) {
    console.error(`Banco não encontrado em ${origem}`);
    process.exit(1);
}
if (existsSync(destino)) unlinkSync(destino);
const db = new DatabaseSync(origem);
db.prepare('VACUUM INTO ?').run(destino);
db.close();
console.log(`Backup gravado em ${destino}`);
