# Fase 21: Troféus da semana (vergonha e glória) e a coroa do mais rico

**Branch:** `trofeus-da-semana` · **Depende de:** fase 14 (hall v2) e a função `riot-ao-vivo` que já existe · **Banco:** sim (seção "22) troféus") · **Edge Function:** nova, `riot-semana`

## Objetivo (para quem usa)
Modelo: `planejamento/demo/hall-zoeira.html` e `.png` (o quadro na parede e os enfeites de cabeça).
- **Toda segunda-feira,** o site calcula sozinho a semana anterior (de segunda a domingo, no horário de Brasília) com as partidas de LoL de cada nanico e entrega os troféus:
  - **Feeder da semana:** quem teve mais mortes por partida;
  - **Turista:** menor placar de visão por minuto;
  - **Carregou o piano:** melhor KDA (mínimo de 5 partidas);
  - **Viciado:** quem jogou mais partidas;
  - **Sumido:** ninguém do grupo jogou com ele na semana (aparece só se tiver jogado alguma).
- **Quadro na parede do hall:** "Troféus da semana", com o rosto, o nome e o número de cada troféu. Clicar abre o quadro grande com os 3 primeiros de cada troféu.
- **Enfeite na cabeça do boneco, a semana inteira:**
  - **chapéu de burro** para o Feeder;
  - **coroa dourada** para quem Carregou o piano;
  - **coroa de moedas** para **o mais rico** (maior saldo agora; troca na hora em que alguém passa).
- **Dá moedas:** +50 para quem Carregou o piano e +20 para o Viciado. Os troféus de vergonha não dão nada (e não tiram).

## Antes de começar
Siga as "Regras de toda sessão" de `planejamento/PLANO.md`. Leia **inteiro** o `supabase/functions/riot-ao-vivo/index.ts`:
- como pega a conta Riot de cada nanico (`riot_contas`, op.gg → Riot ID → puuid);
- `ORIGENS`, a verificação do login e o controle de vez (`riot_vez`, `riot_meta`), que existe para não estourar o limite da chave da Riot.

Leia também o SQL da seção 7 (`creditar`) e o `src/features/hall/*`.

## Como fazer

### Banco (seção "22) troféus")
- **`trofeus_semana`:** `(semana date, trofeu text, friend_id uuid, valor numeric, posicao int, primary key(semana, trofeu, posicao))`. Nanicos leem; só a função escreve.
- **`riot_semana_meta`:** `(semana date pk, estado text check in ('calculando','pronta'), começou_em, terminou_em)`. É a trava para só uma pessoa disparar o cálculo.
- **`semana_vez(p_semana date) returns boolean`:** como o `riot_vez`. Devolve true para **uma** chamada só e deixa as outras esperando; recupera se ficar mais de 10 min "calculando".
- **`trofeus_pagar(p_semana date)`:** interna, só `service_role`. Paga as moedas com `creditar(..., 'trofeu', semana::text)` uma vez só, porque o `ref` com a semana evita pagar duas vezes (confira no `extrato`).
- **Mais rico:** **não** precisa de tabela: `carteiras` já é lida por todos. O site calcula o maior saldo, e na fase 14 ela já está no tempo real.

### Edge Function `riot-semana`
- **Mesmo esqueleto da `riot-ao-vivo`:** CORS por `ORIGENS`, login de nanico obrigatório, chave em `RIOT_API_KEY`.
- **Ao ser chamada:**
  1. se a semana anterior está `pronta`, devolve os troféus;
  2. se não, `semana_vez`. Quem ganhou a vez calcula, e os outros recebem "calculando".
- **Cálculo:**
  - para cada nanico com conta: `match-v5 /by-puuid/{puuid}/ids?startTime&endTime&queue` (filas normais e ranqueadas);
  - depois `match-v5 /matches/{id}` para cada partida. **Partidas em grupo são buscadas uma vez só** (cache por id);
  - tira mortes, kills, assistências, `visionScore`, duração e quem do grupo estava junto.
- **Limite da Riot:** a chave de desenvolvimento aceita 100 chamadas a cada 2 min. Faça as chamadas em fila com pausa, e grave o progresso para continuar na próxima chamada se faltar tempo.
- **Regra pura do cálculo** num arquivo à parte (`calculo.ts`), com teste em Deno ou Vitest a partir de partidas de exemplo (JSON reduzido, **sem dados reais de terceiros**).

### Tela
- **O site chama a `riot-semana`** ao entrar, só às segundas, ou quando a semana anterior não estiver pronta no banco.
- **Quadro na parede:**
  - SVG na parede da esquerda do hall, entre a TV e a porta, com moldura de madeira e três linhas;
  - clicar abre o quadro grande num diálogo, com os 3 primeiros de cada troféu e os números.
- **Enfeites de cabeça (`Chapeu.tsx`):** SVG por código (coroa, chapéu de burro com "BURRO" escrito, coroa de moedas), presos à âncora da cabeça do boneco. Ficam de frente e de costas e seguem o espelho.
- **Sem dados da Riot** (ninguém com op.gg), o quadro não aparece.

## Não faça
- Não chame a Riot do navegador nem exponha a chave.
- Não deixe duas pessoas dispararem o cálculo ao mesmo tempo.
- Não pague troféu duas vezes.
- Não tire moedas de ninguém.

## Pronto quando
- [ ] Com partidas de exemplo, o cálculo acerta cada troféu, inclusive nos empates (vence quem tem mais partidas).
- [ ] Duas abas abrindo na segunda: só uma calcula, e as duas veem o quadro pronto depois.
- [ ] Rodar o pagamento duas vezes não muda nenhum saldo.
- [ ] A coroa de moedas muda de cabeça na hora em que alguém passa o saldo do outro.
- [ ] O `CLAUDE.md` (tabelas, função nova, segredo usado) e o `CHANGELOG` foram atualizados. O PR lembra de publicar a `riot-semana`.

## Entrada do CHANGELOG
`"Troféus da semana no Sítio: Feeder, Turista, Carregou o piano, Viciado e Sumido, com chapéu de burro e coroa"`, `"Coroa de moedas para o mais rico do Sítio"`
