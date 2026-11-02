# Fase 22: Bolão da partida (apostas engraçadas sobre quem está jogando)

**Branch:** `bolao-da-partida` · **Depende de:** fase 10 (apostas ao vivo: mercado, pari-mútuo, liquidação pela `riot-ao-vivo`) · **Banco:** sim (continua a seção "14) apostas")

## Objetivo (para quem usa)
Além de apostar em qual time vence (fase 10), quem está de fora aposta em **perguntas de sim ou não** sobre cada nanico da partida:
- "O **Max** morre mais do que mata?"
- "O **Gamer** faz o first blood?" (kill ou assistência)
- "A partida passa de **30 minutos**?"
- "Alguém do time do grupo **se rende** (surrender)?"
- "O **John** termina com placar de visão abaixo de 20?"

Funciona assim:
- **Perguntas:** cada partida ganha de 3 a 5, sorteadas de uma lista fixa, com os nomes dos nanicos que estão nela.
- **Apostas:** em **Sim** ou **Não**, de 5 a 50 moedas, dividindo o bolo entre quem acertou, como na fase 10 (a casa leva 5%).
- **Prazo:** fecha 5 minutos depois do início, junto com o mercado da fase 10.
- **Quem está na partida não aposta nas perguntas sobre si mesmo,** para não fazer de propósito.
- **No fim,** a Riot responde cada pergunta (dados da `match-v5`) e paga sozinho.

## Antes de começar
Siga as "Regras de toda sessão" de `planejamento/PLANO.md`. Leia **o que a fase 10 fez**: `apostas_mercados`, `apostas`, `apostar_partida`, `apostas_liquidar`, `src/features/jogar/apostas.ts` e a parte da `riot-ao-vivo` que liquida.

## Como fazer

### Banco
- **`bolao_perguntas`:** `(id, game_id → apostas_mercados, tipo text check in ('morre_mais','first_blood','passa_30','surrender','visao_baixa'), friend_id uuid null, resposta boolean null, bolo_sim int default 0, bolo_nao int default 0, casa int default 0, estado text)`.
- **`bolao_apostas`:** `(pergunta_id, user_id, lado boolean, valor int check (5..50), pago int null, primary key(pergunta_id, user_id))`.
- **`bolao_criar(p_game)`:** interna (só `service_role`), chamada pela função quando o mercado é criado. Escolhe de 3 a 5 perguntas com `random()`, usando os nanicos da `riot_ao_vivo`.
- **`apostar_bolao(p_pergunta, p_lado, p_valor)`:**
  - exige `eh_nanico()` e o mercado aberto;
  - recusa se `friend_id` for o nanico de quem aposta;
  - chama `creditar(-valor, 'bolao', id)`.
- **`bolao_liquidar(p_game, p_respostas jsonb)`:** interna. Paga como a `apostas_liquidar`; se um lado tiver bolo 0, devolve tudo. Rodar duas vezes não paga duas vezes.

### Edge Function `riot-ao-vivo`
- **Ao criar o mercado,** chama `bolao_criar`.
- **Ao liquidar,** calcula a resposta de cada pergunta com a `match-v5` que ela já busca:
  - `deaths > kills`;
  - `firstBloodKill or firstBloodAssist`;
  - `gameDuration > 1800`;
  - `gameEndedInSurrender` do time do nanico;
  - `visionScore < 20`.
- **Remake** (fase 10) devolve tudo.

### Regra pura
- `src/features/jogar/bolao.ts` + teste:
  - `textoDaPergunta(tipo, nome)`;
  - `respostaDaPartida(tipo, participante, partida)`, que espelha a função e é testada com partidas de exemplo;
  - `retornoEstimado`, que reaproveita o da fase 10.

### Tela
- **No painel "Apostar" da fase 10,** uma seção "Bolão": cada pergunta com Sim/Não, o bolo de cada lado e o seu retorno estimado.
- **No fim,** um toast por pergunta acertada ("+34 moedas: o Max morreu mais do que matou").

## Não faça
- Não deixe apostar em pergunta sobre si mesmo.
- Não invente pergunta que a `match-v5` não responde com certeza.
- Não pague em dobro.

## Pronto quando
- [ ] Com um mercado simulado, as perguntas são criadas, as apostas dos dois lados e a liquidação pagam como o teste da regra pura.
- [ ] A aposta de quem está na pergunta é recusada pelo banco.
- [ ] A liquidação rodada duas vezes não muda saldo.
- [ ] O `CLAUDE.md` e o `CHANGELOG` foram atualizados. O PR lembra de publicar a `riot-ao-vivo` de novo.

## Entrada do CHANGELOG
`"Bolão da partida: aposte se o amigo vai morrer mais do que matar, fazer first blood e outras"`
