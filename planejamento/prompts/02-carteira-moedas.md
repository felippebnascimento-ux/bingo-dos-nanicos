# Fase 2: Carteira de moedas, bônus diário, sequência e tempo online

**Branch:** `carteira-moedas` · **Depende de:** migração juntada · **Banco:** sim (seção nova no `seguranca.sql`)

## Objetivo (para quem usa)
- **Carteira:** cada nanico tem uma carteira de moedas fictícias.
- **Bônus diário:** ao entrar, ganha o bônus do dia, que cresce com a sequência de dias seguidos.
- **Tempo online:** com o site aberto, ganha moedas aos poucos.
- **Onde ver:** saldo e sequência ficam no menu, e o extrato fica no Perfil.

Esta fase é a **base** do cassino, da loja e dos prêmios. Só ela cria a função que mexe no saldo.

## Antes de começar
Siga as "Regras de toda sessão" de `planejamento/PLANO.md`, principalmente a 5 e a 6. Leia:
- `supabase/sql/seguranca.sql`: o padrão de `limitar()`, os gatilhos, os `revoke` e a conferência do fim;
- `supabase/sql/contas-e-ao-vivo.sql`: `eh_nanico()`;
- `src/lib/dados.ts` (`enterApp`, `later`), `src/lib/supabase.ts` (`q`, `errMsg`), `src/lib/store.ts`, `src/components/shell/Sidebar.tsx` e `src/features/perfil/PerfilView.tsx`;
- a seção "Moedas" do `PLANO.md`, que tem os números.

## Como fazer

### Banco (seção nova "7) moedas" no `seguranca.sql`)
Todo dia é `(now() at time zone 'America/Sao_Paulo')::date`.

**Tabelas:**
- `carteiras(user_id uuid pk → auth.users, saldo int not null default 200 check (saldo >= 0), criada_em)`;
- `extrato(id bigint identity pk, user_id, valor int not null, motivo text not null, ref text, em timestamptz default now())`, com índice `(user_id, em desc)`.
  - `motivo` aceita só `'inicio' | 'diario' | 'sequencia' | 'online' | 'cassino' | 'bingo' | 'truco' | 'aposta' | 'loja' | 'admin'`, com check.
- `bonus_diario(user_id, dia date, seq int, valor int, primary key(user_id, dia))`. A chave impede pegar o bônus duas vezes.
- `online_diario(user_id, dia date, minutos int default 0, ultimo_pulso timestamptz, primary key(user_id, dia))`.

**Permissões (RLS ligado em todas):**
- `carteiras`: `select` para nanicos (o ranking é público no grupo).
- `extrato`, `bonus_diario` e `online_diario`: `select` só da própria linha (`user_id = auth.uid()`).
- Ninguém recebe `insert`/`update`/`delete`.

**Funções:**
- `public.creditar(p_user uuid, p_valor int, p_motivo text, p_ref text)`:
  - **interna**: `revoke` de public, anon e authenticated;
  - cria a carteira se não existir, com um extrato `'inicio'` de +200;
  - faz `select … for update`;
  - falha com "Saldo insuficiente" se o saldo ficaria negativo;
  - grava o extrato e devolve o saldo novo.
  - É a **única** coisa que muda saldo, e as fases seguintes a usam.
- `public.bater_ponto()` (RPC para authenticated):
  - exige `eh_nanico()`;
  - se já existe `bonus_diario` hoje, devolve o estado sem pagar nada;
  - senão: `seq` = seq de ontem + 1 (ou 1); `valor = round(30 * least(1 + 0.1*(seq-1), 2))`; grava a linha; `creditar(valor,'diario')`;
  - se `seq` = 7 ou 30, credita +100 ou +500 com o motivo `'sequencia'`;
  - devolve `jsonb {saldo, seq, ganhou, bonus_extra, minutos_hoje}`.
- `public.pulso()` (RPC):
  - exige `eh_nanico()` e limite `limitar('pulso', 3, '1 minute', …)`;
  - na linha `online_diario` de hoje: se `ultimo_pulso` foi entre 50 s e 150 s atrás, `minutos += 1`; em qualquer caso, `ultimo_pulso = now()`;
  - quando `minutos` cruza um múltiplo de 6 e o total do dia ainda é ≤ 240 (40 moedas), `creditar(1,'online')`;
  - devolve `{saldo, minutos_hoje}`.
- `public.minha_carteira()`: devolve saldo, seq atual (0 se quebrou), se já pegou hoje e os minutos de hoje.

**Fechamento do SQL:** acrescente as funções na conferência do fim e teste rodando o arquivo duas vezes.

### Regra pura `src/lib/moedas.ts` + `moedas.test.ts`
- **Constantes** espelhando o SQL: `BONUS_BASE = 30`, `MULT_MAX = 2`, `MIN_POR_MOEDA = 6`, `TETO_ONLINE = 40`.
- **Funções:** `multiplicador(seq)`, `bonusDoDia(seq)`, `formatarMoedas(n)` (`1.240`).
- Servem só para **mostrar** na tela; quem decide é o banco.
- O teste confere os números da tabela do PLANO: dia 1 = 30, dia 11 = 60, dia 12 = 60.

### Site
- **Módulo `src/lib/carteira.ts`** com uma store Zustand própria (`useCarteira`):
  - `baterPonto()` chamado uma vez em `enterApp()`, mostrando `toast("+45 moedas: 6 dias seguidos")` se ganhou;
  - `pulso()` a cada 60 s **só com `!document.hidden`**, parando ao esconder a aba e voltando ao mostrar;
  - recarrega o saldo depois de cada RPC.
- **Se o SQL ainda não rodou** (a função não existe): esconda tudo, sem erro no console além de um aviso. Siga o padrão do `phrasesV2`/`opggOk`.
- **Menu (`Sidebar`):** um chip compacto com o saldo e a sequência ("12 dias"), com `aria-label` completo. No menu recolhido, só o número.
- **Perfil:** um bloco "Moedas" com saldo, sequência, o bônus de amanhã, os minutos de hoje (x/240) e o extrato das últimas 30 linhas.
- **CSS:** arquivo novo `src/styles/22-moedas.css` (ou o próximo número livre), importado no fim do `layout.tsx`.

## Não faça
- Não dê `grant insert/update` em nenhuma tabela de moedas.
- Não calcule bônus no navegador para gravar.
- Não guarde saldo no `localStorage`.
- Não use `random()` (esta fase não tem sorteio).

## Pronto quando
- [ ] O SQL roda duas vezes seguidas sem erro, e um `update carteiras` pelo cliente falha.
- [ ] Chamar `bater_ponto()` duas vezes no mesmo dia paga uma vez só.
- [ ] Simulando ontem (pelo SQL Editor), a sequência sobe e o valor bate com o PLANO.
- [ ] Pulsos a cada 10 s não aceleram nada, e 5 min parado não contam.
- [ ] Os testes passam e o `CLAUDE.md` (tabelas e funções) e o `CHANGELOG` foram atualizados.

## Entrada do CHANGELOG
`"Moedas: bônus todo dia que você entra, maior a cada dia seguido, e moedas pelo tempo com o site aberto"`
