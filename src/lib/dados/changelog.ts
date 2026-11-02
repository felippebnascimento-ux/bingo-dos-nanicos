/*
 * Log de versões. A versão (v1.NN) é calculada pelo tamanho da lista.
 * Toda mudança que um nanico consiga notar acrescenta UMA entrada no fim:
 *   { data: "DD/MM/AAAA", itens: ["Frase curta dizendo o que mudou para quem usa"] },
 * Função que deixou de existir não é apagada: vira { t: "texto antigo", off: "trocado por … na v1.NN" }.
 */
export type ItemLog = string | { t: string; off: string };
export type EntradaLog = { data: string; itens: ItemLog[] };

export const CHANGELOG: EntradaLog[] = [
  { data: "24/10/2026", itens: ["Banco de frases compartilhado pelo grupo", "Escalação da partida igual para todos", "Cartela 5x5 sorteada para cada pessoa"] },
  { data: "24/10/2026", itens: ["Frase ligada a mais de um campeão", { t: "Fotos dos amigos no seletor", off: "trocado pela arte de cada nanico na v1.05" }, "Lista de amigos em ordem alfabética", { t: "Opção de renomear amigos", off: "removido na v1.02" }] },
  { data: "25/10/2026", itens: ["Site próprio, sem precisar de conta do Claude", { t: "Público só cadastra frases e troca fotos", off: "trocado pelo login de cada nanico na v1.07" }] },
  { data: "25/10/2026", itens: ["Novo visual: Bingo dos Nanicos", "Lista de quem está na sala agora", { t: "Nome salvo no navegador", off: "trocado pelo login de cada nanico na v1.07" }] },
  { data: "25/10/2026", itens: ["Frases viram Nanicadas, sempre em minúsculas", { t: "Filtro por vários nanicos ao mesmo tempo", off: "voltou a ser uma pessoa por vez na v1.19" }, "Opção Random na escalação", "Telas largas aproveitam o espaço em colunas"] },
  { data: "25/10/2026", itens: ["Arte de cada nanico: rosto em todo o site e corpo inteiro na aba Nanicos", "Marca d'água do grupo e ícone da bola de bingo", "Seletor de nanico abre onde cabe na tela"] },
  { data: "30/10/2026", itens: [{ t: "Botão para entrar no Google Meet do grupo", off: "removido na v1.21: agora tem câmera e transmissão no site" }] },
  { data: "31/10/2026", itens: ["Login de cada nanico, com senha própria no primeiro acesso", "Aba Ao vivo: várias transmissões de tela ao mesmo tempo, com o som só da principal"] },
  { data: "31/10/2026", itens: [{ t: "Transmissão em Full HD com 60 ou 30 fps", off: "ganhou a opção 1440p na v1.15" }, { t: "Tela cheia com chat e cartela ao lado e botão de esconder o painel", off: "botão trocado pela alça retrátil na v1.14" }, "Chat da sala", "Cartela no painel e cartela flutuante", "Menu lateral recolhível"] },
  { data: "31/10/2026", itens: ["Número da versão no rodapé e este log de atualizações"] },
  { data: "31/10/2026", itens: ["Uma surpresa que só aparece no fim do dia"] },
  { data: "31/10/2026", itens: ["Som da transmissão: pede o som da janela do jogo quando o navegador permite", "Aviso explicando por que a transmissão saiu sem som, com botão para transmitir de novo"] },
  { data: "31/10/2026", itens: ["Controles do vídeo somem sozinhos e só aparecem ao mexer o mouse, para não tapar o jogo"] },
  { data: "31/10/2026", itens: ["Clicar em quem está ao vivo na lista da sala abre direto a transmissão da pessoa"] },
  { data: "31/10/2026", itens: ["Painel do Ao vivo recolhe pela alça entre o vídeo e o painel, dentro ou fora da tela cheia", "Arrastar o volume ou clicar no vídeo não seleciona mais texto"] },
  { data: "31/10/2026", itens: [{ t: "Qualidade da transmissão: 1080p ou 1440p (2K), com 30 ou 60 fps", off: "reorganizado na v1.17" }] },
  { data: "31/10/2026", itens: ["Câmera: o vídeo aparece no lugar do personagem na lista da sala", "Câmeras numa janela flutuante, de todo mundo ou de uma pessoa só"] },
  { data: "31/10/2026", itens: ["Qualidade da transmissão: 1440p ou 1080p, com 60 ou 30 fps (o mais alto à esquerda)", "Proteção contra abuso: limite de mensagens, nanicadas e mudanças de escalação, e tudo que chega da sala é conferido antes de aparecer"] },
  { data: "31/10/2026", itens: ["Nanicada com vários nanicos e campeões", "Escolha se a nanicada entra com qualquer um ou só com todos na partida", "Qualquer nanico pode editar e remover nanicadas"] },
  { data: "31/10/2026", itens: ["Aba Perfil com o link do op.gg de cada um", "Clicar num nanico abre as nanicadas dele", "Filtro das nanicadas volta a mostrar uma pessoa por vez"] },
  { data: "31/10/2026", itens: ["Partida ao vivo: o site percebe quando um nanico com op.gg entra em jogo e mostra os 10 campeões", "Escalação preenchida sozinha quando a partida começa"] },
  { data: "31/10/2026", itens: ["Perfil mostra o nick de cada um embaixo do nome"] },
  { data: "31/10/2026", itens: ["Escalação automática acerta a lane de cada um pelo campeão e pelos feitiços"] },
  { data: "31/10/2026", itens: ["Rostos e câmeras maiores na lista da sala, com o menu aberto ou recolhido"] },
  { data: "31/10/2026", itens: ["Botão X para esconder o “Estou com fome” até o dia seguinte"] },
  { data: "31/10/2026", itens: ["Menu recolhido mais largo, com barra de rolagem fina e sem cortar os rostos"] },
  { data: "31/10/2026", itens: ["Reações com emoji na live: sobem na tela de quem está assistindo e de quem transmite"] },
  { data: "31/10/2026", itens: ["Montar a própria cartela escolhendo as nanicadas que valem para a escalação"] },
  { data: "31/10/2026", itens: ["Arte nova do Gamer, Grito, Veião e Pin, e foto nova da turma"] },
  { data: "31/10/2026", itens: ["Reações com foto na live: os Picarétezzi"] },
  { data: "31/10/2026", itens: ["Desenhar na live: o risco aparece para todos que estão assistindo e some em 3 s, com cor e espessura, e dá para desligar"] },
  { data: "31/10/2026", itens: ["Caixinha “Ver reações” para desligar os emojis e fotos dos outros na live"] },
  { data: "31/10/2026", itens: ["Visual mais limpo: controles da live em ícones, reações e ajustes num balão", "Câmeras sempre embaixo da live, e botão das câmeras no menu com a contagem", "Live com mais qualidade: mais bitrate, H.264 High e som em 192 kbps"] },
  { data: "31/10/2026", itens: ["Aba Truco gaudério: mesas de 1 contra 1 e 2 contra 2, com envido, flor, truco, retruco e vale quatro"] },
  { data: "01/11/2026", itens: ["Site novo por dentro: abre mais rápido e as artes dos nanicos ficam guardadas no navegador"] },
  { data: "01/11/2026", itens: ["Sítio do Mitz: o hall com o boneco de cada nanico; clique no chão para andar e veja quem está no site"] },
  { data: "01/11/2026", itens: ["As novidades aparecem sozinhas na primeira vez que você entra depois de uma atualização"] },
  { data: "01/11/2026", itens: ["Moedas: bônus todo dia que você entra, maior a cada dia seguido, e moedas pelo tempo com o site aberto"] },
  { data: "01/11/2026", itens: ["Ficha de cada nanico na aba Nanicos: elo, KDA, main e horas de CS2, com o boneco no quarto", "Perfil aceita o link da Steam"] },
  { data: "01/11/2026", itens: ["Atributos na ficha: tilt, choro, clutch, farm, sorte e call, com voto anônimo do grupo"] },
  {
    data: "02/11/2026",
    itens: [
      "Sítio maior e mais claro, com janelão para as árvores",
      "No Sítio: TV, mesa do truco e loja abrem com um clique, e o piso fica marcado embaixo do mouse",
      "Quem está na sala, a sua carteira e os ganhos de moedas de todo mundo aparecem nos cantos do Sítio",
    ],
  },
  {
    data: "02/11/2026",
    itens: [
      "Salas tipo lan house: LoL 1, LoL 2, CS e Resenha, cada uma com live, câmeras e chat próprios",
      "Lobby com quem está em cada sala e chat geral",
      "No celular, as abas ficam numa barra embaixo da tela",
    ],
  },
  { data: "02/11/2026", itens: ["Cassino com moedas: roleta europeia, com a vantagem da casa à mostra e resultado que dá para conferir"] },
  { data: "02/11/2026", itens: ["Cassino: limbo, maior ou menor e caça-níquel com o rosto dos nanicos"] },
  { data: "02/11/2026", itens: ["Sítio: cada nanico aparece uma vez só, e quem entra aparece na hora, mesmo depois de deixar o site em segundo plano"] },
];

export const versionAt = (i: number) => "v1." + String(i).padStart(2, "0");
export const VERSION = versionAt(CHANGELOG.length - 1);
