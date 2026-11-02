# Fase 14: Hall v2 (sala maior e mais clara, móveis clicáveis, carteira, "Na sala agora" e ganhos de moedas)

**Branch:** `hall-v2` · **Depende de:** fases 00 (hall), 2 (moedas) e 3 (ficha, `fichaAberta`) juntadas · **Banco:** sim, pouco (seção "7b) moedas ao vivo" no `seguranca.sql`)

## Objetivo (para quem usa)
O modelo novo está em `planejamento/demo/hall-v2.html` e `hall-v2.png`. Abra os dois antes de começar.
- **Sala maior e mais alegre:**
  - o piso passa de 11×9 para **14×11**, com o meio livre para os 14 bonecos andarem;
  - tijolo, lajota e madeira ficam mais claros e quentes;
  - na parede do fundo entra um **janelão com árvores**, céu e sol, e a luz dele aparece no chão.
  - **fundo claro em volta do cômodo:** um creme quente em degradê (`--hall-fundo-1`/`--hall-fundo-2`) no lugar do fundo escuro do site. No tema escuro, fica um marrom acolhedor, mais fechado, mas nunca preto. Os cantos (lista, ganhos, carteira) continuam escuros e legíveis por cima.
- **Móveis que abrem coisas,** cada um com uma **placa com o nome** em cima (no estilo das placas de nome dos bonecos, com borda `--accent`):
  - **TV → "Ao vivo"** (abre a aba Ao vivo). Quando alguém transmite, a placa mostra o selo `AO VIVO`;
  - **mesa verde → "Truco"** (abre a aba Truco). A placa mostra quantos estão numa mesa, se houver ("2 na mesa");
  - **geladeira e freezer brancos → "Loja"**. Até a fase 11 existir, o clique mostra `toast("A loja abre em breve")`; depois, abre a loja.
- **Portão K-FOFO aberto** (ver `hall-v2.png`): a folha de tábuas fica aberta para dentro, encostada na parede, e pelo vão aparecem a rua, a calçada, um carro branco parado e a árvore grande. A placa "Rua" só aparece quando a fase 16 existir; até lá, o portão é só paisagem e o piso dele continua bloqueado.
- **Piso em destaque:** com o mouse em cima de um piso livre, ele ganha um **contorno branco** (e um véu branco leve). Piso com móvel não ganha destaque. No celular, o piso tocado pisca o contorno uma vez.
- **Cantos da tela do hall:**
  - **em cima, à esquerda: "Na sala agora"**, com rosto e nome de quem está no site. Clicar num nome abre a **ficha** daquela pessoa. Quem está ao vivo tem o selo `AO VIVO` e um botão "Assistir" (o que o `goWatch` já faz);
  - **em cima, à direita: ganhos de moedas**, um aviso por ganho com rosto, nome, quanto e por quê ("Pitoco +36 moedas · bônus do dia"). Aparece para os ganhos de **todo mundo**, tanto o bônus ao entrar quanto o tempo online, o truco etc.;
  - **embaixo, à esquerda: carteira** pequena com o seu saldo e a sua posição ("1.284 · 3º lugar"). Clicar abre o painel da carteira com duas abas (`.seg`):
    - **"Ranking":** os 14 nanicos do mais rico ao mais pobre, com posição, rosto, nome e saldo; o 1º com a coroa de moedas (desenho da fase 21) e você destacado em `--accent`. Clicar num nome abre a ficha. Modelo: `planejamento/demo/ranking.html` e `.png`;
    - **"Meu extrato":** o `MoedasBloco` do Perfil;
  - **embaixo, à direita:** a dica "Clique no chão para andar".
- **Clicar num boneco** também abre a ficha da pessoa.
- **Menu:** o item "Perfil" mostra o **seu rosto** (`Avatar`, tamanho `xs`) no lugar do ícone, com o texto "Perfil".

## Antes de começar
Siga as "Regras de toda sessão" de `planejamento/PLANO.md`. Leia:
- `planejamento/demo/hall-v2.html`: a geometria nova (`NI=14`, `NJ=11`, `X0=700`), o janelão com `clipPath`, as cores, a posição de cada móvel, das placas e dos cantos;
- `src/features/hall/*` e `src/styles/22-hall.css` (como o hall está hoje: `MOVEIS`, `VB`, `TV_CAIXA`, `MovelCamada`, `ordemZ`);
- `src/components/shell/People.tsx` (`goWatch`), `src/components/shell/Sidebar.tsx` (`ABAS`, `People`, `CarteiraChip`);
- `src/features/moedas/Moedas.tsx`, `src/lib/carteira.ts`, `src/lib/moedas.ts` e a seção 7 do `seguranca.sql` (`creditar`, RLS de `carteiras`);
- `src/features/ficha/*` e o campo `fichaAberta` no `store.ts`;
- `src/features/truco/*` (onde se sabe quantas mesas e jogadores existem).

## Como fazer

### 1) Regra pura (`hall.ts` + testes)
- `NI = 14`, `NJ = 11`, `X0` e `VB` novos, e `MOVEIS` com as posições da demo v2 (churrasqueira, geladeira, freezer, dois colchões, mesa verde e cadeiras, mesa comprida e cadeira).
- **Lista nova `CLICAVEIS`:** `{ id: "tv" | "truco" | "loja", alvo, rotulo: {i, j, z} }`, ligando cada móvel (ou a TV) ao que ele abre e ao ponto da placa.
- **`pisoNaTela`** continua servindo para o destaque. Acrescente `pisoLivreNaTela(x, y)`, que devolve null se o piso estiver bloqueado.
- **Posições antigas:** um `pos` vindo da presença que agora caia num móvel falha no `posValida` e a pessoa volta para o ponto de entrada. Teste isso.
- Atualize os testes de caminho para a grade nova.

### 2) Desenho (`Sala.tsx`, `22-hall.css`)
- **Paredes e piso** com as cores novas (mais claras). Continue com as variáveis `--hall-*` e a versão escura de cada uma.
- **Janelão** na parede da direita (`i` de 1,0 a 4,4, `z` de 52 a 178): moldura e caixilho de madeira, peitoril, cortinas, céu, sol, morro e árvores recortados por `clipPath`. A luz no chão é um polígono amarelo bem transparente.
- **Placas dos clicáveis:** são `<button>` HTML por cima do SVG (como o botão da TV hoje), posicionados em % pelo ponto `rotulo`, com `aria-label` ("Abrir o Truco"). Mantenha o botão invisível em cima da TV.
- **Destaque do piso:** um `<polygon>` em camada própria, logo acima do piso e abaixo dos móveis, que muda com `pointermove`. Ele só redesenha quando o piso muda, não a cada movimento do mouse.
- **Boneco clicável:** clicar no boneco de outra pessoa faz `setApp({ fichaAberta: fid })` e **não** anda. O seu boneco não abre nada.

### 3) Cantos (`src/features/hall/Cantos.tsx`, CSS no `22-hall.css`)
- **"Na sala agora":**
  - reaproveite a lista do `People.tsx`, separando a parte de montar a lista num hook (`usePessoasNaSala()`) usado pelos dois lugares;
  - no hall, a lista fica no canto, por cima do cômodo, e pode ser **recolhida** (lembrando em `local`, chave `hall-sala-min`);
  - enquanto a aba Sítio está aberta, a lista da barra lateral fica escondida, para não aparecer duas vezes. Nas outras abas, continua lá.
- **Carteira:** reaproveite o `useCarteira`. Mostra o saldo com o número formatado (`1.284`). Se o SQL das moedas não rodou, não aparece.
- **Ranking (`src/features/moedas/Ranking.tsx`):**
  - lê todas as `carteiras` (a RLS já deixa nanicos lerem todas) uma vez ao abrir e depois acompanha pelo tempo real de `carteiras` desta fase, então muda **na hora** quando alguém ganha ou gasta;
  - quem subiu de posição ganha uma setinha verde por 3 s (sem animação com `prefers-reduced-motion`);
  - nanico sem carteira ainda aparece no fim com "—";
  - **regra pura** em `src/lib/moedas.ts` + teste: `ranking(carteiras, friends)` ordena por saldo e, no empate, por nome, e devolve a posição de cada um (empatados dividem a posição: "2º, 2º, 4º").
- **Ganhos (`Ganhos.tsx`):** pilha de no máximo 3 avisos; cada um some depois de 5 s e o mais velho fica apagado. Com `prefers-reduced-motion`, nada desliza. Tem `aria-live="polite"`.
- **No celular (390 px):** a lista vira uma fileira de rostos acima do hall, com rolagem para o lado só dentro dela; a carteira e os ganhos ficam embaixo do hall. A página continua sem rolagem para o lado.

### 4) Banco: ganhos de todo mundo (seção "7b) moedas ao vivo")
Os ganhos dos outros **não** podem vir por broadcast, que qualquer um forja. Eles vêm do banco:
- **`carteiras` ganha** `ultimo_valor int`, `ultimo_motivo text` e `ultimo_em timestamptz` (`add column if not exists`).
- **`creditar()` (`create or replace`):** grava esses três campos no mesmo `update` do saldo. Não mude mais nada nela.
- **Tempo real:** `alter publication supabase_realtime add table public.carteiras`, no bloco `exception when duplicate_object then null` como nos outros arquivos. A RLS de leitura (nanicos leem todas) continua igual.
- **No site** (`src/lib/carteira.ts`), um `aoMudarTabela("carteiras", …)`:
  - quando `ultimo_valor > 0` e `ultimo_em` for novo, empurra um aviso;
  - se for você, também atualiza o saldo da carteira;
  - gastos (valor negativo) não aparecem para os outros.
- **Texto do motivo:** um mapa em `src/lib/moedas.ts` (`diario` → "bônus do dia", `online` → "tempo online", `truco` → "venceu no truco", `bingo` → "bingo!", `sequencia` → "prêmio da sequência"…). Motivo desconhecido aparece sem texto. Teste o mapa.
- **Tempo online:** ele gera um ganho de +1 a cada 6 min por pessoa. Para não encher a tela, os avisos de `online` dos **outros** são juntados: no máximo um aviso a cada 60 s, do tipo "+3 moedas de tempo online para 3 nanicos". Os seus aparecem sempre.

### 5) Menu
- No `Sidebar.tsx`, o item `perfil` usa o `Avatar` de quem está logado no lugar do `IcPerfil`, com o texto "Perfil". Sem nanico (convidado no futuro), continua o ícone.

## Não faça
- Não mande ganho de moedas por broadcast nem confie em valor vindo do navegador.
- Não use imagens novas para o janelão e as árvores: é SVG desenhado por código, como o resto do cômodo.
- Não abra a loja nem o celular se as fases deles ainda não existirem: a placa "Loja" só avisa "em breve".
- Não crie dependência nova.

## Pronto quando
- [ ] O hall tem 14×11 pisos, janelão com árvores e cores claras, igual ao `hall-v2.png`, nos temas claro e escuro.
- [ ] As placas Ao vivo, Truco e Loja aparecem e abrem o que devem, e "AO VIVO" só aparece quando alguém transmite.
- [ ] O piso livre ganha o contorno branco com o mouse; o piso com móvel não.
- [ ] Clicar num nome do "Na sala agora" ou num boneco abre a ficha da pessoa.
- [ ] Com duas abas logadas, o bônus do dia de uma aparece como aviso na outra. Um broadcast forjado não gera aviso nenhum.
- [ ] O SQL roda duas vezes sem erro, e `creditar` continua recusando saldo negativo.
- [ ] O ranking mostra os 14 na ordem certa, com empates dividindo a posição, e muda na hora em outra aba quando alguém ganha moedas.
- [ ] Com 390 px, tudo cabe sem rolagem para o lado. `npm run check` passa e o console está sem erros de CSP.
- [ ] O `CLAUDE.md` (colunas novas de `carteiras`, `carteiras` no tempo real, chave `hall-sala-min`, `Cantos`/`Ganhos` em `features/hall`) e o `CHANGELOG` foram atualizados. No `PLANO.md`, a fase 14 aparece como feita.

## Entrada do CHANGELOG
`"Sítio maior e mais claro, com janelão para as árvores"`, `"No Sítio: TV, mesa do truco e loja abrem com um clique, e o piso fica marcado embaixo do mouse"`, `"Quem está na sala, a sua carteira e os ganhos de moedas de todo mundo aparecem nos cantos do Sítio"`, `"Ranking de quem tem mais moedas: clique na carteira"`
