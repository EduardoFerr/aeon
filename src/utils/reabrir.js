import { obter } from './diario.js';
import { dataLocal } from './cartaDoDia.js';

/**
 * Reabrir uma leitura guardada no diario na propria tela de leitura.
 *
 * O diario guarda so a ordem das cartas (com a posicao de cada uma), a pergunta e a nota. Tudo o que a tela
 * mostra (texto de cada posicao, frase da cruz, comparacao do templo) sai das cartas, entao reabrir nao grava nada
 * de novo: a tela monta o mesmo resultado a partir da entrada.
 *
 * `posicoes` e a ordem das posicoes da tela (ex.: ['passado', 'presente', 'futuro']). Entradas antigas sem
 * posicao seguem a ordem em que foram guardadas.
 *
 * -> { id, pergunta, data, cartas } (cartas na ordem das posicoes) ou null se a entrada sumiu, e de outro tipo
 *    ou alguma carta nao existe mais no baralho.
 */
export function entradaParaTela(id, tipo, posicoes, todas) {
    const e = typeof id === 'string' ? obter(id) : null;
    if (!e || e.tipo !== tipo || !Array.isArray(e.cartas) || e.cartas.length !== posicoes.length) return null;
    const porPos = new Map(e.cartas.filter((c) => c.pos).map((c) => [c.pos, c]));
    const temTodas = posicoes.every((p) => porPos.has(p));
    const cartas = [];
    for (let i = 0; i < posicoes.length; i++) {
        const ref = temTodas ? porPos.get(posicoes[i]) : e.cartas[i];
        const carta = todas.find((c) => Number(c.order) === ref.order);
        if (!carta) return null;
        cartas.push(carta);
    }
    return { id: e.id, pergunta: e.pergunta || '', data: dataLocal(new Date(e.t)), cartas };
}
