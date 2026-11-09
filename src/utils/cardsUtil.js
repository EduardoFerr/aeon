let cardsCache = null;

/**
 * Função para carregar as cartas do arquivo JSON.
 * @returns {Promise<Array>} Retorna uma Promise com a lista de cartas.
 */
export async function loadCards() {
    // Verifica se as cartas já foram carregadas (cache)
    if (cardsCache) {
        return cardsCache;
    }

    try {
        const response = await fetch('/data/cards.json');
        const cards = await response.json();
        cardsCache = cards; // Armazena no cache
        return cards;
    } catch (error) {
        console.error('Erro ao carregar as cartas:', error);
        throw error;
    }
}

/**
 * Busca uma carta já carregada pelo número de ordem (0 a 77).
 * Só funciona depois de loadCards() ter resolvido; devolve null se não achar.
 * `order` no JSON mistura texto ("00") e número (11), por isso a comparação
 * é feita como número.
 * @param {string|number} order
 * @returns {Object|null}
 */
export function getCardByOrder(order) {
    if (!cardsCache) return null;
    return cardsCache.find((card) => Number(card.order) === Number(order)) ?? null;
}

/**
 * Embaralha uma cópia da lista (Fisher-Yates) com aleatoriedade do navegador,
 * sem viés e sem alterar a lista original nem o cache.
 * @param {Array} list
 * @returns {Array}
 */
export function shuffle(list) {
    const items = [...list];
    const buffer = new Uint32Array(1);
    for (let i = items.length - 1; i > 0; i--) {
        // Amostragem por rejeição, para não favorecer índices baixos
        const limit = Math.floor(2 ** 32 / (i + 1)) * (i + 1);
        let value;
        do {
            crypto.getRandomValues(buffer);
            value = buffer[0];
        } while (value >= limit);
        const j = value % (i + 1);
        [items[i], items[j]] = [items[j], items[i]];
    }
    return items;
}
