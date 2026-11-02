# Fase 23: Missões do dia

**Branch:** `missoes-do-dia` · **Depende de:** fase 2 (moedas). Algumas missões só entram quando a fase delas existir (ver a tabela) · **Banco:** sim (seção "23) missões")

## Objetivo (para quem usa)
- **Todo dia**, no horário de Brasília, cada nanico recebe **3 missões sorteadas**, diferentes para cada um. Elas aparecem num cartão no canto do hall, embaixo da carteira, e no Perfil.
- **Pagamento:**
  - cada missão vale de 10 a 20 moedas;
  - fazer **as 3** dá um bônus de +25;
  - a recompensa é paga **na hora** em que a missão termina, com o aviso de ganho da fase 14.
- **Missões engraçadas e possíveis,** porque **só entra missão que o banco consegue conferir sozinho**:

| Missão | Como o banco sabe | Precisa da fase |
|---|---|---|
| "Fique 30 minutos no site" | `online_diario.minutos` | 2 |
| "Mande 5 mensagens no chat" | `chat_messages` do dia | — |
| "Cadastre uma nanicada nova" | `phrases` criada hoje | — |
| "Dê uma chinelada em alguém" | `zoeiras` | 18 |
| "Leve uma torta na cara" (passiva) | `zoeiras` | 18 |
| "Ganhe uma partida de truco" | resultado conferido pelo servidor | 9 |
| "Faça um bingo" | bingo conferido pelo servidor | 8 |
| "Gire a roleta do rodízio" | `rodizio.sorteado_por` | 17 |
| "Aposte numa partida ao vivo" | `apostas` | 10 |
| "Dê ração para o Pirulito" | `pet_racoes` | 24 |

## Antes de começar
Siga as "Regras de toda sessão" de `planejamento/PLANO.md`. Leia a seção 7 do `seguranca.sql` (`creditar`, `hoje_br`, `bater_ponto`) e veja quais fases da tabela acima já estão na `main`.

## Como fazer

### Banco (seção "23) missões")
- **`missoes_def`:** `(id text pk, texto text, meta int, valor int, fase_ok boolean)`.
  - Semente idempotente com as missões da tabela. As que dependem de uma fase que ainda não existe ficam com `fase_ok = false` e não são sorteadas. **Quando a fase entrar, o PR dela liga a missão.**
- **`missoes_dia`:** `(user_id, dia date, missao_id, progresso int default 0, feita_em timestamptz null, primary key(user_id, dia, missao_id))`. Cada um lê as suas; ninguém escreve direto.
- **`minhas_missoes()`:** se ainda não tem as de hoje, sorteia 3 dentre as `fase_ok` com `random()` e as cria. Devolve as 3 com o progresso **recalculado na hora** a partir das tabelas de origem (contagens do dia). Quando uma chega na meta e ainda não estava feita, marca `feita_em` e chama `creditar(valor, 'missao', dia||id)`. Quando as 3 estão feitas, paga o bônus uma vez (`ref` `dia||'bonus'`).
- **Recalcular em vez de contar por gatilho:** assim nenhuma tabela antiga precisa mudar, e não dá para inflar o progresso pelo site.

### Site
- **`src/features/missoes/`:** `Missoes.tsx` (cartão com as 3, barra de progresso e um check quando feita) e `missoes.ts` (chama `minhas_missoes()` ao entrar, a cada 2 min com o site aberto e logo depois das ações que contam, como mandar um chat).
- **Missão completa:** aviso de ganho e um "Missão feita!" no cartão. Com `prefers-reduced-motion`, nada se mexe.
- **Sem o SQL rodado,** o cartão não aparece.

## Não faça
- Não aceite progresso vindo do navegador.
- Não sorteie missão de fase que não existe.
- Não pague a mesma missão duas vezes no dia.

## Pronto quando
- [ ] Cada nanico recebe 3 missões por dia, diferentes, e elas trocam à meia-noite de Brasília.
- [ ] Mandar 5 mensagens completa a missão do chat e paga uma vez só, mesmo chamando `minhas_missoes()` várias vezes.
- [ ] Fazer as 3 paga o bônus uma vez.
- [ ] O SQL roda duas vezes sem erro. Funciona com 390 px. O `CLAUDE.md` e o `CHANGELOG` foram atualizados.

## Entrada do CHANGELOG
`"Missões do dia: 3 tarefas por dia que valem moedas, com bônus para quem fizer todas"`
