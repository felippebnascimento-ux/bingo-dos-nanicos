# Fase 16: Rua do Sítio (sair pelo vão da frente do hall)

**Branch:** `rua-do-sitio` · **Depende de:** fase 14 (hall v2) e o hall rearrumado pela planta do grupo (commit c941ae2) · **Banco:** nenhum SQL

## Objetivo (para quem usa)
O modelo está em `planejamento/demo/rua.html` e `rua.png`. Abra os dois antes de começar.
- **Sair:** o hall não tem mais o portão K-FOFO (a placa ficou só de enfeite na parede). A saída é o **vão da entrada, na frente do hall** (os pisos `ENTRADA` de `hall.ts`: `i` 5–7, `j` 9–10). Ele ganha a placa "Rua". Clicar nela, ou andar até a borda da frente do vão (`j = 10`), leva o seu boneco para fora. Na rua, a placa "Voltar ao Sítio" no portão do muro faz o caminho inverso e devolve o boneco no vão da entrada.
- **Lá fora:**
  - grama com uma trilha de pedras saindo do portão;
  - calçada com um poste e uma lixeira;
  - a **árvore grande** à direita, com sombra no chão;
  - **bancos de praça**, por enquanto só de enfeite (sentar fica para uma atualização futura);
  - **céu claro de fundo** em volta do cenário, com nuvens e uma fileira de árvores ao longe, no lugar do fundo escuro do site. No tema escuro, vira um céu de fim de tarde, mais fechado, mas nunca preto;
  - de fundo, na rua, **cinco carros estacionados**: Honda Fit verde-escuro, Fiat Fastback branco, Jeep Renegade, Chevrolet Onix branco e Honda HR-V azul-escuro.
- **Carros:** são desenhados por código, só com o formato (hatch, SUV, fastback, sedã) e a cor, **sem logotipos, marcas nem etiqueta com o nome**. São só paisagem.
- **Quem está onde:**
  - cada pessoa só vê, no cenário, os bonecos que estão no mesmo lugar (hall ou rua);
  - o "Na sala agora" (fase 14) continua com todo mundo, com a etiqueta "na rua" para quem está lá fora;
  - os ganhos de moedas e a carteira aparecem nos dois lugares.
- **Recarregar** a página volta cada um ao lugar e ao piso onde estava.

## Antes de começar
Siga as "Regras de toda sessão" de `planejamento/PLANO.md`. Leia:
- `planejamento/demo/rua.html` (geometria: `NI=16`, `NJ=12`, asfalto em `j` de 0 a 2, calçada em `j=3`, grama de `j=4` em diante, muro com o portão em `i=0`, `j` de 6,6 a 8,6; posição de cada carro, banco, árvore, poste e lixeira);
- `src/features/hall/*` como ficou depois da fase 14 (`hall.ts`, `bonecos.ts`, `Sala.tsx`, `Cantos.tsx`), e `src/lib/sala.ts` (`cleanPresence`, `EVENTOS`).

## Como fazer

### 1) Regra pura: cenários
- **`src/features/hall/cenas.ts`:** cada cenário (`"hall"` e `"rua"`) tem `NI`, `NJ`, `X0`, `Y0`, `VB`, `MOVEIS`, `BLOQUEADOS` e `PORTAS`. O `hall.ts` passa a receber o cenário em vez de usar constantes soltas. **Mantenha os testes atuais passando.**
- **`PORTAS`:** liga o piso de saída de um cenário ao piso de chegada do outro (vão da entrada do hall, `j = 10` ↔ portão do muro da rua).
- **Rua:** o asfalto (`j < 3`) é bloqueado (os carros ficam lá), e também a árvore (só o tronco e as raízes), os bancos, o poste e a lixeira.
- **`posValida(v, cena)`**, com testes para:
  - caminho até a porta;
  - troca de cenário;
  - piso de asfalto recusado.

### 2) Tempo real
- **Presença:** ganha `cena: "hall" | "rua"`, conferida em `cleanPresence`. Sem `cena`, vale `"hall"`, para quem ainda está com a versão antiga.
- **Evento `hall`:** passa a ser `{ cena, para: {i, j} }`, com a mesma conferência (tipo, `posValida`, `estaNaSala`, `limitePorPessoa(8, 2000)`).
- **Chave local `hall-pos`:** passa a guardar `{ cena, i, j }`. Uma posição antiga só com `{i, j}` vale como hall.

### 3) Tela
- **`Rua.tsx`:** desenha a rua em SVG, no mesmo esquema do `Sala.tsx`: chão, muro com o portão aberto, carros, poste, lixeira, bancos e árvore, cada móvel na sua camada com `ordemZ`.
- **Cores:** variáveis `--hall-*` novas (`--hall-grama`, `--hall-asfalto`, `--hall-calcada`, `--hall-ceu-1`/`--hall-ceu-2`, as cores de cada carro…), com versão escura.
- **Céu:** um degradê em CSS no fundo do palco (`.hall-palco.rua`), com as nuvens e as árvores distantes no próprio SVG, atrás de tudo.
- **`HallView`:** mostra o cenário em que **você** está. A troca tem um fade curto, que não acontece com `prefers-reduced-motion`.
- **Rótulos:** "Rua" no vão da entrada do hall e "Voltar ao Sítio" no portão da rua. Quem chega ao site continua aparecendo nos pisos `ENTRADA`, como hoje; só sai para a rua quem pisa em `j = 10` ou clica na placa.
- **Teclado:** as setas andam no cenário atual.

## Não faça
- Não desenhe logotipo, emblema ou marca de carro: só forma e cor.
- Não crie SQL: o cenário é presença e broadcast.
- Não use imagens novas para a rua: é SVG desenhado por código.
- Não faça o sentar agora: ele fica para uma atualização futura (está na fila do `PLANO.md`).

## Pronto quando
- [ ] Com duas abas, uma sai para a rua e some do hall da outra; a outra sai também e as duas se veem lá fora.
- [ ] Recarregar mantém cada um no cenário e no piso onde estava.
- [ ] Um broadcast forjado (cena inventada, piso no asfalto, piso de outro cenário) é ignorado.
- [ ] Os testes antigos e novos de `hall.ts`/`cenas.ts` passam, e `npm run check` também.
- [ ] Com 390 px, a rua cabe sem rolagem para o lado, e o console está sem erros de CSP.
- [ ] O `CLAUDE.md` (cenários, campo `cena` na presença, evento `hall` novo, formato da `hall-pos`) e o `CHANGELOG` foram atualizados.

## Entrada do CHANGELOG
`"Rua do Sítio: saia pela frente do hall, passeie na grama debaixo da árvore e veja os carros da galera"`
