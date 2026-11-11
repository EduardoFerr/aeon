import * as L from './lib.mjs';
await L.abrir();
for(const [w,th] of [[390,'crepusculo'],[1280,'aurora']]){
 await L.dispositivo(w,th);
 await L.carregar(th,L.seed([L.SP(),L.ANA,L.JU]));
 await L.nav('perfil');await L.sleep(700);
 await L.shot(`p1-perfil-${w}-${th}`,true);
 await L.click('[data-ver="mapa-b"]');await L.sleep(800);
 await L.shot(`p1-perfil-ver-${w}-${th}`,true);
 await L.click('[data-abrir-acoes]');await L.sleep(700);
 await L.shot(`p1-acoes-${w}-${th}`);
}
console.log(L.linhas.join('\n'));
await L.fechar();process.exit(0);
