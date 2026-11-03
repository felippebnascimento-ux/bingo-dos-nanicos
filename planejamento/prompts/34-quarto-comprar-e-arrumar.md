# Fase 34: Quarto próprio (parte 1): comprar o quarto e os móveis, e arrumar

**Branch:** `quarto-proprio` · **Depende de:** fases 11 (loja e quarto da ficha) e 14 (hall); se a 30 já existir, amigos também têm quarto · **Banco:** sim

A parte 2 (fase 35) leva o boneco para dentro do quarto (teleporte e visitas). Esta fase entrega o quarto que existe, cresce e se arruma, visto na ficha e na tela de arrumar.

## Objetivo (para quem usa)
- **Comprar o quarto na Loja** (grupo novo "Quarto próprio", no topo da vitrine):
  - **Pequeno** 6×6 por 1.000, **Médio** 9×9 por 3.000 e **Grande** 12×12 por 8.000;
  - quem já tem um quarto e compra um maior **paga só a diferença** (do pequeno para o grande: 7.000), e o **mesmo quarto cresce**: os móveis ficam onde estavam;
  - não dá para comprar um tamanho menor ou igual ao que já tem ("Você já tem um quarto maior").
  - Decisão do João (03/11/2026).
- **Comprar móveis** (grupo "Móveis do quarto"): cada móvel ocupa um pedaço do piso (largura × fundo) e pode ser comprado mais de uma vez (até 4 de cada).
  - Os itens de piso que já existem na loja (cadeira gamer, trono, mesa RGB, tapetes e plantas) **viram móveis**: quem já comprou continua com eles.
  - Parede (cor), neon e pôster continuam como hoje: um de cada, equipado, desenhado na parede do quarto.
  - **Catálogo novo** (desenhos próprios em SVG, no estilo do hall):

| id | nome | piso | preço |
|---|---|---|---|
| `movel-cama` | Cama de solteiro | 1×2 | 600 |
| `movel-cama-casal` | Cama de casal | 2×2 | 1.400 |
| `movel-sofa` | Sofá | 2×1 | 900 |
| `movel-poltrona` | Poltrona | 1×1 | 450 |
| `movel-pc` | Setup gamer (mesa + PC + 2 monitores) | 2×1 | 2.500 |
| `movel-tv` | TV com rack | 2×1 | 1.200 |
| `movel-estante` | Estante com troféus | 1×1 | 500 |
| `movel-frigobar` | Frigobar | 1×1 | 700 |
| `movel-mesinha` | Mesa de centro | 1×1 | 250 |
| `movel-puff` | Puff | 1×1 | 150 |
| `movel-luminaria` | Luminária de chão | 1×1 | 200 |
| `movel-guarda-roupa` | Guarda-roupa | 2×1 | 800 |

- **Arrumar** (botão "Arrumar meu quarto" na ficha do dono e na mochila):
  - abre o quarto grande na tela, com o piso em grade;
  - a lista "Guardados" mostra os móveis da mochila que não estão no quarto;
  - tocar num móvel guardado e depois num piso o coloca. O piso fica verde se cabe e vermelho se não cabe;
  - tocar num móvel colocado o seleciona: **Girar** (troca largura e fundo), **Mover** (escolher outro piso) ou **Guardar**;
  - não deixa encostar um móvel em cima de outro, sair do quarto nem tapar o piso da porta;
  - tudo salva na hora (sem botão "Salvar").
- **Na ficha de qualquer nanico,** o quarto mostrado é o quarto de verdade dele, com os móveis onde ele pôs (e o boneco em pé perto da porta). Quem ainda não comprou o quarto continua com o quarto fixo de hoje.
- **No celular** (390 px): o quarto ocupa a largura, com arrastar para os lados e zoom de dois dedos; a lista de guardados fica embaixo.

## Antes de começar
Siga as "Regras de toda sessão" de `planejamento/PLANO.md`. Leia:
- `src/features/ficha/Quarto.tsx`: quarto fixo de 6×6 em SVG (`X0, Y0, TW=46, TH=23`, `p(i,j,z)`, `box()`), cada espaço desenhado em coordenadas fixas (L19-132), boneco parado na frente (L142-180), `QuartoPrevia` com `RECORTE`; `24-ficha.css` (`--quarto-*`, `q-<nome>`);
- `src/features/loja/loja.ts` (`Espaco`, `GRUPOS`, `acumula`, `equipavel`, `podeComprar`), `lojaDados.ts` e `LojaView.tsx` (`Previa`, `MochilaLista`);
- seção 15 do `seguranca.sql`:
  - `loja_itens`, com `preco` entre 10 e 5000 e o `check` do `espaco` refeito na seção 18;
  - `mochila` (sem posição; RLS: todos leem o equipado, cada um a sua inteira);
  - `comprar`, `equipar` e `quarto_de`;
- `src/features/hall/hall.ts`:
  - `tela`, `pisoNaTela`, `BLOQUEADOS`, `caminho` e `camadasHall` estão presos ao hall de 14×11;
  - o `ordemZ` já é genérico;
- `Sala.tsx`: a tabela `DESENHO` (um desenho por móvel), `MOVEL_FORMAS` e uma `<svg>` por móvel com `zIndex`.

## Como fazer

### Banco (seção "40) quarto próprio" no `seguranca.sql`)
- **`loja_itens`:**
  - `preco` passa a ir de 10 a 10.000 (refaça o `check`);
  - espaços novos `quarto` (os 3 tamanhos) e `movel` (refaça o `loja_itens_espaco_check`);
  - os móveis guardam em `dados` `{w, d}` (piso) e `desenho` (id do desenho no site);
  - semente dos 3 quartos e dos 12 móveis com `on conflict do update`;
  - os 7 itens de piso antigos (`cadeira-*`, `mesa-rgb`, `tapete-*`, `planta-*`) ganham `w`/`d`, ficam com o espaço antigo e entram na lista de "posicionáveis" (veja `eh_posicionavel(item)`).
- **`quartos`** `(user_id pk → auth.users, tamanho int check in (6,9,12), criado_em, atualizado_em)`. Membros leem (precisa para visitar e para a ficha); ninguém grava direto. No `postgres_changes`.
- **`quarto_moveis`** `(id bigserial pk, user_id, item_id → loja_itens, i int, j int, giro bool default false, em)`. Membros leem; ninguém grava direto. No `postgres_changes`.
- **`comprar(p_item)`** (substitui o da seção 15 com `create or replace`, mantendo tudo o que ele faz):
  - **quarto:** recusa tamanho menor ou igual ao atual; cobra `preco − preço do quarto atual` com `creditar(…, 'loja', item)`; grava ou aumenta `quartos.tamanho`;
  - **móvel:** acumula até 4 (`qtd`);
  - o resto como hoje.
- **`quarto_por(p_item, p_i, p_j, p_giro)`**, **`quarto_mover(p_id, p_i, p_j, p_giro)`** e **`quarto_guardar(p_id)`**, para `authenticated`:
  - só o dono, com `quartos` e com o item na mochila;
  - não coloca mais do que a `qtd` do item;
  - confere em SQL que o móvel (com `w`/`d` girados) cabe em `0..tamanho`, não passa por cima de outro e não tapa a porta (piso `(0, 0)`, fixo para não mudar quando o quarto cresce);
  - `public.limitar()` (60 por minuto).
  - Uma regra só para "cabe": escreva-a em SQL e espelhe em TS (abaixo), com um teste que confere os dois pelo mesmo exemplo (como o `bingo-valem.fixture.json`).
- **`quarto_de(p_friend)`** passa a devolver também `tamanho` e os móveis colocados.
- **Conferência do fim:** as 2 tabelas e as 3 funções novas.

### Site
- **Grade genérica:** em `hall.ts`, extraia o que é da grade para `src/features/hall/grade.ts`, sem mudar o comportamento do hall:
  - `criarGrade(ni, nj, moveis, origem)`: `tela`/`pisoNaTela` com a origem e o tamanho do piso, `livre`, `caminho`;
  - o hall passa a usar `criarGrade(14, 11, MOVEIS, …)`, e os testes atuais do hall continuam passando.
- **Regra pura `src/features/quarto/quarto.ts`** (+ teste):
  - `cabe(tamanho, moveis, novo)`, a mesma regra do SQL;
  - `girar`, `camadasQuarto` (usa o `ordemZ`), `diferenca(atual, novo)` e `podeComprarQuarto`.
- **Desenhos `src/features/quarto/Moveis.tsx`:**
  - uma tabela `DESENHO_QUARTO` (id → formas), como a do `Sala.tsx`, com os 12 móveis novos e os 7 de piso antigos, que hoje estão dentro do `Quarto.tsx`;
  - cores com `--quarto-*` (crie as que faltarem, com tema escuro) e as classes `q-<nome>`;
  - giro = espelho com largura e fundo trocados.
- **`QuartoCena.tsx`:** desenha o quarto de qualquer tamanho (piso, as duas paredes com cor, neon e pôster equipados, a porta em `(0, 0)` e os móveis ordenados). Serve para a ficha, o arrumar e, na fase 35, as visitas.
- **`ArrumarQuarto.tsx`:** a tela de arrumar descrita acima, chamando as RPCs; o tempo real de `quarto_moveis` atualiza todo mundo.
- **Ficha:** `QuartoDe` usa `QuartoCena` quando o nanico tem `quartos`; sem quarto, o `Quarto.tsx` de hoje.
- **Loja:** os grupos "Quarto próprio" e "Móveis do quarto"; o botão do quarto diz "Comprar por 2.000 (diferença)" quando é upgrade, e o do móvel "Comprar (2 de 4)". A prévia do móvel usa o desenho dele.

## Não faça
- Não grave posição de móvel pelo navegador direto na tabela, nem mande broadcast: só as RPCs e o tempo real.
- Não apague o quarto fixo da ficha para quem não comprou.
- Não mude o tamanho do hall nem o comportamento dele ao extrair a grade.

## Pronto quando
- [ ] Comprar o pequeno (1.000) e depois o grande cobra 7.000, e os móveis continuam no lugar com o quarto maior.
- [ ] Colocar, girar, mover e guardar funcionam. O banco recusa móvel fora do quarto, em cima de outro ou na porta (teste chamando a RPC direto).
- [ ] Com duas abas, a arrumação de uma aparece na ficha aberta na outra sem recarregar.
- [ ] Quem não tem quarto continua vendo o quarto fixo na ficha.
- [ ] O SQL roda duas vezes. 390 px ok. `npm run check` passa. O `CLAUDE.md` (tabelas, loja, pastas, exceção `--quarto-*`) e o `CHANGELOG` foram atualizados.

## Entrada do CHANGELOG
`"Quarto próprio: compre o seu na Loja (pequeno, médio ou grande), compre móveis e arrume do seu jeito"`
