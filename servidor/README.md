# Servidor do Aeon

Guarda, para quem ligar a sincronização no app, uma cópia do diário, dos mapas e do perfil, em texto legível (JSON), e deixa a pessoa entrar com o e-mail e um código de 6 dígitos. Sem senha.

Roda em Node 24 com o SQLite embutido (`node:sqlite`). A única dependência é o `nodemailer`.

## Decisões

- Sincronização opcional, desligada por padrão. O app continua funcionando sem conta.
- Guarda diário, mapas (com data, hora e local de nascimento) e perfil, em texto legível, para o painel de administração da etapa 3.
- Retenção: enquanto a conta existir. Exclusão: `DELETE /v1/conta`, na hora, com confirmação no app.
- Login por código de 6 dígitos (vale 10 minutos, 5 tentativas), digitado no app. Não usa link: o link abre no Safari e não loga o app instalado no iPhone.
- Sessão de 1 ano, renovando a cada uso, em cookie `HttpOnly`, `Secure`, `SameSite=Lax` no `api.aeonfool.com`.

## Rodar localmente

```bash
cd servidor
npm install
NODE_ENV=development SEGREDO=$(openssl rand -base64 48) EMAIL_MODO=console \
  ORIGENS_PERMITIDAS=http://localhost:5173 CAMINHO_BANCO=./dados/aeon.sqlite npm start
```

Com `EMAIL_MODO=console` o código aparece no log em vez de ir por e-mail (recusado em produção).

## Testes

```bash
cd servidor && npm test
```

Sobem o servidor numa porta livre, com banco em memória, e-mail falso e relógio controlado.

## API (prefixo `/v1`)

| Rota | O que faz |
|---|---|
| `POST /auth/pedir` `{ email }` | Envia o código. 202 sempre (existindo conta ou não). 429 se pedir demais. |
| `POST /auth/confirmar` `{ email, codigo, aparelho? }` | Cria a sessão (cookie). Erro único `codigo_invalido`. |
| `POST /auth/sair`, `POST /auth/sair-todos` | Encerra a sessão atual ou todas. |
| `GET /eu` | E-mail e data de criação. |
| `GET /aparelhos`, `DELETE /aparelhos/:id` | Lista e encerra sessões. |
| `GET /sync?desde=N` | Itens com `seq` maior que N, inclusive apagados. |
| `POST /sync` `{ desde, itens }` | Envia mudanças. Devolve o que falta ao aparelho e o novo cursor. |
| `GET /exportar` | Tudo do usuário em JSON, como arquivo. |
| `DELETE /conta` `{ confirmo: "apagar" }` | Apaga tudo e encerra a conta. Avisa por e-mail. |
| `GET /saude` | Para monitoramento. |

Pedidos que mudam dados só valem com `Origin` permitido (`ORIGENS_PERMITIDAS`).

### Item de sincronização

```json
{ "tipo": "perfil | diario | mapa", "id": "perfil | [A-Za-z0-9_-]{1,64}", "dados": { }, "atualizado_em": "2026-11-12T10:00:00Z", "apagado": false }
```

- Vale a mudança mais recente por item. Empate: fica o que está no servidor. No diário, `atualizado_em` é a data da última edição da nota.
- Apagar é `apagado: true` (sem `dados`). O servidor guarda só a marca, sem conteúdo. Uma edição mais nova traz o item de volta.
- O que o aparelho acabou de enviar não volta na resposta. O que o servidor manteve no lugar de um item ignorado volta, para o aparelho ficar igual ao servidor.
- `mais: true` na resposta: continue com `GET /sync?desde=<proximo>`.
- `reinicio: true`: o cursor era de uma conta anterior; o servidor recomeçou do zero. O app deve trocar o cursor guardado e conferir o que tem.
- O app deve zerar o cursor ao trocar de conta ou entrar de novo depois de uma sessão perdida.
- O servidor não interpreta `dados`: guarda e devolve. O app valida de novo o que recebe, como já faz ao importar um backup.

### Limites

1 MB por item, 200 itens por pedido, 500 entradas de diário e 5 MB por usuário (o pedido que passar é desfeito por inteiro).

## Segurança, em uma lista

- Códigos e tokens de sessão ficam no banco só como hash (código com HMAC e o `SEGREDO`; token com SHA-256).
- Limites: 5 códigos por hora por e-mail, 20 por hora por IP, 30 s entre reenvios, 10 confirmações a cada 15 minutos por IP.
- O código vale uma vez, 10 minutos, 5 tentativas. A resposta de erro é a mesma exista a conta ou não.
- E-mail aceito só em ASCII comum (sem aspas, vírgula nem comentários), para não haver ambiguidade no envio.
- Logs: só rota, status, duração e id numérico do usuário. Nunca e-mail, código, cookie, IP nem conteúdo.
- Cabeçalhos: `Cache-Control: no-store`, `nosniff`, `Referrer-Policy: no-referrer`, CSP `default-src 'none'`, HSTS.
- Contêiner sem privilégios, sistema de arquivos só de leitura, sem capacidades extras, porta só em `127.0.0.1`.

Guia de implantação: [DEPLOY.md](./DEPLOY.md).
