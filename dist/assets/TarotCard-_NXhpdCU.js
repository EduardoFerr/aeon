class s extends HTMLElement{constructor(){super(),this.isFlipped=!0}connectedCallback(){this.cardData=JSON.parse(this.getAttribute("data-card"));const a=this.hasAttribute("show-back");this.innerHTML=`
            <div class="tarot-card ${a?"flipped":""} ${this.cardData.isMajorArcana?"arcano-maior":""} ${this.cardData.element}" >
                <div class="card-inner">
                    <div class="card-front">
                        <img src="assets/cards/crowley-${this.cardData.order}.jpg" alt="${this.cardData.name}">
                    </div>
                    <div class="card-back"></div>
                </div>
            </div>
        `,this.addEventListener("click",()=>this.flipCard())}flipCard(){const a=this.querySelector(".tarot-card");if(this.isFlipped)this.isFlipped=!1,a.classList.remove("flipped");else{const t=document.querySelector("tarot-card-info");t&&t.showInfo(this.cardData)}}}customElements.define("tarot-card",s);export{s as TarotCard};
