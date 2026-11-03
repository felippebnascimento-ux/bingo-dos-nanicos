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
| Supressão de ruído | **`@sapphi-red/web-noise-suppressor`** (0.4.1, fixa) | RNNoise em WebAssembly para a voz; a do navegador é fraca. Os arquivos vão para `public/ruido/` pelo `postinstall` (`scripts/copiar-ruido.mjs`) e não entram no git. |

```bash
npm install          # primeira vez
npm run dev          # http://localhost:8810 (a função da Riot só aceita 8810/8811)
npm run check        # typecheck + lint + testes + build: rode antes de todo commit
npm run build        # gera out/
npm run sincronizar:truco  # depois de mexer em src/features/truco/engine.ts (copia para a função truco-mesa)
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
    App.tsx            casca do site em 3 colunas: menu, as 12 abas (sempre montadas, só escondidas; abre no Nanico
                       Hotel, a aba `hall`) e a lista de membros; portas, toast. No K-FOFO somem os membros
                       (`sem-membros`). O Chat fica fora do menu; no computador, Ao vivo e Perfil saem do menu (abrem
                       pelos canais de voz e pela linha "eu" embaixo) e continuam na barra de abas do celular.
                       A tela de Início (fase 28) saiu na v1.68, a pedido do Felippe
    shell/             Sidebar (parte de cima rola: marca, navegação em grupos `GRUPOS` que recolhem como as categorias
                       de canais (Jogos: K-FOFO, Ao vivo só no celular, Truco, Cassino, Loja; Bingo: Nanicadas e
                       Jogar, sempre à vista; Turma: Nanicos, Mídias, Troféus, Perfil; recolhidos em `menu-min`; no
                       celular a barra de baixo fica sem títulos, sem Loja e sem Troféus; o Ranking fica só na carteira),
                       canais; embaixo, fixos: voz, câmera, eu com as
                       moedas, a engrenagem das Configurações e o rodapé com conexão, versão e Log), Canais.tsx (canais de voz como no Discord, com quem está, quem transmite e as mensagens novas do chat da sala, e o #geral em
                       "Canais de texto"; categorias recolhíveis,
                       e o VozPainel) e People.tsx (Membros: a barra da direita com os 14 nanicos, online e offline,
                       câmera no círculo, sem o indicador de voz (quem fala aparece só nos canais); `usePessoasNaSala()` também serve o Sítio; `useNanicosOnline()` é a lista
                       um por nanico com o meu estado, usada pelos canais e pelos membros)
    portas/            login, primeira senha, trocar senha, log de versões (modo "tudo" e modo "novidades")
    ui/                Avatar, FriendPicker, Toast, ícones, useSure (segundo toque)
    Fome.tsx           easter egg das 18h às 22h
  features/            uma pasta por aba / assunto
    moedas/            Moedas.tsx: selinho do saldo no menu (CarteiraChip) e quadro do Perfil (MoedasBloco);
                       Ranking.tsx: painel da carteira (abas Ranking e Meu extrato), aberto pela carteira do K-FOFO
                       (`abrirCarteira`), e `useMinhaPosicao()` ("3º lugar")
    hall/              aba K-FOFO (antes "Sítio do Mitz" e, por um dia, "K-FOFO"; no código continua `hall` e "Sítio" nos nomes), sala de 14×11: hall.ts (grade, móveis, CLICAVEIS, caminho, ordem
                       de desenho; puro e testado), bonecos.ts (movimento, evento `hall`, presença), Sala.tsx
                       (cômodo em SVG com janelão e porta do banheiro, um móvel por camada, destaque do piso; a disposição segue a
                       planta do grupo de 02/11/2026: entrada pelo vão da frente, sem o portão K-FOFO), Boneco.tsx
                       (tocar abre a ficha), Cantos.tsx ("Na sala agora", ganhos, carteira, dica), ganhos.ts
                       (ganhos de moedas de todo mundo pelo tempo real das carteiras), HallView; zoeira:
                       zoeira.ts (arco do voo e cambaleio; puro e testado), zoeiraSala.ts (chama zoar(), recebe
                       a tabela zoeiras, anima) e ZoeiraTela.tsx (menu do boneco, voo, PLAFT!, revidar);
                       QuadroTrofeus.tsx (quadro na parede da esquerda, abre a aba Troféus) e Chapeu.tsx
                       (chapéu de burro, coroa dourada e coroa de moedas na cabeça do boneco); eventos com
                       horário: eventosSala.ts (relógio, espetinho já pego, chama churrasco_pegar()) e EventosTela.tsx
                       (faixa em cima do cômodo, luz do happy hour, brasa e fumaça, placa "Pegar espetinho")
    loja/              aba Loja (aba `loja`, no grupo Jogos do menu; abre também pela geladeira do K-FOFO):
                       loja.ts (espaços, vitrine, equipados, podeComprar, balanço do boneco; puro e testado),
                       lojaDados.ts (vitrine, mochila, equipados de todos; comprar, equipar, usar; `useEquipados`),
                       consumoSala.ts (tempo real de `consumos`: o boneco fuma ou bebe em todas as telas),
                       Itens.tsx (desenhos dos consumíveis e do escudo, ConsumoCamada do Sítio, TituloNanico) e
                       LojaView.tsx (vitrine com prévia, mochila; `MochilaLista` também aparece na ficha) e
                       MochilaPainel.tsx (botão "Mochila" ao lado da carteira no K-FOFO e a janela do inventário,
                       `mochilaAberta` no `useLoja`; fecha ao usar um item)
    midias/            aba Mídias (aba `midias`, no menu): Imagem.tsx (imagem do bucket sob demanda, usada também na rede),
                       midiasDados.ts (galeria, mural e links do perfil; comprime a
                       imagem no navegador para webp até 1920 px; baixa do bucket privado como blob: e solta a URL;
                       `iniciarMidias`, `linksDe`) e MidiasView.tsx (galeria com tela cheia, vídeo como link, mural)
    missoes/           missões do dia: missoesDados.ts (pede minhas_missoes() ao entrar, a cada 2 min e depois das
                       ações que contam, vistas pelo tempo real; lerMissoes puro e testado) e Missoes.tsx (cartão no
                       canto do Sítio, acima da carteira e recolhível, e no Perfil)
    emblemas/          emblemas e respeitos: emblemas.ts (os 12 emblemas, metas de bronze/prata/ouro espelhadas do SQL,
                       lerEmblemas; puro e testado), emblemasDados.ts (emblemas_de com cache de 2 min, respeitos pelo tempo
                       real, darRespeito), Emblema.tsx (desenho SVG próprio) e EmblemasFicha.tsx (bloco da ficha)
    trofeus/           aba Troféus (aba `trofeus`, fora do menu; abre pelo quadro do Sítio): trofeus.ts (os 6
                       troféus, pódio, números, enfeites; puro e testado), trofeusDados.ts (lê o pódio e pede o
                       cálculo à riot-semana) e TrofeusView (cartões, seletor de semana, hall da fama)
    jogar/             JogarView (escalação, cartela, montar cartela), MiniCartela (painel do Ao vivo e
                       cartela flutuante), riot.ts (consulta a função riot-ao-vivo), partida.ts (lanes, puro),
                       RiotBox (com o painel "Apostar"), CellTag; apostas na partida: apostas.ts (pari-mútuo,
                       retorno estimado; puro e testado) e apostasDados.ts (bolo e minhas apostas pelo tempo real,
                       apostar(), aviso do fim); roleta do rodízio: rodizio.ts (fatias, ângulo, "seguidas"; puro e
                       testado), rodizioSala.ts (linha da sala, tempo real, animação, chama as funções) e Roleta.tsx;
                       bingoSala.ts (bingo no servidor numa sala de LoL: partida, minha cartela e cantos do banco,
                       `tocarCasa` canta ou confirma, `sortearCartela`, `usarMontada`, `fecharPartida`; sem o SQL ou
                       fora de uma sala de LoL, cai na cartela local de antes)
    nanicadas/         NanicadasView: cadastro, edição, filtros e lista
    nanicos/           NanicosView: os 14 nanicos com a arte de corpo inteiro (tocar abre a ficha);
                       atributos.ts (os 6 atributos votados, conferir notas, médias; puro e testado)
    ficha/             ficha do nanico: Ficha.tsx (janela), Quarto.tsx (quarto isométrico com o boneco),
                       AtributosFicha.tsx ("Segundo os nanicos": barras e votar, em ordem alfabética), estado.ts
                       (números da função ficha-jogos, usados no Perfil e nas Salas, e atributos), numeros.ts (conferir
                       e escrever; puro e testado), NoSitio.tsx (bloco "No K-FOFO": dias seguidos, recorde,
                       tempo online; `ChamaNome` ao lado do nome com 3+ dias) e presenca.ts (presenca_de e
                       presenca_todos). A ficha mostra em "No jogo" só os links (op.gg, smurf, Steam e os do perfil):
                       sem elo, KDA, main e horas, e sem o placar da zoeira (decisão do Felippe, v1.68)
    perfil/            PerfilView (op.gg, op.gg do smurf, Steam e links), opgg.ts (cleanOpgg, opggOf, opggSmurfOf,
                       opggNick) e steam.ts (limpar link, nick), links.ts (Twitch, YouTube… e vídeo e mural:
                       cleanLink, cleanVideo, cleanMural, dominio; puro e testado) e CampoLinks.tsx ("Meus links")
    live/              live.ts (liga tudo à sala), rtc.ts (WebRTC comum), tela.ts (transmissão), camera.ts,
                       voz.ts (voz da sala: um par WebRTC só de áudio com cada um na voz, microfone, fone, quem
                       está falando; volume e "silenciar" de cada nanico só no meu aparelho, `useAjustesVoz`, e o
                       sinal da conexão, `sinalDaVoz`), ruido.ts (abrirMic: microfone passado pela RNNoise; sem ela, a supressão
                       do navegador), vozRegras.ts (quem oferece, volume, anel de fala; puro e testado),
                       reacoes.ts, desenho.ts, estado.ts (store + preferências), pip.ts;
                       telas: LiveView, Palco, Painel (Chat e Cartela; a aba Telas saiu na v1.90), Cameras, Video,
                       Voos, Rosto, CamNaSala, CamBotoes e CamadaReacoesMinha (reações que chegam na minha transmissão,
                       fora das abas); no estilo do Discord (v1.90): PainelVoz.tsx (o painel "Voz conectada" embaixo
                       do menu com sinal, ruído, desligar e os botões câmera, tela, reações e câmeras; a miniatura da
                       minha transmissão; microfone e fone com a setinha na linha "eu"; as janelas de transmitir, com o
                       que mostrar, 720p/1080p/1440p, 30/60 fps e o som do PC, e a prévia da câmera, `JanelasVoz`) e
                       Grade.tsx (o canal no Ao vivo: todo mundo da voz em quadrados e uma tela para cada transmissão,
                       "Assistir transmissão" para abrir, modo foco com o Palco grande e o resto numa faixa (ou, com `destaque`,
                       o quadro clicado grande: a minha tela, uma câmera), `modo` no
                       estado; menu do quadrado no clique direito; o Palco fica montado também na grade, escondido,
                       para a tela principal seguir com som)
    config/            janela de Configurações (engrenagem embaixo do menu; `configAberto` no store): midia.ts
                       (microfone, saída, câmera, eco e ruído escolhidos, lista de aparelhos; voz.ts e camera.ts
                       leem daqui e trocam o aparelho na hora com `replaceTrack`) e ConfigView.tsx (ConfigJanela:
                       aparelhos, teste do microfone, trocar senha e sair)
    celular/           o Celular (item da loja) com o InstaNanico: rede.ts (feed de 20 em 20, postar com ou sem foto
                       comprimida na pasta rede/<uid>/ do bucket midias, curtir, comentar, apagar, não lidas em `rede-visto`,
                       stories (`carregarStories`, `postarStory`, `marcarVisto`, `lerQuemViu`, `apagarStory`), o Direct
                       (`carregarMensagens`, `enviarMensagem`, `abrirConversa`, `marcarLidas`), a Dynamic Island
                       (`avisarIlha` com `alvo`: cresce, mostra, some e encolhe em fases; `tocarIlha` grava `pedido` e o app abre a
                       conversa, o post ou o story) e o tempo real; `iniciarRede`, `abrirCelular`), EditorStory.tsx (o editor de story, como o do Instagram: texto, desenho,
                       figurinhas, menção, lixeira; sai uma imagem 1080×1920 desenhada com as regras de storyEditor.ts, puro e
                       testado; quem é mencionado recebe no Direct), insta.ts (stories por pessoa, ordem
                       da fileira, andar entre stories, tempo curto, conversas, não lidas e resumo, e o corte da foto ao postar: `formatoInicial`, `recorte` em
                       1:1, 4:5, 1,91:1 ou 9:16 do story; puro e testado; o `Cortador` sobe a foto já cortada, até 1080 px) e Celular.tsx (BotaoCelular no menu
                       e no Sítio só para quem tem o item, `useTemCelular`, e o iPhone 17 Pro Max por cima de tudo, com a
                       Dynamic Island, rodando o InstaNanico: feed, stories, explorar, novo post ou story, notificações e
                       perfil; até 520 px vira tela inteira, sem moldura)
    chat/              chat.ts (um chat por sala: "geral" no lobby e o id da sala dentro dela; não lidas por canal),
                       ChatPainel (o da minha sala, que é o chat do canal de voz, na primeira aba do painel do Ao vivo; ou um `canal`) e ChatView (aba `chat`, fora do menu:
                       o canal de texto escolhido no menu)
    cassino/           aba Cassino (moedas fictícias): regras.ts (roleta, limbo, dado, caça-níquel, conferir() e
                       refazer() com HMAC-SHA256; puro e testado), roda.ts (plano do giro da roleta animada: a bolinha termina no centro
                       da casa que o banco mandou, com `salto` para o tamanho e a sombra nos quiques e o balanço ao
                       assentar; puro e testado), RodaRoleta.tsx (a roda em SVG, animação, sons e mudo),
                       mesa.ts (mesas ao vivo da roleta e do avião: lê mesa_estado, relógio do banco, fases e conferência
                       da rodada; e as contas do pênalti; puro e testado), mesaDados.ts (`useMesa(jogo)`: pergunta ao banco
                       algumas vezes por segundo, mais rápido com o avião no ar; `chamarMesa`), Penalti.tsx (o pênalti
                       individual no lugar do maior ou menor: estádio, goleiro, 6 cantos, escada do multiplicador, bola que
                       espirra na defesa) e goleiro.ts (`membro`: braços, pernas e dedos do goleiro afinando; puro e testado),
                       MaiorMenor.tsx (o maior ou menor antigo, fora da tela),
                       CacaNiquel.tsx (a máquina: gabinete, lâmpadas, 3 rolos que param no que o banco sorteou,
                       alavanca, LED, giro automático ×10, rápido, a tabela de pagamentos e o jackpot do grupo; `comboSlot` em regras.ts),
                       Aviaozinho.tsx e aviao.ts (o Aviãozinho ao vivo: o mesmo avião para todos, céu, curva, sacar,
                       quem está no voo; contas do voo puras e testadas), RoletaMesa.tsx (a roleta ao vivo no feltro: roda,
                       painel do resultado, quem está na rodada, mesa de fichas deitada no computador e em pé no celular,
                       desfazer/limpar/dobrar/repetir; chama mesa_apostar_roleta; `MesaStatus`, `NaMesa` e `useRelogio`
                       servem as três mesas ao vivo),
                       estado.ts (dados do banco), Jogos.tsx (o limbo antigo,
                       fora da tela, e as fichas simples) e CassinoView (seletor de jogo, roleta, conferência, histórico)
    salas/             salas tipo lan house: trocar.ts (entrarSala: encerra tela e voz, mantém a câmera, troca o canal,
                       carrega escalação e chat; encerra a voz) e Salas.tsx (janela das salas com cartões e chat geral,
                       aberta pela porta do Sítio)
    truco/             engine.ts (regras, puro e testado; a função truco-mesa usa uma cópia; relógio de 20 s por
                       jogada: `desde`, trQuemDeve, trRestante, trTempoEsgotado), valida.ts (confere a mesa pública),
                       mesa.ts (pede cada ação à função truco-mesa e recebe a mesa e a minha mão pelo tempo real;
                       `fimDaJogada` e o aviso "tempo" quando acaba), TrucoView, Lobby, MesaTela, Carta e Baralho.tsx (o desenho próprio do
                       baralho espanhol em SVG: naipes, figuras e a moldura com as pintas)
  lib/
    config.ts          URL e chave pública do Supabase
    supabase.ts        cliente (sb()), q(), errMsg()
    store.ts           estado global (useApp, setApp, getApp, friendOf…)
    sala.ts            canal em tempo real: presença, broadcast, mudanças no banco
    presenca.ts        umPorNanico(): junta as abas de um mesmo nanico num item só; puro e testado
    dados.ts           carregar e gravar no banco, login → sessão → sala, sair
    bingo.ts           regras da cartela (quais nanicadas valem, sorteio, marcar); a mesma regra de "quais valem"
                       está em SQL (`bingo_valem`), conferida com o exemplo `bingo-valem.fixture.json` nos dois lados
    moedas.ts          números das moedas (bônus, sequência, teto), só para mostrar; puro e testado
    eventos.ts         happy hour e churrasco de sábado: eventoAgora, happyAgora, fimDoEvento (hora de Brasília
                       por Intl, nunca a do aparelho); só para mostrar; puro e testado
    carteira.ts        carteira do nanico logado: bater_ponto no login, pulso a cada minuto, extrato; ranking:
                       `carregarRanking()` lê o saldo de todas as carteiras uma vez e o tempo real das carteiras mantém
                       `todas` (e o "▲ subiu" em `subiram`); a ordem vem de `ranking()` em moedas.ts (empate divide a posição)
    toast.ts           toast("texto")
    util.ts            norm, canon, shuffle, local (localStorage), rolarAte…
    tipos.ts           Friend, Phrase, Card, Presence…
    dados/             campeoes.ts (CHAMPS, LANES, LANE_CAMP), nanicos.ts (NAN_MAP, artOf, bonecoOf), changelog.ts,
                       novidades.ts (o que mostrar no Log depois de uma atualização; puro e testado)
  styles/              CSS global, numerado: 01-base.css … 33-celular.css (o 27, do Início, saiu) (no celular, as abas ficam numa barra embaixo)
public/arte/           artes dos nanicos (rosto e corpo), bonecos do hall, foto da turma, reações dos Picarétezzi
planejamento/          PLANO.md (próximas fases e decisões), prompts/ (um por fase), demos e arte pronta
supabase/
  functions/riot-ao-vivo/index.ts   Edge Function (Deno): partida ao vivo e as apostas dela (abre o mercado e paga
                                    pelo resultado da match-v5). Fora do build do Next.
  functions/ficha-jogos/index.ts    Edge Function (Deno): números da ficha (Riot, Steam e Leetify), guardados por 6 h
  functions/truco-mesa/            Edge Function (Deno): o juiz do truco (embaralha, guarda as mãos, confere as
                                   jogadas, paga a vitória). engine.ts é cópia GERADA por `npm run sincronizar:truco`
                                   (scripts/sincronizar-truco.mjs); o teste engine-copia.test.ts falha se divergir
  functions/riot-semana/           Edge Function (Deno): troféus da semana; calculo.ts é a regra pura (testada no
                                   site, em src/features/trofeus/calculo.test.ts)
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
5. **Não quebrar a CSP** (`vercel.json`). Script só do próprio site, conexões só com o Supabase do projeto. `'wasm-unsafe-eval'` está liberado só para a RNNoise da voz (compila `.wasm`, não libera `eval`). Imagem externa só de `ddragon.leagueoflegends.com` e `raw.communitydragon.org`. Para liberar outro domínio, edite o `vercel.json` e explique o motivo no commit. Teste o build (`npm run build && npm start`) com o console aberto.
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
- A cartela muda por `src/lib/bingo.ts` (`novaCartela`, `toggleCell`, `limparMarcacoes`) só no bingo local. Numa sala de LoL com o SQL, ela vem do banco: a tela chama `tocarCasa`, `sortearCartela` e `usarMontada` (`features/jogar/bingoSala.ts`) e o `card` do store é montado a partir da cartela e dos cantos confirmados.
- A presença (`trackMe`) acompanha sozinha `card`, `myLiveSid`, `myCamSid` e `hallPos`: basta mudar o estado.

### Sala em tempo real (`src/lib/sala.ts`)
- **Mandar:** `enviar("hall", {...})`. O `from` é acrescentado sozinho.
- **Receber:** `aoReceber("hall", m => …)`. Evento novo vai na lista `EVENTOS` e segue a regra 4.
- **Outros ganchos:** `aoMudarPresenca`, `aoConectar` e `aoMudarTabela`.

### Nomes e idioma
- **Código em português, como o grupo fala:** nanicadas, nanicos, escalação, mão, vaza, mesa, anfitrião. Variáveis curtas são ok (`M`, `h`, `op`) dentro de regra de jogo, desde que comentadas.
- **Comentários em português** explicando o *porquê*, curtos, no estilo dos que já existem.
- **Componentes em PascalCase** (`MiniCartela`) e funções em camelCase (`toggleCell`). Os ids e classes do CSS antigo continuam iguais (`#stage`, `.tr-feltro`, `.cell.on`).

### Componentes que já existem (reaproveite, não recrie)
- **Botões:** `.btn` (principal, ouro), `.btn.soft` (secundário), `.btn.sm` e `.linkish` (link discreto).
- **Seleção:** `.seg` com `role="radio"`, para escolhas tipo "1080p / 1440p".
- **Blocos e etiquetas:** `.block` (cartão de seção), `.hint` e `.status` (texto apagado), `.live-pill` (AO VIVO).
- **Rosto:** `<Avatar f={friend} size="xs" | "lg" />` (já mostra a moldura comprada na loja, pelo `user_id`). O título comprado: `<TituloNanico userId={f.user_id} />`.
- **Seletor de nanico:** `<FriendPicker value onChange emptyLabel ariaLabel />` ou com `multi values`.
- **Aviso rápido:** `toast("texto")`.
- **Confirmação:** ação destrutiva pede **segundo toque** com `useSure()` (classe `.sure`, texto "Confirmar"). Nunca `confirm()` ou `alert()`.
- **Ícones:** `src/components/ui/icones.tsx`.
- **Navegador:** `local.get/set/json/setJson` (com try/catch) e `rolarAte(el)` (respeita menos movimento).

---

## 5. Padrão visual

### Cores (variáveis em `src/styles/01-base.css`, com versão escura em `prefers-color-scheme` e `[data-theme]`; o `--live` fica em `06-portas.css`)
| Nome | Hex | Uso |
|---|---|---|
| Oliva | `#4A4E44` | aba ativa, pano do truco (`--olive`) |
| Ouro | `#B08D57` | destaque, botões principais, "você" (`--accent`) |
| Off-white | `#FAF9F6` | fundo claro (`--bg`) |
| Carvão | `#353535` | texto (`--ink`) |
| Ardósia | `#3E4C59` | carimbo da cartela (`--mint`) |
| Vermelho | `#B4442F` / escuro `#E0705A` | AO VIVO, alertas, Truco! (`--live`) |

- **Sempre** use as variáveis (`var(--accent)` etc.), nunca hex solto, para o tema claro e escuro continuarem funcionando. Alguns hex vieram do site antigo (`#fff` e `#FAF9F6` sobre fundo escuro, o palco e as câmeras em `07`, `13` e `19`, o feltro e as cartas do truco em `20`). Não acrescente outros; quem mexer naquele trecho troca por variável.
- Novas cores só se entrarem na paleta acima.
- **Exceção: o quarto da ficha** (`24-ficha.css`) segue a mesma regra do hall, com as variáveis `--quarto-*` e as classes `q-<nome>` (valem também nas prévias da loja, `.loja-previa` e `.mochila-previa`).
- **Exceção: a roleta animada do Cassino** (`26-cassino.css`): madeira, ouro, prata e feltro usam as variáveis `--roleta-*` (em `.rr`, com tema escuro), e a mesa usa `--rm-*` e as fichas `--ficha-*` (em `.rm`); o caça-níquel usa `--cn-*` (em `.cn`: vinho, lâmpadas, rolos, LED, alavanca, moedas); a roda tem estilos (`tema` do RodaRoleta, `data-tema` em `.rr`: classica, luxo, monaco, neon; a mesa usa `luxo`, laca preta e ouro, escolhido pelo grupo em 03/11/2026); vermelho, preto e verde das casas, na roda e na mesa, são os de cassino, `--roleta-vermelho`, `--roleta-preto` e `--roleta-verde` (iguais nos dois temas; o `--live` ficava salmão). O céu e o avião do Aviãozinho usam `--av-*` (em `.aviao`) e o estádio, o goleiro e a bola do Pênalti, `--pn-*` (em `.penalti`).
- **Exceção: as cartas do truco** (`20-truco.css`): o baralho desenhado usa as variáveis `--carta-*` (definidas em `.tc`; o papel fica claro também no tema escuro, só mais apagado) e as classes `cf-<nome>`.
- **Exceção: o iPhone e o InstaNanico** (`33-celular.css`): a moldura usa `--iph-*` e o app as cores do modo escuro do Instagram, `--ig-*` (preto, cinzas, azul dos botões, o degradê do anel dos stories e os fundos dos stories de texto), definidas em `.iphone`.
- **Exceção: os desenhos dos itens da loja** (`30-loja.css`): cigarro, latas, cuia, copo e fumaça usam as variáveis `--loja-*` (com tema escuro) e as classes `l-<nome>`.
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
| `friends` | os 14 nanicos (`name`, `user_id`, `username`, `opgg`, `opgg_smurf`, `steam`) | cada um só o próprio `opgg`, `opgg_smurf` e `steam` |
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
| `riot_contas`, `riot_ao_vivo`, `riot_meta` | cache da API da Riot (`riot_contas` guarda também a conta do smurf: `riot_id_smurf`, `puuid_smurf`) | só a Edge Function |
| `rodizio` | roleta do rodízio, uma linha por sala de LoL (`fila`, `rodada`, `ja_entraram`, `sorteado`, `girado_em`, `giro`, `trocas`, `no_time`) | ninguém direto: só `rodizio_fila`, `rodizio_girar` (o banco sorteia com `random()`), `rodizio_colocar` (troca a rota na `game` e passa pelo `escalacao_protecao`) e `rodizio_desistir` (seção 19) |
| `zoeiras` | chinelada, torta e revide no Sítio (`de`, `para` = friend ids, `tipo`, `em`; apaga com 30 dias) | ninguém direto: só `zoar(nanico, tipo)` (cobra 5/25 com `creditar`, revide grátis em 30 s, limites) e `placar_zoeira(nanico)` (seção 20); nanicos leem as das últimas 24 h |
| `loja_itens` | a vitrine (`id`, `nome`, `descricao`, `espaco`, `preco` 10–5000, `dados` com cor/texto/animação, `ativo`, `ordem`); a semente fica no SQL | nanicos leem; só o admin escreve |
| `mochila` | o que cada um comprou (`user_id`, `item_id`, `qtd`, `equipado`) | ninguém grava direto; **todos leem os equipados** (quarto, título e moldura dos outros) e cada um lê a mochila inteira só a sua |
| `consumos` | consumível usado no Sítio (`de` = friend id, `item_id`, `em`; apaga com 30 dias) | ninguém grava direto (só `usar_item`); nanicos leem as das últimas 24 h |
| `trofeus_semana` | pódio de cada troféu por semana (`semana` = segunda, `trofeu`, `posicao` 1–3, `friend_id`, `valor`, `partidas`) | nanicos leem; só a função `riot-semana` grava |
| `riot_semana_meta`, `riot_semana_partidas` | trava e progresso do cálculo da semana (`estado` calculando/parcial/pronta) e as partidas já lidas (só os números dos nanicos) | só a função `riot-semana` (o site lê `estado`) |
| `jogos_stats` | números da ficha por nanico e fonte (`lol`: elo, vitórias, KDA, main; `steam`: horas; `cs`: Premier e nível da GC pelo Leetify, seção 30) | nanicos leem; só a função `ficha-jogos` grava |
| `riot_partidas_vistas` | partidas do LoL já lidas (KDA das últimas 20 sem buscar tudo de novo) | só a função `ficha-jogos` |
| `midias` | galeria (`user_id`, `caminho` no bucket **ou** `link` de vídeo do YouTube/Medal/clipe da Twitch, `legenda` ≤ 140, `sala`) | nanicos leem; cada um manda (gatilho `midias_protecao`: autor, pasta própria, arquivo existe, 10 por hora, até 60 por pessoa) e apaga as suas |
| `perfil_links` | links da ficha (`friend_id`, `tipo` twitch/youtube/instagram/tiktok/x/faceit/leetify, `url` no formato de cada site) | nanicos leem; cada um grava só os próprios |
| `mural_links` | mural do grupo (`user_id`, `url` só https ≤ 300, `titulo` ≤ 80) | nanicos leem; cada um põe (10 por hora) e apaga os seus |
| `rede_posts` | rede nanica / InstaNanico (`user_id`, `texto` até 500, vazio só com foto desde a seção 34, `midia` = `rede/<uid>/<id>.webp` no bucket `midias`) | só quem tem o Celular lê e posta (`tem_item('celular')`); o autor apaga; ninguém edita |
| `rede_curtidas`, `rede_comentarios` | curtidas (`post_id`, `user_id`) e comentários (`texto` 1–280) | só quem tem o Celular lê e escreve; o autor apaga |
| `rede_stories` | stories do InstaNanico (`user_id`, `midia` em `rede/<uid>/` ou só `texto` ≤ 120 sobre `fundo` roxo/laranja/verde/azul/preto, `em`) | só quem tem o Celular lê e posta; os outros só veem os das últimas 24 h (o dono vê os vencidos, para apagar foto e linha); o autor apaga (seção 34) |
| `rede_stories_vistos` | quem viu cada story (`story_id`, `user_id`) | cada um grava só o próprio "vi"; quem viu e o dono do story leem |
| `rede_mensagens` | Direct do InstaNanico (`de`, `para`, `texto` até 1000, `story_id` = resposta a um story, `post_id` = publicação enviada, `em`, `lida_em`) | cada um lê só as que mandou ou recebeu, e só com o Celular; o remetente é sempre quem está logado (gatilho `rede_mensagem_protecao`, 30 por minuto); quem recebe marca lidas por `marcar_lidas(de)` (seção 35) |
| `missoes_def` | as missões possíveis (`id`, `texto`, `meta`, `valor`, `fase_ok`, `ordem`); a semente fica no SQL | nanicos leem; só o admin escreve (o PR de uma fase nova liga a missão dela com `fase_ok = true`) |
| `missoes_dia` | as 3 missões de cada um por dia (`user_id`, `dia`, `missao_id`, `progresso`, `feita_em`) | cada um lê as suas; só `minhas_missoes()` grava |
| `bingo_partidas` | uma partida de bingo aberta por sala de LoL (`sala`, `game_id` da Riot, `aberta_em`, `fechada_em`) | nanicos leem; só as funções `bingo_*` |
| `bingo_cartelas` | a cartela de cada um na partida (`casas` = 25 ids de nanicadas, o meio null = LIVRE; `origem` sorteada/montada) | cada um lê **só a sua**; só as funções `bingo_*` |
| `bingo_cantos` | "Aconteceu!" (`phrase_id`, `cantado_por`, `confirmado_por`, `confirmado_em`) | nanicos leem; só `bingo_cantar` e `bingo_confirmar` |
| `bingo_premios` | quem fechou linha em cada partida (`linhas`, `pago` 25 ou 0) | nanicos leem; só `bingo_pagar` |
| `truco_mesas` | mesa de truco como todos veem (`id`, `criada_por`, `opcoes`, `publico` = `trPublica`, `fase`, `atualizada_em`) | nanicos leem; só a função `truco-mesa` grava (pelas funções `truco_*`) |
| `truco_estado` | a mesa completa, com o baralho e as mãos (`estado` = `{M, partida, fimEm}`, `versao`) | **ninguém** (nem leitura, nem tempo real); só as funções `truco_*` |
| `truco_maos` | as cartas de cada lugar (`mesa_id`, `lugar`, `user_id`, `cartas`, `mao_n`) | cada um lê **só a sua** (o RLS filtra também o tempo real); só a função grava |
| `apostas_mercados` | uma linha por partida ao vivo (`game_id`, `nanicos` friend id → time, `fecha_em`, `estado` aberto/pago/devolvido, `vencedor`, `fim`, `bolo_100`, `bolo_200`, `casa`) | nanicos leem; só a função `riot-ao-vivo` abre e paga (`apostas_abrir`, `apostas_liquidar`) |
| `apostas` | a aposta de cada um numa partida (`lado` 100/200, `valor` 5–100, `pago`; uma por partida) | cada um lê as suas; só `apostar_partida(game, lado, valor)` grava |
| `respeitos` | respeito dado (`de`, `para` = friend ids, `dia` de Brasília; 1 por pessoa por dia) | nanicos leem todos (é público); só `dar_respeito(nanico)` grava, até 3 por dia (seção 27) |
| `mesa_rodadas` | rodadas das mesas ao vivo (`jogo` roleta/aviao/penalti, `abre_em`, `fecha_em`, `segredo`, `hash`, `resultado`, `fim_em`, `liquidada`) | **ninguém lê nem grava direto**: só as funções `mesa_*` e `penalti_*` (seção 32) |
| `mesa_apostas` | a aposta de cada um numa rodada da roleta ou do avião (`escolha` = fichas ou `{auto}`, `estado`, `sacou`, `pagou`; uma por pessoa por rodada) | ninguém direto; `mesa_estado` mostra quem está na rodada |
| `penalti_jogos` | a disputa de pênaltis de cada um (`aposta`, `gols`, `estado` ativa/sacou/perdeu/completa, `ult_hash`/`ult_nonce`/`ult_coluna` do último chute; uma ativa por pessoa) | ninguém direto; só as funções `penalti_*` (seção 32b) |
| `cassino_jackpot` | o jackpot do caça-níquel (uma linha: `valor`, `ganhador`, `ganhou`, `ganhou_em`) | nanicos leem; só `apostar_slot` grava (seção 33) |
| `atributos_votos` | votos anônimos (`de`, `para`, `atributo`, `nota` 0–10) | **ninguém lê nem grava direto**: só pelas funções abaixo |

- **Quem é nanico:** `public.eh_nanico()` diz se o usuário logado está ligado a um nanico.
- **Moedas (seção 7 do `seguranca.sql`):**
  - **O saldo só muda por `public.creditar()`**, que é interna (o site não chama) e é usada por outras funções do banco. Toda fase que dá ou tira moedas (cassino, bingo, truco, loja) chama `creditar` de dentro de uma função do banco. O navegador nunca decide ganho nem perda.
  - **RPCs do site:** `bater_ponto()` (bônus do dia, uma vez por dia, com a sequência), `pulso()` (um por minuto; conta 1 minuto se o último pulso que valeu foi entre 55 s e 150 s atrás; +1 moeda a cada 6 minutos e, no happy hour, +1 a cada 3 minutos, **sem teto por dia** desde 02/11/2026, decisão do João; o limite de pulsos por minuto continua) e `minha_carteira()`.
  - **Bolsa Cassino (seção 36, decisão do João, 03/11/2026):** `pedir_bolsa()` paga `creditar(5000, 'bolsa', data)` a quem está com menos de 100 moedas, uma vez por dia de Brasília (o `ref` é a data). O site pede ao entrar e depois de cada pulso, só com o saldo abaixo de 100 (`BOLSA_ABAIXO_DE` em `moedas.ts`).
- **Eventos com horário (seção 25 do `seguranca.sql`):** não há tabela de "evento ligado": quem decide é o relógio do banco. `agora_br()` é a hora de Brasília e `evento_em(hora)` diz `'happy'` (todo dia, 22h à meia-noite) ou `'churrasco'` (sábado, 18h às 23h; no sábado das 22h às 23h vale o churrasco, mas o `pulso` confere a hora e paga o happy hour junto). O `pulso` guarda em `online_diario` os `happy_min` e `happy_ganho` do dia. `churrasco_pegar()` só aceita no horário, uma vez por pessoa por sábado (`ref` = data no `extrato`), sorteia de 10 a 60 com `random()` e paga com `creditar(…, 'churrasco', data)`; o aviso para todo mundo vem do tempo real das carteiras.
  - **O dia é o de Brasília** (`public.hoje_br()`). Os números estão espelhados em `src/lib/moedas.ts`, só para mostrar.
  - **Tempo online:** conta mesmo com a aba escondida (decisão do grupo, 01/11/2026).
  - **Se o SQL não rodou,** o site esconde as moedas e só deixa um aviso no console.
- **Cassino (seção 11 do `seguranca.sql`, usa `pgcrypto`):**
  - **O sorteio é no banco:** `u` = primeiros 52 bits de `HMAC-SHA256(semente do servidor, "semente_cliente:nonce")`, feito por `cassino_numero()` (interna, incrementa o nonce com `for update`). O navegador nunca sorteia.
  - **RPCs:** `apostar_roleta_mesa(fichas)` (seção 28: várias fichas numa rodada, um sorteio só; tipos número, cor, paridade, metade, dúzia e coluna; cada ficha 5–100, até 30 fichas e 1.000 por rodada; dúzia e coluna pagam 3×; guarda uma aposta `roleta` com `escolha.fichas`), `apostar_roleta(aposta 5–100, tipo, valor)` (a antiga, de uma ficha), `apostar_limbo(aposta, alvo 1,01–100)`, `apostar_dado(aposta, lado, n)` (chance de 1% a 95%) e `apostar_slot(aposta)` (3 nonces seguidos, um por rolo). Todas debitam com `creditar`, sorteiam com `cassino_numero`, pagam e gravam em `cassino_apostas`. E `cassino_estado()`, `trocar_semente(cliente)` (revela a antiga) e `cassino_feed()`.
  - **Aviãozinho (seção 29):** `aviao_decolar(aposta, auto)` cobra e sorteia o ponto de queda (a conta do limbo, casa 3%) em `aviao_voos`, que **ninguém lê**: o ponto só sai no fim. `aviao_ver(id)` (o site pergunta 4 vezes por segundo) e `aviao_sacar(id)` decidem pelo relógio do banco (`aviao_mult`: floor(e^(0,07 × segundos) × 100) / 100); o automático vale se o alvo ≤ ponto de queda. Cada voo terminado vira uma aposta `aviao` (conferível como o limbo). `aviao_mesa()` mostra os voos dos últimos 3 min sem revelar a queda de quem está no ar. O Limbo saiu da tela (a função continua no banco).
  - **Mesas ao vivo (seção 32):** roleta e aviãozinho são rodadas para todo mundo junto, como num cassino online. A mesa fica parada até alguém apostar; a primeira aposta abre a rodada (`mesa_abrir`) com tempo de apostas (`mesa_janela`: roleta 15 s, avião 8 s) e quem entrar a tempo joga na mesma rodada. Não há servidor rodando o relógio: `mesa_estado(jogo)` (o site pergunta algumas vezes por segundo) e as apostas chamam `mesa_avancar`, que, com trava por jogo, sorteia a rodada que fechou e paga a que acabou (`mesa_liquidar`, uma vez só). Justo por rodada: um segredo aleatório nasce com ela, o sha256 (`hash`) aparece antes e o segredo sai quando ela é paga; u = HMAC-SHA256(segredo, "jogo:id"), a mesma conta do motor (`conferirRodada` em mesa.ts). Roleta: `mesa_apostar_roleta(fichas)` (pode chamar de novo na mesma rodada; até 30 fichas e 1.000), a casa sai no fechamento e paga no fim do giro (9 s). Avião: `mesa_apostar_aviao(aposta, auto)` (uma por voo), decola no fechamento, `mesa_sacar_aviao()` pelo relógio do banco, o ponto de queda só sai quando ele vai embora e o automático é pago no fim. Cada aposta paga vira uma linha em `cassino_apostas` (`escolha.rodada`, `hash` e `nonce` = a rodada). As funções antigas (`apostar_roleta_mesa`, `aviao_decolar`, `apostar_dado`) continuam no banco, fora da tela.
  - **Pênalti (seção 32b, individual, como caça-níquel):** `penalti_comecar(aposta)` cobra, `penalti_chutar(zona)` sorteia na hora com `cassino_numero` a coluna do goleiro (floor(u × 3); gol nas outras duas) e `penalti_sacar()` paga `aposta × penalti_mult(gols)`, com `penalti_mult(g)` = 0,97 ÷ (2/3)^g (1,45× … 7,36× no 5º gol, que paga sozinho). `penalti_estado()` devolve a disputa aberta. Ao terminar vira uma aposta `penalti` com o hash e o nonce do último chute (`refazer` confere a coluna). Medido no banco local: gol em 66,7% de 6.000 chutes.
  - **Jackpot do grupo (seção 33):** o `apostar_slot` põe 1% de cada giro em `cassino_jackpot` (começa em 500) e quem tira 3 bolas leva o 1.000× e mais o jackpot, que volta para 500. A tela lê o valor a cada poucos segundos e avisa quando alguém leva.
  - **Quanto a casa leva:** roleta 2,7%, limbo, dado, aviãozinho e pênalti 3%, caça-níquel cerca de 8% (o fim da seção 11b recalcula o RTP exato da tabela e falha fora de 91,5%–92,5%; o jackpot devolve 1% aos jogadores).
  - **Conferência:** `conferir()` e `refazer()` em `features/cassino/regras.ts` refazem a conta de qualquer jogo com `crypto.subtle`.
- **Atributos votados (seção 9 do `seguranca.sql`):**
  - **Anonimato:** `atributos_votos` não tem `select` para ninguém. O site só recebe média e contagem por `atributos_de(nanico)` e `atributos_todos()`. A média aparece desde o 1º voto (decisão do João, 02/11/2026; antes era com 3) e sai `null` só sem nenhum voto ("sem votos"). Cada voto grava em `atributos_aviso` (só o nanico votado e a hora, nunca quem votou) e o tempo real dessa tabela faz a ficha de todo mundo pedir as médias de novo.
  - **Votar:** `votar_atributos(nanico, notas)` exige as 6 notas inteiras de 0 a 10, não deixa votar em si mesmo e só deixa mudar o voto em alguém uma vez a cada 7 dias (o erro diz a data).
  - **`meu_voto(nanico)`** devolve só as notas de quem chamou e quando dá para mudar.
- **Loja (seção 15 do `seguranca.sql`):**
  - **O preço vem sempre da `loja_itens`.** `comprar(item)` debita com `creditar(-preco, 'loja', item)`: sem saldo, falha e não muda nada. Escudo (até 3) e consumíveis (até 20) acumulam; o resto só se compra uma vez.
  - **`equipar(item, ligar)`** só aceita o que está na mochila e desliga os outros do mesmo espaço (cadeira, mesa, tapete, pôster, planta, parede, luz, título, moldura). **`usar_item(item)`** gasta 1 consumível e grava em `consumos`; o tempo real dessa tabela anima o boneco em todas as telas (nunca broadcast). **`quarto_de(nanico)`** devolve os equipados.
  - **Escudo de sequência:** o `bater_ponto()` da seção 15 (substitui o da 7) gasta 1 escudo quando a pessoa faltou ontem mas veio anteontem, cria o dia de ontem com valor 0 e devolve `escudo_usado: true`. Dois dias perdidos não salvam.
  - **Itens:** consumíveis de 15 a 60 (cigarrinho, latinha, chimarrão, energético, caipirinha, charuto), escudo 400, quarto de 150 a 1.500, títulos de 250 a 2.000 e molduras de 800 e 1.200.
- **Mídias e links (seção 16 do `seguranca.sql`):** bucket `midias` **privado** (5 MB, só webp/png/jpeg/gif); `storage.objects` só deixa nanico ler, subir na própria pasta (`<uid>/…`) e apagar a própria. O site mostra a imagem com `download()` → `URL.createObjectURL` (a CSP já aceita `blob:`); link externo abre em nova aba, sem iframe e sem prévia. Apagar uma mídia apaga o arquivo e a linha.
- **Celular e rede nanica (seção 18 do `seguranca.sql`):** o item `celular` (espaço `celular`, 3.000 moedas, compra única, não se equipa: na mochila o botão é "Abrir"). `public.tem_item(item)` diz se quem está logado tem o item, e o RLS das tabelas `rede_*` usa `eh_nanico() and tem_item('celular')`: sem o item, o feed volta vazio e o tempo real não chega. O gatilho `rede_protecao` força o autor, limpa o texto (mantém quebras de linha), confere a imagem na própria pasta e limita (10 postagens, 40 comentários e 120 curtidas por hora). A política de subir no bucket `midias` aceita também `rede/<uid>/` para quem tem o Celular. Postar e curtir não dão moedas. O aviso "Fulano postou na rede nanica" no Sítio só chega a quem tem o Celular (o tempo real respeita o RLS).
- **Missões do dia (seção 23 do `seguranca.sql`):** `minhas_missoes()` sorteia 3 das `fase_ok` (com `random()`) na primeira chamada do dia de Brasília e devolve as 3 com o progresso **recalculado na hora** das tabelas de origem (`missao_progresso`: `online_diario`, `chat_messages`, `phrases.created_by`, `zoeiras`, extrato do truco, `bingo_premios`, `rodizio.sorteado_por`). Paga ao completar com `creditar(valor, 'missao', 'dia:id')` e, com as 3 feitas, o bônus de +25 (`'dia:bonus'`), uma vez só (trava por pessoa com `pg_advisory_xact_lock`). Nenhum progresso vem do site. A "Aposte numa partida ao vivo" espera a fase 10 (`fase_ok = false`).
- **Bingo no servidor (seção 12a do `seguranca.sql`):**
  - **Cartela:** `bingo_nova_cartela(sala)` sorteia no banco (`bingo_sortear`, com `gen_random_bytes`; até 16 da partida, o resto genéricas, como `sortear()`), e `bingo_montada(sala, casas)` aceita 24 nanicadas que valem (`bingo_valem`, a mesma regra de `eligible()`). Ambas abrem a partida da sala se não houver (`bingo_abrir`). Trocar de cartela só antes do primeiro canto confirmado.
  - **Marcar:** `bingo_cantar(partida, nanicada)` (quem tem cartela; a nanicada tem que estar em alguma cartela; 10 por minuto) e `bingo_confirmar(canto)` por **outro** nanico com cartela. A casa marca em todas as cartelas que a têm.
  - **Prêmio:** cada confirmação chama `bingo_pagar` (interna): cartela **sorteada** com 1 linha ou mais ganha `creditar(25, 'bingo', partida)` uma vez por partida, até 3 prêmios pagos por dia. Montada não paga.
  - **Fechar:** `bingo_fechar(sala)`, qualquer nanico (botão "Fechar a partida"). Ainda não fecha sozinho pelo fim do jogo na Riot.
- **Truco no servidor (seção 13 do `seguranca.sql`):**
  - **O juiz é a função `truco-mesa`.** Ações: `abrir` (modo, alvo, flor), `sentar` (lugar), `sair`, `comecar` (também a revanche), `jogar`/`truco`/`envido`/`quero`/`naoquero`/`mazo` (com `arg`), `nova_mao` (n) e `fechar`. A resposta é só `{ ok }` ou `{ erro }`, nunca cartas.
  - **Cada ação:** `truco_vez(user)` (30 a cada 10 s) → `truco_carregar(mesa)` → regras do `engine.ts` → `truco_salvar(..., versao)`, que só grava se ninguém gravou no meio (senão a função tenta de novo). Embaralha com `crypto.getRandomValues`.
  - **Lugar:** `Lugar.key` é o `user_id` (não a aba), então recarregar ou trocar de aparelho não perde o lugar. Uma mesa em jogo por pessoa; as paradas há 3 h somem.
  - **Próxima mão:** quem está sentado pede `nova_mao` sozinho 3,8 s depois do fim; a função espera 3 s e vale só o primeiro pedido.
  - **Tempo (20 s por jogada, `TR_TEMPO_MS`):** `h.desde` marca o começo da espera (relógio do servidor; toda ação que deu certo recomeça). Quando acaba no aparelho, quem está sentado manda `tempo` (n); a função só aceita se o relógio dela também passou e, por quem devia agir (`trQuemDeve`), aceita o pedido pendente ("quero") ou joga uma carta sorteada. Mesa sem `desde` (antiga) não tem tempo.
  - **Prêmio:** `truco_premiar(mesa)` (só a função) paga +15 a cada vencedor com `creditar(15, 'truco', 'mesa:partida')`, uma vez por partida, até 3 vitórias pagas por dia, e só se todos os lugares forem nanicos diferentes.
- **Apostas na partida (seção 14 do `seguranca.sql`):** pari-mútuo com 5% da casa. A `riot-ao-vivo` abre o mercado quando vê a partida (fecha 5 min depois do início; Arena fica de fora) e, quando a partida some, busca o resultado na match-v5 (até 3 por ciclo) e chama `apostas_liquidar`, que paga `floor((total − casa) × aposta / bolo do vencedor)` com `creditar(…, 'aposta', …)`. Remake (menos de 5 min ou rendição antecipada), um lado vazio ou 6 h sem resultado devolvem tudo. Rodar de novo não paga de novo (o `estado` garante). Quem está na partida só aposta no próprio time (pelo `nanicos` do mercado ou pelo `riot_ao_vivo`). A conta está espelhada em `features/jogar/apostas.ts`, só para mostrar.
- **Respeitos e emblemas (seção 27 do `seguranca.sql`):** `dar_respeito(nanico)` (3 por dia, 1 por pessoa, nunca a si mesmo) e `meus_respeitos()`; o tempo real de `respeitos` mantém a conta e avisa no Hotel. `emblemas_de(nanico)` calcula no banco 12 emblemas de 3 níveis (horas de site, recorde de sequência, horas de tela compartilhada, horas de coroa/chapéu, respeitos, elo do LoL, horas de CS2 pela Steam, 1º lugares nos troféus, vitórias no truco, bingos, apostas no cassino e nanicadas). O `pulso(p_tela)` conta em `online_diario` os minutos de tela compartilhada (`tela_min`, informado pelo site: é só para o emblema, não dá moedas) e de chapéu ou coroa (`chapeu_min`, conferido no banco: mais rico agora ou 1º do Feeder/Carregou o piano da última semana). O nível da GC do CS não entra: não há fonte de dados.
- **Presença pública (seção 26 do `seguranca.sql`):** `bonus_diario` e `online_diario` continuam fechadas (cada um lê só as suas). O resumo de qualquer nanico sai por `presenca_de(nanico)` (sequência de hoje ou de ontem, recorde, minutos de hoje, 7 dias e total) e a chama da lista por `presenca_todos()` (só `seq` e `hoje_min`). Não calcule sequência no navegador.
- **op.gg de smurf (seção 27 do `seguranca.sql`):** coluna `friends.opgg_smurf` (mesmo formato do `opgg`, gravada pelo dono, passa pelo `perfil_protecao`). A `riot-ao-vivo` resolve as duas contas (o smurf em `riot_id_smurf`/`puuid_smurf`) e vale a que estiver em partida. A ficha e o Perfil mostram o link; a `ficha-jogos` e a `riot-semana` continuam só com o `opgg`.
- **Gatilhos:** `chat_protecao`, `chat_sala_protecao` (recusa sala que não existe), `limpar_chat` (apaga o que tem mais de 30 dias), `nanicada_protecao`, `nanicada_remocao`, `escalacao_protecao` e `perfil_protecao`.
- **"Já vi" do Log:** fica na conta, em `user_metadata.log_visto` (índice da entrada no `CHANGELOG`), gravado com `auth.updateUser({ data })` por `marcarLogVisto()` (`src/lib/dados.ts`). Vale em todos os aparelhos e não precisa de SQL. O `localStorage` (`log-visto`) fica de reserva.
- **Logins:** são criados só pelo admin, com `criar_login_nanico(nome, usuario, senha)` e `resetar_senha_nanico(usuario, senha)`. O e-mail interno é `usuario@nanicos.app`.
- **SQL que ainda não rodou:** o site segue funcionando. `phrasesV2` e `opggOk` no estado dizem se as colunas novas existem.

### Sala em tempo real (canais privados)
- **Lobby, canal `bingo-dos-nanicos`** (o mesmo de antes, então quem está com a versão antiga segue funcionando): presença de todo mundo, o evento `hall` e as mudanças do banco.
- **Canal da minha sala, `sala:<id>`:** os eventos `rtc`, `reacao` e `risco`, só de quem está nela. O banco (RLS de `realtime.messages`) só aceita `sala:<id>` de uma sala que existe.
- **Uma sala por vez:** `minhaSala` no store (null = lobby). Trocar de sala passa por `entrarSala()` (`features/salas/trocar.ts`). `onlineSala` é quem está na minha sala, e a live, as câmeras, as reações e o desenho usam essa lista e `naMinhaSala(from)` no lugar de `estaNaSala(from)`.
- **Presença:** `{name, fid, lines, live, cam, pos, sala, voz, mudo, surdo, texto, at}`, conferida por `cleanPresence()` (`sala` só vale se estiver na lista de salas; `voz` é um sid; `texto` é o canal de texto aberto, `"geral"` ou o id de uma sala).
- **Voz:** entrar num canal de voz é `entrarSala(id)` + `entrarVoz()` (`features/live/voz.ts`). Cada par na voz da sala tem uma conexão WebRTC só de áudio; a chave menor oferece. A sinalização vai no `rtc` do canal da sala (`vo`/`va`/`vi`/`vb`, conferida em `live.ts` como o resto). Outra aba do mesmo nanico não conecta (ouviria a si mesmo). Trocar de sala ou sair do site encerra a voz, e o botão de desligar do menu é sair da sala (`entrarSala(null)`). A câmera é da voz: só quem está na voz da mesma sala se vê (`syncCams` e `camOnWatch` conferem `naVoz()` e o `voz` da presença); trocar de sala (`pararAoTrocarDeSala`) mantém a câmera ligada e fecha só as conexões da sala antiga, e voltar para o lobby desliga. Assistir a live de alguém é um clique só: `assistirLive(key, sala)` (`shell/People.tsx`) entra na sala da pessoa sem voz, abre o Ao vivo e mostra a tela dela quando a presença chega (usado nos canais, nos membros, no "Na sala agora" e na TV do K-FOFO). A transmissão de tela pede `restrictOwnAudio` para a voz não voltar pelo som do sistema. Não tem servidor TURN: rede muito fechada pode não conectar.
- **Um por nanico:** a chave da presença é uma por aba (`MY_KEY`), então o mesmo nanico com duas abas, PC e celular, ou uma presença antiga, aparece várias vezes na lista crua. Toda tela que lista gente (hall, canais, membros) passa por `umPorNanico()` (`src/lib/presenca.ts`), que junta por `fid`, fica com o `at` mais novo e mantém `live`/`cam`/`voz` de qualquer aba que transmita. A `sala` vem da aba na voz, depois de qualquer aba numa sala e só então da mais recente (senão a pessoa pula entre a sala e o lobby a cada renovação), e `chaveCam` diz por qual aba chega a câmera. O boneco tem o id `n:<fid>`, e o broadcast de qualquer aba daquele nanico move o mesmo boneco. **Não troque a chave da presença pelo `fid`**: duas abas brigariam pela mesma chave.
- **Limite da presença:** o Supabase aceita só 5 `track()` a cada 30 s por pessoa; passou disso, ele fecha o canal (`ClientPresenceRateLimitReached`) e emojis, desenho e o sinal da live se perdem até reconectar. Por isso `trackMe()` sai no máximo 4 vezes a cada 30 s (o resto espera e sai junto, com o estado mais novo). Coisa que muda toda hora vai por broadcast, nunca pela presença. E `enviar()` não manda nada com o canal fora do ar (o supabase-js mandaria pela API, que não entrega em canal privado).
- **Reconexão:** se o canal do lobby cair (`CHANNEL_ERROR`, `TIMED_OUT`, `CLOSED`), o site mostra "Reconectando…" e monta o canal de novo sozinho (1 s, 2 s, 5 s, 10 s, até 30 s), junto com o canal da sala. Ao voltar para a aba, reconecta na hora (ou renova a presença), e a presença se renova a cada 60 s. Os handlers de `aoReceber`/`aoMudarPresenca`/`aoMudarTabela` ficam guardados no módulo e valem no canal novo. `pos` é o piso do boneco no hall (`{i, j}`, conferido por `posHall`) e, se ele estiver sentado, o assento (`s`, um id de `ASSENTOS` em `hall.ts` que sai daquele piso); só muda quando o boneco chega. Tocar num sofá ou poltrona leva o boneco ao piso `chegar` do assento e ele senta (o evento `hall` leva `{i, j, s}`). Sentado não fica salvo no `hall-pos`.
- **Eventos de broadcast:**
  - `rtc`: sinalização da tela, da câmera e da voz;
  - `reacao`: emojis e fotos;
  - `risco`: desenho na live;
  - `hall`: `{ para: {i, j} }`, o destino do boneco. Cada navegador calcula o caminho e anima sozinho (limite de 8 a cada 2 s).
- **Mudanças no banco:** chegam por `postgres_changes` em `friends`, `phrases`, `game`, `chat_messages`, `carteiras`, `rodizio`, `mochila` (equipados), `consumos` (o boneco fumando ou bebendo), `truco_mesas`, `truco_maos`, `bingo_partidas`, `bingo_cartelas`, `bingo_cantos`, `midias`, `mural_links`, `perfil_links`, `rede_posts`, `rede_curtidas`, `rede_comentarios`, `rede_stories`, `rede_mensagens`, `apostas_mercados`, `apostas`, `atributos_aviso` e `respeitos` (no DELETE, `aoMudarTabela` entrega a chave da linha apagada). A chinelada e a torta vêm do tempo real de `zoeiras` (pagas, gravadas por `zoar()`), e o sorteio da roleta do rodízio vem do tempo real de `rodizio` (todo mundo anima até o mesmo `girado_em`), **nunca de broadcast**. Os ganhos de moedas de todo mundo no Sítio vêm do tempo real de `carteiras` (gravado por `creditar()`), **nunca de broadcast**.

### Navegador (`localStorage`, só conveniência de cada pessoa)
- **Chaves:** `rift-lineup`, `rift-card` (cartela do bingo local; numa sala de LoL com o SQL, a cartela vem do banco), `side-min`, `rail-min`, `rail-tab`, `live-fps`, `live-res`, `live-vol`, `desenho`, `reacoes-ver`, `riot-auto`, `riot-visto`, `truco-opt`, `log-visto`, `fome-fechado`, `hall-pos` (último piso no hall), `hall-sala-min` (lista "Na sala agora" do Sítio recolhida), `sala-atual` (última sala; o site sempre abre no lobby), `menu-min` (grupos do menu recolhidos), `canais-voz-min` e `canais-texto-min` (categorias de canais recolhidas; no celular começam recolhidas) `membros-min` (lista de membros só com os rostos; abaixo de 1200 px fica assim sempre) e `midia` (microfone, saída de som, câmera, eco e ruído escolhidos nas Configurações) e `evento-visto` (o aviso que explica o happy hour e o churrasco já apareceu) `missoes-min` (cartão das missões recolhido no Sítio) e `rede-visto` (última postagem da rede nanica vista, para a bolinha de não lidas) e `roleta-som` (`0` = roleta do Cassino no mudo) e `insta-vistos` (ids dos stories que eu já vi no InstaNanico; o banco também guarda em `rede_stories_vistos`) e, da voz e da transmissão, `voz-ajustes` (volume geral, volume e silenciados por nanico), `live-som` (`0` = transmitir sem o som do PC), `live-mostrar` (tela inteira, janela ou aba), `cam-espelho`, `cam-na-grade` e `vz-previa` (`0` = prévia da minha transmissão escondida no menu).
- **As do site antigo continuam iguais**, então ninguém perde a cartela na troca.
- **`sessionStorage`:** `log-auto` (o Log de novidades já abriu sozinho nesta sessão do navegador).
- Nada importante pode morar só aqui.

### Arte (`public/arte/`)
- **`nanicos/{n}-rosto.webp` e `{n}-corpo.webp`:** o número vem de `NAN_MAP` (nome do nanico → número). Os nomes são Abreutz, Alemão, DD, Gamer, Grito, Guiperino, Le Bubu, Henry, Pitoco, John, Veião, Max, Gordão e Pin.
- **Tamanhos:** o rosto tem 160×160 e o corpo, 440 px de altura. Use `artOf(friend)`.
- **`bonecos/*.webp`:** uma spritesheet por nanico para o hall (células de 84×134 nas medidas do código; desde a v1.68 a folha está em 3x, 252×402 px por célula, para ficar nítida ampliada; linhas `frente`/`costas`, colunas `parado` + 4 de andar; os lados esquerdos são o espelho). O formato está em `bonecos/bonecos.json`. Use `bonecoOf(friend)`; quem não tem boneco aparece com o rosto num pino.
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
- **Edge Function `riot-ao-vivo`:** se mexer nela, publique de novo e confira se a aba Jogar ainda mostra "EM PARTIDA". Ela também abre e paga as apostas (seção 14): não tire o passo 5 (resultado das partidas que sumiram).
- **Origens:** a função só aceita chamadas das origens listadas em `ORIGENS`, que incluem a Vercel e `localhost:8810/8811`.
- **Chave da Riot:** fica em **Edge Functions → Secrets → `RIOT_API_KEY`**. Não copie para lugar nenhum.
- **Chave da Steam:** fica em **Edge Functions → Secrets → `STEAM_API_KEY`** (tirada em steamcommunity.com/dev/apikey). Sem ela, a ficha mostra só os números do LoL.
- **Edge Function `riot-semana`** (usa o segredo `RIOT_API_KEY`): o site chama ao entrar quando a semana anterior (segunda a domingo, Brasília) não está pronta. Só uma pessoa calcula por vez (`semana_vez`); cada chamada faz no máximo 40 consultas à Riot com pausa e guarda o progresso, e a próxima continua (o site tenta de novo a cada 2,5 min). No fim grava `trofeus_semana` e paga com `trofeus_pagar` (+50 Carregou o piano, +20 Viciado; o `ref` com a semana evita pagar duas vezes). `hall_da_fama()` conta os 1º lugares. O "Mais rico" não tem tabela: é o maior saldo de `carteiras`, ao vivo.
- **Edge Function `truco-mesa`:** publicada pelo MCP do Supabase (ou `npx supabase functions deploy truco-mesa`) com os dois arquivos da pasta, `index.ts` e `engine.ts`. Antes de publicar, rode `npm run sincronizar:truco`. Usa só a chave do próprio Supabase.
- **Edge Function `ficha-jogos`:** busca cada fonte de um nanico no máximo uma vez a cada 6 h (usa no máximo 25 chamadas à Riot por vez). O CS vem da API pública do Leetify (sem chave) pelo número da Steam do `friends.steam` (link `/profiles/<17 dígitos>`; link `/id/` só com a chave da Steam); a GC é o nível da partida mais recente na Gamers Club. As origens aceitas são as mesmas da `riot-ao-vivo`.

### Pendências conhecidas
- **Validar a v2 com o grupo:** login, sala, live, câmera, chat, truco entre duas abas, Riot. Depois disso, apagar `legacy/`.
- **`dados.ts` ↔ `features/jogar/riot.ts`:** um importa o outro. Funciona porque nenhum usa o outro ao carregar. Não chame nada do outro módulo no topo do arquivo.

### Para quem usa IA no projeto
- **Antes de editar:** leia o arquivo que vai mudar e este CLAUDE.md. Não reescreva arquivos inteiros "do zero" para mudar um pedaço.
- **Reaproveite:** use o que já existe (`Avatar`, `FriendPicker`, `toast`, `useSure`, `friendOf`, `enviar`/`aoReceber`, `trOpcoes` etc.) em vez de criar outro parecido.
- **Não invente:** nada de dependências, CDNs ou fontes novas sem motivo forte (regra 8).
- **Para conferir comportamento:** o site antigo está em `legacy/index.html` (as artes em base64 deixam o arquivo enorme; procure pelo nome da função).
- **Mexeu na estrutura** (pasta nova, padrão novo, comando novo)? Atualize este arquivo.
- **Dúvida sobre regra do grupo** (nomes, regras do truco, o que é nanicada): pergunte ao Felippe.
