# Implantação do servidor do Aeon

Para a VPS que você já usa (srv1717921, IP 2.25.152.64) e o domínio `api.aeonfool.com`. Tempo estimado: 40 minutos, mais a espera do DNS.

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

1. No hPanel, Emails, crie a caixa `atendimento@aeonfool.com` com uma senha forte.
2. Dados do SMTP: servidor `smtp.hostinger.com`, porta `465` (SSL), usuário `atendimento@aeonfool.com`.
3. Confira no DNS do `aeonfool.com` os registros que a Hostinger cria ao ativar o e-mail: MX (mx1 e mx2.hostinger.com), SPF (TXT `v=spf1 include:_spf.mail.hostinger.com ~all`) e os três DKIM (CNAME `hostingermail-a`, `-b`, `-c` `._domainkey`). Se algum faltar, o hPanel mostra o valor exato na própria página do e-mail.
4. Acrescente o DMARC (TXT, nome `_dmarc`): `v=DMARC1; p=none; rua=mailto:SEU-EMAIL-QUE-VOCE-LE`. Troque `SEU-EMAIL-QUE-VOCE-LE` por um e-mail que você lê (pode ser o próprio `atendimento@aeonfool.com`). Depois de uma semana sem problemas, troque `p=none` por `p=quarantine`.
5. Teste de entrega: depois do passo 5 deste guia, peça um código para um Gmail e use "Mostrar original". Devem aparecer `SPF: PASS` e `DKIM: PASS`. Se o código cair no spam, marque "não é spam" uma vez e confira o DMARC.

Limite a conhecer: caixas de hospedagem têm teto de envios por hora e por dia (veja o do seu plano no hPanel). Para o começo basta. Se o app crescer, troque o SMTP por um serviço de envio (Resend, Brevo, SES); só mudam as variáveis `SMTP_*`.

## 3. Subir o servidor

Na VPS, com Docker e o plugin `docker compose` instalados:

```bash
git clone https://github.com/EduardoFerr/aeon.git /opt/aeon
cd /opt/aeon/servidor
cp .env.example .env
chmod 600 .env
# pasta do banco: o servidor roda como usuário 1000 dentro do contêiner e só ele deve ler o arquivo
mkdir -p dados && chown 1000:1000 dados && chmod 700 dados
```

Edite o `.env`:

- `SEGREDO`: gere com `openssl rand -base64 48`. Não troque depois, ou os códigos pendentes deixam de valer. Guarde uma cópia fora da VPS.
- `SMTP_SENHA`: a senha da caixa criada no passo 2.
- O resto já vem certo para o `aeonfool.com`.

## 4. Proxy e certificado

### O seu caso (conferido na VPS em 11/11/2026): Caddy do gataon, em Docker

As portas 80 e 443 são do contêiner `gataon-caddy-1` (Caddy 2, projeto em `/opt/gataon`, arquivo `/opt/gataon/Caddyfile`, redes `gataon_front` e `gataon_back`). Não suba outro proxy: ele não conseguiria as portas e, se conseguisse, derrubaria o gataon.com. O certo é pôr o `api.aeonfool.com` como mais um site do Caddy que já existe.

**a) Ponha a API na rede do Caddy.** Crie `/opt/aeon/servidor/docker-compose.override.yml`:

```yaml
services:
  api:
    networks: [aeon, gataon_front]
networks:
  gataon_front:
    external: true
```

```bash
cd /opt/aeon/servidor && docker compose up -d --build
docker exec gataon-caddy-1 wget -qO- http://aeon-api:8787/v1/saude   # deve responder {"ok":true}
```

**b) Acrescente o site ao Caddyfile do gataon** (faça cópia antes, valide e só então recarregue):

```bash
cp /opt/gataon/Caddyfile /opt/gataon/Caddyfile.bak-$(date +%Y%m%d)
cat >> /opt/gataon/Caddyfile <<'FIM'

api.aeonfool.com {
	encode zstd gzip
	reverse_proxy aeon-api:8787
	log {
		output stdout
		format filter {
			wrap json
			request>remote_ip delete
			request>client_ip delete
			request>headers delete
			request>tls delete
		}
	}
}
FIM
docker exec gataon-caddy-1 caddy validate --config /etc/caddy/Caddyfile
docker exec gataon-caddy-1 caddy reload --config /etc/caddy/Caddyfile
```

O Caddyfile é montado como arquivo único. Acrescentar com `cat >>` funciona. Se você editar com um editor que troca o arquivo (vim, por exemplo) e o `reload` continuar com a configuração antiga, rode `cd /opt/gataon && docker compose restart caddy`. Se algo der errado, volte a cópia `.bak` e recarregue: o gataon.com não é afetado enquanto o `validate` passar.

O Caddy pega o certificado do `api.aeonfool.com` sozinho (o DNS do passo 1 precisa já estar valendo) e troca o `X-Forwarded-For` pelo IP real de quem chamou, que é o que o servidor lê (`CONFIAR_PROXY=true`, já no compose).

### Outros casos (se um dia mudar de servidor)

**Nada usa a 80 e a 443:** `docker compose --profile proxy up -d --build` (o Caddy do próprio compose cuida de tudo).

**nginx no host:**

```nginx
server {
    listen 80;
    server_name api.aeonfool.com;
    client_max_body_size 7m;
    access_log off;   # o servidor não guarda IP; o proxy também não deve
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

**Proxy em contêiner (Caddy, Traefik, nginx):** `127.0.0.1` dentro dele é o próprio contêiner, e `host.docker.internal` não alcança a porta publicada só em loopback. Faça como no seu caso acima: ponha a API na rede do proxy (override com `networks: [aeon, <rede-do-proxy>]` e `external: true`) e aponte o proxy para `aeon-api:8787`.

Importante: `CONFIAR_PROXY=true` só é seguro porque a 8787 fica em `127.0.0.1` ou numa rede interna, e só o seu proxy chega nela. Não publique a 8787 na internet.

Firewall: a VPS já tem o gataon.com no ar, então um firewall provavelmente já existe. Confira com `ufw status` antes de mudar qualquer coisa, e nunca rode `ufw enable` sem ter liberado a porta do SSH (se não for a 22, a sua).

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

Se você tem um iPhone, depois que o cliente estiver no app, confira uma vez: entre, deixe o Safari de lado por uma semana e veja se continua logado. O Safari limita a 7 dias os cookies de subdomínios que ficam em outro IP que o site principal (o `api` está em 2.25.152.64; o `aeonfool.com` está nos IPs do GitHub Pages). Se isso acontecer, a "sessão de 1 ano" vira 7 dias nesse aparelho e a pessoa só precisa pedir um código novo. Não é perda de dados.

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
echo "BACKUP_SENHA='troque-por-uma-senha-longa'" | sudo tee /root/.aeon-backup >/dev/null   # aspas simples: aceita espaço, $ e #
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

Para restaurar de verdade: `docker compose stop api`, troque `dados/aeon.sqlite` pelo arquivo restaurado (apague `aeon.sqlite-wal` e `aeon.sqlite-shm`), devolva a posse com `chown 1000:1000 dados/aeon.sqlite && chmod 600 dados/aeon.sqlite` (sem isso o servidor não consegue gravar) e `docker compose start api`.

## 7. Manutenção

- Atualizar: `cd /opt/aeon && git pull && cd servidor && docker compose up -d --build`. As migrações do banco rodam sozinhas.
- Logs: `docker compose logs -f api`. Limite o tamanho dos logs do Docker em `/etc/docker/daemon.json`: `{ "log-driver": "json-file", "log-opts": { "max-size": "10m", "max-file": "5" } }` e reinicie o Docker.
- Monitoramento: um serviço de uptime gratuito (UptimeRobot, Better Stack) apontando para `https://api.aeonfool.com/v1/saude`.
- Segurança da VPS: login SSH só por chave, atualizações automáticas (`unattended-upgrades`), `.env` com permissão 600.
- Ver o que há no banco (útil até o painel existir): `docker compose exec api node -e "const {DatabaseSync}=require('node:sqlite');const d=new DatabaseSync('/dados/aeon.sqlite');console.log(d.prepare('select count(*) usuarios from usuarios').get(), d.prepare('select tipo,count(*) n from itens where apagado=0 group by tipo').all())"`
- Apagar uma conta por pedido por e-mail: peça para a pessoa usar o botão no app (é o caminho que registra a exclusão e envia o aviso). Se ela não conseguir entrar, apague com o próprio servidor, que liga as chaves estrangeiras (sessões e itens saem juntos; o `sqlite3` solto do host NÃO faz isso e deixaria dados órfãos):

```bash
docker compose exec -e EMAIL=fulano@exemplo.com api node -e "const {DatabaseSync}=require('node:sqlite');const d=new DatabaseSync('/dados/aeon.sqlite');d.exec('PRAGMA foreign_keys=ON');console.log(d.prepare('DELETE FROM usuarios WHERE email=?').run(process.env.EMAIL))"
```

## LGPD, em curto

- Você é o controlador dos dados. O que é guardado: e-mail, diário, mapas (com data, hora e local de nascimento) e perfil de quem ligar a sincronização.
- Base legal: consentimento, pedido na tela antes do e-mail. O texto do consentimento e a política de privacidade são atualizados na etapa seguinte, antes de o app oferecer a opção.
- Direitos atendidos pelo próprio app: cópia (`/exportar`), exclusão (`DELETE /conta`) e correção (a pessoa edita no app e sincroniza).
- Incidente (vazamento): avise as pessoas e a ANPD em prazo razoável. Mantenha o backup e o `SEGREDO` fora da VPS para limitar o dano.
