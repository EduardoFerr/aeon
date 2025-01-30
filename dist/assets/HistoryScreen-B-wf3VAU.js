import{g as o}from"./storage-CiteaeKf.js";class s extends HTMLElement{connectedCallback(){const t=o();this.innerHTML=`
            <div class="history-screen">
                <h1>Histórico de Leituras</h1>
                <ul>
                    ${t.map(e=>`
                            <li>${e.date}: ${e.cards.map(i=>i.name).join(", ")}</li>
                        `).join("")}
                </ul>
                <button onclick="navigateTo('home')">Voltar</button>
            </div>
        `}}customElements.define("history-screen",s);export{s as HistoryScreen};
