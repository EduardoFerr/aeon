/**
 * Limitador de pedidos em memória (janela fixa). Num servidor de um processo só isso basta; reiniciar zera os
 * contadores, o que é aceitável: o limite que protege de verdade o código de login (5 tentativas) fica no banco.
 */
const MAX_CHAVES = 200_000;

export function criarLimitador(relogio) {
    const baldes = new Map();

    function limpar() {
        const agora = relogio();
        for (const [k, b] of baldes) if (agora - b.inicio >= b.janela) baldes.delete(k);
        if (baldes.size > MAX_CHAVES) {
            let n = baldes.size - MAX_CHAVES / 2;
            for (const k of baldes.keys()) {
                if (n-- <= 0) break;
                baldes.delete(k);
            }
        }
    }

    return {
        /** Conta um pedido. -> { ok: true } ou { ok: false, esperaS } */
        tentar(chave, max, janelaMs) {
            const agora = relogio();
            let b = baldes.get(chave);
            if (!b || agora - b.inicio >= janelaMs) {
                if (baldes.size >= MAX_CHAVES) limpar();
                b = { inicio: agora, n: 0, janela: janelaMs };
                baldes.set(chave, b);
            }
            if (b.n >= max) return { ok: false, esperaS: Math.max(1, Math.ceil((b.inicio + janelaMs - agora) / 1000)) };
            b.n++;
            return { ok: true };
        },
        limpar,
    };
}
