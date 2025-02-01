class l extends HTMLElement{connectedCallback(){this.innerHTML=`
            <div class="tarot-card-info">
                <div class="info-content">
                    <h3 id="card-title"></h3>
                    <img id="card-image" src="assets/back.jpg" alt="Carta não revelada">
                    <p id="card-name"></p>
                    <p id="card-description"></p>
                    <div class="card-border">
                        <p>
                            <strong>Descrição Simbólica: </strong><br><spam id="card-symbolic-description"></spam>
                        </p>
                        <p>
                            <strong>Mensagem Esotérica: </strong><br><spam id="card-message-esoteric"></spam>
                        </p>
                    </div>
                    <div class="card-border">
                        <p >
                            <strong>Oitava Maior: </strong><spam id="card-maior"></spam>
                        </p>
                        <p >    
                            <strong>Oitava Menor: </strong><spam id="card-menor"></spam>
                        </p>                    
                    </div>
                    <div class="card-border non-wrap">
                        <p id="card-numero">
                            <strong>Número: </strong><spam></spam>
                        </p>
                        <p id="card-arcano">
                            <strong>Arcano: </strong><spam></spam>
                        </p>
                        <p id="card-suit">
                            <strong>Naipe: </strong><spam></spam>
                        </p>
                        <p id="card-element">
                            <strong>Elemento: </strong><spam></spam>
                        </p>
                        <p id="card-astrology">
                            <strong>Astrologia: </strong><spam></spam>
                        </p>
                    </div>
                    <div class="card-border">
                        <p><strong>Alquimia Interna: </strong><spam id="card-internal-alchemy"></spam></p>
                        <p><strong>Prática Mágica: </strong><spam id="card-magical-practice"></spam></p>
                    </div>
                    <div id="card-meditation-reflection"></div>
                    <div id="card-past-present-future"></div>
                    <button id="close-info">Fechar</button>
                </div>
            </div>
        `,this.querySelector("#close-info").addEventListener("click",()=>this.hideInfo())}showInfo(e){var s,i,n;let t="Não disponível";this.querySelector(".info-content").dataset.element=e.element,this.querySelector("#card-image").src=`assets/cards/crowley-${e.order}.jpg`||backImage,this.querySelector("#card-image").alt=e.name||t,this.querySelector("#card-title").textContent=e.title||t,this.querySelector("#card-name").textContent=e.name||t,this.querySelector("#card-description").textContent=e.description||t,this.querySelector("#card-symbolic-description").textContent=e.description_symbolic||t,this.querySelector("#card-message-esoteric").textContent=e.message_esoteric||t,this.querySelector("#card-numero").lastChild.textContent=`${e.number}`||t,this.querySelector("#card-arcano").lastChild.textContent=e.isMajorArcana?"Maior":"Menor",this.querySelector("#card-suit").setAttribute("hidden",!1),this.querySelector("#card-suit").lastChild.textContent=e.suit?e.suit:this.querySelector("#card-suit").setAttribute("hidden",!0),this.querySelector("#card-element").lastChild.textContent=e.element?e.element:t,this.querySelector("#card-astrology").lastChild.textContent=e.astrology?e.astrology:"",this.querySelector("#card-maior").textContent=e.eighth_greater||t,this.querySelector("#card-menor").textContent=e.eighth_lesser||t,this.querySelector("#card-internal-alchemy").textContent=e.internal_alchemy||t,this.querySelector("#card-magical-practice").textContent=e.magical_practice||t;const r=this.querySelector("#card-meditation-reflection");if(r.innerHTML="<strong>Meditação e Reflexão:</strong>",e.meditation_reflection){const o=document.createElement("ul");e.meditation_reflection.forEach(a=>{const c=document.createElement("li");c.textContent=a,o.appendChild(c)}),r.appendChild(o)}else r.textContent+=" Não disponível.";const d=this.querySelector("#card-past-present-future");d.innerHTML=`
            <p><strong>Passado:</strong> <br> ${((s=e.past_present_future)==null?void 0:s.past)||"Não disponível."}</p>
            <p><strong>Presente:</strong> <br> ${((i=e.past_present_future)==null?void 0:i.present)||"Não disponível."}</p>
            <p><strong>Futuro:</strong> <br> ${((n=e.past_present_future)==null?void 0:n.future)||"Não disponível."}</p>
        `,this.removeAttribute("hidden")}hideInfo(){this.setAttribute("hidden",!0)}}customElements.define("tarot-card-info",l);export{l as TarotCardInfo};
