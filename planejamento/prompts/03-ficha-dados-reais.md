# Fase 3: Ficha do nanico com dados reais (Riot e Steam) e link da Steam

**Branch:** `ficha-dados-reais` · **Depende de:** migração juntada · **Banco:** sim · **Edge Function:** nova

## Objetivo (para quem usa)
Na aba Nanicos, clicar num nanico abre a **ficha**, com duas partes:
- **à esquerda:** a arte de corpo inteiro dele, em pé num quarto isométrico 2.5D;
- **à direita:**
  - **LoL:** elo, vitórias nas ranqueadas da season e KDA e main das últimas 20 partidas;
  - **Steam:** horas de CS2 (e o total de horas);
  - **links:** op.gg e Steam.

No Perfil, cada um coloca o próprio link da Steam, igual faz com o op.gg. A metade zoeira (atributos votados) é a **fase 4**: deixe só o espaço para ela.

**Modelo visual:** `planejamento/demo/ficha-demo.html` e `.png`. Use a parte do quarto (funções `p()`, `poly()`, `box()`) como ponto de partida, mas reescreva em React/TSX, com as cores das variáveis CSS. A mochila e o "Hoje" da demo ficam para as fases 2 e 11.

## Antes de começar
Siga as "Regras de toda sessão" de `planejamento/PLANO.md`. Leia:
- `supabase/functions/riot-ao-vivo/index.ts`: o padrão de função (CORS com `ORIGENS`, conferir nanico, chave secreta, `riot_vez` para não estourar a Riot);
- `supabase/sql/seguranca.sql`, seções 4b e 4c: op.gg, `perfil_protecao`, tabelas da Riot com `revoke all`;
- `src/features/perfil/opgg.ts` e `opgg.test.ts`: o modelo para validar o link da Steam;
- `src/features/perfil/PerfilView.tsx`, `src/features/nanicos/NanicosView.tsx`, `src/lib/dados/nanicos.ts` (`artOf`, `CORPO_W`) e `src/features/jogar/riot.ts` (como o site chama a função).

## Como fazer

### Banco (seção "8) ficha" no `seguranca.sql`)
- **Coluna `friends.steam`:**
  - check de formato: `^https://steamcommunity\.com/(id/[A-Za-z0-9_-]{2,32}|profiles/7656\d{13})/?$`;
  - `grant update (steam)`;
  - **atualize `perfil_protecao`** para deixar passar `steam` (hoje ela só deixa `opgg`).
- **Tabela `jogos_stats(friend_id uuid → friends, fonte text check in ('lol','steam'), dados jsonb not null, erro text, atualizado timestamptz, primary key(friend_id, fonte))`:**
  - **RLS:** nanicos leem e ninguém escreve; o `grant` de escrita é só para `service_role`, como nas tabelas da Riot.
  - `dados` tem formato fixo e pequeno.
    - **LoL:** `{tier, rank, lp, vitorias, derrotas, kda, main, partidas}`.
    - **Steam:** `{cs2_horas, total_horas, privado}`.
- **Tabela `riot_partidas_vistas(friend_id, match_id, kills, deaths, assists, campeao, em)`** para o KDA ser incremental. Só a função mexe.

### Edge Function nova `supabase/functions/ficha-jogos/index.ts`
- **Mesmo esqueleto da `riot-ao-vivo`:** CORS com `ORIGENS`, só POST, confere o JWT e se é nanico, e `chaveSecreta()`.
- **Atualização:** recebe `{friend_id}` e atualiza **só esse nanico**, no máximo uma vez a cada 6 h por fonte. Se ainda está fresco, devolve o cache.
- **LoL** (usa `riot_contas.puuid`, que a `riot-ao-vivo` já preenche):
  - `league-v4` por puuid dá elo e vitórias/derrotas da ranqueada solo;
  - `match-v5` dá os ids das últimas 20 partidas, e a função busca **só os que ainda não estão** em `riot_partidas_vistas`;
  - calcula KDA e main (o campeão mais jogado) dessas 20;
  - respeita o limite da chave: no máximo 25 chamadas por execução.
- **Steam** (segredo novo `STEAM_API_KEY`):
  - `ISteamUser/ResolveVanityURL` quando o link é `/id/…`;
  - `IPlayerService/GetOwnedGames?include_played_free_games=1`, com appid 730 = CS2;
  - perfil ou "detalhes de jogos" privado vira `privado: true`, sem erro.
- **Devolve** o que está em `jogos_stats` desse nanico.
- **Origens:** acrescente a `ORIGENS` a mesma lista da `riot-ao-vivo`.

### Site
- **`src/features/perfil/steam.ts` + `steam.test.ts`:** `cleanSteam()` no molde do `cleanOpgg()`. Aceita colar sem `https://` e com barra no fim.
- **Perfil:** um campo "Steam" ao lado do op.gg, com a mesma gravação e as mesmas mensagens. Se a Steam estiver privada, mostre um `<details>` "Como deixar as horas visíveis".
- **Aba Nanicos:**
  - a grade continua; clicar abre a ficha (painel ou modal, conforme o que já existe), que fecha com Esc e tem foco preso;
  - **`Quarto.tsx`:** um SVG isométrico com a arte `artOf(f).full` numa `<image>` com sombra;
  - **`Ficha.tsx`:** os números reais em blocos `.st`, os links e o espaço reservado "Segundo os nanicos (em breve)" escondido até a fase 4;
  - ao abrir, chama a função para aquele nanico e mostra "atualizado há X min".
- **Carregamento:** `jogos_stats` carrega junto com os amigos (um `select` só) e entra em `aoMudarTabela` se você acrescentar a tabela no `sala.ts`. Senão, recarrega ao abrir a ficha.
- **Celular:** com 390 px, o quarto fica em cima e os dados embaixo.

## Não faça
- Não chame a Riot ou a Steam do navegador. A CSP bloqueia, e a chave não pode sair do servidor.
- Não guarde a chave em nenhum arquivo.
- Não crie imagens novas. No quarto da ficha, use o **boneco estilo Habbo parado** (`bonecoOf(friend)`, da fase 00, quadro `parado` de `frente`). Se a fase 00 ainda não estiver na `main`, use a arte de corpo inteiro (`artOf(friend).full`) e deixe o `Quarto.tsx` recebendo a imagem por props.
- Não implemente os votos (fase 4).

## Pronto quando
- [ ] O SQL roda duas vezes, e o cliente não consegue escrever em `jogos_stats`.
- [ ] Salvar um link da Steam inválido mostra um erro que diz o formato certo.
- [ ] A ficha de quem tem op.gg mostra elo e KDA. A de quem tem Steam pública mostra as horas. A de quem tem Steam privada mostra a dica.
- [ ] Abrir a ficha 10 vezes seguidas não chama a Riot 10 vezes (cache de 6 h).
- [ ] O console fica sem erro de CSP. Funciona com 390 px. O `CLAUDE.md` traz a função nova, o segredo `STEAM_API_KEY` e as tabelas.
- [ ] O PR explica como publicar a função e cadastrar o segredo.

## Entrada do CHANGELOG
`"Ficha de cada nanico na aba Nanicos: elo, KDA, main e horas de CS2, com o boneco no quarto"`, `"Perfil aceita o link da Steam"`
