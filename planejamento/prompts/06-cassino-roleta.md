# Fase 6: Cassino, parte 1: motor justo, conferência e roleta

**Branch:** `cassino-roleta` · **Depende de:** fase 2 (carteira, `creditar`) · **Banco:** sim (`pgcrypto`)

## Objetivo (para quem usa)
- **Aba nova "Cassino"**, com moedas fictícias (sem compra e sem saque). O primeiro jogo é a **roleta europeia**:
  - 37 casas, do 0 ao 36;
  - número paga 35×;
  - vermelho/preto, par/ímpar e 1–18/19–36 pagam 1×;
  - o 0 perde nas apostas de cor, paridade e metade.
- **Transparência:** cada jogo mostra quanto a casa leva (aqui, 2,7%).
- **Conferência:** a pessoa pode conferir que o resultado não foi trocado.

## Antes de começar
Siga as "Regras de toda sessão" de `planejamento/PLANO.md` (5 e 6 principalmente). Leia:
- a seção "Cassino" do PLANO;
- o SQL da fase 2 (`creditar`, `extrato`) e `src/lib/carteira.ts`.

## Como fazer

### Banco (seção "11) cassino" no `seguranca.sql`)
- **Extensão:** `create extension if not exists pgcrypto with schema extensions;`. Use `extensions.hmac(...)` e `extensions.gen_random_bytes(32)`.
- **`cassino_sementes`:** `(user_id pk, semente bytea not null, hash text not null, semente_cliente text not null default 'nanico', nonce int not null default 0, criada_em)`.
  - **RLS:** a pessoa lê **só** `hash`, `semente_cliente` e `nonce`, com `grant select` por coluna (**nunca** `semente`).
- **`cassino_sementes_antigas`:** `(user_id, semente_hex, hash, semente_cliente, ultimo_nonce, revelada_em)`. A pessoa lê as próprias.
- **`cassino_apostas`:** `(id bigint identity, user_id, jogo text, aposta int, escolha jsonb, resultado jsonb, pagou int, hash text, nonce int, em)`.
  - **RLS:** cada um lê as próprias, e as últimas 20 de todo mundo aparecem num feed (decida no plano se mostra o nome).
- **`public.cassino_numero(p_user uuid) returns numeric`** (interna):
  - pega a linha **com `for update`** e incrementa o `nonce`;
  - calcula `hmac(semente_cliente || ':' || nonce, semente, 'sha256')`;
  - os primeiros 52 bits viram `u` em [0, 1).
  - Devolve `u`, o hash e o nonce.
- **`public.trocar_semente(p_cliente text)`:** move a semente atual para `cassino_sementes_antigas` (revelando-a em hex), cria uma semente nova e devolve o hash novo.
- **`public.apostar_roleta(p_aposta int, p_tipo text, p_valor int)`** (RPC):
  - exige `eh_nanico()`;
  - `p_aposta` entre 5 e 100;
  - `limitar('cassino', 30, '1 minute', …)`;
  - `p_tipo` em `('numero','cor','paridade','metade')`, com o `p_valor` validado;
  - `creditar(-aposta,'cassino','roleta')`;
  - sorteia a casa `floor(u*37)`;
  - calcula o pagamento (aposta × 36 no número; × 2 nas outras, com o 0 perdendo);
  - se ganhou, `creditar(+pagamento,'cassino','roleta')`;
  - grava em `cassino_apostas` e devolve `{casa, cor, pagou, saldo, hash, nonce}`.
- **Cores:** as casas vermelhas são a lista padrão da roleta europeia (1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36).

### Regra pura `src/features/cassino/regras.ts` + teste
- **O que tem:** cores das casas, `pagamentoRoleta(tipo, valor, casa, aposta)` (o mesmo cálculo do SQL, só para mostrar e testar) e `vantagemDaCasa()`.
- **Conferência no navegador:** `conferir(semente_hex, semente_cliente, nonce)` recalcula o `u` com `crypto.subtle` (HMAC-SHA256), para a tela "Conferir minhas apostas".
- **O teste prova:**
  - o RTP exato da roleta é 36/37 para todo tipo de aposta;
  - `conferir()` bate com vetores calculados à mão.

### Tela `src/features/cassino/CassinoView.tsx`
- **Aba nova** no menu, com ícone em `icones.tsx`.
- **No topo:** saldo (da `useCarteira`) e "A casa leva 2,7%".
- **Mesa:** grade da roleta responsiva (no celular, 3 colunas que rolam na vertical), ficha de valor (5, 10, 25, 50, 100) e botão "Girar".
- **Animação:** a roda gira e para na casa sorteada. Com `prefers-reduced-motion`, mostra o resultado direto.
- **Resultado:** o número grande na `var(--display)` e `toast` com o ganho ou a perda.
- **`<details>` "Como conferir que é justo":** mostra o hash atual, a semente do cliente (editável), o nonce, o botão "Trocar semente e revelar a antiga" e a lista das sementes reveladas com "Conferir".
- **Histórico:** minhas últimas apostas.
- **CSS:** `src/styles/23-cassino.css` (ou o próximo número).

## Não faça
- Não sorteie no navegador nem use `random()` no SQL.
- Não deixe `select` na coluna `semente`.
- Não aceite valor de aposta fora do intervalo nem saldo negativo (o `creditar` já barra; teste mesmo assim).

## Pronto quando
- [ ] O SQL roda duas vezes. Como authenticated, `select semente from cassino_sementes` falha.
- [ ] 1.000 giros de teste no SQL Editor devolvem perto de 97,3% do apostado (anote no PR).
- [ ] Trocar a semente revela a antiga, e `conferir()` no site reproduz as casas das apostas feitas com ela.
- [ ] Aposta com saldo insuficiente mostra "Saldo insuficiente" e nada muda.
- [ ] Funciona com 390 px. O `CLAUDE.md` (aba Cassino, tabelas) e o `CHANGELOG` foram atualizados.

## Entrada do CHANGELOG
`"Cassino com moedas: roleta europeia, com a vantagem da casa à mostra e resultado que dá para conferir"`
