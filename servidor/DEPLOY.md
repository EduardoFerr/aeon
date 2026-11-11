# Implantação do servidor do Aeon

Para a VPS que você já usa (IP 2.25.152.64) e o domínio `api.aeonfool.com`. Tempo estimado: 40 minutos, mais a espera do DNS.

Passos, em ordem:
1. DNS do `api.aeonfool.com`
2. Caixa de e-mail e SPF, DKIM e DMARC
3. Subir o servidor
4. Proxy e certificado (dois caminhos, escolha um)
5. Conferir de ponta a ponta
6. Backup
7. Manutenção

## 1. DNS

No DNS do `aeonfool.com` (Hostinger, hPanel, Domínios, DNS):

| Tipo | Nome | Valor | TTL |
|---|---|---|---|
| A | api | 2.25.152.64 | 300 |

Conferir (pode levar alguns minutos):

```bash
dig +short api.aeonfool.com
```

Deve responder `2.25.152.64`.

## 2. E-mail do código de acesso

1. No hPanel, Emails, crie a caixa `nao-responda@aeonfool.com` com uma senha forte.
2. Dados do SMTP: servidor `smtp.hostinger.com`, porta `465` (SSL), usuário `nao-responda@aeonfool.com`.
3. Confira no DNS do `aeonfool.com` os registros que a Hostinger cria ao ativar o e-mail: MX (mx1 e mx2.hostinger.com), SPF (TXT `v=spf1 include:_spf.mail.hostinger.com ~all`) e os três DKIM (CNAME `hostingermail-a`, `-b`, `-c` `._domainkey`). Se algum faltar, o hPanel mostra o valor exato na própria página do e-mail.
4. Acrescente o DMARC (TXT, nome `_dmarc`): `v=DMARC1; p=none; rua=mailto:nao-responda@aeonfool.com`. Depois de uma semana sem problemas, troque `p=none` por `p=quarantine`.
5. Teste de entrega: depois do passo 5 deste guia, peça um código para um Gmail e use "Mostrar original". Devem aparecer `SPF: PASS` e `DKIM: PASS`. Se o código cair no spam, marque "não é spam" uma vez e confira o DMARC.

Limite a conhecer: caixas de hospedagem têm teto de envios por hora e por dia (veja o do seu plano no hPanel). Para o começo basta. Se o app crescer, troque o SMTP por um serviço de envio (Resend, Brevo, SES); só mudam as variáveis `SMTP_*`.

## 3. Subir o servidor

Na VPS, com Docker e o plugin `docker compose` instalados:

```bash
git clone https://github.com/EduardoFerr/aeon.git /opt/aeon
cd /opt/aeon/servidor
cp .env.example .env
chmod 600 .env
```

Edite o `.env`:

- `SEGREDO`: gere com `openssl rand -base64 48`. Não troque depois, ou os códigos pendentes deixam de valer. Guarde uma cópia fora da VPS.
- `SMTP_SENHA`: a senha da caixa criada no passo 2.
- O resto já vem certo para o `aeonfool.com`.

## 4. Proxy e certificado

Descubra se a porta 80 e a 443 já estão em uso (provavelmente estão, por causa do gataon.com):

```bash
sudo ss -ltnp | grep -E ':(80|443)\s'
```

### Caminho A: nada usa a 80 e a 443

```bash
docker compose --profile proxy up -d --build
```

O Caddy pega o certificado de `api.aeonfool.com` sozinho (o DNS do passo 1 precisa já estar valendo).

### Caminho B: já existe nginx, Caddy ou Traefik

```bash
docker compose up -d --build
```

A API passa a ouvir só em `127.0.0.1:8787`. Aponte o seu proxy para lá.

**nginx** (`/etc/nginx/sites-available/api.aeonfool.com`):

```nginx
server {
    listen 80;
    server_name api.aeonfool.com;
    client_max_body_size 7m;
    location / {
        proxy_pass http://127.0.0.1:8787;
        proxy_set_header Host $host;
        proxy_set_header X-Forwarded-For $remote_addr;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_read_timeout 60s;
    }
}
```

```bash
sudo ln -s /etc/nginx/sites-available/api.aeonfool.com /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx
sudo certbot --nginx -d api.aeonfool.com
```

**Caddy que já existe:** acrescente ao seu Caddyfile `api.aeonfool.com { reverse_proxy 127.0.0.1:8787 }` e recarregue.

**Traefik:** crie um roteador para `Host(\`api.aeonfool.com\`)` apontando para `http://host.docker.internal:8787` (ou ponha a API na rede do Traefik).

Importante: o servidor lê o IP de quem chamou no último valor de `X-Forwarded-For` (`CONFIAR_PROXY=true`, já definido no compose). Isso só é seguro porque a porta 8787 fica em `127.0.0.1` e só o seu proxy chega nela. Não publique a 8787 na internet.

Firewall: deixe aberto só 22, 80 e 443.

```bash
sudo ufw allow 22 && sudo ufw allow 80 && sudo ufw allow 443 && sudo ufw enable
```

## 5. Conferir de ponta a ponta

```bash
curl -s https://api.aeonfool.com/v1/saude
```

Deve responder `{"ok":true}`. Depois, o login completo (troque pelo seu e-mail):

```bash
curl -s -X POST https://api.aeonfool.com/v1/auth/pedir \
  -H 'Origin: https://aeonfool.com' -H 'Content-Type: application/json' \
  -d '{"email":"voce@exemplo.com"}'
```

O código chega por e-mail. Confirme (o `-c` guarda o cookie):

```bash
curl -s -c /tmp/aeon.cookies -X POST https://api.aeonfool.com/v1/auth/confirmar \
  -H 'Origin: https://aeonfool.com' -H 'Content-Type: application/json' \
  -d '{"email":"voce@exemplo.com","codigo":"123456","aparelho":"Teste"}'
curl -s -b /tmp/aeon.cookies https://api.aeonfool.com/v1/eu
```

Apague a conta de teste ao terminar:

```bash
curl -s -b /tmp/aeon.cookies -X DELETE https://api.aeonfool.com/v1/conta \
  -H 'Origin: https://aeonfool.com' -H 'Content-Type: application/json' -d '{"confirmo":"apagar"}'
rm /tmp/aeon.cookies
```

## 6. Backup

O script faz uma cópia consistente do banco, criptografa e guarda as 14 mais recentes.

1. Escolha uma senha de backup longa e guarde-a fora da VPS (gerenciador de senhas).
2. Guarde-a num arquivo que só o root lê:

```bash
echo 'BACKUP_SENHA=troque-por-uma-senha-longa' | sudo tee /root/.aeon-backup >/dev/null
sudo chmod 600 /root/.aeon-backup
```

3. Agende (`sudo crontab -e`):

```
0 3 * * * cd /opt/aeon/servidor && . /root/.aeon-backup && BACKUP_SENHA="$BACKUP_SENHA" ./scripts/backup.sh >> /var/log/aeon-backup.log 2>&1
```

4. Copie a pasta `backups/` para fora da VPS (outro servidor, ou armazenamento de objetos), por exemplo com `rclone` ou `scp`. Backup que só existe na mesma máquina não protege de nada.
5. Teste a restauração uma vez por mês:

```bash
openssl enc -d -aes-256-cbc -pbkdf2 -iter 600000 -in backups/aeon-AAAAMMDD-HHMMSS.sqlite.enc -out /tmp/aeon-teste.sqlite
sqlite3 /tmp/aeon-teste.sqlite 'select count(*) from usuarios;'
rm /tmp/aeon-teste.sqlite
```

Para restaurar de verdade: `docker compose stop api`, troque `dados/aeon.sqlite` pelo arquivo restaurado (apague `aeon.sqlite-wal` e `aeon.sqlite-shm`), `docker compose start api`.

## 7. Manutenção

- Atualizar: `cd /opt/aeon && git pull && cd servidor && docker compose up -d --build`. As migrações do banco rodam sozinhas.
- Logs: `docker compose logs -f api`. Limite o tamanho dos logs do Docker em `/etc/docker/daemon.json`: `{ "log-driver": "json-file", "log-opts": { "max-size": "10m", "max-file": "5" } }` e reinicie o Docker.
- Monitoramento: um serviço de uptime gratuito (UptimeRobot, Better Stack) apontando para `https://api.aeonfool.com/v1/saude`.
- Segurança da VPS: login SSH só por chave, atualizações automáticas (`unattended-upgrades`), `.env` com permissão 600.
- Ver o que há no banco (útil até o painel existir): `docker compose exec api node -e "const {DatabaseSync}=require('node:sqlite');const d=new DatabaseSync('/dados/aeon.sqlite');console.log(d.prepare('select count(*) usuarios from usuarios').get(), d.prepare('select tipo,count(*) n from itens where apagado=0 group by tipo').all())"`
- Apagar uma conta por pedido por e-mail: peça para a pessoa usar o botão no app (é o caminho que registra a exclusão e envia o aviso). Se ela não conseguir entrar, apague pelo banco, no `sqlite3` do host, com o serviço parado: `delete from usuarios where email='fulano@exemplo.com';` (sessões e itens saem em cascata).

## LGPD, em curto

- Você é o controlador dos dados. O que é guardado: e-mail, diário, mapas (com data, hora e local de nascimento) e perfil de quem ligar a sincronização.
- Base legal: consentimento, pedido na tela antes do e-mail. O texto do consentimento e a política de privacidade são atualizados na etapa seguinte, antes de o app oferecer a opção.
- Direitos atendidos pelo próprio app: cópia (`/exportar`), exclusão (`DELETE /conta`) e correção (a pessoa edita no app e sincroniza).
- Incidente (vazamento): avise as pessoas e a ANPD em prazo razoável. Mantenha o backup e o `SEGREDO` fora da VPS para limitar o dano.
