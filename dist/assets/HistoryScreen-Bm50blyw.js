import{g as i}from"./storage-CiteaeKf.js";class s extends HTMLElement{connectedCallback(){const t=i();document.querySelector("header>h1").textContent="Histórico de Leituras",this.innerHTML=`
            <div class="history-screen">
                <h1>Histórico de Leituras</h1>
                <ul>
                    ${t.map(e=>`
                            <li>${e.date}: ${e.cards.map(o=>o.name).join(", ")}</li>
                        `).join("")}
                </ul>
                <button onclick="navigateTo('home')">Voltar</button>
            </div>
        `}}customElements.define("history-screen",s);export{s as HistoryScreen};
