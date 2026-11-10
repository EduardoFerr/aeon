# Notas de pausa: frente Leitura (feat/sa-leitura)

## Pronto (so verificado em 390 px, tema Crepusculo, com capturas abertas)
- Leitura de tres cartas: sem altura reservada (vazio maximo medido 27 px, antes 162 px); ritmo de 24 px entre grupos; Passado/Presente/Futuro em fonte de titulo, rotulos (Raiz, Dilema, Tendencia, Luz) em versalete peso 500; "Escrever no diario" unica primaria e "Ações" terciario; "Abrir a carta" virou terciario.
- Carta do dia: 2 botoes (Abrir primaria, Guardar no diario) e "Ações" como texto (Compartilhar e Lembrar foram para a gaveta); luz e pergunta sem caixas; semana em 7 colunas iguais.
- Home: 4 cartoes de altura igual (Tirar cartas, Cartas, Seu mapa/Mapa astral, Diario), linha unica; destaque cheio com a carta fechada e em tom do acento com a carta aberta.
- Cartas: chips 40 px (toque 44), busca e contagem com respiro, grade mais compacta.
- Detalhe da carta: coluna de 38 rem (cpl <= 45 em 390), entrelinha 1,6 a 1,7, rotulos em versalete sem dois-pontos; abrirResumoCarta com botao primario.
- Auditoria 390 crepusculo: nenhuma falha (home, cartas, detalhe, leitura em todos os estados).

## Falta
- Rodar a matriz completa (360, 375, 412, 1280 e tema Aurora) e abrir as capturas: NAO foi concluida (interrompida).
- Teclado completo (Tab, setas no leque, Enter/Espaco) nao testado depois das mudancas.
- Conferir desktop (1280): interp alinhada a esquerda sob carta centralizada; cpl no desktop.
- Conferir Aurora (destaque da Home com color-mix, chips).
- Cenario "Cartas > detalhe" em outros temas; Home sem mapa (Mapa astral / Crie o seu).
- Conferir "B1 nenhum Voltar solto" nestas telas (nao medido por mim).
- npm run test:astro nao tive a saida lida; validar e build passaram.
- Sem teste automatizado novo em tests/.

## Como rodar a auditoria
Vite em 5303 (`node_modules/.bin/vite --port 5303`), depois:
`node notas-pausa/auditoria-t.mjs 360,375,390,412,1280 crepusculo,aurora shots <pasta> home,cartas,leitura`
(ajustar caminho de saida S no topo do script e o perfil de Chrome em /private/tmp; apagar o perfil ao fim). Cenarios: home, cartas, leitura, ('teclado' ainda nao implementado).

## Achados das capturas ja vistas
- Antes: vazio de 162 px entre cada slot da leitura (min-height da interp) e 734 px reservados no embaralhar.
- Botao "Escrever no diario" saia com 44 px (iconbtn esticava a linha): corrigido com btn-terciario.
- Home tinha dois cartoes para o mesmo destino (Tirar cartas e Tres cartas): trocado por Diario.
- Pendencia de design: avaliar se o tom do destaque da Home com a carta aberta le como primario.
