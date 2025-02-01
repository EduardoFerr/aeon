class r extends HTMLElement{constructor(){super(),this.isFlipped=!0}connectedCallback(){var s,e;this.cardData=JSON.parse(this.getAttribute("data-card"));const t=this.hasAttribute("show-back"),a=this.cardData?`
            <div class="card-inner">
                <div class="card-front">
                    <img src="assets/cards/crowley-${this.cardData.order}.jpg" alt="${this.cardData.name}">
                    <p class="card-element ${this.cardData.element}">${this.cardData.name}</p>
                </div>
                <div class="card-back"></div>
            </div>
        `:"";this.innerHTML=`
        <div class="tarot-card ${t?"flipped":""} ${(s=this.cardData)!=null&&s.isMajorArcana?"arcano-maior":""} ${((e=this.cardData)==null?void 0:e.element)||""}">
            ${a}
        </div>
        `,this.addEventListener("click",()=>this.flipCard())}flipCard(){const t=this.querySelector(".tarot-card");if(this.isFlipped)this.isFlipped=!1,t.classList.remove("flipped");else{const a=document.querySelector("tarot-card-info");a&&a.showInfo(this.cardData)}}}customElements.define("tarot-card",r);export{r as TarotCard};
