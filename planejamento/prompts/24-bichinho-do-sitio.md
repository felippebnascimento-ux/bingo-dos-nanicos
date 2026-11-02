# Fase 24: Bichinho do Sítio (o cachorro do grupo)

**Branch:** `bichinho-do-sitio` · **Depende de:** fases 2 (moedas) e 14 (hall v2) · **Banco:** sim (seção "24) bichinho")

## Objetivo (para quem usa)
Modelo: `planejamento/demo/hall-zoeira.html` e `.png`.
- **O Sítio tem um cachorro** (vira-lata caramelo, nome provisório **"Pirulito"**; **pergunte ao Felippe o nome de verdade**). Ele anda sozinho pelo hall e às vezes deita.
- **Humor:** ele tem uma barra de 0 a 100 que depende do grupo:
  - **sobe** com cada nanico diferente que entra no dia (+8) e com ração (+5 cada);
  - **desce** 2 por hora.
- **Como ele fica:**
  - **feliz (≥ 60):** abana o rabo e segue o boneco de quem deu ração por último;
  - **ok (30–59):** anda devagar;
  - **triste (< 30):** fica deitado num canto, com uma nuvenzinha em cima. Clicar mostra "O Pirulito sente falta da galera".
- **Dar ração:** clicar no cachorro abre "Dar ração · 10 moedas" (no máximo 3 por pessoa por dia). Todo mundo vê o pote encher e o aviso "Max deu ração para o Pirulito".
- **Ranking "Melhor amigo do Pirulito":** quem mais deu ração no mês, no diálogo do cachorro.

## Antes de começar
Siga as "Regras de toda sessão" de `planejamento/PLANO.md`. Leia:
- `src/features/hall/*` (como os bonecos andam e como os móveis bloqueiam);
- a seção 7 do `seguranca.sql` (`creditar`, `bonus_diario`, que diz quem entrou no dia).

## Como fazer

### Arte
- O cachorro é **SVG desenhado por código** (corpo, cabeça, orelhas, rabo), com 4 sentidos (o esquerdo é espelho) e 3 poses: andando (rabo e patas alternando), parado e deitado.
- Sem imagens novas.

### Banco (seção "24) bichinho")
- **`pet`:** uma linha `(id int pk default 1 check (id = 1), humor_base int, base_em timestamptz)`.
- **`pet_racoes`:** `(id, user_id, em)`.
- **Humor calculado, nunca gravado pelo site:** `pet_humor()` calcula a partir do `humor_base` e do `base_em`, somando +8 por nanico distinto no `bonus_diario` de hoje, +5 por ração desde `base_em` e −2 por hora passada, com teto 100 e piso 0.
  - Uma vez por dia, ela mesma "fecha" o dia anterior e atualiza `humor_base`/`base_em`, para a conta não crescer sem fim.
- **`dar_racao()`:** exige `eh_nanico()`, aceita no máximo 3 por pessoa por dia, chama `creditar(-10, 'racao', null)` e insere em `pet_racoes`.
- **Tempo real:** `pet_racoes` entra no tempo real, para todos verem a ração na hora.

### Movimento (todos veem o mesmo cachorro)
- **Sem servidor de jogo:** a posição é **calculada pelo relógio**. `posicaoDoPet(tempoMs, humor, BLOQUEADOS)` usa um gerador pseudoaleatório com semente = minuto atual e escolhe um destino livre a cada ~8 s. Como todos usam o mesmo relógio e a mesma semente, todos veem o cachorro no mesmo lugar, a menos de 1 ou 2 s.
- **Seguir alguém (feliz):** o destino é o piso ao lado do boneco de quem deu a última ração (lido de `pet_racoes`).
- **Regra pura** `src/features/hall/pet.ts` + teste: mesma semente, mesmo caminho; nunca para num piso bloqueado; triste fica deitado no canto.

### Tela
- O cachorro é uma camada com `ordemZ`, como os bonecos.
- O diálogo do cachorro mostra o humor, "Dar ração" e o ranking.
- **`prefers-reduced-motion`:** o cachorro fica parado, ainda clicável.

## Não faça
- Não deixe o navegador mandar humor nem posição.
- Não use imagem: é SVG por código.
- Não tire moedas de ninguém além de quem compra a ração.

## Pronto quando
- [ ] Duas abas veem o cachorro no mesmo lugar (diferença de no máximo 2 s).
- [ ] Ração em uma aba aparece na outra, e a 4ª ração no dia é recusada pelo banco.
- [ ] Simulando um dia sem ninguém (mudando `base_em` no SQL Editor), ele fica triste e deitado.
- [ ] Funciona com 390 px. `npm run check` passa, e o `CLAUDE.md` e o `CHANGELOG` foram atualizados.

## Entrada do CHANGELOG
`"O Sítio ganhou um cachorro: quanto mais gente entra, mais feliz ele fica, e dá para dar ração com moedas"`
