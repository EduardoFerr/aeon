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

