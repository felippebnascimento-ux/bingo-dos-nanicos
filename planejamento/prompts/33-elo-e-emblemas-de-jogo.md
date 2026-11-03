# Fase 33: Elo do LoL na ficha e emblemas de elo e de nível da GC

**Branch:** `elo-emblemas-jogo` · **Depende de:** fases 3 (ficha com dados reais) e 27 (emblemas, seção 27 do SQL) · **Banco:** sim (só a função `emblemas_de`)

Demo: `planejamento/demo/emblemas-jogo.html` (abra no navegador: os 20 níveis da GC e os 10 brasões, já recortados).

## Objetivo (para quem usa)
- **"No jogo" da ficha** ganha a linha do LoL, acima da do CS2:
  - brasão pequeno do elo + **"LoL Platina IV · 42 PDL · Flex"** (ou "· Solo/Duo");
  - vale o **elo mais alto** entre a ranqueada solo/duo e a flex (decisão do João, 03/11/2026). Com elo só numa delas, mostra essa. Sem nenhuma, a linha não aparece;
  - Mestre, Grão-Mestre e Desafiante não têm divisão: "Mestre · 230 PDL".
  - **Continua de fora:** KDA, main, vitórias e horas. Em 03/11/2026 o João voltou só com o elo, que tinha saído na v1.68.
- **Linha do CS2:** o "GC nível 10" ganha o círculo colorido do nível na frente.
- **Emblemas da ficha:**
  - **"Elo no LoL"** (o antigo "Elo alto"): o desenho do emblema passa a ser o **brasão oficial do elo atual** (de Ferro a Desafiante), em vez da medalha de bronze, prata ou ouro. Aparece para qualquer elo e muda sozinho quando o elo muda (a ficha relê a cada 6 h). A dica diz "Platina IV na flex".
  - **"Nível da GC"** (novo): o círculo do nível de 1 a 20, igual ao do print do João (roxos de 1 a 5, azuis de 6 a 10, verde-água e verdes de 11 a 15, amarelo, laranja e vermelho de 16 a 20; o 20 tem brilho vermelho). A dica diz "GC nível 14".
  - O "Veterano do CS" (horas) continua como está.

## Antes de começar
Siga as "Regras de toda sessão" de `planejamento/PLANO.md`. Leia:
- `supabase/functions/ficha-jogos/index.ts`: `buscarLol` (L104-158) hoje só lê a `RANKED_SOLO_5x5`; `buscarCs` guarda `gc` (L207-214);
- `src/features/ficha/Ficha.tsx` (`Links`, "No jogo", L41-80; `csTexto`), `src/features/ficha/estado.ts` e `numeros.ts` (conferir os números; puro e testado);
- `src/features/emblemas/emblemas.ts` (o `elo` em L19, L55-66), `Emblema.tsx` (desenho SVG de cada emblema), `EmblemasFicha.tsx`; e `emblemas_de` no `seguranca.sql` (a linha do `elo`, L2855, e a mais nova, L3870: confira qual vale depois dos 10 emblemas novos);
- a CSP do `vercel.json`: `img-src` já aceita `raw.communitydragon.org`.

## Como fazer
- **`ficha-jogos`:**
  - leia também a `RANKED_FLEX_SR` e guarde as duas em `dados.solo` e `dados.flex` (`{tier, rank, lp, vitorias, derrotas}` ou null);
  - os campos de cima (`tier`, `rank`, `lp`) passam a ser os do **mais alto** e ganham `fila: 'solo' | 'flex'`. Assim a `emblemas_de` e quem já lê `tier` continuam funcionando;
  - "mais alto": ordem dos tiers IRON < BRONZE < SILVER < GOLD < PLATINUM < EMERALD < DIAMOND < MASTER < GRANDMASTER < CHALLENGER, depois a divisão (IV < I), depois o PDL; no empate, a solo;
  - publique a função de novo.
- **Regra pura em `src/features/ficha/numeros.ts`** (+ teste): `eloMaisAlto(solo, flex)` (a mesma conta da função; teste os empates, só uma fila e nenhuma) e `textoElo(e)` ("Platina IV · 42 PDL · Flex"; sem divisão do Mestre para cima). `lerElo` confere o que vem do banco.
- **Brasão oficial:**
  - `src/features/emblemas/brasao.ts` com `brasaoUrl(tier)` = `https://raw.communitydragon.org/latest/plugins/rcp-fe-lol-static-assets/global/default/images/ranked-emblem/emblem-<tier minúsculo>.png`, só para os 10 tiers conhecidos (qualquer outro: null);
  - o PNG tem 1280×720 com o brasão no meio. Recorte por CSS, como no demo: um `span` com `background: center 46% / 380% auto no-repeat` e a imagem em `background-image` (valor calculado, então `style={{}}` é permitido). Não baixe nem guarde as imagens no repositório.
- **Círculo da GC:** `NivelGc.tsx` (SVG próprio, como o do demo). As cores ficam em variáveis `--gc-<n>-a` e `--gc-<n>-b` (de cima e de baixo de cada nível, os valores estão no demo) definidas em `.gc-nivel`, no CSS dos emblemas. Acrescente esta exceção na seção 5 do `CLAUDE.md`, no mesmo formato das outras.
- **Emblemas:**
  - `emblemas.ts`: o `elo` vira "Elo no LoL" e o desenho usa o brasão (o `Emblema.tsx` recebe o tier pela ficha); `gc` novo, "Nível da GC";
  - `emblemas_de` (nova seção "39) emblemas de elo e da GC" com `create or replace`):
    - `elo`: aparece com qualquer tier; o nível serve só para ordenar: Ferro a Prata = 1, Ouro a Esmeralda = 2, Diamante para cima = 3. Devolve também o `tier`;
    - `gc`: o nível vem do `jogos_stats` fonte `cs` (`dados->>'gc'`); nível 1 de 1 a 7, 2 de 8 a 14, 3 de 15 a 20. Devolve o número;
  - a conferência do fim continua listando as mesmas funções.

## Não faça
- Não volte com KDA, main ou vitórias para a ficha.
- Não use outro domínio de imagem nem mude a CSP.
- Não calcule elo no navegador a partir da API da Riot: só lê o que a `ficha-jogos` guardou.

## Pronto quando
- [ ] Um nanico com Ouro na solo e Platina na flex mostra "Platina IV · … · Flex" e o brasão de Platina na linha e no emblema.
- [ ] Um nanico só com flex mostra a flex. Um sem ranqueada não mostra a linha do LoL nem o emblema.
- [ ] Um nanico com GC mostra o círculo do nível na linha do CS2 e o emblema "Nível da GC".
- [ ] Tema escuro e 390 px ok, console sem bloqueio de CSP. `npm run check` passa. O `CLAUDE.md` (ficha, emblemas, exceção de cor `--gc-*`, `jogos_stats`) e o `CHANGELOG` foram atualizados.

## Entrada do CHANGELOG
`"Ficha: o elo do LoL voltou (o mais alto entre solo e flex), com o brasão do elo e o nível da GC como emblemas"`
