import {iniciar,abrirApp,sleep} from './lib.mjs';
const tag=process.argv[2]||'antes';const w=+(process.argv[3]||390);
const b=await iniciar();
for(const th of ['crepusculo','aurora']){
 await abrirApp(b,th,w);const t=`${tag}-${th}-${w}`;
 await b.shot(`${t}-home`);
 await b.nav('all-cards');await b.shot(`${t}-cartas`);
 await b.nav('three-card-game');await b.shot(`${t}-leitura`);
 await b.nav('history');await b.shot(`${t}-diario`);
 await b.nav('perfil');await b.shot(`${t}-perfil`);
 await b.click('[data-acao="ler"]');await sleep(1800);await b.shot(`${t}-mapa`);
 await b.ev(`document.querySelector('.topbar .themebtn').click()`);await sleep(900);await b.shot(`${t}-tema`);
}
await b.fim();process.exit(0);
