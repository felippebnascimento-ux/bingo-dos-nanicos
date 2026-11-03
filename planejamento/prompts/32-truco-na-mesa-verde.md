# Fase 32: Truco na mesa verde do K-FOFO (jogadores sentados e plateia)

**Branch:** `truco-mesa-verde` · **Depende de:** fases 14, 27 e 31 · **Banco:** não

## Objetivo (para quem usa)
- **Cadeiras:** a mesa verde do K-FOFO (`mesa-jogos`) ganha **4 cadeiras** em volta, uma em cada lado, de frente para o centro.
- **Quem está jogando aparece sentado:** enquanto uma partida de truco está em jogo, o boneco de cada jogador vai para a cadeira do seu lugar (lugar 0 na frente, 1 na direita, 2 no fundo, 3 na esquerda; no 1×1, só a da frente e a do fundo). Todo mundo vê isso.
  - Os bonecos ficam **"jogando":** um leque de cartas na mão (igual ao número de cartas que a pessoa tem, `nc` do `publico`), as cartas jogadas viradas no centro da mesa (pelas `vazas` da mão), e um balão curto quando alguém grita "Truco!", "Envido" ou "Flor" (pelas `falas`).
  - Em cima da mesa, uma plaquinha com o placar ("Nós 12 × 9" fica "Lightzin e Max 12 × 9 Gamer e Pin") e, se a mesa vale moedas, "Vale 25".
  - No fim, a plaquinha mostra quem ganhou por alguns segundos e os bonecos voltam para onde estavam.
  - Se houver mais de uma partida em jogo, a mesa verde mostra a que começou primeiro e a plaquinha diz "+1 mesa".
- **Assistir:** tocar na mesa verde durante uma partida:
  1. o meu boneco **anda até um piso livre em volta da mesa e fica em pé olhando para ela** (como plateia; quem está no K-FOFO vê);
  2. abre por cima do K-FOFO a **janela "Assistindo"**, com a mesa ao vivo vista do lugar 0 (sem as cartas de ninguém) e o painel "Apostar" da fase 31.
  - Fechar a janela (ou Esc) não tira o boneco de lá: ele sai quando eu tocar em outro lugar.
  - Sem partida em jogo, tocar na mesa abre a aba Truco, como hoje.
- A etiqueta da mesa no K-FOFO passa de "Truco" para "Truco · ao vivo" com uma bolinha `--live` quando há partida.

## Antes de começar
Siga as "Regras de toda sessão" de `planejamento/PLANO.md`. Leia:
- `src/features/hall/hall.ts`:
  - `mesa-jogos` (L51), centro (3,5; 7,3), raio 1, pisos bloqueados i ∈ {2,3,4} × j ∈ {6,7};
  - `CLICAVEIS` (`truco`, L68), `ASSENTOS` (L110-123: `chegar`, `olha`), `posHall`, `assentoNaTela`, `peNaTela`;
  - `camadasHall` (L314-338: sentados saem do `ordemZ` e são desenhados logo depois do móvel) e `ENCOSTO_NA_FRENTE`;
- `Sala.tsx` (mesa verde L236-249, com 3 cartas fixas no feltro), `Boneco.tsx` (sentado: `quadroSprite(olha, 0)`, classe `sentado` em `22-hall.css` L459-460), `bonecos.ts` (`andarAte`, `parar`, `sincronizar`) e `HallView.tsx` (L70 `naMesa`, L138 abre a aba truco, L223);
- `Chapeu.tsx` (enfeite dentro do boneco: é o jeito certo de pôr as cartas na mão sem passar por cima da mesa) e `ConsumoCamada` em `loja/Itens.tsx` (camada por cima de tudo, boa para os balões);
- `src/features/truco/mesa.ts` (`useTruco().mesas`, `verMesa`), `MesaTela.tsx` (já funciona para quem assiste, `eu = -1`) e `Carta.tsx`/`Baralho.tsx`;
- o painel de apostas da fase 31.

## Como fazer
- **Regra pura em `hall.ts`** (+ teste em `hall.test.ts`):
  - `CADEIRAS_TRUCO`: 4 cadeiras com o centro (`i, j`) na borda da mesa e `olha` para o centro. **Não use `ASSENTOS`**: ninguém senta nelas tocando; só o truco põe gente lá.
  - `PLATEIA_TRUCO`: os pisos livres em volta da mesa (perto de (5,6), (5,7), (2..4,5) e (2..4,8)), **tirando** os `chegar` dos sofás e das poltronas. Mais `pisoDaPlateia(ocupados)`, que devolve o primeiro livre.
  - `lugarNaMesaVerde(modo, lugar)`: 1×1 usa as cadeiras 0 e 2.
  - Teste: as cadeiras ficam em pisos bloqueados, os pisos da plateia são livres e alcançáveis por `caminho`, e nenhum é `chegar` de assento.
- **Desenho em `Sala.tsx`:** as 4 cadeiras (madeira, com as cores `--hall-*`); as de trás ficam antes da mesa no `ordemZ` e as da frente depois. Tire as 3 cartas fixas do feltro **só quando** há partida (as cartas de verdade entram no lugar).
- **Quem senta: `src/features/hall/trucoSala.ts`**
  - lê `useTruco().mesas` (tempo real que já existe, **sem broadcast novo**) e escolhe a partida em jogo mais antiga;
  - devolve, para cada `fid` sentado, a cadeira, as cartas na mão e as falas recentes.
  - O `camadasHall` e o `Boneco` usam isso por cima da posição normal: o boneco com cadeira de truco é desenhado sentado nela (mesma regra do `sentado`), sem mudar a presença `pos` nem o `hall-pos`. Quando a partida acaba, ele volta para a `pos` da presença.
  - Jogador sem boneco no K-FOFO (fora do lobby): a cadeira fica vazia, com o nome na plaquinha.
- **Cartas:**
  - `CartasNaMao.tsx` (enfeite como o `Chapeu`): leque de verso, de 0 a 3 cartas;
  - as cartas jogadas no feltro, de verso, desenhadas no SVG da mesa pelas `vazas`;
  - com `prefers-reduced-motion`, sem animação de carta caindo.
- **Balões:** reaproveite o padrão da `ConsumoCamada`, por 2 s, a partir de `falas` (texto fixo do jogo, nunca texto de usuário).
- **Assistir:**
  - em `HallView`, o clique em `truco` com partida em jogo chama `andarAte(pisoDaPlateia(...))` (o evento `hall` que já existe) e abre `AssistindoJanela.tsx`;
  - a janela monta a `MesaTela` da mesa escolhida como quem assiste, sem sentar, e o `ApostarTruco` da fase 31;
  - se `MesaTela` depender da aba Truco estar visível, separe o que for preciso, sem duplicar a mesa;
  - fecha com Esc e ao clicar fora, e no celular vira tela cheia.
- **CSS** em `22-hall.css` (cadeiras, cartas, plaquinha) e um arquivo novo no fim para a janela, se precisar.

## Não faça
- Não mande evento novo pela sala para sentar ou levantar: tudo sai do tempo real de `truco_mesas`.
- Não mexa na presença `pos`/`s` nem no `hall-pos` por causa do truco.
- Não mostre a mão de ninguém: só o verso e a quantidade.

## Pronto quando
- [ ] Partida 2×2 entre quatro contas: na quinta aba, os quatro bonecos aparecem sentados nas cadeiras certas, com cartas na mão diminuindo a cada jogada e as cartas viradas no feltro.
- [ ] "Truco!" aparece em balão em cima de quem gritou.
- [ ] No fim, a plaquinha mostra quem ganhou e os bonecos voltam para onde estavam.
- [ ] Tocar na mesa durante a partida leva o meu boneco para a plateia (as outras abas veem) e abre a janela com a mesa e o "Apostar".
- [ ] Sem partida, a mesa abre a aba Truco como antes.
- [ ] 390 px ok, sem rolagem para o lado. `npm run check` passa. O `CLAUDE.md` (hall, truco) e o `CHANGELOG` foram atualizados.

## Entrada do CHANGELOG
`"Truco no K-FOFO: quem está jogando aparece sentado na mesa verde, e dá para chegar perto, assistir e apostar"`
