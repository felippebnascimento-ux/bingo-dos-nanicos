# Fase 10: Apostas na partida ao vivo (nanico contra nanico)

**Branch:** `apostas-ao-vivo` · **Depende de:** fase 6 (cassino) e a partida ao vivo da Riot que já existe · **Banco:** sim · **Edge Function:** ajuste na `riot-ao-vivo`

## Objetivo (para quem usa)
Quando um nanico entra em partida, aparece **"Apostar"** no aviso de "EM PARTIDA".
- **Mercado:** cada lado (azul e vermelho) recebe apostas. O bolo dos dois lados é dividido entre quem acertou, proporcional à aposta (**pari-mútuo**), e a casa leva **5%**.
- **Janela:** as apostas fecham **5 minutos depois do início** da partida.
- **Quem está jogando** só pode apostar **no próprio time**, para ninguém perder de propósito.
- **Fim da partida:** o servidor pergunta à Riot quem venceu e paga sozinho.
- **Reembolso:**
  - remake ou partida encerrada cedo devolve tudo;
  - se ninguém apostou contra, também devolve.

## Antes de começar
Siga as "Regras de toda sessão" de `planejamento/PLANO.md`. Leia inteiros:
- `supabase/functions/riot-ao-vivo/index.ts`: o que vai em `riot_ao_vivo.jogo`, como sabe que a partida acabou, `riot_vez`;
- `src/features/jogar/riot.ts` e `RiotBox.tsx`;
- o SQL das fases 2 e 6 (`creditar`, limites de aposta).

## Como fazer

### Banco (seção "14) apostas" no `seguranca.sql`)
- **`apostas_mercados`:** `(game_id bigint pk, plataforma text, aberto_em, fecha_em, estado text check in ('aberto','fechado','pago','devolvido'), vencedor int null (100/200), bolo_100 int default 0, bolo_200 int default 0, casa int default 0)`.
- **`apostas`:** `(id, game_id, user_id, lado int check in (100,200), valor int, pago int null, em, unique(game_id, user_id))`. Uma aposta por pessoa por partida.
- **RLS:**
  - os mercados são públicos para nanicos;
  - nas apostas, cada um vê as próprias, e todos veem o total por lado (já está no mercado);
  - ninguém escreve direto.
- **`apostar_partida(p_game bigint, p_lado int, p_valor int)`:**
  - exige `eh_nanico()`;
  - o mercado tem que estar `aberto` e `now() < fecha_em`;
  - o valor fica entre 5 e 100;
  - se o nanico do usuário está nessa partida (confira em `riot_ao_vivo`), o lado tem que ser o dele;
  - chama `creditar(-valor,'aposta',game)` e soma no bolo.
- **`apostas_liquidar(p_game bigint, p_vencedor int, p_remake boolean)`** (interna, só `service_role`):
  - se `p_remake` ou um dos bolos for 0, devolve cada aposta;
  - senão: `casa = floor(total * 0.05)`; cada acertador recebe `floor((total - casa) * valor / bolo_vencedor)`;
  - grava `pago` e o estado.
  - Rodar duas vezes não paga duas vezes: o estado garante.

### Regra pura `src/features/jogar/apostas.ts` + teste
- `retornoEstimado(valor, lado, bolo100, bolo200)` e `divisao(apostas, vencedor)`, que espelham o SQL.
- **O teste prova:**
  - a soma paga + casa ≤ total;
  - o arredondamento nunca paga a mais;
  - o reembolso devolve exatamente o apostado.

### Edge Function `riot-ao-vivo`
- **Partida nova:** cria o mercado (`fecha_em = início + 5 min`) com `on conflict do nothing`.
- **Partida que sumiu:**
  1. busca `match-v5` (`{PLATAFORMA}_{gameId}`), com nova tentativa nos ciclos seguintes até achar;
  2. lê `teams[].win` e se houve remake (`gameEndedInEarlySurrender` ou duração < 5 min);
  3. chama `apostas_liquidar`.
- **Limite da Riot:** o mesmo controle de chamadas da função (`riot_vez`).

### Tela
- **No `RiotBox`:**
  - "Apostar" abre um painel com os dois times (os 10 campeões que já aparecem), o bolo de cada lado, o seu retorno estimado ao vivo e a contagem até fechar;
  - quem está jogando vê só o próprio lado liberado.
- **Depois do fim:** `toast("+87 moedas: o time do Gamer venceu")` ou "Aposta devolvida: remake".
- O histórico das apostas fica no extrato (fase 2) com o motivo `aposta`.

## Não faça
- Não deixe apostar depois de `fecha_em` (o banco confere, não só o botão).
- Não deixe quem joga apostar contra o próprio time.
- Não pague em dobro ao rodar a liquidação de novo.

## Pronto quando
- [ ] Com mercado simulado no SQL Editor: as apostas dos dois lados e a liquidação pagam como o teste da regra pura.
- [ ] Rodar `apostas_liquidar` duas vezes não muda nenhum saldo.
- [ ] Remake devolve tudo.
- [ ] Uma aposta 6 min depois do início é recusada com "As apostas desta partida já fecharam".
- [ ] O `CLAUDE.md` e o `CHANGELOG` foram atualizados, e o PR lembra de publicar a `riot-ao-vivo` de novo e conferir o "EM PARTIDA".

## Entrada do CHANGELOG
`"Apostas com moedas na partida ao vivo: escolha o time e divida o bolo com quem acertou"`
