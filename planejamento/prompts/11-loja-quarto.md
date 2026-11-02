# Fase 11: Loja e quarto 2.5D (onde as moedas são gastas)

**Branch:** `loja-quarto` · **Depende de:** fase 2 (moedas) e fase 3 (`Quarto.tsx` da ficha) · **Banco:** sim

## Objetivo (para quem usa)
- **Loja:** gasta as moedas em itens.
  - **Do quarto:** cadeira gamer, mesa e PC, tapete, pôster, planta, cor da parede e luz neon.
  - **Títulos:** aparecem embaixo do nome ("Rei do tilt").
  - **Moldura do rosto.**
  - **Escudo de sequência:** salva **um** dia perdido da sequência e é gasto sozinho.
- **Mochila:** guarda o que a pessoa comprou, e ela **equipa** um item por espaço.
- **Quarto:** a ficha mostra o quarto com o que está equipado, e a mochila aparece na ficha (como na demo).

É o **ralo principal** da economia: os preços vão de 150 a 2.000 moedas.

## Antes de começar
Siga as "Regras de toda sessão" de `planejamento/PLANO.md`. Leia:
- `planejamento/demo/ficha-demo.html` (o quarto e a mochila);
- o `Quarto.tsx` e o `Ficha.tsx` da fase 3;
- o SQL da fase 2 (`creditar`, `bater_ponto`);
- `src/components/ui/Avatar.tsx` (para a moldura).

## Como fazer

### Banco (seção "15) loja" no `seguranca.sql`)
- **`loja_itens`:** `(id text pk, nome text, espaco text check in ('cadeira','mesa','tapete','poster','planta','parede','luz','titulo','moldura','escudo'), preco int check (preco between 50 and 5000), dados jsonb (cores, texto do título), ativo bool, ordem int)`.
  - Semente idempotente com uns 15 itens e preços conforme o PLANO.
  - Nanicos leem; só o admin escreve.
- **`mochila`:** `(user_id, item_id, qtd int default 1, equipado bool default false, comprado_em, primary key(user_id, item_id))`.
  - **RLS:** **todos** leem os itens equipados (para ver o quarto dos outros) e cada um lê a mochila inteira só da própria conta.
  - Ninguém escreve direto.
- **`comprar(p_item)`:** exige `eh_nanico()` e o item ativo; item que não seja `escudo` não se compra duas vezes; chama `creditar(-preco,'loja',item)`.
- **`equipar(p_item, p_ligar bool)`:** liga o item e desliga os outros do mesmo espaço.
- **Escudo na `bater_ponto()` (`create or replace`):** se não pegou ontem, mas pegou anteontem e tem escudo, gasta 1 escudo, cria a linha de ontem com valor 0 e continua a sequência. Avise com `escudo_usado: true` no retorno.
- **`quarto_de(p_friend uuid)`:** devolve os itens equipados do nanico.

### Tela
- **`src/features/loja/LojaView.tsx`** (aba nova ou dentro do Cassino; decida no plano o que deixa o menu mais limpo):
  - os itens agrupados por espaço, cada um com uma prévia desenhada em SVG isométrico com as cores da paleta (**sem imagens novas**);
  - preço e "Comprar". Comprar usa `useSure()` (segundo toque "Confirmar"), porque gasta moedas.
- **`Quarto.tsx`:** desenha os itens equipados nos espaços fixos do quarto (cadeira ao lado da mesa, tapete no centro…), com as mesmas funções isométricas.
- **Ficha:** o título fica embaixo do nome, a moldura no `Avatar` e a mochila com "Equipar" na ficha da própria pessoa.
- **Escudo usado:** `toast("Escudo usado: sua sequência continua")`.

## Não faça
- Não aceite preço vindo do navegador (o banco lê da `loja_itens`).
- Não use imagens novas nem bibliotecas de 3D.
- Não deixe equipar o que não está na mochila.

## Pronto quando
- [ ] Comprar com saldo insuficiente falha sem mexer em nada, e comprar o mesmo item duas vezes falha (menos o escudo).
- [ ] Equipar troca o item do espaço, e o quarto aparece igual para quem visita a ficha.
- [ ] Simulando um dia perdido com escudo, a sequência continua e o escudo some. Sem escudo, volta a 1.
- [ ] Funciona com 390 px, e o `CLAUDE.md` e o `CHANGELOG` foram atualizados.

## Entrada do CHANGELOG
`"Loja: gaste moedas em itens para o seu quarto, títulos, molduras e escudo de sequência"`
