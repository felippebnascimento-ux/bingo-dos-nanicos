# Fase 9: Truco no servidor (ninguém vê a mão dos outros), com prêmio em moedas

**Branch:** `truco-servidor` · **Depende de:** fase 2 (moedas) · **Banco:** sim · **Edge Function:** nova

## Objetivo (para quem usa)
O truco continua igual na tela, mas **o servidor embaralha, guarda as cartas e confere cada jogada**.
- **Hoje:** o navegador do anfitrião tem o baralho e a mão de todo mundo, então dá para ver e inventar o resultado.
- **Depois:** cada um só recebe as **próprias** cartas.
- **Prêmio:** quem vence a partida ganha **+15 moedas** (no máximo 3 vitórias pagas por dia), e só em mesas com todos os lugares ocupados por nanicos.

## Antes de começar
Siga as "Regras de toda sessão" de `planejamento/PLANO.md`. Leia inteiros:
- `src/features/truco/engine.ts` e `engine.test.ts`: as regras, puras, com `trAcao`, `trNovaMao`, `trPublica` etc.;
- `src/features/truco/mesa.ts`: o anfitrião de hoje, com os eventos `truco` e a volta da mesa ao recarregar;
- `src/features/truco/valida.ts`, `Lobby.tsx`, `MesaTela.tsx`;
- `supabase/functions/riot-ao-vivo/index.ts`: o esqueleto de função.

## Como fazer

### Uma regra só, no site e no servidor
- O `engine.ts` não importa nada do site. **Não duplique as regras.**
- **Primeira opção:** a função importa `../../../src/features/truco/engine.ts` direto. Confira se a publicação (`npx supabase functions deploy`) empacota esse import.
- **Se não empacotar:** crie um script `npm run sincronizar:truco`, que copia o arquivo para `supabase/functions/_shared/truco-engine.ts` com o cabeçalho "gerado, não edite", mais um teste no Vitest que **falha se as duas cópias forem diferentes**.
- Escolha uma das duas no plano e explique o motivo.
- Pergunte ao João como a `riot-ao-vivo` é publicada hoje (pelo painel ou pelo CLI).

### Banco (seção "13) truco" no `seguranca.sql`)
- **`truco_mesas`:** `(id text pk, criada_por, opcoes jsonb, publico jsonb, fase text, atualizada_em)`, só com o que todos podem ver.
  - **RLS:** nanicos leem; ninguém escreve; só o `service_role`.
- **`truco_estado`:** `(mesa_id pk → truco_mesas, estado jsonb)`, o estado completo com o baralho e as mãos.
  - **`revoke all` para todos** e fora da publicação de tempo real.
  - Fica numa tabela separada, e não numa coluna escondida, para nada vazar pelo tempo real.
- **`truco_maos`:** `(mesa_id, lugar int, user_id, cartas jsonb, mao_n int, primary key(mesa_id, lugar))`. **RLS: `select` só onde `user_id = auth.uid()`.**
- **Tempo real:** `truco_mesas` e `truco_maos` (o RLS filtra a mão de cada um) entram na publicação `supabase_realtime`.
- **`truco_premiar(mesa)`:** interna, chamada só pela função com o service role. Paga `creditar(15,'truco',mesa)` a cada vencedor, respeitando o limite diário e a regra de "todos os lugares com nanicos".

### Edge Function `supabase/functions/truco-mesa/index.ts`
- **Esqueleto da `riot-ao-vivo`:** CORS com `ORIGENS`, confere JWT e nanico, `limitar` por pessoa.
- **Ações:** `abrir` (com opções), `sentar`, `sair`, `comecar`, `jogar` (`AcaoJogo` + carta) e `nova_mao`.
- **A cada ação:**
  1. carrega `truco_estado` com `select … for update`, numa transação via RPC `security definer`, ou com uma versão otimista (`atualizada_em`);
  2. confere se a pessoa está naquele lugar;
  3. aplica `trAcao`;
  4. grava `truco_estado`, `truco_mesas.publico = trPublica(...)` e as `truco_maos`;
  5. no fim da partida, chama `truco_premiar`.
- **Embaralhar:** `crypto.getRandomValues`, nunca `Math.random`. Passe o `rnd` para `trEmbaralha`.

### Site
- **`mesa.ts`:**
  - deixa de ser anfitrião: cada jogada vira uma chamada à função;
  - o estado público e a minha mão chegam por `postgres_changes`;
  - mantenha a store `useTruco` e o formato `TrucoUI`, para a tela mudar pouco.
- **Evento de broadcast `truco`:** saia de `EVENTOS` se não sobrar uso (atualize o `CLAUDE.md`), ou fique só para as "falas", conferidas pela regra 4.
- **Latência:** mostre a carta "saindo" na hora (otimista) e desfaça se a função recusar, com `toast` da mensagem.
- **Prêmio:** `toast("+15 moedas: vitória no truco")`.

## Não faça
- Não deixe nenhuma mão chegar a quem não é dono dela (nem na resposta da função).
- Não mantenha o caminho antigo do anfitrião em paralelo (para não ter dois juízes).
- Não use `Math.random`.

## Pronto quando
- [ ] Logado como A, `select * from truco_maos` só mostra as cartas de A, e `select * from truco_estado` falha.
- [ ] Uma jogada fora da vez ou com carta que não é sua é recusada pela função.
- [ ] Uma partida completa entre 2 e entre 4 pessoas termina e paga +15 aos vencedores uma vez só.
- [ ] Os testes do `engine.ts` continuam passando, mais o teste das cópias (se houver).
- [ ] O PR explica como publicar a função. O `CLAUDE.md` (truco no servidor, função, tabelas, evento) e o `CHANGELOG` foram atualizados.

## Entrada do CHANGELOG
`"Truco à prova de espiada: as cartas ficam no servidor, e a vitória vale moedas"`
