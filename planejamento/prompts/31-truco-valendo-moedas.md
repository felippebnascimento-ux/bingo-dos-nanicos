# Fase 31: Truco valendo moedas, com apostas em quem ganha

**Branch:** `truco-valendo` · **Depende de:** fases 9 (truco no servidor), 10 (apostas do LoL), 30 (amigos) · **Banco:** sim

## Objetivo (para quem usa)
- **Mesa valendo:** quem abre a mesa escolhe quanto vale, com um `.seg`: **0, 10, 25, 50 ou 100 moedas por jogador**.
  - Quando a partida começa (e a cada revanche), cada um paga o valor. Se alguém não tiver saldo, a partida não começa e aparece "Fulano está sem moedas para esta mesa". **Ninguém paga nesse caso.**
  - Quem ganha leva o bolo inteiro, sem taxa: no 1×1 o vencedor recebe 2× o valor, e no 2×2 cada um da dupla recebe 2× o valor.
  - **Mesa de 0** continua como hoje, com o prêmio de +15 (até 3 por dia).
  - Mesa fechada no meio do jogo, ou apagada por estar parada há 3 h, **devolve** o que cada um pagou.
- **No Lobby e na mesa** aparece o valor ("Vale 25 🪙") e o bolo ("Bolo: 100").
- **Apostas na partida** (bolo dividido, como no LoL):
  - quem assiste aposta em qualquer dupla, e **quem está jogando só aposta no próprio time** (decisão do João, 03/11/2026);
  - de 5 a 100 moedas, uma aposta por pessoa por partida;
  - abrem quando a partida começa e **fecham quando acaba a 1ª mão**;
  - no fim, o bolo menos 5% da casa é dividido entre quem acertou, na proporção do que apostou;
  - um lado sem apostas, ou mesa fechada antes do fim, devolve tudo;
  - o painel "Apostar" fica ao lado da mesa (para quem assiste e para quem joga), com o bolo de cada lado e o retorno estimado; no fim aparece "Você ganhou 84" ou "Não foi dessa vez".
- **Amigos** (fase 30) jogam e apostam igual aos nanicos.

## Antes de começar
Siga as "Regras de toda sessão" de `planejamento/PLANO.md`. Leia:
- `supabase/functions/truco-mesa/index.ts` inteiro (`abrir` L162-175, `comecar` L96, `nova_mao` L113, `truco_premiar` depois do save L205-208);
- seção 13 do `seguranca.sql` (`truco_salvar` apaga mesas paradas, `truco_fechar`, `truco_premiar`);
- seção 14 (`apostas_mercados`, `apostar_partida`, `apostas_liquidar`) e `src/features/jogar/apostas.ts` / `apostasDados.ts` / `RiotBox.tsx` (painel "Apostar");
- `src/features/truco/engine.ts` (`MesaPub`, `trPublica`, `maoN`, `vencedor`), `mesa.ts`, `Lobby.tsx` e `MesaTela.tsx` (quem assiste já vê a mesa do lugar 0, L71-73);
- os padrões de cobrar antes e pagar depois: `penalti_comecar`/`penalti_fechar` (seção 32b) e `mesa_liquidar` (seção 32).

## Como fazer

### Banco (seção "38) truco valendo e apostas no truco" no `seguranca.sql`)
- **`truco_bolos`** `(mesa text, partida int, valor int, jogadores jsonb` (lugar → `user_id`)`, estado text check in ('cobrado','pago','devolvido'), criado_em, primary key (mesa, partida))`. Ninguém lê nem grava direto; o site sabe o valor por `truco_mesas.opcoes.valor`.
- **`truco_cobrar(mesa, partida, valor, jogadores)`**, só `service_role`: numa transação, `creditar(uid, -valor, 'truco', 'mesa:partida:entrada')` para cada um. O erro de saldo diz o nome de quem está sem moedas. Grava o bolo `'cobrado'`. Com `valor = 0`, não faz nada.
- **`truco_premiar(mesa)`** passa a olhar o bolo da partida:
  - com bolo `'cobrado'`, paga `valor × modo ÷ vencedores` a cada vencedor (`ref` `mesa:partida:premio`) e marca `'pago'`;
  - sem bolo, o +15 de hoje (limite de 3 por dia);
  - nunca paga duas vezes (o `estado` garante).
- **`truco_devolver(mesa)`**, só `service_role`: devolve os bolos `'cobrado'` da mesa (`ref` `…:devolvida`) e os mercados abertos ou fechados dela. Chame:
  - em `truco_fechar`;
  - no `truco_salvar`, **antes** de apagar as mesas paradas há 3 h.
- **Mercado do truco**, separado do LoL (não mexa nas tabelas da seção 14, que usam `game_id bigint` e lados 100/200):
  - `truco_mercados (mesa, partida, times jsonb` (friend id → 0 ou 1)`, estado aberto/fechado/pago/devolvido, vencedor 0|1, bolo_0, bolo_1, casa, primary key (mesa, partida))`. Membros leem; entra no `postgres_changes`.
  - `truco_apostas (mesa, partida, user_id, lado 0|1, valor 5..100, pago, unique (mesa, partida, user_id))`. Cada um lê as suas.
  - `truco_mercado_abrir`, `truco_mercado_fechar` e `truco_mercado_liquidar`, só `service_role`. O liquidar é a mesma conta do `apostas_liquidar` (5% da casa, devolve com um lado vazio), com `ref` `truco:mesa:partida`.
  - `apostar_truco(mesa, partida, lado, valor)` para `authenticated`:
    - `eh_membro()`, mercado aberto, uma aposta por pessoa;
    - quem está em `times` só aposta no próprio lado;
    - debita com `creditar(-valor, 'aposta', …)`;
    - usa `public.limitar()`.
- **Conferência do fim** lista as tabelas e funções novas.

### Função `truco-mesa`
- `abrir`: aceita `valor` em {0, 10, 25, 50, 100} (outro valor vira 0) e guarda em `opcoes`.
- `comecar`: antes de salvar, chama `truco_cobrar`; se falhar, devolve `{ erro }` com o texto do banco e **não** começa. Depois abre o mercado com os times da partida.
- `nova_mao`: quando passa da mão 1 para a 2, fecha o mercado.
- Fim da partida: depois do `truco_premiar`, chama `truco_mercado_liquidar`.
- `fechar`: chama `truco_devolver`.
- Rode `npm run sincronizar:truco` se mexer no `engine.ts` (o ideal é não mexer: o valor mora em `opcoes`, fora do engine).

### Site
- **Regra pura:** generalize `src/features/jogar/apostas.ts` para dois lados quaisquer (as contas não dependem de 100/200), mantendo os testes do LoL e acrescentando os do truco.
- **`src/features/truco/apostasTruco.ts`:** o mercado e a minha aposta pelo tempo real, `apostarTruco()`, e o aviso do fim (toast).
- **Lobby:** o `.seg` do valor ao abrir, e "Vale N" no cartão da mesa.
- **Mesa:**
  - o bolo no placar;
  - o painel "Apostar" (`ApostarTruco.tsx`, reaproveitando o visual do painel do `RiotBox`) para quem assiste e para quem joga, só no próprio time;
  - fechado depois da 1ª mão, mostrando o bolo e a minha aposta.
- **Missão "aposta":** continua presa à fase do LoL; não ligue aqui.

## Não faça
- Não cobre nem pague pelo navegador: só a função `truco-mesa`, pelas funções do banco.
- Não reaproveite `apostas_mercados`/`apostas` para o truco.
- Não deixe o mesmo `ref` pagar duas vezes (revanche é outra `partida`).

## Pronto quando
- [ ] Mesa de 25 em 1×1 entre duas contas: as duas pagam 25 ao começar e o vencedor recebe 50 (extrato confere).
- [ ] Um jogador com 10 moedas numa mesa de 25: a partida não começa e ninguém é cobrado.
- [ ] Fechar a mesa no meio do jogo devolve as entradas e as apostas.
- [ ] Com três contas, quem assiste aposta num lado e quem joga só consegue apostar no próprio. As apostas fecham depois da 1ª mão e pagam certo no fim (5% da casa).
- [ ] A mesa de 0 continua pagando +15, até 3 por dia.
- [ ] O SQL roda duas vezes. 390 px ok. `npm run check` passa. O `CLAUDE.md` (tabelas, funções, truco, apostas) e o `CHANGELOG` foram atualizados.

## Entrada do CHANGELOG
`"Truco valendo moedas: escolha quanto vale a mesa e quem ganha leva o bolo. Dá para apostar em quem vai ganhar a partida"`
