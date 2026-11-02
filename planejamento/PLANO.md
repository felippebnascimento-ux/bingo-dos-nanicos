# Plano das próximas features

Decisões combinadas com o João em 01/11/2026. Vale para qualquer pessoa ou IA que pegar uma fase.
**Leia o `CLAUDE.md` antes deste arquivo.** Se as duas coisas brigarem, o `CLAUDE.md` vence e este plano é corrigido.

## Como usar

### Duas sessões, dois papéis
- **Sessão de planejamento:** só decide e escreve. Ela atualiza este `PLANO.md`, os prompts (`planejamento/prompts/`), as demos e os arquivos de arte prontos (`planejamento/assets/`). **Não mexe no código do site.**
- **Sessão de atualizações:** implementa uma fase por vez, seguindo o prompt daquela fase, e abre um PR por fase.

### Como passar uma fase de uma para a outra
1. **Uma vez:** a pasta `planejamento/` precisa estar na `main` (o PR da branch `planejamento`, que só tem documentos e arte), para toda sessão enxergá-la a partir da `main`.
2. **Na sessão de atualizações**, para cada fase, mande:
   > Leia o CLAUDE.md e o planejamento/PLANO.md. Depois leia planejamento/prompts/NN-nome.md e faça o que ele pede, só essa fase, numa branch nova a partir da main.
3. **A sessão de atualizações:**
   - mostra o plano curto e espera o "ok";
   - implementa;
   - roda `npm run check`;
   - abre o PR;
   - marca a fase como feita em **Andamento**.
4. **Uma feature por vez.** A próxima fase só começa depois que a anterior foi revisada e juntada na `main`.
5. **Mudou alguma ideia no meio?** Volte para a sessão de planejamento, que corrige o plano e o prompt. A sessão de atualizações não decide sozinha o que não está escrito.

## Regras de toda sessão (os prompts apontam para cá)

1. **Leia antes:** o `CLAUDE.md` inteiro, este plano e todos os arquivos que o prompt citar. Não reescreva arquivo do zero para mudar um pedaço.
2. **Branch:** comece da `main` atualizada (com a migração para Next.js já juntada) e crie a branch que o prompt indica.
3. **Plano primeiro:** antes de editar, mostre um plano curto (arquivos novos e alterados, SQL, eventos, chaves) e espere o "ok".
4. **Só esta feature.** Achou outro problema? Anote em "Fora do escopo" na descrição do PR e não conserte.
5. **Banco:**
   - SQL novo vai numa seção numerada no fim de `supabase/sql/seguranca.sql`;
   - tem que poder rodar de novo (`if not exists`, `create or replace`, `drop policy if exists`);
   - use `revoke`/`grant` explícitos e `security definer set search_path = public`;
   - use `public.limitar()` contra spam;
   - erros dizem o que fazer;
   - atualize a consulta de conferência do fim do arquivo.
   - **Nunca** rode SQL no projeto real: teste num Postgres local ou num projeto de teste e entregue o SQL para o admin colar no SQL Editor.
6. **Moedas e prêmios:** o saldo só muda por `public.creditar()` (fase 2), chamada de dentro de outra função do banco. O navegador nunca decide ganho, perda nem sorteio.
7. **Regra pura** (economia, cassino, bingo, truco) fica em `.ts` sem React, com `*.test.ts` ao lado.
8. **Tempo real:** evento novo vai em `EVENTOS` (`src/lib/sala.ts`) e segue a regra 4 do `CLAUDE.md`: tipo, tamanho, `estaNaSala`, `limitePorPessoa`.
9. **Tela:**
   - reaproveite `.btn`, `.seg`, `.block`, `Avatar`, `FriendPicker`, `toast`, `useSure`, `icones.tsx` e `local`;
   - use as cores das variáveis;
   - CSS de área nova vai num arquivo novo numerado no fim de `src/styles/`, importado em ordem no `layout.tsx`;
   - tem que funcionar com 390 px sem rolagem para o lado;
   - foco visível, `aria-label` e `prefers-reduced-motion`.
10. **Segredos:** chaves (Riot, Steam) só nos Secrets das Edge Functions. Domínio externo novo só com motivo e editando a CSP do `vercel.json`.
11. **Fechamento:**
    - uma entrada nova no fim do `CHANGELOG`;
    - o `CLAUDE.md` atualizado (tabelas, funções, eventos, chaves do `localStorage`, pastas);
    - `npm run check` passando;
    - teste no `npm run dev`: login, "Sincronizado", 390 px e console sem erro de CSP;
    - commit em português;
    - PR para `main` com o que foi testado e o SQL a rodar, na ordem.

## Decisões

### Atributos (ficha do nanico)
- **Metade real:**
  - **LoL** pela Riot: elo, vitórias, KDA e main.
  - **CS2 e outros jogos** pela Steam: horas jogadas.
  - **Links:** op.gg e Steam.
- **Metade zoeira:** Tilt, Choro, Clutch (CS2), Farm, Sorte e Call, com notas de 0 a 10.
  - O voto é **anônimo**: o site só recebe média e contagem, e o atributo só aparece com 3 votos ou mais.
  - Ninguém vota em si mesmo.
  - Cada um muda o voto em alguém uma vez por semana.
- **Boneco (decidido em 02/11/2026, falta o ok do grupo):**
  - os bonecos são **gerados com IA (GPT Image 2.5, pela ferramenta Higgsfield) a partir da arte de cada nanico**, em pixel limpo no estilo Habbo, desenhados do zero (sem usar o corpo do Habbo);
  - **4 sentidos:** frente-direita, frente-esquerda, costas-direita e costas-esquerda (as diagonais do piso);
  - **prontos:** os 14 parados, em `planejamento/demo/ia/` (`geradas/` são as imagens originais, `poses/pose-<n>-<sentido>.png` são as poses recortadas, `n` vem do `NAN_MAP`, e `recortar.py` tira o fundo e separa as poses);
  - **o prompt** que funcionou está em `planejamento/demo/ia/LEIA.md`;
  - **andar pronto para os 14:** 4 quadros de frente e 4 de costas por nanico, em `andar/andar-q-<n>-<frente|costas>-<0..3>.png`, alinhados pela cabeça; os lados esquerdos são o espelho (`montar-andar.py`, `andar-todos.png`, `todos-andando.gif`);
  - **falta:** sentar/acenar (se quiserem) e transformar os quadros em spritesheets leves para o site (`public/arte/bonecos/`);
  - **não reaproveite** as tentativas desenhadas por código; foram recusadas.

### Hall (lobby) = Sítio do Mitz
- **O que é:** o lobby da fase 5 é um cômodo isométrico inspirado no sítio do grupo, desenhado por código em SVG, sem fotos. Modelo: `planejamento/demo/hall.html` e `.png`.
- **Paredes:** tijolinho claro com alguns tijolos avermelhados, viga e pilares cinza, beiral de madeira com tronco em cima e janelas velhas penduradas como enfeite.
- **Piso:** lajota clara.
- **Objetos que levam para algum lugar:**
  - a **TV** mostra quem está ao vivo;
  - a **porta de tábuas** com a placa "K-FOFO 2018" leva às salas de LoL e CS;
  - a **porta de vidro** para o gramado leva à Resenha.
- **Enfeites:** churrasqueira de tijolo com coifa, relógio, quadro, geladeira e freezer brancos, mesa comprida com toalha, mesa de toalha verde, cadeiras de plástico brancas e colchões infláveis azuis.
- **Hall v2 (pedido de 01/11/2026, fase 14):** modelo em `planejamento/demo/hall-v2.html` e `.png`.
  - **Mais espaço e mais alegre:** piso de 14×11 para caber os 14 bonecos, cores mais claras e um janelão com árvores na parede do fundo.
  - **Móveis que abrem coisas, com placa em cima:** TV = Ao vivo, mesa verde = Truco, geladeira e freezer brancos = Loja.
  - **Piso marcado:** contorno branco no piso embaixo do mouse.
  - **Cantos:**
    - "Na sala agora" em cima, à esquerda, e clicar num nome abre a ficha;
    - ganhos de moedas de todo mundo em cima, à direita, vindos do banco e não do broadcast;
    - carteira pequena embaixo, à esquerda.
  - **Menu:** "Perfil" mostra o rosto de quem está logado.
- **Celular e rede social nanica (fase 15):**
  - é um item da loja;
  - quem compra posta, curte e comenta na rede do grupo, com imagens no bucket `midias`;
  - sem o celular, o banco não deixa ler nem postar.

### Moedas
| Fonte | Valor |
|---|---|
| Ao criar a carteira | 200 |
| Tempo online | 1 moeda a cada 6 min com o site aberto (conta mesmo com a aba escondida, decisão de 01/11/2026), no máximo 40 por dia |
| Bônus diário | `round(30 × multiplicador)`, uma vez por dia (horário de Brasília) |
| Sequência | multiplicador = `min(1 + 0,1 × (dia − 1), 2)`: chega a ×2 no dia 11; perdeu um dia, volta a ×1 |
| Prêmio da sequência | +100 no dia 7 e +500 no dia 30 |
| Bingo e truco | +25 por bingo e +15 por vitória no truco, no máximo 3 de cada por dia, só com o resultado conferido pelo servidor |

- **Para onde as moedas vão:** a vantagem da casa no cassino e a loja (itens de 150 a 2.000).

### Cassino (moedas fictícias, sem compra e sem saque)
| Jogo | Regra | Quanto a casa leva |
|---|---|---|
| Roleta europeia | 37 casas; número paga 35×; cor, par/ímpar e metade pagam 1× | 2,7% |
| Limbo ("crash") | a pessoa escolhe um alvo x entre 1,01 e 100; o resultado é `0,97 / (1 − u)`; ganha x × aposta se o resultado ≥ x | 3% |
| Maior ou menor | sorteio de 0 a 9999; paga `0,97 / chance` | 3% |
| Caça-níquel dos nanicos | 3 rolos com os rostos e tabela de pagamentos no banco | 8% (RTP de 92%) |
| Apostas na partida ao vivo | as apostas dos dois lados vão para um bolo só (pari-mútuo) | 5% do bolo |

- **Aposta:** de 5 a 100 moedas e no máximo 30 apostas por minuto.
- **Sorteio:** acontece **no banco**, com HMAC-SHA256 de uma semente do servidor + a semente da pessoa + um contador (nonce), usando `pgcrypto`.
- **Conferência ("provably fair"):**
  - antes da aposta, a pessoa vê o hash da semente do servidor;
  - quando ela pede uma semente nova, a antiga é revelada e qualquer um confere os resultados.

### Proteção contra trapaça
- **Bingo:**
  - O servidor sorteia a cartela e a guarda.
  - "Aconteceu!" só marca a casa quando **outro** nanico confirma.
  - O servidor confere as linhas e paga.
  - A cartela montada à mão não dá moedas.
- **Truco:**
  - A mesa roda numa Edge Function com o mesmo `engine.ts`.
  - Cada um lê só a própria mão, garantido por RLS.
  - O prêmio é pago pela função quando a partida termina.
- **O que não dá para impedir:** combinação pelo Discord. Por isso os prêmios têm limite por dia.

### Salas tipo lan house
- **Para que servem:** a call do Discord se dividiu, então cada grupo vai para uma sala. Não tem voz no site.
- **Lobby (tela inicial):** os cartões das salas mostram quem está em cada uma, quem está ao vivo e quem está em partida.
- **Cada sala tem:** presença, live, câmeras, reações, desenho e chat próprios.
- **No lobby, para todos:** chat geral, truco e cassino.
- **Salas fixas, criadas pelo admin:** LoL 1, LoL 2, CS e Resenha.
- **Escalação e bingo:** só nas salas de LoL.

### Log do site
- **Quando aparece:** sozinho, no primeiro login depois de uma versão nova, mostrando só o que mudou desde a última vez da pessoa. Depois disso não abre mais sozinho.
- **Onde guarda o "já vi":** na conta da pessoa (`user_metadata.log_visto`), então vale para todos os aparelhos.

### Ainda sem decisão
- **"Poder mudar a senha de novo":** o botão "Trocar senha" já existe. Falta saber se o problema é o botão não funcionar ou se é recuperar uma senha esquecida (hoje só o admin reseta).

## Fila de ideias (ainda sem prompt)
Quando uma delas for a próxima, a sessão de planejamento escreve o prompt.
- **Balão do chat no hall:** a mensagem aparece por 5 s em cima do boneco de quem escreveu.
- **Sentar e acenar:** sentar nas cadeiras e no colchão do hall, e acenar com um botão. São mais quadros gerados com IA, no mesmo estilo.
- **Gramado da Resenha:** a área de fora do Sítio, com as cadeiras de plástico na grama, como sala.
- **Trocar a senha de novo:** falta saber se o problema é o botão não funcionar ou se a ideia é recuperar uma senha esquecida.

## Ordem e andamento

| Fase | Prompt | Branch | Depende de | Estado |
|---|---|---|---|---|
| 0 | migração Next.js (PR #1) | `nextjs-migracao` | — | em revisão |
| — | pasta `planejamento/` na `main` | `planejamento` | — | feita (PR #2) |
| 00 | `00-hall-sitio-bonecos.md` | `hall-sitio` | 0 | **feita**, PR aberto (em cima da `nextjs-migracao`, porque o PR #1 ainda não entrou) |
| 1 | `01-log-novidades.md` | `log-novidades` | 0 | **feita**, PR aberto (em cima da `hall-sitio`) |
| 2 | `02-carteira-moedas.md` | `carteira-moedas` | 0 | **feita**, PR aberto (em cima da `log-novidades`); SQL da seção 7 já aplicado no Supabase em 01/11/2026 |
| 3 | `03-ficha-dados-reais.md` | `ficha-dados-reais` | 0 | **feita**, PR aberto (em cima da `carteira-moedas`); SQL da seção 8 aplicado e função `ficha-jogos` publicada em 01/11/2026; falta o segredo `STEAM_API_KEY` |
| 4 | `04-atributos-votados.md` | `atributos-votados` | 3 | **feita**, PR aberto (em cima da `ficha-dados-reais`); SQL da seção 9 aplicado em 01/11/2026 |
| 5 | `05-salas-lan-house.md` | `salas-lan-house` | 00, 3 | a fazer |
| 6 | `06-cassino-roleta.md` | `cassino-roleta` | 2 | a fazer |
| 7 | `07-cassino-jogos.md` | `cassino-jogos` | 6 | a fazer |
| 8 | `08-bingo-servidor.md` | `bingo-servidor` | 2, 5 | a fazer |
| 9 | `09-truco-servidor.md` | `truco-servidor` | 2 | a fazer |
| 10 | `10-apostas-ao-vivo.md` | `apostas-ao-vivo` | 6 | a fazer |
| 11 | `11-loja-quarto.md` | `loja-quarto` | 2, 3 | a fazer |
| 12 | `12-midias-links.md` | `midias-links` | 5 | a fazer |
| 13 | `13-login-convidado.md` | `login-convidado` | 5 | a fazer |
| 14 | `14-hall-v2.md` | `hall-v2` | 00, 2, 3 | a fazer (pode vir logo depois da 3) |
| 15 | `15-celular-rede-nanica.md` | `celular-rede-nanica` | 11, 12 | a fazer |
