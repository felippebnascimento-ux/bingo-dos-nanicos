# Fase 27 (correção, urgente): um boneco por nanico e quem entra sempre aparece

**Branch:** `hall-um-por-nanico` · **Depende de:** fase 00 (hall) · **Banco:** não · **Faça antes das outras fases que mexem no hall**

## O que está errado (relatado pelo grupo em 02/11/2026)
1. **Dois Pitocos no hall:** às vezes o mesmo nanico aparece duas vezes.
2. **Quem acabou de entrar não aparece:** às vezes alguém loga e não aparece no hall de quem já estava lá.

## Causa provável (confira antes de mudar)
- **Duplicado:**
  - a presença usa como chave o `MY_KEY` (`src/lib/store.ts`), que é **um por aba e muda a cada recarga**;
  - o `sincronizar()` de `src/features/hall/bonecos.ts` cria **um boneco por chave**;
  - por isso o mesmo nanico vira dois bonecos quando:
    - tem o site aberto em duas abas ou em dois aparelhos (PC e celular);
    - recarrega a página e a presença antiga ainda não expirou no Supabase.
  - O "Na sala agora" (`People.tsx`) tem o mesmo problema.
- **Quem não aparece:**
  - quando a aba fica em segundo plano, o navegador segura os timers e o socket do tempo real pode cair (`TIMED_OUT`/`CLOSED`/`CHANNEL_ERROR`);
  - hoje o `joinRoom` (`src/lib/sala.ts`) só mostra "Sem atualização ao vivo. Recarregue a página." e **não reconecta**;
  - a presença dessa pessoa fica congelada, e ela não vê quem entrou depois.
  - Confira também o corte `.slice(0, 40)` na lista: com várias chaves velhas do mesmo nanico, ele pode descartar gente nova.

**Antes de corrigir, reproduza os dois casos** (duas abas do mesmo login; uma aba minimizada por 5 minutos enquanto outra pessoa entra) e anote no PR o que viu.

## Como fazer

### 1) Regra pura: um por nanico (`src/lib/presenca.ts` + teste)
- **`umPorNanico(online: Presence[], minhaChave): Presence[]`:**
  - agrupa por `fid` (sem `fid`, pelo nome);
  - fica com a presença de `at` mais recente;
  - mantém `live` e `cam` de **qualquer** aba daquele nanico que esteja transmitindo, para não sumir a tela de quem transmite numa aba e anda na outra;
  - devolve também `chaves: string[]` (todas as chaves daquele nanico).
- **As minhas outras abas** (mesmo `fid` que eu) **não** viram outro boneco: entram no meu.
- **Testes:**
  - duas chaves do mesmo nanico viram um;
  - fica com o `at` mais novo;
  - mantém o `live` da aba que transmite;
  - sem `fid`, agrupa pelo nome.

### 2) Usar em todo lugar que lista gente
- **`bonecos.ts`:**
  - `sincronizar()` usa `umPorNanico`, e o boneco passa a ter a chave `n:<fid>`;
  - o `onHall` acha o boneco pela chave de quem mandou, olhando a lista `chaves`, para o broadcast de qualquer aba daquele nanico mover o mesmo boneco;
  - o meu boneco continua sendo o `MY_KEY`.
- **`People.tsx`** e o `Cantos.tsx` da fase 14 (se já existir): a mesma lista, sem duplicados.
- **`estaNaSala(key)`** continua aceitando qualquer chave viva (a regra 4 não muda).
- **`.slice(0, 40)`:** aplique **depois** de agrupar, e suba para 60 chaves cruas antes de agrupar.

### 3) Reconectar sozinho (`src/lib/sala.ts`)
- **No `subscribe`,** em `CHANNEL_ERROR`, `TIMED_OUT` ou `CLOSED` (que não tenha vindo de um `sair()`):
  - mostra "Reconectando…";
  - remove o canal (`sb().removeChannel`) e chama `joinRoom` de novo, com espera crescente (1 s, 2 s, 5 s, 10 s, e no máximo 30 s).
  - Os handlers registrados com `aoReceber`/`aoMudarPresenca`/`aoMudarTabela` **continuam valendo** no canal novo; confira que não ficam registrados em dobro.
- **`visibilitychange`:** quando a aba volta a ficar visível e o canal não está `joined`, reconecta na hora. Se estiver `joined`, chama `trackMe()` para renovar a presença.
- **Tempo real em segundo plano:** veja se o `@supabase/supabase-js` 2.45.4 (o realtime-js que vem com ele) aceita a opção `worker: true` ou `heartbeatIntervalMs` no `createClient` (`src/lib/supabase.ts`). Se aceitar, ligue para o heartbeat não parar com a aba escondida. **Não troque a versão da biblioteca** (regra 6).
- **A presença se renova sozinha:** um `trackMe()` a cada 60 s, com o `at` novo, para o "mais recente" do item 1 funcionar.

## Não faça
- Não mude a chave da presença para o `fid`: duas abas do mesmo nanico brigariam pela mesma chave, e a live de uma derrubaria a da outra.
- Não esconda o duplicado só no desenho: corrija a lista, para o "Na sala agora" e o hall baterem.
- Não troque a versão do `@supabase/supabase-js`.

## Pronto quando
- [ ] O mesmo login em duas abas e no celular aparece **um** boneco e **uma** linha no "Na sala agora". Andar por qualquer uma das abas move o mesmo boneco.
- [ ] Recarregar a página não deixa um boneco fantasma.
- [ ] Com uma aba minimizada por 5 minutos, ao voltar ela mostra quem entrou nesse meio-tempo, sem recarregar.
- [ ] Derrubar a conexão (modo avião por 20 s) mostra "Reconectando…" e volta sozinho para "Sincronizado".
- [ ] Os testes de `presenca.ts` passam e `npm run check` passa. O `CLAUDE.md` (sala: um por nanico, reconexão) e o `CHANGELOG` foram atualizados.

## Entrada do CHANGELOG
`"Sítio: cada nanico aparece uma vez só, e quem entra aparece na hora, mesmo depois de deixar o site em segundo plano"`
