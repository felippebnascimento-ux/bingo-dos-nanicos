# Fase 35: Quarto próprio (parte 2): teletransporte e visitas

**Branch:** `quarto-visitas` · **Depende de:** fases 27 (um boneco por nanico) e 34 (quarto próprio) · **Banco:** não (só leitura das tabelas da fase 34)

## Objetivo (para quem usa)
- **Ir para o meu quarto:** quem tem quarto vê o botão **"Ir para o meu quarto"** no K-FOFO (ao lado da carteira e da mochila).
  - **Teletransporte:** o boneco some do K-FOFO com um brilho rápido (todo mundo no K-FOFO vê) e aparece na porta do quarto.
  - A aba continua sendo a do K-FOFO (`hall`); só a cena troca. Em cima aparece "Quarto do Fulano" e o botão **"Voltar ao K-FOFO"**, que traz o boneco de volta pela entrada do K-FOFO, com o mesmo brilho.
- **Andar e sentar no quarto:**
  - o boneco anda pelo piso do quarto como no K-FOFO (tocar num piso livre);
  - os móveis de sentar (cadeira, trono, poltrona, sofá, puff, camas) funcionam como os sofás do hall.
- **Visitar:** **todos sempre podem entrar** em qualquer quarto (decisão do João, 03/11/2026).
  - Na ficha de quem tem quarto, o botão **"Visitar o quarto"** leva o meu boneco para lá (teletransporte).
  - Quem está no mesmo quarto se vê e vê os outros andando.
- **Dono arrumando com gente dentro:** quem está no quarto vê os móveis mudando na hora. Se um móvel cair em cima de alguém, essa pessoa vai para o piso livre mais perto.
- **Quem está onde:**
  - na lista "Na sala agora" do K-FOFO, quem está num quarto aparece com "no quarto do Fulano" (tocar leva até lá);
  - os membros mostram um ícone de casinha;
  - a ficha mostra "3 pessoas no quarto agora".

## Antes de começar
Siga as "Regras de toda sessão" de `planejamento/PLANO.md` e leia o prompt e o código da fase 34 (`grade.ts`, `QuartoCena.tsx`, `quarto.ts`). Leia também:
- `src/lib/sala.ts`:
  - `cleanPresence` (L134-154: `pos` conferido com `posHall`, `sala` só se estiver na lista);
  - `trackMe` (L173-204: no máximo 4 a cada 30 s);
  - o evento `hall` em `EVENTOS`;
- `src/lib/presenca.ts` (`umPorNanico`: junta `pos` e `sala` por nanico);
- `src/features/hall/bonecos.ts`:
  - `sincronizar` (L180-215) põe todo mundo online no hall;
  - `andarAte` manda `enviar("hall", { para })`;
  - `onHall` (L235-243) confere com a grade do hall;
- `HallView.tsx`, `Boneco.tsx` (sentado), `Cantos.tsx` ("Na sala agora", carteira, mochila) e `People.tsx`;
- `src/lib/store.ts` (`hallPos`) e a chave `hall-pos`.

## Como fazer
- **Presença:**
  - campo novo **`quarto`**: o friend id do dono do quarto onde estou, ou null;
  - `cleanPresence` aceita só um id que esteja em `friends` **e** tenha linha em `quartos` (lida e mantida pelo tempo real da fase 34);
  - o `pos` de quem está num quarto é conferido com a grade daquele quarto (tamanho da `quartos`), não com a do hall;
  - `umPorNanico` junta o `quarto` como junta a `sala`, ficando com o da aba mais recente;
  - entra no `trackMe` pelo estado (`meuQuarto` no store), sem passar do limite de 4 a cada 30 s.
- **Evento `hall`:** ganha `q` opcional (o dono do quarto).
  - Quem recebe confere o tipo, o tamanho, `estaNaSala` e o limite que já existe, e só anima se estiver vendo aquele quarto, conferindo com a grade dele.
  - O resto da regra 4 do `CLAUDE.md` continua igual.
- **Bonecos (`bonecos.ts`):**
  - `sincronizar` passa a filtrar por cena: no K-FOFO, só quem tem `quarto = null`; no quarto X, só quem tem `quarto = X`;
  - o brilho do teletransporte toca quando alguém some ou aparece na cena por troca de `quarto` (não quando entra ou sai do site);
  - com `prefers-reduced-motion`, só some e aparece.
- **Cena (`HallView`):**
  - estado `meuQuarto` no store e `irParaQuarto(dono | null)` em `src/features/quarto/visita.ts`;
  - `irParaQuarto` troca a cena, põe o boneco na porta `(0, 0)` (ou na entrada do K-FOFO, ao voltar) e atualiza a presença;
  - o `hall-pos` só guarda posição do K-FOFO, e ao recarregar o site sempre abre no K-FOFO;
  - **o canal da sala de voz não muda:** entrar num quarto não é `entrarSala`.
- **Assentos do quarto:** os móveis de sentar ganham `assentos` no desenho (centro e `chegar` relativos ao móvel, girados junto); `assentoNaTela` e o sentado do `Boneco` passam a receber a grade da cena.
- **Móvel em cima de alguém:** quando chega um `quarto_moveis` novo ou movido pelo tempo real e o meu `pos` deixou de ser livre, ando para o piso livre mais perto (`caminho` da grade).
- **Telas:**
  - o botão "Ir para o meu quarto" (só com `quartos`) e "Voltar ao K-FOFO";
  - "Visitar o quarto" na ficha (abre a aba `hall` e chama `irParaQuarto`);
  - "no quarto do Fulano" em "Na sala agora" e a casinha nos membros (ícone novo em `icones.tsx`).

## Não faça
- Não crie canal de tempo real por quarto: o lobby já tem a presença de todos e o evento `hall` já existe.
- Não guarde o quarto no `localStorage`: o site sempre abre no K-FOFO.
- Não mude a voz, a câmera nem a sala ao entrar ou sair de um quarto.

## Pronto quando
- [ ] Com três abas: A vai para o quarto dele (some do K-FOFO com brilho nas outras), B visita pela ficha e os dois se veem andando e sentando; C, no K-FOFO, vê "no quarto do A" na lista.
- [ ] A move um móvel para onde B está, e B vai sozinho para o piso livre mais perto.
- [ ] "Voltar ao K-FOFO" traz o boneco de volta pela entrada. Recarregar abre no K-FOFO.
- [ ] Presença com `quarto` falso, ou `pos` fora do quarto, é ignorada (teste mandando a mensagem à mão no console).
- [ ] 390 px ok. `npm run check` passa. O `CLAUDE.md` (presença, evento `hall`, store, quarto) e o `CHANGELOG` foram atualizados.

## Entrada do CHANGELOG
`"Quarto próprio: teletransporte para o seu quarto e visite o quarto dos outros nanicos"`
