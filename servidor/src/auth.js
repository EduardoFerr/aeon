import { createHash, createHmac, randomBytes, randomInt, timingSafeEqual } from 'node:crypto';
import { transacao } from './db.js';
import {
    CODIGO_REENVIO_MS, CODIGO_TENTATIVAS, CODIGO_VALE_MS, SESSAO_MS, SESSAO_RENOVA_APOS_MS,
} from './config.js';
import { ErroHttp } from './http.js';

// Conservador de propósito: só ASCII comum, sem aspas, vírgula, parênteses nem comentários. Endereços com
// caracteres fora disso são recusados em vez de arriscar uma interpretação diferente no envio.
const RE_EMAIL = /^[a-z0-9._%+'-]{1,64}@[a-z0-9-]+(\.[a-z0-9-]+)*\.[a-z]{2,}$/;
const RE_CODIGO = /^\d{6}$/;

export function normalizarEmail(valor) {
    if (typeof valor !== 'string') return null;
    const e = valor.trim().toLowerCase();
    return e.length <= 254 && RE_EMAIL.test(e) ? e : null;
}

const sha256 = (t) => createHash('sha256').update(t).digest('hex');
const iso = (ms) => new Date(ms).toISOString();

function aparelhoLimpo(valor) {
    if (typeof valor !== 'string') return 'Aparelho';
    const t = valor.replace(/[\u0000-\u001F\u007F]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 60);
    return t || 'Aparelho';
}

export function criarAuth({ db, config, relogio }) {
    const hmac = (texto) => createHmac('sha256', config.segredo).update(texto).digest('hex');
    const iguais = (a, b) => {
        const x = Buffer.from(a, 'hex');
        const y = Buffer.from(b, 'hex');
        return x.length === y.length && timingSafeEqual(x, y);
    };

    return {
        /**
         * Gera e guarda um código novo para o e-mail. Lança 429 se o último foi há menos de 30 s.
         * Existir conta ou não não muda nada aqui: a resposta é a mesma.
         */
        novoCodigo(email) {
            const agora = relogio();
            const atual = db.prepare('SELECT criado_em FROM codigos WHERE email = ?').get(email);
            if (atual && agora - atual.criado_em < CODIGO_REENVIO_MS) {
                const esperaS = Math.ceil((CODIGO_REENVIO_MS - (agora - atual.criado_em)) / 1000);
                throw new ErroHttp(429, 'aguarde', { espera_s: esperaS });
            }
            const codigo = String(randomInt(0, 1_000_000)).padStart(6, '0');
            db.prepare(
                `INSERT INTO codigos (email, hash, criado_em, expira_em, tentativas) VALUES (?, ?, ?, ?, 0)
                 ON CONFLICT(email) DO UPDATE SET hash = excluded.hash, criado_em = excluded.criado_em,
                 expira_em = excluded.expira_em, tentativas = 0`,
            ).run(email, hmac(`${email}:${codigo}`), agora, agora + CODIGO_VALE_MS);
            return codigo;
        },

        /** Confere o código. Todo erro é o mesmo "codigo_invalido": não diz se o e-mail existe nem o que falhou. */
        confirmar(email, codigo, aparelho) {
            const falha = () => new ErroHttp(400, 'codigo_invalido');
            if (typeof codigo !== 'string' || !RE_CODIGO.test(codigo)) throw falha();
            const agora = relogio();
            // Dentro da transação nada é lançado: a tentativa errada precisa ficar gravada. O erro sai depois.
            const r = transacao(db, () => {
                const linha = db.prepare('SELECT hash, expira_em, tentativas FROM codigos WHERE email = ?').get(email);
                if (!linha) return null;
                if (agora > linha.expira_em || linha.tentativas >= CODIGO_TENTATIVAS) {
                    db.prepare('DELETE FROM codigos WHERE email = ?').run(email);
                    return null;
                }
                if (!iguais(hmac(`${email}:${codigo}`), linha.hash)) {
                    const n = linha.tentativas + 1;
                    if (n >= CODIGO_TENTATIVAS) db.prepare('DELETE FROM codigos WHERE email = ?').run(email);
                    else db.prepare('UPDATE codigos SET tentativas = ? WHERE email = ?').run(n, email);
                    return null;
                }
                db.prepare('DELETE FROM codigos WHERE email = ?').run(email);
                const agoraIso = iso(agora);
                db.prepare(
                    `INSERT INTO usuarios (email, criado_em, ultimo_acesso) VALUES (?, ?, ?)
                     ON CONFLICT(email) DO UPDATE SET ultimo_acesso = excluded.ultimo_acesso`,
                ).run(email, agoraIso, agoraIso);
                const usuario = db.prepare('SELECT id, email, criado_em FROM usuarios WHERE email = ?').get(email);
                const token = randomBytes(32).toString('base64url');
                const id = randomBytes(8).toString('hex');
                db.prepare(
                    'INSERT INTO sessoes (id, token_hash, usuario_id, aparelho, criada_em, ultimo_uso) VALUES (?, ?, ?, ?, ?, ?)',
                ).run(id, sha256(token), usuario.id, aparelhoLimpo(aparelho), agoraIso, agoraIso);
                return { token, usuario: { email: usuario.email, criado_em: usuario.criado_em } };
            });
            if (!r) throw falha();
            return r;
        },

        /** Sessão do cookie, ou null. Renova o prazo (no máximo 1 vez por hora). -> { usuario, sessaoId, renovou } */
        sessaoDoToken(token) {
            if (typeof token !== 'string' || token.length < 20 || token.length > 100) return null;
            const agora = relogio();
            const s = db
                .prepare(
                    `SELECT s.id AS sessao_id, s.ultimo_uso, u.id, u.email, u.criado_em
                     FROM sessoes s JOIN usuarios u ON u.id = s.usuario_id WHERE s.token_hash = ?`,
                )
                .get(sha256(token));
            if (!s) return null;
            if (agora - Date.parse(s.ultimo_uso) > SESSAO_MS) {
                db.prepare('DELETE FROM sessoes WHERE id = ?').run(s.sessao_id);
                return null;
            }
            let renovou = false;
            if (agora - Date.parse(s.ultimo_uso) > SESSAO_RENOVA_APOS_MS) {
                const agoraIso = iso(agora);
                db.prepare('UPDATE sessoes SET ultimo_uso = ? WHERE id = ?').run(agoraIso, s.sessao_id);
                db.prepare('UPDATE usuarios SET ultimo_acesso = ? WHERE id = ?').run(agoraIso, s.id);
                renovou = true;
            }
            return { usuario: { id: s.id, email: s.email, criado_em: s.criado_em }, sessaoId: s.sessao_id, renovou };
        },

        sair(sessaoId) {
            db.prepare('DELETE FROM sessoes WHERE id = ?').run(sessaoId);
        },
        sairTodos(usuarioId) {
            db.prepare('DELETE FROM sessoes WHERE usuario_id = ?').run(usuarioId);
        },
        aparelhos(usuarioId, sessaoAtual) {
            return db
                .prepare('SELECT id, aparelho, criada_em, ultimo_uso FROM sessoes WHERE usuario_id = ? ORDER BY ultimo_uso DESC')
                .all(usuarioId)
                .map((r) => ({ id: r.id, aparelho: r.aparelho, criada_em: r.criada_em, ultimo_uso: r.ultimo_uso, atual: r.id === sessaoAtual }));
        },
        /** Encerra um aparelho do próprio usuário. -> true se existia */
        encerrarAparelho(usuarioId, id) {
            return db.prepare('DELETE FROM sessoes WHERE id = ? AND usuario_id = ?').run(id, usuarioId).changes > 0;
        },

        /** Limpeza periódica: códigos vencidos e sessões sem uso há mais de um ano. */
        limpar() {
            const agora = relogio();
            db.prepare('DELETE FROM codigos WHERE expira_em < ?').run(agora);
            db.prepare('DELETE FROM sessoes WHERE ultimo_uso < ?').run(iso(agora - SESSAO_MS));
        },
    };
}
