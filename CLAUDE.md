# Bingo dos Nanicos

Site privado de um grupo de amigos que joga League of Legends. Tem:

- bingo de "nanicadas" (frases e manias do grupo);
- transmissão de tela, câmera, chat, reações e desenho na live;
- partida ao vivo pela API da Riot;
- truco gaudério.

Quem usa são os 14 nanicos, cada um com o seu login.

Este arquivo vale para qualquer pessoa ou IA (Claude, Copilot etc.) que mexa no projeto. **Leia tudo antes de mudar qualquer coisa.** Quem mudar a estrutura do projeto atualiza este arquivo no mesmo commit.

> **v2 (nov/2026):** o site saiu de um `index.html` único para **Next.js + React + TypeScript**. O arquivo antigo está em `legacy/index.html` só como referência, para conferir se algo se comporta igual. Não edite o legacy; depois que o grupo validar o site novo, a pasta pode ser apagada (o histórico fica no git).

---

## 1. Stack e comandos

| Peça | Escolha | Por quê |
|---|---|---|
| Framework | **Next.js 16** (App Router), `output: "export"` | Gera um site estático em `out/`. Não tem servidor: tudo roda no navegador, como antes. |
| UI | **React 19** + **TypeScript** (`strict`) | Componentes por aba, tipos para os dados do banco e da sala. |
| Estado | **Zustand** (`src/lib/store.ts`) | Um estado global que o React lê e que o WebRTC, a sala e o truco mudam de fora do React. |
| Banco, login, tempo real | **Supabase** (`@supabase/supabase-js` **2.45.4**, fixo) | O mesmo de antes. |
| Estilo | **CSS global** em `src/styles/` | O CSS do site antigo, dividido por área, sem Tailwind. |
| Fontes | `next/font/google` (Unbounded e Onest) | Servidas pelo próprio site. |
| Testes | **Vitest** | Regras puras (truco, bingo). |

```bash
npm install          # primeira vez
npm run dev          # http://localhost:8810 (a função da Riot só aceita 8810/8811)
npm run check        # typecheck + lint + testes + build: rode antes de todo commit
npm run build        # gera out/
npm start            # serve out/ localmente para testar o build
```

- **Node 20 ou mais novo.**
- **Vercel:** o `vercel.json` diz `"framework": "nextjs"`. A cada push na branch principal, a Vercel roda `npm run build` e publica. Cada Pull Request ganha uma preview.

---

## 2. Onde fica cada coisa

```
src/
  app/                 layout.tsx (fontes, CSS na ordem certa), page.tsx (monta o App só no navegador), ícones
  components/
    App.tsx            casca do site: barra lateral, as 7 abas (sempre montadas, só escondidas), portas, toast
    shell/             Sidebar (marca, navegação, rodapé) e People ("Na sala agora")
    portas/            login, primeira senha, trocar senha, log de versões
    ui/                Avatar, FriendPicker, Toast, ícones, useSure (segundo toque)
    Fome.tsx           easter egg das 18h às 22h
  features/            uma pasta por aba / assunto
    hall/              aba Sítio (tela inicial): hall.ts (grade, móveis, caminho, ordem de desenho; puro e
                       testado), bonecos.ts (movimento, evento `hall`, presença), Sala.tsx (o cômodo em SVG,
                       um móvel por camada), Boneco.tsx, HallView
    jogar/             JogarView (escalação, cartela, montar cartela), MiniCartela (painel do Ao vivo e
                       cartela flutuante), riot.ts (consulta a função riot-ao-vivo), partida.ts (lanes, puro),
                       RiotBox, CellTag
    nanicadas/         NanicadasView: cadastro, edição, filtros e lista
    nanicos/           NanicosView: os 14 nanicos com a arte de corpo inteiro
    perfil/            PerfilView e opgg.ts (limpar link, nick)
    live/              live.ts (liga tudo à sala), rtc.ts (WebRTC comum), tela.ts (transmissão), camera.ts,
                       reacoes.ts, desenho.ts, estado.ts (store + preferências), pip.ts;
                       telas: LiveView, Palco, Painel, Cameras, Video, Voos, Rosto, CamNaSala, CamBotoes
    chat/              chat.ts (carregar, receber, enviar) e ChatPainel
    truco/             engine.ts (regras, puro e testado), valida.ts (confere mesa vinda da sala),
                       mesa.ts (mesa online: o navegador do anfitrião manda), TrucoView, Lobby, MesaTela, Carta
  lib/
    config.ts          URL e chave pública do Supabase
    supabase.ts        cliente (sb()), q(), errMsg()
    store.ts           estado global (useApp, setApp, getApp, friendOf…)
    sala.ts            canal em tempo real: presença, broadcast, mudanças no banco
    dados.ts           carregar e gravar no banco, login → sessão → sala, sair
    bingo.ts           regras da cartela (quais nanicadas valem, sorteio, marcar)
    toast.ts           toast("texto")
    util.ts            norm, canon, shuffle, local (localStorage), rolarAte…
    tipos.ts           Friend, Phrase, Card, Presence…
    dados/             campeoes.ts (CHAMPS, LANES, LANE_CAMP), nanicos.ts (NAN_MAP, artOf, bonecoOf), changelog.ts
  styles/              CSS global, numerado: 01-base.css … 22-hall.css
public/arte/           artes dos nanicos (rosto e corpo), bonecos do hall, foto da turma, reações dos Picarétezzi
planejamento/          PLANO.md (próximas fases e decisões), prompts/ (um por fase), demos e arte pronta
supabase/
  functions/riot-ao-vivo/index.ts   Edge Function (Deno). Fora do build do Next.
  sql/                 seguranca.sql, contas-e-ao-vivo.sql, supabase.sql e antigos/
legacy/                site antigo (index.html) e o passo a passo antigo (LEIA-ME.md)
vercel.json            cabeçalhos de segurança (CSP etc.) e framework
```

### Nunca suba para o GitHub
- `criar-logins.sql`, que tem as senhas iniciais dos nanicos. Se ele aparecer no repositório, apague e troque as senhas.
- Qualquer chave **secret** ou **service_role** do Supabase, a chave da Riot (`RGAPI-...`) ou arquivos `.env`.
- No código só pode existir a **publishable key** do Supabase (`src/lib/config.ts`), que é pública por natureza.

---

## 3. Regras que não podem ser quebradas

1. **Segurança vem do banco, não do site.** Toda permissão é garantida por RLS, `GRANT` por coluna e gatilhos no Postgres. Nunca "proteja" algo só escondendo um botão.
2. **Todo SQL novo tem que poder rodar de novo:**
   - use `create ... if not exists`, `create or replace` e `drop policy if exists`;
   - acrescente no `supabase/sql/seguranca.sql` em vez de criar arquivos soltos;
   - teste antes num projeto de teste ou num Postgres local.
3. **Texto de usuário nunca vira HTML.** O React já escapa tudo que vai entre `{}`. **Não use `dangerouslySetInnerHTML`** com nada que venha de usuário, da sala, do banco ou da Riot. Precisa de negrito numa mensagem? Escreva em JSX (`<b>`).
4. **Mensagens da sala (broadcast) não são confiáveis.** Todo handler registrado com `aoReceber()`:
   - confere o tipo e o tamanho de cada campo;
   - confere se o remetente está na sala (`estaNaSala(m.from)`);
   - tem limite de mensagens por pessoa (`limitePorPessoa(max, janelaMs)`).
5. **Não quebrar a CSP** (`vercel.json`). Script só do próprio site, conexões só com o Supabase do projeto. Imagem externa só de `ddragon.leagueoflegends.com` e `raw.communitydragon.org`. Para liberar outro domínio, edite o `vercel.json` e explique o motivo no commit. Teste o build (`npm run build && npm start`) com o console aberto.
6. **Não trocar a versão do `@supabase/supabase-js`** (fixa em 2.45.4 no `package.json`) sem testar login, sala, chat, transmissão e truco.
7. **Não deixar dados reais em teste.** Não use senhas reais em exemplos, prints ou issues.
8. **Dependência nova só com motivo.** Antes de `npm install` de algo, veja se dá para resolver com o que já existe. Nada de CDN, fonte nova ou biblioteca de componentes.

---

## 4. Padrão do código

### Organização
- **Uma pasta por assunto em `src/features/`.** A aba é um componente `XxxView({ hidden })` que devolve a `<section id="view-…" className="inner" hidden={hidden}>`. As abas ficam sempre montadas (a live e o truco não podem morrer ao trocar de aba).
- **Regra pura separada da tela.** Cálculo (truco, bingo, lanes da Riot) fica em `.ts` sem React, com teste em `*.test.ts` ao lado. A tela só chama.
- **Lógica imperativa (WebRTC, canvas, mesa do anfitrião) fica em módulos `.ts`** com estado próprio, e avisa o React mudando o `useApp` (ou uma store Zustand do próprio módulo). Componente não guarda `RTCPeerConnection` em `useState`.
- **Nada roda no servidor.** `page.tsx` monta o `App` com `ssr: false`; dá para usar `window`, `localStorage` e `navigator` direto nos componentes.

### Estado
- `useApp(s => s.campo)` dentro de componente (assine só o que usa). `getApp()` / `setApp({...})` fora do React.
- Dados do banco (`friends`, `phrases`, `lineup`) só mudam por `src/lib/dados.ts`. A escalação se salva com `salvarEscalacao(lineup)`.
- A cartela muda por `src/lib/bingo.ts` (`novaCartela`, `toggleCell`, `limparMarcacoes`).
- A presença (`trackMe`) acompanha sozinha `card`, `myLiveSid`, `myCamSid` e `hallPos`: basta mudar o estado.

### Sala em tempo real (`src/lib/sala.ts`)
- **Mandar:** `enviar("truco", {...})`. O `from` é acrescentado sozinho.
- **Receber:** `aoReceber("truco", m => …)`. Evento novo vai na lista `EVENTOS` e segue a regra 4.
- **Outros ganchos:** `aoMudarPresenca`, `aoConectar` e `aoMudarTabela`.

### Nomes e idioma
- **Código em português, como o grupo fala:** nanicadas, nanicos, escalação, mão, vaza, mesa, anfitrião. Variáveis curtas são ok (`M`, `h`, `op`) dentro de regra de jogo, desde que comentadas.
- **Comentários em português** explicando o *porquê*, curtos, no estilo dos que já existem.
- **Componentes em PascalCase** (`MiniCartela`) e funções em camelCase (`toggleCell`). Os ids e classes do CSS antigo continuam iguais (`#stage`, `.tr-feltro`, `.cell.on`).

### Componentes que já existem (reaproveite, não recrie)
- **Botões:** `.btn` (principal, ouro), `.btn.soft` (secundário), `.btn.sm` e `.linkish` (link discreto).
- **Seleção:** `.seg` com `role="radio"`, para escolhas tipo "1080p / 1440p".
- **Blocos e etiquetas:** `.block` (cartão de seção), `.hint` e `.status` (texto apagado), `.live-pill` (AO VIVO).
- **Rosto:** `<Avatar f={friend} size="xs" | "lg" />`.
- **Seletor de nanico:** `<FriendPicker value onChange emptyLabel ariaLabel />` ou com `multi values`.
- **Aviso rápido:** `toast("texto")`.
- **Confirmação:** ação destrutiva pede **segundo toque** com `useSure()` (classe `.sure`, texto "Confirmar"). Nunca `confirm()` ou `alert()`.
- **Ícones:** `src/components/ui/icones.tsx`.
- **Navegador:** `local.get/set/json/setJson` (com try/catch) e `rolarAte(el)` (respeita menos movimento).

---

## 5. Padrão visual

### Cores (variáveis em `src/styles/01-base.css`, com versão escura em `prefers-color-scheme` e `[data-theme]`)
| Nome | Hex | Uso |
|---|---|---|
| Oliva | `#4A4E44` | aba ativa, pano do truco (`--olive`) |
| Ouro | `#B08D57` | destaque, botões principais, "você" (`--accent`) |
| Off-white | `#FAF9F6` | fundo claro (`--bg`) |
| Carvão | `#353535` | texto (`--ink`) |
| Ardósia | `#3E4C59` | carimbo da cartela (`--mint`) |
| Vermelho | `#B4442F` / escuro `#E0705A` | AO VIVO, alertas, Truco! (`--live`) |

- **Sempre** use as variáveis (`var(--accent)` etc.), nunca hex solto, para o tema claro e escuro continuarem funcionando.
- Novas cores só se entrarem na paleta acima.
- **Exceção: o cômodo do hall** (`22-hall.css`). Ele é uma ilustração com cores próprias (tijolo, madeira, lajota), definidas como variáveis `--hall-*` em `.hall`, cada uma com uma versão mais escura no tema escuro. O SVG usa as classes `f-<nome>` (preenchimento) e `s-<nome>` (traço). A interface em volta (placas com nome, TV, botões) continua com a paleta acima.

### Tipografia
- **Unbounded** (`var(--display)`) só em títulos, placar, números e etiquetas curtas.
- **Onest** (`var(--body)`) em todo o resto.
- Não adicionar outras fontes.

### CSS
- **Ordem:** os arquivos de `src/styles/` são importados em ordem no `src/app/layout.tsx`. Regra de baixo sobrescreve a de cima, então não reordene à toa.
- **Onde pôr:** CSS novo de uma área vai no arquivo daquela área; área nova ganha um arquivo novo numerado no fim.
- **Nada de `style={{}}` novo** para cor ou espaçamento fixo. Use só para valor calculado (posição, `--rot`, `--h`). Alguns estilos inline vieram do site antigo (margens e `width:100%` em botões). Quem mexer naquele trecho passa o estilo para uma classe no CSS da área.

### Princípios
- **Limpo:** só aparece o que está disponível agora. Botão de função desligada ou sem uso fica escondido.
- **Explicações:** texto de ajuda longo vai em `<details>` ("Como mandar o som do jogo"), não solto na tela.
- **Celular:** tudo tem que funcionar a partir de 390 px de largura, **sem rolagem para o lado**.
- **Acessibilidade:** foco visível no teclado, `aria-label` em botão só com ícone e respeito a `prefers-reduced-motion`.
- **Movimento:** só para dar retorno (carta caindo, emoji subindo). Nada de animação decorativa espalhada.

### Textos
- **Idioma:** português do Brasil, frases curtas e voz ativa. O botão diz o que faz ("Abrir mesa", "Salvar", "Transmitir minha tela").
- **Nanicadas:** sempre em **minúsculas**. O banco obriga, com o gatilho `nanicada_protecao`.
- **Erros:** dizem o que fazer ("Libere a câmera no cadeado ao lado do endereço"). Não pedem desculpa.

---

## 6. Modelos de dados

### Supabase (schema `public`)
| Tabela | O que guarda | Quem pode mexer pelo site |
|---|---|---|
| `friends` | os 14 nanicos (`name`, `user_id`, `username`, `opgg`) | cada um só o próprio `opgg` |
| `phrases` | nanicadas (`text`, `friend_ids uuid[]`, `champions text[]`, `modo 'qualquer'\|'todos'`) | criar, editar e remover (com limite e histórico) |
| `nanicadas_historico` | cópia de toda nanicada editada ou removida | ninguém pelo site (só o admin) |
| `game` | escalação compartilhada (`players` = 5 rotas `{friendId, champion}`) | atualizar (formato conferido) |
| `chat_messages` | chat da live (apaga sozinho após 30 dias) | enviar (o autor é sempre quem está logado) |
| `limites` | contador anti-spam | ninguém |
| `riot_contas`, `riot_ao_vivo`, `riot_meta` | cache da API da Riot | só a Edge Function |

- **Quem é nanico:** `public.eh_nanico()` diz se o usuário logado está ligado a um nanico.
- **Gatilhos:** `chat_protecao`, `nanicada_protecao`, `nanicada_remocao`, `escalacao_protecao` e `perfil_protecao`.
- **Logins:** são criados só pelo admin, com `criar_login_nanico(nome, usuario, senha)` e `resetar_senha_nanico(usuario, senha)`. O e-mail interno é `usuario@nanicos.app`.
- **SQL que ainda não rodou:** o site segue funcionando. `phrasesV2` e `opggOk` no estado dizem se as colunas novas existem.

### Sala em tempo real (canal privado `bingo-dos-nanicos`)
- **Presença:** `{name, fid, lines, live, cam, pos, at}`, conferida por `cleanPresence()`. `pos` é o piso do boneco no hall (`{i, j}`, conferido por `posValida`); só muda quando o boneco chega.
- **Eventos de broadcast:**
  - `rtc`: sinalização da tela e da câmera;
  - `reacao`: emojis e fotos;
  - `risco`: desenho na live;
  - `truco`: mesas, jogadas e mão de cada um;
  - `hall`: `{ para: {i, j} }`, o destino do boneco. Cada navegador calcula o caminho e anima sozinho (limite de 8 a cada 2 s).
- **Mudanças no banco:** chegam por `postgres_changes` em `friends`, `phrases`, `game` e `chat_messages`.

### Navegador (`localStorage`, só conveniência de cada pessoa)
- **Chaves:** `rift-lineup`, `rift-card`, `side-min`, `rail-min`, `rail-tab`, `live-fps`, `live-res`, `live-vol`, `desenho`, `reacoes-ver`, `riot-auto`, `riot-visto`, `truco-opt`, `truco-mesa`, `log-visto`, `fome-fechado` e `hall-pos` (último piso no hall).
- **As do site antigo continuam iguais**, então ninguém perde a cartela na troca.
- Nada importante pode morar só aqui.

### Arte (`public/arte/`)
- **`nanicos/{n}-rosto.webp` e `{n}-corpo.webp`:** o número vem de `NAN_MAP` (nome do nanico → número). Os nomes são Abreutz, Alemão, DD, Gamer, Grito, Guiperino, Le Bubu, Henry, Pitoco, John, Veião, Max, Gordão e Pin.
- **Tamanhos:** o rosto tem 160×160 e o corpo, 440 px de altura. Use `artOf(friend)`.
- **`bonecos/*.webp`:** uma spritesheet por nanico para o hall (células de 84×134, linhas `frente`/`costas`, colunas `parado` + 4 de andar; os lados esquerdos são o espelho). O formato está em `bonecos/bonecos.json`. Use `bonecoOf(friend)`; quem não tem boneco aparece com o rosto num pino.
- **`turma.webp`:** foto da turma. **`marca.png`:** bola de bingo. **`reacoes/`:** os Picarétezzi.

---

## 7. Versão e Log (obrigatório a cada mudança visível)

A versão (`v1.NN`) é **calculada sozinha** pelo tamanho do array `CHANGELOG` em `src/lib/dados/changelog.ts`. Toda mudança que um nanico consiga notar acrescenta **uma entrada no fim**:

```ts
{ data: "DD/MM/AAAA", itens: ["Frase curta dizendo o que mudou para quem usa"] },
```

- Escreva só funcionalidades, sem termos técnicos.
- Quando uma função deixar de existir ou for substituída, **não apague** o item antigo. Troque por:
  `{ t: "texto antigo", off: "trocado por … na v1.NN" }`. Ele aparece riscado no Log.

---

## 8. Como trabalhar

1. Crie uma **branch** (`git checkout -b minha-mudanca`). Não faça commit direto na principal sem combinar com o Felippe.
2. Faça a mudança **pequena e focada**. Não reformate arquivos que você não mudou.
3. Antes do commit, confira:
   - [ ] `npm run check` passa (typecheck, lint, testes e build);
   - [ ] o site abre, faz login e mostra "Sincronizado" (teste numa preview da Vercel ou no `npm run dev`);
   - [ ] nada quebrou no celular, com largura de 390 px;
   - [ ] o console do navegador está sem erros e sem bloqueio de CSP;
   - [ ] a entrada nova está no `CHANGELOG`;
   - [ ] se mexeu no banco: o SQL roda duas vezes seguidas sem erro, e as permissões continuam fechadas.
4. Commit com mensagem em português dizendo **o quê** e **por quê** (ex.: `Truco: botão de ir ao mazo pede confirmação`).
5. Abra um Pull Request e espere outra pessoa olhar antes de juntar.

### Mudanças no Supabase
- **Nunca** apague tabelas nem dados pelo Table Editor sem avisar o grupo.
- **SQL:** primeiro no arquivo do repositório (`supabase/sql/`), depois no SQL Editor. Nada de mudança "só no painel".
- **Edge Function `riot-ao-vivo`:** se mexer nela, publique de novo e confira se a aba Jogar ainda mostra "EM PARTIDA".
- **Origens:** a função só aceita chamadas das origens listadas em `ORIGENS`, que incluem a Vercel e `localhost:8810/8811`.
- **Chave da Riot:** fica em **Edge Functions → Secrets → `RIOT_API_KEY`**. Não copie para lugar nenhum.

### Pendências conhecidas
- **Validar a v2 com o grupo:** login, sala, live, câmera, chat, truco entre duas abas, Riot. Depois disso, apagar `legacy/`.
- **Truco:** a mão de cada jogador vai para a sala inteira, filtrada só pelo campo `to`. Quem abrir o devtools vê as cartas dos outros. Isso já era assim no site antigo; resolver exige mensagem direta (não existe no `sala.ts` hoje).
- **`dados.ts` ↔ `features/jogar/riot.ts`:** um importa o outro. Funciona porque nenhum usa o outro ao carregar. Não chame nada do outro módulo no topo do arquivo.

### Para quem usa IA no projeto
- **Antes de editar:** leia o arquivo que vai mudar e este CLAUDE.md. Não reescreva arquivos inteiros "do zero" para mudar um pedaço.
- **Reaproveite:** use o que já existe (`Avatar`, `FriendPicker`, `toast`, `useSure`, `friendOf`, `enviar`/`aoReceber`, `trOpcoes` etc.) em vez de criar outro parecido.
- **Não invente:** nada de dependências, CDNs ou fontes novas sem motivo forte (regra 8).
- **Para conferir comportamento:** o site antigo está em `legacy/index.html` (as artes em base64 deixam o arquivo enorme; procure pelo nome da função).
- **Mexeu na estrutura** (pasta nova, padrão novo, comando novo)? Atualize este arquivo.
- **Dúvida sobre regra do grupo** (nomes, regras do truco, o que é nanicada): pergunte ao Felippe.
