# Fase 8: Bingo à prova de trapaça, com prêmio em moedas

**Branch:** `bingo-servidor` · **Depende de:** fase 2 (moedas) e fase 5 (salas de LoL) · **Banco:** sim

## Objetivo (para quem usa)
- **Cartela sorteada pelo servidor:** cada partida de uma sala de LoL tem cartelas que o servidor sorteia e guarda. Ninguém consegue mudar a própria.
- **Marcar uma nanicada:**
  - aconteceu algo? Qualquer um da sala aperta **"Aconteceu!"** na nanicada;
  - quando **outro** nanico confirma, ela é marcada **em todas as cartelas** da partida que têm aquela casa.
- **Bingo:** quem fecha uma linha ganha **+25 moedas**, com o servidor conferindo. É no máximo 3 prêmios de bingo por dia por pessoa.
- **Cartela montada à mão:** continua existindo para brincar, mas **não dá moedas** (a pessoa escolhe as casas fáceis).

## Antes de começar
Siga as "Regras de toda sessão" de `planejamento/PLANO.md`. Leia inteiros:
- `src/lib/bingo.ts` e `bingo.test.ts` (quais nanicadas valem para a escalação, sorteio e linhas);
- `src/features/jogar/*` (`JogarView`, `MiniCartela`, `partida.ts`, `RiotBox`);
- o SQL das fases 2 e 5 (escalação por sala, `creditar`);
- `supabase/sql/seguranca.sql`, seção 4c (`riot_ao_vivo.game_id`).

## Como fazer

### Banco (seção "12) bingo" no `seguranca.sql`)
**Tabelas** (RLS em todas; nanicos leem o que é da sua sala ou o que é público; ninguém escreve direto):
- `bingo_partidas(id bigint identity, sala text → salas, game_id bigint null, aberta_em, fechada_em null)`: uma aberta por sala, com índice único parcial `where fechada_em is null`.
- `bingo_cartelas(id, partida_id, user_id, casas uuid[25] (ids de phrases; a do meio é livre), origem text check in ('sorteada','montada'), unique(partida_id, user_id))`.
- `bingo_cantos(id, partida_id, phrase_id, cantado_por, cantado_em, confirmado_por null, confirmado_em null, unique(partida_id, phrase_id))`.
- `bingo_premios(partida_id, user_id, linhas int, pago int, em, primary key(partida_id, user_id))`.

**Funções (RPC):**
- **`bingo_abrir(p_sala)`:** abre a partida da sala se não houver uma aberta, guardando o `game_id` da Riot se algum nanico da escalação estiver em `riot_ao_vivo`.
- **`bingo_nova_cartela(p_sala)`:**
  - **sorteia no banco**, com `extensions.gen_random_bytes` (não use `random()`);
  - usa as mesmas regras de `bingo.ts` para decidir quais nanicadas valem para a escalação daquela sala (nanicos e campeões, modo `qualquer`/`todos`);
  - **escreva essa regra em SQL** e faça um teste comparando com a versão TS para os mesmos dados (um fixture com 10 nanicadas e uma escalação, explicado no PR);
  - uma cartela por pessoa por partida; sortear de novo só antes do primeiro canto confirmado.
- **`bingo_montada(p_sala, p_casas uuid[])`:** confere se as casas são válidas para a escalação e grava com `origem = 'montada'`.
- **`bingo_cantar(p_partida, p_phrase)`:** a nanicada tem que estar em alguma cartela da partida; `limitar('cantar', 10, '1 minute')`.
- **`bingo_confirmar(p_canto)`:**
  - `confirmado_por <> cantado_por`, e quem confirma é nanico e tem cartela na partida;
  - confirmar grava a hora e chama `bingo_pagar(partida)`.
- **`bingo_pagar(p_partida)`** (interna): para cada cartela `sorteada` sem prêmio, conta as linhas feitas com os cantos confirmados. Se ≥ 1 e a pessoa tiver menos de 3 prêmios hoje, chama `creditar(25,'bingo',partida)` e grava em `bingo_premios`.
- **`bingo_fechar(p_sala)`:** qualquer nanico da sala fecha a partida, ou ela fecha sozinha quando a Riot diz que o jogo acabou. Isso fica num gancho na `riot-ao-vivo`, só se for simples; senão, anote no PR.

**Tempo real:** acrescente as tabelas na publicação `supabase_realtime` e em `aoMudarTabela`, para os cantos aparecerem na hora.

### Site
- **`bingo.ts`:**
  - a marcação deixa de ser local: `toggleCell` vira "cantar" ou "confirmar";
  - as casas marcadas vêm dos cantos confirmados;
  - mantenha `LINES` e `linhasFeitas` (puros e testados);
  - a cartela local `rift-card` vira só reserva de leitura, para quem ainda não tem o SQL. Siga o padrão do `phrasesV2` para não quebrar nada.
- **Na cartela:**
  - uma casa cantada e não confirmada mostra "Aconteceu? Confirmar" para os **outros** e "Esperando alguém confirmar" para quem cantou;
  - uma casa confirmada mostra o carimbo (`.cell.on`).
- **Prêmio:** `toast("+25 moedas: bingo!")`, e a presença continua mostrando as linhas, agora vindas do servidor.
- **Montar cartela:** um aviso discreto: "Cartela montada não vale moedas".

## Não faça
- Não deixe o navegador marcar a casa direto.
- Não aceite confirmação de quem cantou.
- Não pague cartela `montada`.
- Não use `random()`.

## Pronto quando
- [ ] Sozinho na sala, ninguém consegue marcar nem ganhar nada.
- [ ] Com duas pessoas, cantar e confirmar marca a casa nas duas cartelas na hora, e fechar uma linha paga +25 uma vez só.
- [ ] O quarto bingo do dia não paga. Uma cartela montada não paga.
- [ ] O teste SQL × TS de "nanicadas que valem" passa.
- [ ] O `CLAUDE.md` (bingo agora no servidor, tabelas) e o `CHANGELOG` foram atualizados.

## Entrada do CHANGELOG
`"Bingo valendo moedas: a cartela é sorteada pelo site e cada nanicada precisa de outro nanico confirmando"`
