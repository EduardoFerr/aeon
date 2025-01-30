class e extends HTMLElement{connectedCallback(){this.innerHTML=`
            <div class="home-screen">
                <button onclick="navigateTo('all-cards')">Ver Todas as Cartas</button>
                <button onclick="navigateTo('three-card-game')">Jogo das 3 Cartas</button>
                <button onclick="navigateTo('history')">Ver Histórico</button>
            </div>
        `,document.querySelector("header>h1").textContent="Tarot de Thoth"}}customElements.define("home-screen",e);export{e as HomeScreen};
