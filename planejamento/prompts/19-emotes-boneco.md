# Fase 19: Emotes do boneco (dancinha, chorar, "gg ez", pedir desculpa)

**Branch:** `emotes-boneco` · **Depende de:** fase 14 e os quadros dos emotes em `planejamento/assets/bonecos/` (**a sessão de planejamento gera antes**, com a mesma IA dos bonecos) · **Banco:** não

## Objetivo (para quem usa)
- **Botão "Emotes"** no canto do hall: abre 4 opções.
  - **Dancinha:** 4 quadros em loop, por 4 s.
  - **Chorar:** 2 quadros com lágrimas, por 4 s.
  - **"gg ez":** pose de deboche, com um balão "gg ez" em cima.
  - **Pedir desculpa:** de joelhos, com um balão "foi mal".
- **Todo mundo no hall vê.** O boneco volta a ficar parado sozinho, e andar cancela o emote.
- **Atalhos de teclado:** 1, 2, 3 e 4, com o hall em foco.

## Antes de começar
Siga as "Regras de toda sessão" de `planejamento/PLANO.md`. Leia:
- `planejamento/assets/bonecos/bonecos.json`: a seção nova `emotes` (linha e colunas de cada emote na spritesheet, só de frente; o espelho vale para o lado esquerdo);
- `src/features/hall/*` e `src/lib/sala.ts`.

## Como fazer
- **Arte:** copie as spritesheets novas de `planejamento/assets/bonecos/` para `public/arte/bonecos/`. Elas substituem as antigas e ganham as linhas dos emotes.
- **Evento `hall`:** ganha `{ cena, emote: "danca" | "chorar" | "ggez" | "desculpa" }`.
  - Confira o tipo contra a lista fechada, `estaNaSala` e o `limitePorPessoa`, que já existe.
  - **Sem moedas e sem banco:** se alguém forjar um emote, o pior que acontece é o próprio boneco dançar.
- **Regra pura:** `quadroDoEmote(emote, ms)` em `bonecos.ts`, que devolve a coluna e a linha a partir do tempo e diz quando o emote acaba. Teste.
- **Balões** ("gg ez", "foi mal") no mesmo estilo das placas de nome.
- **`prefers-reduced-motion`:** mostra só o primeiro quadro e o balão.

## Não faça
- Não ponha emote na presença: é um evento de momento.
- Não use texto livre no balão: só os textos fixos da lista.

## Pronto quando
- [ ] Com duas abas, os 4 emotes aparecem nas duas e somem sozinhos.
- [ ] Andar no meio de um emote cancela o emote.
- [ ] Um emote inventado (`"xyz"`) é ignorado.
- [ ] `npm run check` passa, e o `CLAUDE.md` e o `CHANGELOG` foram atualizados.

## Entrada do CHANGELOG
`"Emotes no Sítio: dancinha, chorar, gg ez e pedir desculpa"`
