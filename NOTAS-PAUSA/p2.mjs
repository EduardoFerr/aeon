import * as L from './lib.mjs';
await L.abrir();
for(const [w,th] of [[390,'crepusculo'],[1280,'aurora']]){
 await L.dispositivo(w,th);
 await L.carregar(th,L.seed([L.SP(),L.ANA]));
 await L.nav('perfil');await L.sleep(500);
 await L.click('[data-acao="ler"]');await L.sleep(1800);
 await L.shot(`p2-mapa-${w}-${th}`);
 await L.click('[data-abrir-acoes]');await L.sleep(700);
 await L.shot(`p2-mapa-acoes-${w}-${th}`);
 await L.ev(`document.querySelector('.sob [data-sob-x]').click()`);await L.sleep(500);
 await L.nav('perfil');await L.sleep(500);
 await L.click('[data-exec="novo"]');await L.sleep(1000);
 await L.shot(`p2-novo-${w}-${th}`);
 await L.nav('perfil');await L.sleep(500);
 await L.click('[data-exec="meus-dados"]');await L.sleep(1000);
 await L.shot(`p2-editar-${w}-${th}`);
}
await L.fechar();process.exit(0);
