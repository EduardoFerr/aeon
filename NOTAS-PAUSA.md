# Notas de pausa (frente Perfil, Mapa e Novo mapa)

Pronto (nao commitado antes deste WIP, sem push):
- PerfilScreen reescrito: Meus dados (apelido, data, hora, cidade + Sol/Lua/Ascendente com as cartas) com "Ler o meu mapa" como unica primaria e "Editar meus dados" em texto; lapis de apelido removido; lista "Mapas de outras pessoas" so com os outros, resumo curto, "Ver"/"Em exibição" (btn-terciario), item em exibicao com contorno de acento e resumo expandido; "Adicionar pessoa" em texto; dica "Para trocar de mapa..." removida; sem dados: convite com uma acao.
- Barra do desktop do Perfil e do Mapa: botao "Ações" (btn-ghost) abre popover no desktop e menu lateral no celular (src/components/menuAcoes.js, novo). Mapa mostra 2 acoes a vista (Guardar no diario, Compartilhar) + Ações.
- MapaScreen: codigo morto do guardar direto removido (salvo, guardar-perfil, descartar, Nao guardado, guardarNoPerfil). CSS .mc-estado/.mc-guardar removidos.
- validar, build e test:astro passaram antes do commit.

Falta:
- Abrir e criticar as capturas p2 (Mapa, Novo mapa, editar) em 390 e 1280 (rodadas, nao vistas): seta no cabecalho do Novo mapa/edicao em vez de iconbtn solto acima do form (NovoMapaScreen ainda usa .form-voltar).
- Auditoria por script (lib.mjs tem medir()) em 360, 375, 390, 412 e 1280, dois temas: perfil vazio, so Meus dados, com outros, editar, apagar+Desfazer, novo mapa direto, mapa em todas as abas, hora ambigua, sem hora, latitude alta, teclado.
- Conferir termos proibidos nos textos novos (travessao, sempre, nunca, vai, pede, pedir, gesto, regua, travessia). Nao editei textos.json nem astro-ids.json.
- Aba Dados do Perfil agora so tem Privacidade e backup; revisar se falta algo.
- Chip "Ver" ok no desktop; checar toque 44 no celular.

Como rodar: npx vite --port 5301 --strictPort --host 127.0.0.1; node NOTAS-PAUSA/p1.mjs (ajustar caminhos de lib.mjs/OUT). Usar porta CDP aleatoria (outra sessao usava 9351 e contaminou as primeiras capturas).

Achados ja vistos: nome do signo quebrava de forma diferente por coluna (corrigido com coluna no celular e linha unica no desktop); Data quebrava em 2 linhas (grid 0.8fr/1.2fr); botoes de texto com icone quebravam linha (icones removidos dos terciarios).
