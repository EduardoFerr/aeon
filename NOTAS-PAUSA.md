# Notas de pausa: frente transversal (feat/sa-global)

## Pronto (nao auditado ao fim)
- base.css: escala --sp-* documentada no topo, --gutter, --nav-total, --float-b; #main com padding-top; .page-title com padding menor.
- Rodape com respiro e links de 44 px; voltar ao topo (--float-b, sobe acima do rodape via --lift no script de index.html, some sem rolagem relevante e enquanto ha aviso); toast em --float-b.
- Aviso: esconderAviso() em Sobreposicao.js, chamado em abrir() e ao abrir o seletor de tema.
- Filete de taro (losango) por CSS nos titulos .page-title h1, .panel-card > h2/h3, .home-sobre h2 e classe .filete-titulo; glifo em --filete-glifo nos dois temas.
- Fade de 180 ms entre telas (#app.tela-in, navigation.js entrarSuave, respeita reduced-motion).
- Janela de tema: miniaturas com data-theme real (fundo, fonte, acento, botao), anel de acento e check, uma linha por tema, setas/Home/End aplicam ao vivo, fontes dos dois temas carregadas ao abrir.
- validar, build e test:astro passaram (57 testes).

## Falta
- Rodar a auditoria completa (nao terminou): 5 larguras x 2 temas. Ainda nao medido: nav em 360, voltar ao topo vs rodape, toast vs nav, margens laterais, teclado do dialogo de tema, movimento reduzido, duas capturas da transicao.
- Abrir as capturas principais (home, cartas, leitura, diario, perfil, mapa) depois das mudancas e criticar; so vi tema, diario e home.
- node tools/contraste-tokens.mjs (nao rodado; tokens nao foram alterados).
- Conferir verso da carta: .card-back (cartas.css), .leitura-verso (leitura.css) e img em TarotCardInfo usam todos assets/back.jpg; so .card-back leva sombra no Aurora, os outros tem a propria. Parece consistente, nao alterado.
- Checar se o filete em .panel-card h2 fica bom nas telas das outras frentes.
- Remover tools/teste-sa-global se nao quiser os scripts no repo.

## Como rodar a auditoria
1. npm run dev -- --port 5304 --strictPort (node_modules e link).
2. Os scripts estao em tools/teste-sa-global/ (lib.mjs aponta S para a pasta de capturas e usa Chrome por CDP porta 9355; perfil temporario apagado ao fim).
3. node tools/teste-sa-global/audit.mjs 360,390 (lento: rode em segundo plano, passa de 2 min com 5 larguras); node .../shots.mjs <prefixo> <largura> gera capturas.
4. Copie para uma pasta fora do repo se o caminho de imports precisar (imports sao relativos, funcionam in loco).

## Achados das capturas ja vistas
- Tema (390): miniaturas reais, mas o check cobria o eyebrow (movido para o canto inferior) e o botao do Aurora cortava (min-height no lugar de aspect-ratio). Em 360 a janela empilhava as opcoes (limite do container query baixado para 14em; rever).
- Diario: filete ficou limitado a 280 px e parecia arbitrario (agora largura total); glifo do Crepusculo (0.4 de opacidade) esta discreto, conferir.
