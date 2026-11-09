export class TarotCardInfo extends HTMLElement {
    connectedCallback() {
        // Define o conteúdo inicial vazio
        this.innerHTML = `
            <div class="tarot-card-info" role="dialog" aria-modal="true" aria-labelledby="card-name">
                <div class="info-content" tabindex="-1">
                    <h3 id="card-title"></h3>
                    <img id="card-image" src="assets/back.jpg" alt="Carta não revelada">
                    <p id="card-name"></p>
                    <p id="card-description"></p>
                    <div class="card-border">
                        <p>
                            <strong>Descrição Simbólica: </strong><br><span id="card-symbolic-description"></span>
                        </p>
                        <p>
                            <strong>Mensagem Esotérica: </strong><br><span id="card-message-esoteric"></span>
                        </p>
                    </div>
                    <div class="card-border">
                        <p >
                            <strong>Oitava Maior: </strong><span id="card-maior"></span>
                        </p>
                        <p >
                            <strong>Oitava Menor: </strong><span id="card-menor"></span>
                        </p>
                    </div>
                    <div class="card-border non-wrap">
                        <p id="card-numero">
                            <strong>Número: </strong><span></span>
                        </p>
                        <p id="card-arcano">
                            <strong>Arcano: </strong><span></span>
                        </p>
                        <p id="card-suit">
                            <strong>Naipe: </strong><span></span>
                        </p>
                        <p id="card-element">
                            <strong>Elemento: </strong><span></span>
                        </p>
                        <p id="card-astrology">
                            <strong>Astrologia: </strong><span></span>
                        </p>
                    </div>
                    <div class="card-border">
                        <p><strong>Alquimia Interna: </strong><span id="card-internal-alchemy"></span></p>
                        <p><strong>Prática Mágica: </strong><span id="card-magical-practice"></span></p>
                    </div>
                    <div id="card-meditation-reflection"></div>
                    <div id="card-past-present-future"></div>
                    <button id="close-info">Fechar</button>
                </div>
            </div>
        `;

        this.onKeydown = (event) => {
            if (event.key === 'Escape') this.hideInfo();
        };

        // Adiciona o evento de fechar
        this.querySelector('#close-info').addEventListener('click', () => this.hideInfo());
        // Clique no fundo (fora do conteúdo) também fecha
        this.querySelector('.tarot-card-info').addEventListener('click', (event) => {
            if (event.target === event.currentTarget) this.hideInfo();
        });
    }

    /**
     * Preenche o texto do <span> de uma linha de rótulo. Se não houver valor,
     * esconde a linha inteira (antes ficava "Astrologia:" em branco).
     */
    preencherLinha(seletor, valor) {
        const linha = this.querySelector(seletor);
        linha.hidden = !valor;
        linha.querySelector('span').textContent = valor || '';
    }

    /**
     * Exibe as informações da carta.
     * @param {Object} cardData - Dados da carta a serem exibidos.
     * @param {HTMLElement} [origem] - Elemento que abriu o modal, para devolver o foco ao fechar.
     */
    showInfo(cardData, origem) {
        let not_found = 'Não disponível'
        this.origem = origem || null;

        // Atualiza os elementos do modal com os dados da carta
        this.querySelector('.info-content').dataset.element =  cardData.element
        this.querySelector('#card-image').src = `assets/cards/crowley-${cardData.order}.jpg`;
        this.querySelector('#card-image').alt = cardData.name || not_found;

        this.querySelector('#card-title').textContent = cardData.title || not_found;


        this.querySelector('#card-name').textContent = cardData.name || not_found;
        this.querySelector('#card-description').textContent = cardData.description || not_found;
        this.querySelector('#card-symbolic-description').textContent = cardData.description_symbolic || not_found;
        this.querySelector('#card-message-esoteric').textContent = cardData.message_esoteric || not_found;

        // Na Corte o "número" 11 a 14 não existe em Thoth (a carta é a patente), então a linha some
        this.preencherLinha('#card-numero', cardData.court_rank ? '' : (cardData.numeral || `${cardData.number}`));
        this.preencherLinha('#card-arcano', cardData.isMajorArcana ? 'Maior' : 'Menor');
        this.preencherLinha('#card-suit', cardData.suit);
        this.preencherLinha('#card-element', cardData.element || not_found);
        this.preencherLinha('#card-astrology', cardData.astrology);

        this.querySelector('#card-maior').textContent = cardData.eighth_greater || not_found;
        this.querySelector('#card-menor').textContent = cardData.eighth_lesser || not_found;
        this.querySelector('#card-internal-alchemy').textContent = cardData.internal_alchemy || not_found;
        this.querySelector('#card-magical-practice').textContent = cardData.magical_practice || not_found;

        // Meditação e reflexão
        const meditationContainer = this.querySelector('#card-meditation-reflection');
        meditationContainer.innerHTML = '<strong>Meditação e Reflexão:</strong>';
        if (cardData.meditation_reflection) {
            const list = document.createElement('ul');
            cardData.meditation_reflection.forEach(item => {
                const listItem = document.createElement('li');
                listItem.textContent = item;
                list.appendChild(listItem);
            });
            meditationContainer.appendChild(list);
        } else {
            meditationContainer.textContent += ' Não disponível.';
        }

        // Leitura em três tempos. As cartas já reescritas (texto_thoth) usam o formato
        // raiz, dilema e tendência; as demais ainda têm passado, presente e futuro.
        const rotulos = cardData.texto_thoth
            ? ['Raiz', 'Dilema', 'Tendência']
            : ['Passado', 'Presente', 'Futuro'];
        const pastPresentFutureContainer = this.querySelector('#card-past-present-future');
        pastPresentFutureContainer.innerHTML = `
            <p><strong>${rotulos[0]}:</strong> <br> ${cardData.past_present_future?.past || 'Não disponível.'}</p>
            <p><strong>${rotulos[1]}:</strong> <br> ${cardData.past_present_future?.present || 'Não disponível.'}</p>
            <p><strong>${rotulos[2]}:</strong> <br> ${cardData.past_present_future?.future || 'Não disponível.'}</p>
        `;

        this.removeAttribute('hidden'); // Exibe o modal
        document.addEventListener('keydown', this.onKeydown);

        // Começa lendo do topo e leva o foco para dentro do modal
        // (sem rolar até o botão Fechar, que fica no fim do conteúdo)
        const conteudo = this.querySelector('.info-content');
        this.querySelector('.tarot-card-info').scrollTop = 0;
        conteudo.scrollTop = 0;
        conteudo.focus({ preventScroll: true });
    }

    /**
     * Esconde o modal.
     */
    hideInfo() {
        this.setAttribute('hidden', true);
        document.removeEventListener('keydown', this.onKeydown);
        // Devolve o foco para a carta que abriu o modal
        if (this.origem && this.origem.isConnected) this.origem.focus();
        this.origem = null;
    }
}

customElements.define('tarot-card-info', TarotCardInfo);
