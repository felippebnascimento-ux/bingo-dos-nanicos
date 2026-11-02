# Fase 29: Ranking de quem tem mais moedas

**Branch:** `ranking-moedas` · **Depende de:** fase 14 (carteira no canto do Sítio, `carteiras` no tempo real) e fase 28 (chip de moedas no Início) · **Banco:** não

Esta parte foi acrescentada ao prompt da fase 14 depois que ela já estava feita. Por isso ficou de fora e vira uma fase pequena.

## Objetivo (para quem usa)
Modelo: `planejamento/demo/ranking.html` e `ranking.png`.
- **Clicar na carteira** (no canto do Sítio, ou no chip de moedas do Início) abre o painel da carteira com duas abas (`.seg`):
  - **"Ranking":** os 14 nanicos do mais rico ao mais pobre, com posição, rosto, nome e saldo;
    - o 1º lugar tem uma coroa de moedas pequena no rosto;
    - você aparece destacado em `--accent`;
    - clicar num nome abre a ficha (`fichaAberta`).
  - **"Meu extrato":** o `MoedasBloco` que já existe.
- **A posição aparece junto do saldo,** na carteira do Sítio e no chip do Início: "1.284 · 3º lugar".
- **Ao vivo:** quando alguém ganha ou gasta moedas, a lista se reordena na hora. Quem subiu de posição ganha "▲ subiu" em verde por 3 s.
- **Empates** dividem a posição ("5º, 5º, 7º"). Nanico sem carteira ainda aparece no fim, com "—".

## Antes de começar
Siga as "Regras de toda sessão" de `planejamento/PLANO.md`. Leia:
- `src/features/moedas/*` e `src/lib/carteira.ts` (`useCarteira`, extrato);
- `src/lib/sala.ts`: o `postgres_changes` de `carteiras`, que já existe, e o `aoMudarTabela`;
- o `Cantos.tsx` do hall (carteira) e o `InicioView.tsx` (chip de moedas);
- a RLS de `carteiras` na seção 7 do `seguranca.sql`: nanicos já leem todas.

## Como fazer
- **Regra pura** em `src/lib/moedas.ts` + teste: `ranking(carteiras, friends)` ordena por saldo (no empate, por nome), devolve a posição de cada um com os empates dividindo a posição e põe quem não tem carteira no fim.
  - **Teste:** empate, ninguém com carteira e o jogador sem carteira.
- **Dados** em `src/lib/carteira.ts`:
  - `carregarRanking()` lê `user_id, saldo` de todas as carteiras uma vez, quando a primeira tela que precisa dele monta;
  - depois mantém a lista pelo `aoMudarTabela("carteiras")`, que já chega;
  - guarda em `useCarteira` (campo novo `todas`).
  - Sem consulta repetida.
- **`src/features/moedas/Ranking.tsx`:**
  - a lista com a coroa do 1º (SVG pequeno em `icones.tsx`), o destaque de quem está logado e o "▲ subiu" (sem animação com `prefers-reduced-motion`);
  - o painel abre por cima do canto do Sítio, ou como diálogo no Início, e fecha com Esc e ao clicar fora.
- **Posição na carteira e no chip:** use `ranking(...)` com o seu `user_id`. Sem carteiras carregadas, mostra só o saldo.

## Não faça
- Não crie tabela nem RPC: as carteiras já são legíveis por nanicos.
- Não consulte o banco a cada mudança: o tempo real já traz o saldo novo.

## Pronto quando
- [ ] O ranking mostra os 14 na ordem certa, com os empates dividindo a posição.
- [ ] Com duas abas, quando uma ganha moedas, o ranking e a posição mudam na outra sem recarregar.
- [ ] O chip do Início e a carteira do Sítio mostram "· Nº lugar".
- [ ] Funciona com 390 px. `npm run check` passa, e o `CLAUDE.md` e o `CHANGELOG` foram atualizados.

## Entrada do CHANGELOG
`"Ranking de quem tem mais moedas: clique na carteira para ver a sua posição"`
