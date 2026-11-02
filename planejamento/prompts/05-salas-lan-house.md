# Fase 5: Salas tipo lan house, lobby e chat geral

**Branch:** `salas-lan-house` · **Depende de:** fase 3 (horas e links na ficha) · **Banco:** sim · **É a maior mudança do plano**

## Objetivo (para quem usa)
A call do Discord se dividiu? Cada grupo entra numa **sala** do site.
- **Lobby (a tela inicial nova):**
  - cartões das salas fixas, por enquanto **LoL 1, LoL 2, CS e Resenha**;
  - cada cartão mostra quem está ali (rosto), quem está **ao vivo** e quem está **em partida**;
  - ao passar o mouse ou tocar num rosto, aparecem as horas daquele jogo (dado da fase 3) e os links do op.gg e da Steam;
  - o **chat geral** fica no lobby.
- **Dentro de uma sala:**
  - live, câmeras, reações, desenho e **chat da sala** são só de quem está nela;
  - as salas de LoL têm escalação e bingo; a de CS e a Resenha não.
- **Comuns a todos, fora das salas:** truco e, depois, o cassino.
- **Voz:** não tem voz no site, ela continua no Discord. No máximo, cada sala mostra o nome do canal combinado.

## Antes de começar
Siga as "Regras de toda sessão" de `planejamento/PLANO.md`. **Esta fase é grande: entre em modo plano (EnterPlanMode), mostre o desenho e espere o ok.** Leia inteiros:
- `src/lib/sala.ts`: canal único `CANAL_SALA`, presença, `EVENTOS`, `postgres_changes`;
- `src/lib/config.ts`, `src/lib/store.ts`, `src/lib/tipos.ts` (`Presence`, `Aba`) e `src/lib/dados.ts` (`enterApp`, `joinRoom`);
- `src/components/App.tsx`, `src/components/shell/Sidebar.tsx` e `src/components/shell/People.tsx`;
- `src/features/live/*` (como a live e as câmeras usam a presença e `rtc`), `src/features/chat/*`, `src/features/truco/mesa.ts` e `src/features/jogar/*`;
- `supabase/sql/contas-e-ao-vivo.sql`: as políticas de `realtime.messages` com `realtime.topic() = 'bingo-dos-nanicos'`.

## Desenho proposto (confirme no plano)

### Canais
- **Lobby, canal `bingo-dos-nanicos` (o mesmo nome de hoje):**
  - **presença global** com um campo novo, `sala: string | null`, conferido em `cleanPresence` contra a lista de salas;
  - nele também ficam o evento `truco` e as mudanças do banco.
- **Canal por sala, `sala:<id>`:** broadcast de `rtc`, `reacao` e `risco`, e a presença de quem está dentro (com `live` e `cam`).
- **Trocar de sala:**
  - sai do canal da sala antiga, encerrando tela e câmera com o que já existe em `live`;
  - entra no novo;
  - atualiza `sala` na presença do lobby.
- Uma pessoa está em uma sala por vez. "Lobby" = `sala: null`.

### Banco (seção "10) salas" no `seguranca.sql`)
- **Tabela `salas(id text pk check (id ~ '^[a-z0-9-]{2,20}$'), nome text, jogo text check in ('lol','cs','outro'), discord text null, ordem int)`:**
  - nanicos leem e só o admin escreve;
  - semente idempotente: `lol-1`, `lol-2`, `cs` e `resenha`, com `on conflict do nothing`.
- **Políticas de `realtime.messages`:** `drop`/`create` aceitando `topic = 'bingo-dos-nanicos'` **ou** `topic like 'sala:%'` com a sala existindo em `salas`, sempre com `eh_nanico()`.
- **Chat:**
  - `chat_messages` ganha `sala text not null default 'geral'`, com check "`'geral'` ou id existente";
  - `grant insert (text, sala)`;
  - o `chat_protecao` continua igual.
- **Escalação por sala de LoL:**
  - hoje `game` tem `id int = 1`. Proponha no plano a forma menos arriscada, por exemplo uma coluna `sala text unique` com a linha 1 virando `lol-1` e uma linha nova por sala de LoL;
  - a política e o `escalacao_protecao` passam a valer por sala.
- **Conferência:** atualize a consulta do fim do arquivo.

### Site
- **Estado:**
  - `store.ts` ganha `salas`, `minhaSala: string | null` e `onlineSala` (presença do canal da sala);
  - `Aba` ganha `"lobby"`, que vira a aba inicial;
  - a última sala fica em `local` (`sala-atual`), mas o site sempre abre no lobby.
- **`sala.ts`:**
  - separe "lobby" e "sala atual";
  - `enviar`/`aoReceber` de `rtc`, `reacao` e `risco` passam pelo canal da sala;
  - `truco` continua no lobby;
  - mantenha as conferências da regra 4 (`estaNaSala` passa a olhar a presença do canal certo).
- **`features/lobby/LobbyView.tsx` (nova):** a grade de cartões de sala (cada um como uma "máquina", no visual do `.block`), o chat geral ao lado no desktop e embaixo no celular, e o botão "Entrar na sala".
- **Menu:**
  - "Na sala agora" mostra quem está na **minha** sala;
  - em cima fica "Você está em: LoL 1 · Trocar".
  - Aproveite para simplificar: no celular, a navegação vira uma barra embaixo.
  - É a parte "mudar UI/UX" do plano; mostre a ideia no plano antes.
- **Abas que dependem do jogo:** Jogar (escalação e bingo) só aparece em sala de LoL. A live e as câmeras ficam "dentro da sala"; no lobby, mostram um convite "Entre numa sala para transmitir".
- **Chat:** carrega por `sala` (`'geral'` no lobby, o id na sala), e a contagem de não lidas é separada.

## Não faça
- Não crie salas pelo site (por enquanto só o admin cria).
- Não ponha voz nem microfone.
- Não mude o truco de lugar além do necessário para continuar funcionando no lobby.
- Não quebre quem ainda está com a versão antiga aberta: o canal antigo continua aceito.

## Pronto quando
- [ ] Duas pessoas em salas diferentes transmitem e uma não vê a live, as reações nem o desenho da outra. No lobby, as duas aparecem nos cartões certos.
- [ ] O chat geral e o chat da sala não se misturam, e o banco recusa uma `sala` que não existe.
- [ ] A escalação da LoL 1 não muda a da LoL 2.
- [ ] O truco continua funcionando entre pessoas de salas diferentes.
- [ ] Mensagem de broadcast forjada para `sala:xyz` inexistente é recusada pelo banco.
- [ ] Com 390 px: lobby, sala e barra de navegação sem rolagem para o lado.
- [ ] O `CLAUDE.md` foi atualizado (seção "Sala em tempo real", tabelas, chave `sala-atual`, pasta `lobby/`) e o `CHANGELOG` também.

## Entrada do CHANGELOG
`"Salas tipo lan house: LoL 1, LoL 2, CS e Resenha, cada uma com live, câmeras e chat próprios"`, `"Lobby com quem está em cada sala e chat geral"`
