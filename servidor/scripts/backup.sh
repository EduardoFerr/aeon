#!/usr/bin/env bash
# Backup diário: copia consistente do SQLite, criptografada, com 14 cópias. Rode no servidor, na pasta do compose.
#   BACKUP_SENHA="uma-senha-longa" ./scripts/backup.sh
# Restaurar: openssl enc -d -aes-256-cbc -pbkdf2 -iter 600000 -in backups/aeon-AAAAMMDD-HHMMSS.sqlite.enc -out aeon.sqlite
set -euo pipefail
cd "$(dirname "$0")/.."
: "${BACKUP_SENHA:?Defina BACKUP_SENHA (guarde-a fora da VPS)}"
mkdir -p backups
carimbo="$(date +%Y%m%d-%H%M%S)"
trap 'rm -f dados/instantaneo.sqlite' EXIT # nunca deixa a cópia sem criptografia no disco
docker compose exec -T api node scripts/backup.mjs /dados/instantaneo.sqlite
openssl enc -aes-256-cbc -pbkdf2 -iter 600000 -salt -pass env:BACKUP_SENHA \
  -in dados/instantaneo.sqlite -out "backups/aeon-${carimbo}.sqlite.enc"
chmod 600 "backups/aeon-${carimbo}.sqlite.enc"
# mantém só as 14 mais recentes
ls -1t backups/aeon-*.sqlite.enc | tail -n +15 | xargs -r rm -f
echo "Backup criado: backups/aeon-${carimbo}.sqlite.enc"
