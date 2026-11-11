import { createHash, createHmac, randomBytes, randomInt, timingSafeEqual } from 'node:crypto';
import { transacao } from './db.js';
import {
    CODIGO_BLOQUEIO_MS, CODIGO_REENVIO_MS, CODIGO_TENTATIVAS, CODIGO_VALE_MS, EXPURGO_MARCAS_MS, MAX_SESSOES_POR_USUARIO,
    SESSAO_MS, SESSAO_RENOVA_APOS_MS,
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

export function criarAuth({ db, config, relogio, fundir }) {
    const hmac = (texto) => createHmac('sha256', config.segredo).update(texto).digest('hex');
    // O código nunca é guardado: sai da semente (aleatória, no banco) e do SEGREDO (fora do banco).
    const codigoDe = (email, semente) =>
        String(parseInt(hmac(`codigo:${email}:${semente}`).slice(0, 8), 16) % 1_000_000).padStart(6, '0');
    const iguais = (a, b) => {
        const x = Buffer.from(a);
        const y = Buffer.from(b);
        return x.length === y.length && timingSafeEqual(x, y);
    };

    return {
        /**
         * Código para o e-mail. Dentro da validade, reenvia o MESMO código (as tentativas não voltam a zero).
         * Lança 429 se o último envio foi há menos de 30 s, ou se o e-mail está bloqueado (5 erros seguidos).
         * Existir conta ou não não muda nada aqui: a resposta é a mesma.
         */
        novoCodigo(email) {
            const agora = relogio();
            const bloqueio = db.prepare('SELECT ate FROM bloqueios WHERE email = ?').get(email);
            if (bloqueio && agora < bloqueio.ate) throw new ErroHttp(429, 'aguarde', { espera_s: Math.ceil((bloqueio.ate - agora) / 1000) });
            const atual = db.prepare('SELECT semente, enviado_em, expira_em, tentativas FROM codigos WHERE email = ?').get(email);
            if (atual && agora - atual.enviado_em < CODIGO_REENVIO_MS) {
                throw new ErroHttp(429, 'aguarde', { espera_s: Math.ceil((CODIGO_REENVIO_MS - (agora - atual.enviado_em)) / 1000) });
            }
            if (atual && agora <= atual.expira_em && atual.tentativas < CODIGO_TENTATIVAS) {
                db.prepare('UPDATE codigos SET enviado_em = ? WHERE email = ?').run(agora, email);
                return codigoDe(email, atual.semente);
            }
            const semente = randomBytes(16).toString('hex');
            db.prepare(
                `INSERT INTO codigos (email, semente, criado_em, enviado_em, expira_em, tentativas) VALUES (?, ?, ?, ?, ?, 0)
                 ON CONFLICT(email) DO UPDATE SET semente = excluded.semente, criado_em = excluded.criado_em,
                 enviado_em = excluded.enviado_em, expira_em = excluded.expira_em, tentativas = 0`,
            ).run(email, semente, agora, agora, agora + CODIGO_VALE_MS);
            return codigoDe(email, semente);
        },

        /** Confere o código. Todo erro é o mesmo "codigo_invalido": não diz se o e-mail existe nem o que falhou. */
        confirmar(email, codigo, aparelho, tokenAtual) {
            const falha = () => new ErroHttp(400, 'codigo_invalido');
            if (typeof codigo !== 'string' || !RE_CODIGO.test(codigo)) throw falha();
            const agora = relogio();
            // Dentro da transação nada é lançado: a tentativa errada precisa ficar gravada. O erro sai depois.
            const r = transacao(db, () => {
                const bloqueio = db.prepare('SELECT ate FROM bloqueios WHERE email = ?').get(email);
                if (bloqueio && agora < bloqueio.ate) return null;
                const linha = db.prepare('SELECT semente, expira_em, tentativas FROM codigos WHERE email = ?').get(email);
                if (!linha) return null;
                if (agora > linha.expira_em || linha.tentativas >= CODIGO_TENTATIVAS) {
                    db.prepare('DELETE FROM codigos WHERE email = ?').run(email);
                    return null;
                }
                if (!iguais(codigo, codigoDe(email, linha.semente))) {
                    const n = linha.tentativas + 1;
                    if (n >= CODIGO_TENTATIVAS) {
                        db.prepare('DELETE FROM codigos WHERE email = ?').run(email);
                        db.prepare('INSERT OR REPLACE INTO bloqueios (email, ate) VALUES (?, ?)').run(email, agora + CODIGO_BLOQUEIO_MS);
                    } else db.prepare('UPDATE codigos SET tentativas = ? WHERE email = ?').run(n, email);
                    return null;
                }
                db.prepare('DELETE FROM codigos WHERE email = ?').run(email);
                const agoraIso = iso(agora);
                // Quem ja tem conta anonima neste aparelho: o login so associa o e-mail a ela, ou, se o e-mail ja tem
                // conta (de outro aparelho), funde os dados e passa a usar a conta do e-mail. A sessao continua a mesma.
                const anonima = typeof tokenAtual === 'string' && tokenAtual.length >= 20
                    ? db.prepare('SELECT s.id AS sessao_id, u.id AS uid FROM sessoes s JOIN usuarios u ON u.id = s.usuario_id WHERE s.token_hash = ? AND u.email IS NULL').get(sha256(tokenAtual))
                    : null;
                if (anonima) {
                    const existente = db.prepare('SELECT id, criado_em FROM usuarios WHERE email = ?').get(email);
                    if (!existente) {
                        db.prepare('UPDATE usuarios SET email = ?, ultimo_acesso = ? WHERE id = ?').run(email, agoraIso, anonima.uid);
                        const u = db.prepare('SELECT criado_em FROM usuarios WHERE id = ?').get(anonima.uid);
                        return { token: null, usuario: { email, criado_em: u.criado_em }, vinculou: true, fundiu: false };
                    }
                    fundir(anonima.uid, existente.id);
                    db.prepare('UPDATE sessoes SET usuario_id = ? WHERE usuario_id = ?').run(existente.id, anonima.uid);
                    db.prepare('UPDATE usuarios SET ultimo_acesso = ? WHERE id = ?').run(agoraIso, existente.id);
                    db.prepare('DELETE FROM usuarios WHERE id = ?').run(anonima.uid);
                    db.prepare(
                        'DELETE FROM sessoes WHERE usuario_id = ? AND id NOT IN (SELECT id FROM sessoes WHERE usuario_id = ? ORDER BY ultimo_uso DESC, criada_em DESC LIMIT ?)',
                    ).run(existente.id, existente.id, MAX_SESSOES_POR_USUARIO);
                    return { token: null, usuario: { email, criado_em: existente.criado_em }, vinculou: false, fundiu: true };
                }
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
                // no máximo MAX_SESSOES_POR_USUARIO aparelhos por conta: a mais antiga em uso sai
                db.prepare(
                    'DELETE FROM sessoes WHERE usuario_id = ? AND id NOT IN (SELECT id FROM sessoes WHERE usuario_id = ? ORDER BY ultimo_uso DESC, criada_em DESC LIMIT ?)',
                ).run(usuario.id, usuario.id, MAX_SESSOES_POR_USUARIO);
                return { token, usuario: { email: usuario.email, criado_em: usuario.criado_em }, vinculou: false, fundiu: false };
            });
            if (!r) throw falha();
            return r;
        },

        /** Conta anonima para um aparelho: sem e-mail, com uma sessao. -> { token, usuario } */
        criarAnonimo(aparelho) {
            const agoraIso = iso(relogio());
            return transacao(db, () => {
                const uid = Number(db.prepare('INSERT INTO usuarios (email, criado_em, ultimo_acesso) VALUES (NULL, ?, ?)').run(agoraIso, agoraIso).lastInsertRowid);
                const token = randomBytes(32).toString('base64url');
                db.prepare(
                    'INSERT INTO sessoes (id, token_hash, usuario_id, aparelho, criada_em, ultimo_uso) VALUES (?, ?, ?, ?, ?, ?)',
                ).run(randomBytes(8).toString('hex'), sha256(token), uid, aparelhoLimpo(aparelho), agoraIso, agoraIso);
                return { token, usuario: { email: null, anonimo: true, criado_em: agoraIso } };
            });
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
            db.prepare('DELETE FROM bloqueios WHERE ate < ?').run(agora);
            // marcas de exclusão (sem conteúdo) com mais de 1 ano: um aparelho parado por tanto tempo já perdeu a sessão
            db.prepare('DELETE FROM itens WHERE apagado = 1 AND atualizado_em < ?').run(iso(agora - EXPURGO_MARCAS_MS));
            db.prepare('DELETE FROM sessoes WHERE ultimo_uso < ?').run(iso(agora - SESSAO_MS));
            // conta anonima sem nenhuma sessao: ninguem mais consegue chegar nela (o dado esta orfao). Sai com os itens.
            db.prepare('DELETE FROM usuarios WHERE email IS NULL AND id NOT IN (SELECT usuario_id FROM sessoes)').run();
        },
    };
}
