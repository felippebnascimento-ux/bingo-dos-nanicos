# Fase 28: Tela de início com cartões (o Sítio abre só ao clicar)

**Branch:** `tela-inicio` · **Depende de:** fase 27 (um boneco por nanico). Combina com a 14 (carteira e ranking), mas não depende dela · **Banco:** não

## Objetivo (para quem usa)
Modelo: `planejamento/demo/inicio.html` e `inicio.png`. O desenho que o grupo mandou era **só um exemplo**; a demo é a versão arrumada dele.
- **Depois do login,** o site abre na tela **Início**, e não mais direto no Sítio.
- **Barra de cima:**
  - à esquerda, a marca: uma faixa com 5 bonecos, "Bingo dos Nanicos" e, embaixo, "Sítio do Mitz · 6 online agora";
  - à direita, o chip das **moedas** (saldo e posição; clicar abre o painel de ranking e extrato da fase 14 ou, sem ela, o quadro de moedas do Perfil) e o chip do **perfil** (rosto e nome; clicar abre a sua ficha).
- **Saudação:** "E aí, Gamer", e ao lado a sequência de dias e o bônus de hoje.
- **Cartões grandes,** 3 por linha no computador, 2 no tablet e 1 no celular. Cada um tem uma capa e uma linha "ao vivo":
  - **Sítio:** miniatura do cômodo e os rostos de quem está no hall; "6 nanicos no hall agora";
  - **Truco:** cartas; "1 mesa aberta · falta 1", com os rostos de quem está na mesa;
  - **Ao vivo:** tela; o selo `AO VIVO` e "Alemão está transmitindo" só quando alguém transmite, senão "Ninguém transmitindo";
  - **Jogar:** as 5 rotas com os rostos da escalação; o selo `EM PARTIDA` quando a Riot mostra alguém jogando;
  - **Cassino:** roleta; uma frase fixa ("Roleta, limbo, maior ou menor e caça-níquel") ou a última vitória grande, se a fase do cassino já mostrar isso;
  - **Nanicadas:** 3 nanicadas sorteadas em balões e "87 cadastradas · 2 novas hoje".
  - Abas que existirem depois (Troféus, Loja…) ganham um cartão no mesmo molde.
- **Todo mundo que loga aparece no Sítio,** mesmo ficando no Início. O boneco entra no hall na hora do login, como hoje; o Sítio só **aparece na tela** para quem clicar no cartão.
- **Voltar ao Início:** clicando na marca, ou no item "Início" do menu.

## Antes de começar
Siga as "Regras de toda sessão" de `planejamento/PLANO.md`. Leia:
- `src/components/App.tsx` (as abas sempre montadas) e `src/components/shell/Sidebar.tsx` (`ABAS`, marca, `People`, `CarteiraChip`);
- `src/lib/store.ts` (aba inicial) e `src/lib/tipos.ts` (`Aba`);
- `src/features/hall/HallView.tsx`, `bonecos.ts` (`iniciarHall`) e `Sala.tsx` (`Fundo`);
- `src/features/truco/*` (mesas abertas), `src/features/live/*` (quem transmite), `src/features/jogar/riot.ts` (quem está em partida);
- `src/features/moedas/*` e `src/lib/carteira.ts`.

## Como fazer
- **`Aba` ganha `"inicio"`:**
  - vira a aba inicial do store (no lugar de `"hall"`) e o primeiro item de `ABAS` ("Início", ícone novo em `icones.tsx`);
  - registre no `CLAUDE.md` que o site abre no Início.
- **`src/features/inicio/InicioView.tsx`** (`<section id="view-inicio" className="inner">`), com `Cartao.tsx` e o CSS em `src/styles/` com o próximo número livre.
- **Marca:** os 5 bonecos são recortes da spritesheet (`bonecoOf`, quadro parado de frente). É o mesmo arquivo do hall, sem imagem nova.
- **Capa do Sítio:**
  - reaproveite o `<Fundo>` do `Sala.tsx` num `viewBox` recortado, sem bonecos e sem animação; por cima, os rostos (`Avatar`) de quem está no hall, com `umPorNanico` da fase 27;
  - as outras capas são SVG ou CSS simples com as cores da paleta (`--olive`, `--mint`, `--live`, `--accent`).
- **Linhas "ao vivo":** cada cartão lê só o que já existe no store e nos módulos (presença, mesas do truco, `myLiveSid`/`online[].live`, Riot, `phrases`). **Nenhuma consulta nova ao banco.** Se a informação não existe, mostra só o texto fixo.
- **Cartões:** cada um é um `<button>` com `aria-label` ("Entrar no Sítio, 6 nanicos no hall agora"), foco visível e `setApp({ aba })` ao clicar.
- **Menu lateral:**
  - **no Início,** ele fica escondido: a barra de cima e os cartões fazem o papel dele, como no desenho;
  - **nas outras abas,** ele continua como está, com "Início" em primeiro.
  - No celular, a barra de cima fica compacta (marca pequena, moedas e rosto) e os cartões em uma coluna.
- **Hall em segundo plano:** confira que `iniciarHall()` roda no login mesmo sem abrir o Sítio. O `HallView` já fica montado escondido, mas não dependa disso: chame no `enterApp`. O meu boneco aparece para os outros sem eu abrir o Sítio. O loop de animação continua parado enquanto o Sítio não está na tela.
- **Log de novidades** (fase 1): continua abrindo por cima do Início depois de uma atualização.

## Não faça
- Não tire ninguém do hall por estar no Início: estar no site é estar no Sítio.
- Não crie consulta nova ao banco só para os cartões.
- Não use imagens novas: as capas são SVG/CSS e os bonecos que já existem.

## Pronto quando
- [ ] Ao logar, o site abre no Início, com a barra de cima, a saudação e os cartões.
- [ ] Com duas pessoas, uma no Início e outra no Sítio, a do Sítio vê o boneco da outra; ao entrar no Sítio, a primeira vê o hall com todo mundo.
- [ ] Os selos AO VIVO e EM PARTIDA e as contagens aparecem só quando é verdade.
- [ ] Clicar na marca volta ao Início, e o chip das moedas e o do perfil abrem o que devem.
- [ ] Com 390 px, sem rolagem para o lado, os cartões ficam em uma coluna. Pelo teclado, Tab passa pelos cartões e Enter abre.
- [ ] `npm run check` passa. O `CLAUDE.md` (aba `inicio`, pasta `features/inicio`, aba inicial) e o `CHANGELOG` foram atualizados.

## Entrada do CHANGELOG
`"Tela de início: escolha para onde ir (Sítio, Truco, Ao vivo, Jogar, Cassino, Nanicadas) e veja o que está rolando em cada um"`
