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
    App.tsx            casca do site: barra lateral, as 8 abas (sempre montadas, só escondidas; abre no Início),
                       portas, toast; no Início a barra lateral some (classe `no-inicio` no body)
    shell/             Sidebar (marca, navegação, rodapé; Perfil com o rosto) e People ("Na sala agora";
                       `usePessoasNaSala()` também serve o Sítio, e a lista da barra some na aba Sítio)
    portas/            login, primeira senha, trocar senha, log de versões (modo "tudo" e modo "novidades")
    ui/                Avatar, FriendPicker, Toast, ícones, useSure (segundo toque)
    Fome.tsx           easter egg das 18h às 22h
  features/            uma pasta por aba / assunto
    inicio/            InicioView: tela de início (aba `inicio`, a primeira depois do login): barra de cima, saudação
                       e um cartão por lugar com capa e linha ao vivo (só lê o store, nenhuma consulta nova)
    moedas/            Moedas.tsx: selinho do saldo no menu (CarteiraChip) e quadro do Perfil (MoedasBloco);
                       Ranking.tsx: painel da carteira (abas Ranking e Meu extrato), aberto pela carteira do Sítio e
                       pelo chip do Início (`abrirCarteira`), e `useMinhaPosicao()` ("3º lugar")
    hall/              aba Sítio, sala de 14×11: hall.ts (grade, móveis, CLICAVEIS, caminho, ordem
                       de desenho; puro e testado), bonecos.ts (movimento, evento `hall`, presença), Sala.tsx
                       (cômodo em SVG com janelão e portão, um móvel por camada, destaque do piso), Boneco.tsx
                       (tocar abre a ficha), Cantos.tsx ("Na sala agora", ganhos, carteira, dica), ganhos.ts
                       (ganhos de moedas de todo mundo pelo tempo real das carteiras), HallView
    jogar/             JogarView (escalação, cartela, montar cartela), MiniCartela (painel do Ao vivo e
                       cartela flutuante), riot.ts (consulta a função riot-ao-vivo), partida.ts (lanes, puro),
                       RiotBox, CellTag
    nanicadas/         NanicadasView: cadastro, edição, filtros e lista
    nanicos/           NanicosView: os 14 nanicos com a arte de corpo inteiro (tocar abre a ficha);
                       atributos.ts (os 6 atributos votados, conferir notas, médias; puro e testado)
    ficha/             ficha do nanico: Ficha.tsx (janela), Quarto.tsx (quarto isométrico com o boneco),
                       AtributosFicha.tsx ("Segundo os nanicos": barras e votar), estado.ts (números da função
                       ficha-jogos e atributos), numeros.ts (conferir e escrever; puro e testado), NoSitio.tsx
                       (bloco "No Sítio": dias seguidos, recorde, tempo online; `ChamaNome` ao lado do nome com 3+
                       dias) e presenca.ts (presenca_de e presenca_todos)
    perfil/            PerfilView, opgg.ts e steam.ts (limpar link, nick)
    live/              live.ts (liga tudo à sala), rtc.ts (WebRTC comum), tela.ts (transmissão), camera.ts,
                       reacoes.ts, desenho.ts, estado.ts (store + preferências), pip.ts;
                       telas: LiveView, Palco, Painel, Cameras, Video, Voos, Rosto, CamNaSala, CamBotoes
    chat/              chat.ts (um chat por sala: "geral" no lobby e o id da sala dentro dela) e ChatPainel
    cassino/           aba Cassino (moedas fictícias): regras.ts (roleta, limbo, dado, caça-níquel, conferir() e
                       refazer() com HMAC-SHA256; puro e testado), estado.ts (dados do banco), Jogos.tsx (limbo,
                       maior ou menor e caça-níquel) e CassinoView (seletor de jogo, roleta, conferência, histórico)
    salas/             salas tipo lan house: trocar.ts (entrarSala: encerra tela e câmera, troca o canal,
                       carrega escalação e chat) e Salas.tsx (janela das salas com cartões e chat geral; "Você está em")
    truco/             engine.ts (regras, puro e testado), valida.ts (confere mesa vinda da sala),
                       mesa.ts (mesa online: o navegador do anfitrião manda), TrucoView, Lobby, MesaTela, Carta
  lib/
    config.ts          URL e chave pública do Supabase
    supabase.ts        cliente (sb()), q(), errMsg()
    store.ts           estado global (useApp, setApp, getApp, friendOf…)
    sala.ts            canal em tempo real: presença, broadcast, mudanças no banco
    dados.ts           carregar e gravar no banco, login → sessão → sala, sair
    bingo.ts           regras da cartela (quais nanicadas valem, sorteio, marcar)
    moedas.ts          números das moedas (bônus, sequência, teto), só para mostrar; puro e testado
    carteira.ts        carteira do nanico logado: bater_ponto no login, pulso a cada minuto, extrato; ranking:
                       `carregarRanking()` lê o saldo de todas as carteiras uma vez e o tempo real das carteiras mantém
                       `todas` (e o "▲ subiu" em `subiram`); a ordem vem de `ranking()` em moedas.ts (empate divide a posição)
    toast.ts           toast("texto")
    util.ts            norm, canon, shuffle, local (localStorage), rolarAte…
    tipos.ts           Friend, Phrase, Card, Presence…
    dados/             campeoes.ts (CHAMPS, LANES, LANE_CAMP), nanicos.ts (NAN_MAP, artOf, bonecoOf), changelog.ts,
                       novidades.ts (o que mostrar no Log depois de uma atualização; puro e testado)
  styles/              CSS global, numerado: 01-base.css … 26-cassino.css (no celular, as abas ficam numa barra embaixo)
public/arte/           artes dos nanicos (rosto e corpo), bonecos do hall, foto da turma, reações dos Picarétezzi
planejamento/          PLANO.md (próximas fases e decisões), prompts/ (um por fase), demos e arte pronta
supabase/
  functions/riot-ao-vivo/index.ts   Edge Function (Deno): partida ao vivo. Fora do build do Next.
  functions/ficha-jogos/index.ts    Edge Function (Deno): números da ficha (Riot e Steam), guardados por 6 h
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
- **Exceção: o quarto da ficha** (`24-ficha.css`) segue a mesma regra do hall, com as variáveis `--quarto-*` e as classes `q-<nome>`.
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
| `friends` | os 14 nanicos (`name`, `user_id`, `username`, `opgg`, `steam`) | cada um só o próprio `opgg` e `steam` |
| `phrases` | nanicadas (`text`, `friend_ids uuid[]`, `champions text[]`, `modo 'qualquer'\|'todos'`) | criar, editar e remover (com limite e histórico) |
| `nanicadas_historico` | cópia de toda nanicada editada ou removida | ninguém pelo site (só o admin) |
| `game` | escalação por sala de LoL (`sala`, `players` = 5 rotas `{friendId, champion}`; a linha 1 é a da `lol-1`) | atualizar (formato conferido) |
| `cassino_sementes` | semente do servidor de cada um (`semente` secreta, `hash`, `semente_cliente`, `nonce`) | cada um lê só `hash`, `semente_cliente` e `nonce` da sua; **ninguém lê `semente`** |
| `cassino_sementes_antigas` | sementes reveladas (em hex), para conferir as apostas | cada um lê as suas |
| `cassino_apostas` | apostas (`jogo`, `aposta`, `escolha`, `resultado`, `pagou`, `hash`, `nonce`) | cada um lê as suas; o feed das últimas 20 vem de `cassino_feed()` |
| `cassino_rolos`, `cassino_pagamentos` | pesos dos símbolos e tabela de pagamentos do caça-níquel (o banco é a fonte; RTP conferido no SQL) | nanicos leem; ninguém grava pelo site |
| `salas` | salas tipo lan house (`id`, `nome`, `jogo` lol/cs/outro, `discord`, `ordem`): `lol-1`, `lol-2`, `cs`, `resenha` | ninguém pelo site (só o admin cria) |
| `chat_messages` | chat (`sala` = `'geral'` no lobby ou o id da sala; apaga sozinho após 30 dias) | enviar (o autor é sempre quem está logado; sala que não existe é recusada) |
| `limites` | contador anti-spam | ninguém |
| `carteiras` | saldo de moedas de cada um (`user_id`, `saldo >= 0`) e o último ganho (`ultimo_valor`, `ultimo_motivo`, `ultimo_em`) | ninguém grava; nanicos leem todas (ranking e ganhos no Sítio) |
| `extrato` | cada entrada e saída de moedas (`valor`, `motivo`, `ref`) | ninguém grava; cada um lê o seu |
| `bonus_diario` | bônus de cada dia e a sequência (`dia`, `seq`, `valor`) | ninguém grava; cada um lê o seu |
| `online_diario` | minutos com o site aberto por dia (`minutos`, `ultimo_pulso`) | ninguém grava; cada um lê o seu |
| `riot_contas`, `riot_ao_vivo`, `riot_meta` | cache da API da Riot | só a Edge Function |
| `jogos_stats` | números da ficha por nanico e fonte (`lol`: elo, vitórias, KDA, main; `steam`: horas) | nanicos leem; só a função `ficha-jogos` grava |
| `riot_partidas_vistas` | partidas do LoL já lidas (KDA das últimas 20 sem buscar tudo de novo) | só a função `ficha-jogos` |
| `atributos_votos` | votos anônimos (`de`, `para`, `atributo`, `nota` 0–10) | **ninguém lê nem grava direto**: só pelas funções abaixo |

- **Quem é nanico:** `public.eh_nanico()` diz se o usuário logado está ligado a um nanico.
- **Moedas (seção 7 do `seguranca.sql`):**
  - **O saldo só muda por `public.creditar()`**, que é interna (o site não chama) e é usada por outras funções do banco. Toda fase que dá ou tira moedas (cassino, bingo, truco, loja) chama `creditar` de dentro de uma função do banco. O navegador nunca decide ganho nem perda.
  - **RPCs do site:** `bater_ponto()` (bônus do dia, uma vez por dia, com a sequência), `pulso()` (um por minuto; conta 1 minuto se o último pulso que valeu foi entre 55 s e 150 s atrás; +1 moeda a cada 6 minutos, até 40 por dia) e `minha_carteira()`.
  - **O dia é o de Brasília** (`public.hoje_br()`). Os números estão espelhados em `src/lib/moedas.ts`, só para mostrar.
  - **Tempo online:** conta mesmo com a aba escondida (decisão do grupo, 01/11/2026).
  - **Se o SQL não rodou,** o site esconde as moedas e só deixa um aviso no console.
- **Cassino (seção 11 do `seguranca.sql`, usa `pgcrypto`):**
  - **O sorteio é no banco:** `u` = primeiros 52 bits de `HMAC-SHA256(semente do servidor, "semente_cliente:nonce")`, feito por `cassino_numero()` (interna, incrementa o nonce com `for update`). O navegador nunca sorteia.
  - **RPCs:** `apostar_roleta(aposta 5–100, tipo, valor)`, `apostar_limbo(aposta, alvo 1,01–100)`, `apostar_dado(aposta, lado, n)` (chance de 1% a 95%) e `apostar_slot(aposta)` (3 nonces seguidos, um por rolo). Todas debitam com `creditar`, sorteiam com `cassino_numero`, pagam e gravam em `cassino_apostas`. E `cassino_estado()`, `trocar_semente(cliente)` (revela a antiga) e `cassino_feed()`.
  - **Quanto a casa leva:** roleta 2,7%, limbo e dado 3%, caça-níquel cerca de 8% (o fim da seção 11b recalcula o RTP exato da tabela e falha fora de 91,5%–92,5%).
  - **Conferência:** `conferir()` e `refazer()` em `features/cassino/regras.ts` refazem a conta de qualquer jogo com `crypto.subtle`.
- **Atributos votados (seção 9 do `seguranca.sql`):**
  - **Anonimato:** `atributos_votos` não tem `select` para ninguém. O site só recebe média e contagem por `atributos_de(nanico)` e `atributos_todos()`. Com menos de 3 votos, a média sai `null` ("poucos votos").
  - **Votar:** `votar_atributos(nanico, notas)` exige as 6 notas inteiras de 0 a 10, não deixa votar em si mesmo e só deixa mudar o voto em alguém uma vez a cada 7 dias (o erro diz a data).
  - **`meu_voto(nanico)`** devolve só as notas de quem chamou e quando dá para mudar.
- **Presença pública (seção 26 do `seguranca.sql`):** `bonus_diario` e `online_diario` continuam fechadas (cada um lê só as suas). O resumo de qualquer nanico sai por `presenca_de(nanico)` (sequência de hoje ou de ontem, recorde, minutos de hoje, 7 dias e total) e a chama da lista por `presenca_todos()` (só `seq` e `hoje_min`). Não calcule sequência no navegador.
- **Gatilhos:** `chat_protecao`, `nanicada_protecao`, `nanicada_remocao`, `escalacao_protecao` e `perfil_protecao`.
- **"Já vi" do Log:** fica na conta, em `user_metadata.log_visto` (índice da entrada no `CHANGELOG`), gravado com `auth.updateUser({ data })` por `marcarLogVisto()` (`src/lib/dados.ts`). Vale em todos os aparelhos e não precisa de SQL. O `localStorage` (`log-visto`) fica de reserva.
- **Logins:** são criados só pelo admin, com `criar_login_nanico(nome, usuario, senha)` e `resetar_senha_nanico(usuario, senha)`. O e-mail interno é `usuario@nanicos.app`.
- **SQL que ainda não rodou:** o site segue funcionando. `phrasesV2` e `opggOk` no estado dizem se as colunas novas existem.

### Sala em tempo real (canais privados)
- **Lobby, canal `bingo-dos-nanicos`** (o mesmo de antes, então quem está com a versão antiga segue funcionando): presença de todo mundo, os eventos `truco` e `hall` e as mudanças do banco.
- **Canal da minha sala, `sala:<id>`:** os eventos `rtc`, `reacao` e `risco`, só de quem está nela. O banco (RLS de `realtime.messages`) só aceita `sala:<id>` de uma sala que existe.
- **Uma sala por vez:** `minhaSala` no store (null = lobby). Trocar de sala passa por `entrarSala()` (`features/salas/trocar.ts`). `onlineSala` é quem está na minha sala, e a live, as câmeras, as reações e o desenho usam essa lista e `naMinhaSala(from)` no lugar de `estaNaSala(from)`.
- **Presença:** `{name, fid, lines, live, cam, pos, sala, at}`, conferida por `cleanPresence()` (`sala` só vale se estiver na lista de salas).
- **Um por nanico:** a chave da presença é uma por aba (`MY_KEY`), então o mesmo nanico com duas abas, PC e celular, ou uma presença antiga, aparece várias vezes na lista crua. Toda tela que lista gente (hall, "Na sala agora") passa por `umPorNanico()` (`src/lib/presenca.ts`), que junta por `fid`, fica com o `at` mais novo e mantém `live`/`cam` de qualquer aba que transmita. O boneco tem o id `n:<fid>`, e o broadcast de qualquer aba daquele nanico move o mesmo boneco. **Não troque a chave da presença pelo `fid`**: duas abas brigariam pela mesma chave.
- **Reconexão:** se o canal do lobby cair (`CHANNEL_ERROR`, `TIMED_OUT`, `CLOSED`), o site mostra "Reconectando…" e monta o canal de novo sozinho (1 s, 2 s, 5 s, 10 s, até 30 s), junto com o canal da sala. Ao voltar para a aba, reconecta na hora (ou renova a presença), e a presença se renova a cada 60 s. Os handlers de `aoReceber`/`aoMudarPresenca`/`aoMudarTabela` ficam guardados no módulo e valem no canal novo. `pos` é o piso do boneco no hall (`{i, j}`, conferido por `posValida`); só muda quando o boneco chega.
- **Eventos de broadcast:**
  - `rtc`: sinalização da tela e da câmera;
  - `reacao`: emojis e fotos;
  - `risco`: desenho na live;
  - `truco`: mesas, jogadas e mão de cada um;
  - `hall`: `{ para: {i, j} }`, o destino do boneco. Cada navegador calcula o caminho e anima sozinho (limite de 8 a cada 2 s).
- **Mudanças no banco:** chegam por `postgres_changes` em `friends`, `phrases`, `game`, `chat_messages` e `carteiras`. Os ganhos de moedas de todo mundo no Sítio vêm do tempo real de `carteiras` (gravado por `creditar()`), **nunca de broadcast**.

### Navegador (`localStorage`, só conveniência de cada pessoa)
- **Chaves:** `rift-lineup`, `rift-card`, `side-min`, `rail-min`, `rail-tab`, `live-fps`, `live-res`, `live-vol`, `desenho`, `reacoes-ver`, `riot-auto`, `riot-visto`, `truco-opt`, `truco-mesa`, `log-visto`, `fome-fechado`, `hall-pos` (último piso no hall), `hall-sala-min` (lista "Na sala agora" do Sítio recolhida) e `sala-atual` (última sala; o site sempre abre no lobby).
- **As do site antigo continuam iguais**, então ninguém perde a cartela na troca.
- **`sessionStorage`:** `log-auto` (o Log de novidades já abriu sozinho nesta sessão do navegador).
- Nada importante pode morar só aqui.

### Arte (`public/arte/`)
- **`nanicos/{n}-rosto.webp` e `{n}-corpo.webp`:** o número vem de `NAN_MAP` (nome do nanico → número). Os nomes são Abreutz, Alemão, DD, Gamer, Grito, Guiperino, Le Bubu, Henry, Pitoco, John, Veião, Max, Gordão e Pin.
- **Tamanhos:** o rosto tem 160×160 e o corpo, 440 px de altura. Use `artOf(friend)`.
- **`bonecos/*.webp`:** uma spritesheet por nanico para o hall (células de 84×134, linhas `frente`/`costas`, colunas `parado` + 4 de andar; os lados esquerdos são o espelho). O formato está em `bonecos/bonecos.json`. Use `bonecoOf(friend)`; quem não tem boneco aparece com o rosto num pino.
- **`turma.webp`:** foto da turma. **`marca.png`:** bola de bingo. **`reacoes/`:** os Picarétezzi.

---

## 7. Versão e Log (obrigatório a cada mudança visível)

A versão (`v1.NN`) é **calculada sozinha** pelo tamanho do array `CHANGELOG` em `src/lib/dados/changelog.ts`. Toda mudança que um nanico consiga notar acrescenta **uma entrada no fim**. Depois de uma versão nova, o Log abre sozinho no primeiro acesso de cada pessoa, só com o que ela ainda não viu (`novidadesDesde`); o botão "Log" do rodapé mostra tudo:

```ts
{ data: "DD/MM/AAAA", itens: ["Frase curta dizendo o que mudou para quem usa"] },
```

- Escreva só funcionalidades, sem termos técnicos.
- Quando uma função deixar de existir ou for substituída, **não apague** o item antigo. Troque por:
  `{ t: "texto antigo", off: "trocado por … na v1.NN" }`. Ele aparece riscado no Log.

---

## 8. Como trabalhar

### 0. Antes de qualquer mudança: leia o que os outros fizeram
Mais de uma pessoa (e mais de uma IA) mexe no site. **Toda tarefa começa assim, sem exceção:**

1. **GitHub:**
   - `git fetch` e `git pull` na branch principal;
   - leia os commits novos (`git log --oneline -20` e `git show <commit>`);
   - leia o diff dos arquivos que você vai tocar.
   - Se alguém mudou o mesmo trecho, parta da versão nova; nunca sobrescreva com uma cópia antiga.
2. **Supabase:** confira o estado real do banco antes de escrever SQL:
   - tabelas, colunas, políticas (`pg_policies`), gatilhos e funções;
   - as Edge Functions publicadas.
   - Se o banco tiver algo que não está nos `.sql` do repositório, **pare e pergunte ao Felippe** antes de mudar.
3. **Vercel:** veja se a última publicação deu certo antes de publicar outra por cima.
4. Só então planeje e faça a mudança. No fim, diga em uma linha o que encontrou de novo dos outros, se encontrou.

1. Crie uma **branch** (`git checkout -b minha-mudanca`) para cada mudança.
2. Faça a mudança **pequena e focada**. Não reformate arquivos que você não mudou.
3. Antes do commit, confira:
   - [ ] `npm run check` passa (typecheck, lint, testes e build);
   - [ ] o site abre, faz login e mostra "Sincronizado" (teste numa preview da Vercel ou no `npm run dev`);
   - [ ] nada quebrou no celular, com largura de 390 px;
   - [ ] o console do navegador está sem erros e sem bloqueio de CSP;
   - [ ] a entrada nova está no `CHANGELOG`;
   - [ ] se mexeu no banco: o SQL roda duas vezes seguidas sem erro, e as permissões continuam fechadas.
4. Commit com mensagem em português dizendo **o quê** e **por quê** (ex.: `Truco: botão de ir ao mazo pede confirmação`).
5. **Juntar na principal:** desde 02/11/2026 (decisão do João, com o ok do grupo), quem terminou e conferiu tudo acima pode juntar direto na principal, sem esperar revisão ("trocar a roda com o carro andando"). Abrir Pull Request continua bom para registrar o que mudou, mas não é obrigatório. Antes de juntar, refaça o passo 0 (pegue o que os outros juntaram) e rode o `npm run check` de novo.

### Mudanças no Supabase
- **Nunca** apague tabelas nem dados pelo Table Editor sem avisar o grupo.
- **SQL:** primeiro no arquivo do repositório (`supabase/sql/`), depois no SQL Editor. Nada de mudança "só no painel".
- **Edge Function `riot-ao-vivo`:** se mexer nela, publique de novo e confira se a aba Jogar ainda mostra "EM PARTIDA".
- **Origens:** a função só aceita chamadas das origens listadas em `ORIGENS`, que incluem a Vercel e `localhost:8810/8811`.
- **Chave da Riot:** fica em **Edge Functions → Secrets → `RIOT_API_KEY`**. Não copie para lugar nenhum.
- **Chave da Steam:** fica em **Edge Functions → Secrets → `STEAM_API_KEY`** (tirada em steamcommunity.com/dev/apikey). Sem ela, a ficha mostra só os números do LoL.
- **Edge Function `ficha-jogos`:** busca cada fonte de um nanico no máximo uma vez a cada 6 h (usa no máximo 25 chamadas à Riot por vez). As origens aceitas são as mesmas da `riot-ao-vivo`.

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
