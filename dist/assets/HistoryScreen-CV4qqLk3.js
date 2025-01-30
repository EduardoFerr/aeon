import{g as s}from"./storage-CiteaeKf.js";class n extends HTMLElement{connectedCallback(){const t=s();this.innerHTML=`
            <div class="history-screen">
                <ul>
                    ${t.map(e=>{const r=Array.isArray(e.cards)?e.cards:[];return`
                                <li>${e.date}: ${r.map(o=>o.name).join(", ")}</li>
                            `}).join("")}
                </ul>
                <button onclick="navigateTo('home')">Voltar</button>
            </div>
        `,document.querySelector("header>h1").textContent="Histórico de Leituras"}}customElements.define("history-screen",n);export{n as HistoryScreen};
