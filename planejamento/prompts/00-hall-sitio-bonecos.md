# Fase 00: Hall do Sítio do Mitz com os bonecos dos nanicos

**Branch:** `hall-sitio` · **Depende de:** migração juntada na `main` (PR #1) e a pasta `planejamento/` na `main` · **Banco:** nenhum SQL · **É a próxima fase**

## Objetivo (para quem usa)
- **Aba nova "Sítio":** passa a ser a **tela inicial**. É o hall do Sítio do Mitz em 2.5D (isométrico): paredes de tijolinho, viga cinza, beiral de madeira, janelas velhas na parede, churrasqueira, porta de tábuas com a placa "K-FOFO 2018", TV, geladeira, colchões azuis, mesas e cadeiras de plástico.
- **Quem está no site aparece no hall** como o seu boneco (estilo Habbo), com o nome em cima.
- **Andar:** clicou ou tocou num piso livre, o **seu** boneco anda até lá nos 4 sentidos (as diagonais do piso), desviando dos móveis. Todo mundo vê os outros andando ao vivo. Parado, o boneco fica no quadro "parado" do último sentido.
- **TV:** abre a aba Ao vivo. Quando alguém está transmitindo, ela mostra o selo "AO VIVO".
- **Porta da Resenha e portão das salas:** ficam **escondidos** nesta fase (pela regra "Limpo"). Eles entram na fase 05.

## Antes de começar
Siga as "Regras de toda sessão" de `planejamento/PLANO.md`. Leia:
- **Modelo do hall:** `planejamento/demo/hall.html` e `hall.png`. Copie a geometria (funções `p()`, `caixa()`, `naParede()`, os tijolos e os móveis), **reescrevendo em React/TSX**. Não cole o HTML.
- **Bonecos:**
  - `planejamento/assets/bonecos/*.webp`, uma spritesheet por nanico;
  - `planejamento/assets/bonecos/bonecos.json`: célula de 84×134, âncora no chão, linhas `frente`/`costas`, colunas `parado` + 4 de `andar`, e quais sentidos são espelhados;
  - `planejamento/demo/ia/todos-andando.gif`: como deve ficar em movimento.
- **Código:**
  - `src/components/App.tsx`, `src/components/shell/Sidebar.tsx` (`ABAS`) e `src/lib/tipos.ts` (`Aba`, `Presence`);
  - `src/lib/sala.ts` (`EVENTOS`, `aoReceber`, `enviar`, `cleanPresence`, `trackMe`, `limitePorPessoa`, `estaNaSala`) e `src/lib/store.ts`;
  - `src/lib/dados/nanicos.ts` (`NAN_MAP`, `artOf`), `src/features/live/*` (como saber quem está ao vivo pela presença) e `src/styles/` (o último número em uso é o 21).

## Como fazer

### 1) Arquivos dos bonecos
- **Copie** `planejamento/assets/bonecos/` para `public/arte/bonecos/` (14 `.webp`, cerca de 1,5 MB no total, e o `bonecos.json`).
- **`bonecoOf(friend)`** em `src/lib/dados/nanicos.ts`, no molde do `artOf`: devolve a URL da spritesheet pelo número do `NAN_MAP`, ou `null`.
- **Quem não tiver boneco** (convidado no futuro, nanico sem arte) aparece com o rosto (`Avatar`) num pino. Não quebre nada.

### 2) Regra pura `src/features/hall/hall.ts` + `hall.test.ts`
- **Grade do piso:** `NI = 11` por `NJ = 9`, igual ao modelo.
- **`BLOQUEADOS`:** lista dos pisos ocupados pelos móveis, tirados do modelo.
- **`caminho(de, para)`:** menor caminho por BFS em 4 vizinhos (só ±i e ±j, o que já garante os 4 sentidos). Devolve `[]` se o destino estiver bloqueado ou for inalcançável.
- **`sentido(a, b)`:** `+i` = frente-direita, `+j` = frente-esquerda, `−i` = costas-esquerda, `−j` = costas-direita. Bate com o `bonecos.json`.
- **`tela(i, j)`:** posição na tela (a `p()` do modelo).
- **`ordemZ(i, j)`:** quem está mais na frente é desenhado por cima, inclusive em relação aos móveis.
- **`posValida(v)`:** confere `{i, j}` inteiros dentro da grade e fora dos bloqueados.
- **Testes:** caminho em volta da mesa, destino bloqueado, sentido de cada passo e `posValida` com lixo.

### 3) Tempo real (regra 4 do CLAUDE.md)
- **Presença:** ganha `pos: {i, j}`, conferida em `cleanPresence` com `posValida`. Quem entra já vê onde cada um está. A presença só é atualizada **quando o boneco chega**, não a cada passo.
- **Evento novo `hall` em `EVENTOS`:** `{ para: {i, j} }`.
  - O handler confere o tipo e `posValida`, se o remetente `estaNaSala` e aplica `limitePorPessoa(8, 2000)`.
  - Cada navegador calcula o caminho e anima sozinho, a partir da última posição conhecida daquela pessoa.
- **Primeira entrada:** posição sorteada entre alguns pisos livres perto da porta de vidro.
- **Conveniência:** guarde a última posição em `local` (`hall-pos`), registrando no CLAUDE.md. Não é nada importante.

### 4) Tela `src/features/hall/HallView.tsx` (+ `Sala.tsx`, `Boneco.tsx`)
- **`HallView({ hidden })`:** devolve `<section id="view-hall" className="inner">`, como as outras abas, sempre montada.
- **O cômodo é um `<svg>`** com `viewBox` fixo, que escala para a largura disponível. Com 390 px ele cabe inteiro, sem rolagem para o lado.
- **Boneco:**
  - é um elemento posicionado por cima do SVG, na mesma escala, com `background-image` da spritesheet e `background-position` do quadro;
  - para os sentidos espelhados, usa `transform: scaleX(-1)`;
  - fica numa camada com `z-index` por `ordemZ`, para passar atrás da mesa e na frente dela.
- **Animação:**
  - velocidade de cerca de 3 pisos por segundo, trocando o quadro do andar a cada ~120 ms (ciclo 1–2–3–4) e com interpolação suave entre pisos;
  - um loop com `requestAnimationFrame` **só enquanto alguém anda**, que para com a aba escondida;
  - com `prefers-reduced-motion`: anda sem trocar quadros e mais rápido.
- **Comandos:**
  - clique ou toque no piso: anda;
  - **teclado**: as setas movem um piso, e o hall tem `tabIndex` e foco visível.
- **Rótulos e leitores de tela:** placa com o nome em cima de cada boneco, a sua com a cor `--accent`, e um `aria-live` discreto ("Gamer entrou no hall").
- **Aba:**
  - `Aba` ganha `"hall"`, que vira o **primeiro item de `ABAS`** (título "Sítio", ícone novo em `icones.tsx`) e a aba inicial do store;
  - no celular, continua no mesmo menu de hoje.
- **CSS:** `src/styles/22-hall.css`, importado no fim do `layout.tsx`.
  - O cômodo é uma ilustração com cores próprias (tijolo, madeira, lajota). Defina essas cores **como variáveis em `.hall`** (`--hall-tijolo`, `--hall-madeira`…), cada uma com uma versão um pouco mais escura no tema escuro. A interface em volta (placas, botões) continua com as cores da paleta.
  - **Isso é uma exceção à regra das cores do CLAUDE.md:** explique no PR e registre no CLAUDE.md.

## Não faça
- Não crie tabela nem SQL: posição é presença e broadcast.
- Não use biblioteca de jogo, canvas de terceiros nem dependência nova. Só SVG, CSS e o que já existe.
- Não mande posição a cada quadro: só o destino e a chegada.
- Não mostre a porta da Resenha nem o portão das salas ainda.
- Não use `dangerouslySetInnerHTML`. Os nomes vão por `{}`.

## Pronto quando
- [ ] Ao entrar, o site abre no Sítio, e o seu boneco aparece perto da porta de vidro.
- [ ] Com duas abas logadas como nanicos diferentes, uma vê a outra andando, nos 4 sentidos, desviando dos móveis.
- [ ] Recarregar a página mostra cada um onde parou, pela presença.
- [ ] Um broadcast forjado (`para` fora da grade, texto, remetente fora da sala, 50 por segundo) é ignorado sem erro.
- [ ] A TV abre o Ao vivo e mostra "AO VIVO" só quando alguém transmite.
- [ ] Com 390 px, o hall cabe sem rolagem para o lado e tocar no piso funciona. Pelo teclado, as setas andam.
- [ ] `npm run check` passa (com os testes de `hall.ts`) e o console fica sem erros de CSP.
- [ ] O `CLAUDE.md` foi atualizado: pasta `features/hall`, `public/arte/bonecos`, evento `hall`, campo `pos` na presença, chave `hall-pos` e a exceção das cores do hall. O `CHANGELOG` também.
- [ ] No `PLANO.md`, a fase 00 aparece como feita.

## Entrada do CHANGELOG
`"Sítio do Mitz: o hall com o boneco de cada nanico; clique no chão para andar e veja quem está no site"`
