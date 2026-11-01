# Bingo dos Nanicos

Site privado de um grupo de amigos que joga League of Legends. Tem:

- bingo de "nanicadas" (frases e manias do grupo);
- transmissão de tela, câmera, chat, reações e desenho na live;
- partida ao vivo pela API da Riot;
- truco gaudério.

Quem usa são os 14 nanicos, cada um com o seu login.

Este arquivo vale para qualquer pessoa ou IA (Claude, Copilot etc.) que mexa no projeto. **Leia tudo antes de mudar qualquer coisa.**

---

## 1. Como o projeto é montado

| Arquivo | O que é |
|---|---|
| `index.html` | **O site inteiro** num arquivo só: HTML, CSS e JavaScript, com as artes em base64 (~1,2 MB). Não tem build, framework nem `npm`. |
| `supabase.js` | Biblioteca oficial `@supabase/supabase-js@2.45.4` (UMD), servida pelo próprio site. **Não editar.** |
| `vercel.json` | Cabeçalhos de segurança (CSP etc.). Qualquer domínio externo novo precisa ser liberado aqui. |
| `supabase/functions/riot-ao-vivo/index.ts` | Edge Function do Supabase que consulta a API da Riot. A chave fica no segredo `RIOT_API_KEY`, **nunca** no código. |
| `seguranca.sql` | SQL principal de permissões, anti-spam, nanicadas v2, op.gg e tabelas da Riot. Pode rodar de novo sem quebrar nada. |
| `contas-e-ao-vivo.sql` | Logins por nanico, sala privada e chat. Também pode rodar de novo. |
| `supabase.sql` | Estrutura original das tabelas, da primeira versão. |
| `LEIA-ME.md` | Passo a passo antigo de publicação. |
| `sql-antigos/` | Ajustes que já foram rodados uma vez (renomear nanicos, nanicadas em minúsculas). Ficam só como histórico; não precisa rodar de novo. |
| `.gitignore` | Impede que o `criar-logins.sql` e arquivos de segredo subam por engano. |

- **Hospedagem:** Vercel, que publica sozinha a cada push na branch principal.
- **Banco, login e tempo real:** Supabase.
- **Transmissão e câmera:** WebRTC direto entre os navegadores. O Supabase só faz a sinalização.

### Nunca suba para o GitHub
- `criar-logins.sql`, que tem as senhas iniciais dos nanicos. Se ele aparecer no repositório, apague e troque as senhas.
- Qualquer chave **secret** ou **service_role** do Supabase, a chave da Riot (`RGAPI-...`) ou arquivos `.env`.
- No `index.html` só pode existir a **publishable key** do Supabase, que é pública por natureza.

---

## 2. Regras que não podem ser quebradas

1. **Segurança vem do banco, não do site.** Toda permissão é garantida por RLS, `GRANT` por coluna e gatilhos no Postgres. Nunca "proteja" algo só escondendo um botão.
2. **Todo SQL novo tem que poder rodar de novo:**
   - use `create ... if not exists`, `create or replace` e `drop policy if exists`;
   - acrescente no `seguranca.sql` em vez de criar arquivos soltos;
   - teste antes num projeto de teste ou num Postgres local.
3. **Nada de texto vindo de usuário vai para `innerHTML` sem `esc()`.** Isso vale para nomes, nanicadas, chat, presença, mensagens da sala e dados da Riot. Use sempre `esc()`, já definido no site.
4. **Mensagens da sala (broadcast) não são confiáveis:**
   - todo handler confere o tipo e o tamanho dos dados;
   - confere se o remetente está em `online`;
   - tem limite de mensagens por pessoa, como já fazem `onRtc`, `onReacao`, `onRisco` e `onTruco`.
5. **Não quebrar a CSP.** Script só do próprio site, e conexões só com o Supabase do projeto. Imagem externa só de `ddragon.leagueoflegends.com` e `raw.communitydragon.org`. Para liberar outro domínio, edite o `vercel.json` e explique o motivo no commit.
6. **Não trocar a versão do `supabase.js`** sem testar login, sala, chat, transmissão e truco.
7. **Não deixar dados reais em teste.** Não use senhas reais em exemplos, prints ou issues.

---

## 3. Padrão visual

### Cores (variáveis CSS em `:root`, com versão escura em `prefers-color-scheme` e `[data-theme]`)
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

### Tipografia
- **Unbounded** (`var(--display)`) só em títulos, placar, números e etiquetas curtas.
- **Onest** (`var(--body)`) em todo o resto.
- Não adicionar outras fontes.

### Componentes que já existem (reaproveite, não recrie)
- **Botões:** `.btn` (principal, ouro), `.btn.soft` (secundário), `.btn.sm` e `.linkish` (link discreto).
- **Seleção:** `.seg` com `role="radio"`, para escolhas tipo "1080p / 1440p".
- **Blocos e etiquetas:** `.block` (cartão de seção), `.hint` e `.status` (texto apagado), `.live-pill` (AO VIVO).
- **Rostos:** `avatar(friend, "xs"|"lg")` desenha o rosto de cada nanico a partir de `NAN_ART`.
- **Aviso rápido:** `toast("texto")`.
- **Confirmação:** ações destrutivas pedem um **segundo toque** (classe `.sure`, texto "Confirmar"), nunca `confirm()` ou `alert()`.

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
- **Nomes de função:** "nanicadas", "nanicos", "mão", "vaza", "escalação". Mantenha o vocabulário do grupo.

---

## 4. Modelos de dados

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

### Sala em tempo real (canal privado `bingo-dos-nanicos`)
- **Presença:** `{name, fid, lines, live, cam, at}`, conferida por `cleanPresence()`.
- **Eventos de broadcast:**
  - `rtc`: sinalização da tela e da câmera;
  - `reacao`: emojis e fotos;
  - `risco`: desenho na live;
  - `truco`: mesas, jogadas e mão de cada um.
- **Mudanças no banco:** chegam por `postgres_changes` em `friends`, `phrases`, `game` e `chat_messages`.

### Navegador (`localStorage`, só conveniência de cada pessoa)
`side-min`, `rail-min`, `rail-tab`, `live-fps`, `live-res`, `live-vol`, `desenho`, `reacoes-ver`, `riot-auto`, `riot-visto`, `truco-opt`, `truco-mesa`, `log-visto` e `fome-fechado`. Nada importante pode morar só aqui.

### Dentro do `index.html`
- **`NAN_MAP`:** nome do nanico → número da arte. Os nomes são Abreutz, Alemão, DD, Gamer, Grito, Guiperino, Le Bubu, Henry, Pitoco, John, Veião, Max, Gordão e Pin.
- **`NAN_ART`:** `{n: {face, full, w, h}}` em WebP base64. `face` tem 160×160, recorte do rosto. `full` tem 440 px de altura, corpo inteiro.
- **`CREW`:** foto da turma, 1100 px de largura, fundo transparente.
- **`CHAMPS`:** lista de campeões com os nomes oficiais da Riot. **`LANE_CAMP`** guarda a lane de cada um, para a escalação automática.
- **`CHANGELOG`:** o log de versões (veja a seção 5).

---

## 5. Versão e Log (obrigatório a cada mudança visível)

A versão (`v1.NN`) é **calculada sozinha** pelo tamanho do array `CHANGELOG`. Toda mudança que um nanico consiga notar acrescenta **uma entrada no fim**:

```js
{data:"DD/MM/AAAA",itens:["Frase curta dizendo o que mudou para quem usa"]},
```

- Escreva só funcionalidades, sem termos técnicos.
- Quando uma função deixar de existir ou for substituída, **não apague** o item antigo. Troque por:
  `{t:"texto antigo", off:"trocado por … na v1.NN"}`. Ele aparece riscado no Log.

---

## 6. Como trabalhar

1. Crie uma **branch** (`git checkout -b minha-mudanca`). Não faça commit direto na principal sem combinar com o Felippe.
2. Faça a mudança **pequena e focada**. Não reformate o arquivo inteiro: o `index.html` é enorme e um diff gigante esconde erro.
3. Antes do commit, confira:
   - [ ] a sintaxe do JavaScript: extraia o último `<script>` e rode `node --check`;
   - [ ] o site abre, faz login e mostra "Sincronizado" (teste numa preview da Vercel);
   - [ ] nada quebrou no celular, com largura de 390 px;
   - [ ] o console do navegador está sem erros e sem bloqueio de CSP;
   - [ ] a entrada nova está no `CHANGELOG`;
   - [ ] se mexeu no banco: o SQL roda duas vezes seguidas sem erro, e as permissões continuam fechadas.
4. Commit com mensagem em português dizendo **o quê** e **por quê** (ex.: `Truco: botão de ir ao mazo pede confirmação`).
5. Abra um Pull Request e espere outra pessoa olhar antes de juntar.

### Mudanças no Supabase
- **Nunca** apague tabelas nem dados pelo Table Editor sem avisar o grupo.
- **SQL:** primeiro no arquivo do repositório, depois no SQL Editor. Nada de mudança "só no painel".
- **Edge Function `riot-ao-vivo`:** se mexer nela, publique de novo e confira se a aba Jogar ainda mostra "EM PARTIDA".
- **Chave da Riot:** fica em **Edge Functions → Secrets → `RIOT_API_KEY`**. Não copie para lugar nenhum.

### Para quem usa IA no projeto
- **Antes de editar:** leia o trecho que vai mudar. Não reescreva seções inteiras "do zero".
- **Reaproveite:** use as funções que já existem (`esc`, `avatar`, `toast`, `friendOf`, `trOpcoes` etc.) em vez de criar outras parecidas.
- **Não invente:** nada de dependências, frameworks, CDNs ou fontes novas.
- **Dúvida sobre regra do grupo** (nomes, regras do truco, o que é nanicada): pergunte ao Felippe.
