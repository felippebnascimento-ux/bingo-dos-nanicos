# Fase 18: Chinelada e torta na cara (zoar os amigos no hall)

**Branch:** `chinelada-torta` · **Depende de:** fases 2 (moedas) e 14 (hall v2: clicar no boneco) · **Banco:** sim (seção "20) zoeira" no `seguranca.sql`)

## Objetivo (para quem usa)
Modelo: `planejamento/demo/hall-zoeira.html` e `.png`.
- **Menu do boneco:** clicar no boneco de outra pessoa no hall abre um menuzinho em cima dele, com três opções:
  - "Ver ficha" (o que a fase 14 já fazia direto);
  - "Chinelada · 5";
  - "Torta na cara · 25".
- **Chinelada:**
  - um chinelo voa do seu boneco até o outro, em arco, e o alvo **cambaleia** (balança uns graus para os lados);
  - aparece um "PLAFT!" em cima dele por 1,5 s;
  - todo mundo no hall vê.
- **Torta:** a torta voa, e o rosto do alvo fica **sujo de chantili** por 20 s, numa camada por cima do boneco.
- **Avisos:**
  - **o alvo** recebe "Gamer te deu uma chinelada" com o botão **"Revidar"**, que é grátis uma vez, durante 30 s;
  - **para todos,** aparece um aviso no canto dos ganhos da fase 14 ("Gamer deu uma chinelada no Max").
- **Limites:**
  - 1 chinelada a cada 10 s por pessoa;
  - no máximo 3 no mesmo alvo a cada 5 min;
  - não dá para zoar a si mesmo nem quem não está no hall.
- **Placar da zoeira:** um quadro na ficha (fase 3) com quantas chineladas a pessoa deu e levou na semana.

## Antes de começar
Siga as "Regras de toda sessão" de `planejamento/PLANO.md`. Leia:
- `src/features/hall/*` como ficou na fase 14 (`Boneco.tsx`, `bonecos.ts`, `Cantos.tsx`, `Ganhos.tsx`);
- a seção 7 do `seguranca.sql` (`creditar`, `limitar`) e a seção 7b (moedas ao vivo);
- `src/lib/sala.ts` (`aoMudarTabela`).

## Como fazer

### Banco: a zoeira é paga, então passa pelo banco
- **`zoeiras`:** `(id bigint identity, de uuid, para uuid, tipo text check in ('chinelo','torta','revide'), em timestamptz default now())`.
  - **RLS:** nanicos leem as das últimas 24 h; ninguém escreve direto.
  - Entra no tempo real.
- **`zoar(p_para_friend uuid, p_tipo text)`:**
  - exige `eh_nanico()`, o alvo existe e é outra pessoa;
  - preço: `chinelo` 5, `torta` 25, e `revide` é grátis só se existir uma zoeira do alvo contra você nos últimos 30 s que ainda não foi revidada;
  - limites: `limitar('zoar', 6, '1 minute')` e no máximo 3 no mesmo alvo em 5 min;
  - chama `creditar(-preco, 'zoeira', tipo)` e grava a linha.
- **O alvo não perde moedas:** é só zoeira. As moedas gastas somem da economia, e isso é bom.
- **Limpeza:** apague as linhas com mais de 30 dias. Use um `delete` dentro da própria `zoar`, como o chat faz.
- **Placar:** `placar_zoeira(p_friend)` devolve quantas a pessoa deu e levou nos últimos 7 dias.

### Animação (`src/features/hall/zoeira.ts`, regra pura + teste)
- **`arco(de, para, t)`:** ponto do chinelo/torta no tempo `t` (0 a 1), numa parábola entre as cabeças dos dois bonecos.
- **`cambalear(t)`:** ângulo do boneco (−8° a +8°, amortecido em ~600 ms).
- **Tela:** a zoeira chega pelo `aoMudarTabela("zoeiras")` e **só anima se as duas pessoas estiverem no hall agora**; senão, vira só o aviso. Use `requestAnimationFrame`, como o andar.
- **Desenhos:** chinelo e torta são SVG pequenos feitos por código (um chinelo de dedo, uma torta com chantili), sem imagens novas.
- **`prefers-reduced-motion`:** nada voa nem balança, aparece só o "PLAFT!" e o aviso.

### Menu do boneco
- Um popover com os 3 botões, fechando com Esc e ao clicar fora, e com foco no primeiro botão.
- Preço em cada botão. Sem saldo, o botão fica desligado com o texto "Faltam X moedas".
- Pelo teclado: Tab até o boneco (cada boneco é um `button` com `aria-label` "Max, abrir opções") e Enter abre o menu.

## Não faça
- Não mande a zoeira por broadcast: ela é paga, então vem da tabela.
- Não tire moedas do alvo.
- Não use `confirm()`: 5 moedas não pedem confirmação; a torta (25) usa `useSure()`.

## Pronto quando
- [ ] Com duas abas, uma dá uma chinelada e as duas veem o chinelo voar e o outro cambalear.
- [ ] O revide grátis funciona uma vez em 30 s, e não funciona sem ter levado uma zoeira antes.
- [ ] A 4ª chinelada no mesmo alvo em 5 min é recusada pelo banco com mensagem clara.
- [ ] Sem saldo, o banco recusa e nada é gravado.
- [ ] Funciona com 390 px. `npm run check` passa, e o `CLAUDE.md` e o `CHANGELOG` foram atualizados.

## Entrada do CHANGELOG
`"No Sítio: clique num amigo para dar uma chinelada ou uma torta na cara (e ele pode revidar)"`
