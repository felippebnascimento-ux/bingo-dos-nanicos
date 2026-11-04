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
  { data: "25/10/2026", itens: ["Novo visual: Bingo dos Nanicos", { t: "Lista de quem está na sala agora", off: "trocada pela lista de membros à direita na v1.52" }, { t: "Nome salvo no navegador", off: "trocado pelo login de cada nanico na v1.07" }] },
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
  { data: "01/11/2026", itens: [{ t: "Ficha de cada nanico na aba Nanicos: elo, KDA, main e horas de CS2, com o boneco no quarto", off: "trocado só pelos links do op.gg e da Steam na ficha na v1.68" }, "Perfil aceita o link da Steam"] },
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
  { data: "02/11/2026", itens: [{ t: "Tela de início: escolha para onde ir (Sítio, Truco, Ao vivo, Jogar, Cassino, Nanicadas) e veja o que está rolando em cada um", off: "o site volta a abrir no Nanico Hotel na v1.68" }] },
  { data: "02/11/2026", itens: ["Ranking de quem tem mais moedas: clique na carteira para ver a sua posição"] },
  { data: "02/11/2026", itens: ["Na ficha de cada um: dias seguidos no Sítio, recorde e tempo online (hoje, na semana e no total)"] },
  { data: "02/11/2026", itens: ["Roleta do rodízio na aba Jogar: quem está de fora entra na roleta e todo mundo joga na sua vez"] },
  { data: "02/11/2026", itens: ["No Sítio: clique num amigo para dar uma chinelada ou uma torta na cara (e ele pode revidar)"] },
  {
    data: "02/11/2026",
    itens: [
      { t: "Troféus da semana no Sítio: Feeder, Turista, Carregou o piano, Viciado e Sumido, com chapéu de burro e coroa", off: "trocado pelo Hall da Fama do LoL e do CS2 na v1.122" },
      "Coroa de moedas para o mais rico do Sítio",
      "Clique no quadro de troféus do Sítio para ver todas as categorias, as semanas anteriores e o hall da fama",
    ],
  },
  {
    data: "02/11/2026",
    itens: ["O menu do lado rola sozinho em tela baixa, sem arrastar a página junto"],
  },
  {
    data: "02/11/2026",
    itens: [
      "Voz nas salas: clique numa sala em \"Canais de voz\" para entrar, falar com quem está nela e ver as transmissões; o botão vermelho desliga e sai da sala",
      "Clique no AO VIVO de alguém em outra sala para entrar no canal e já assistir à tela",
      "O rosto de quem está falando acende na lista",
      { t: "Canais de texto no menu: o #geral e o chat de cada sala, com as mensagens novas e quem está lendo agora", off: "o chat de cada sala foi para dentro do canal de voz na v1.54" },
      "Lista de membros à direita, com quem está online e quem está offline, onde cada um está e a câmera no rosto",
      "Embaixo do menu ficam fixos a voz, a câmera, o seu perfil e as suas moedas",
      "A câmera agora é da voz: só quem está no mesmo canal de voz se vê, e ela continua ligada quando você troca de canal",
      "Configurações na engrenagem embaixo do menu: escolha o microfone, a saída de som e a câmera, ligue ou desligue o cancelamento de eco e a supressão de ruído e teste o microfone",
      "Trocar senha e Sair agora ficam nas Configurações",
      "No Ao vivo, o nome da sala onde você está aparece em destaque",
    ],
  },
  {
    data: "02/11/2026",
    itens: [
      "Supressão de ruído bem mais forte na voz: uma inteligência artificial corta teclado, ventilador e barulho de fundo",
      "No teste do microfone, dá para se ouvir de fone e comparar com a supressão ligada e desligada",
      "Quem tem o site aberto em mais de um lugar não some mais da sala nem pula para o lobby",
    ],
  },
  {
    data: "02/11/2026",
    itens: [
      "O chat de cada sala agora é o chat do canal de voz: fica no Ao vivo, ao lado das transmissões, e abre primeiro",
      "O canal de voz onde você está mostra as mensagens novas do chat dele; clicar abre direto no chat",
      "Em Canais de texto fica só o #geral, o chat de todo mundo",
    ],
  },
  {
    data: "02/11/2026",
    itens: ["Happy hour das 22h à meia-noite com moedas em dobro", "Churrasco de sábado no Sítio: pegue seu espetinho surpresa"],
  },
  {
    data: "02/11/2026",
    itens: [
      "Loja: gaste moedas em itens para o seu quarto, títulos, molduras e escudo de sequência",
      "Cigarrinho, latinha, chimarrão, energético, caipirinha e charuto: use no Sítio e todo mundo vê o seu boneco fumando ou bebendo",
      "Mochila na sua ficha: equipe e tire os itens; o quarto, o título e a moldura aparecem para todo mundo",
      "A geladeira do Sítio agora abre a Loja",
    ],
  },
  {
    data: "02/11/2026",
    itens: [
      "Truco à prova de espiada: as cartas ficam no servidor, e a vitória vale moedas",
      "Ganhou a partida de truco: +15 moedas (até 3 vitórias pagas por dia)",
      "Recarregou a página no meio do truco? Seu lugar e suas cartas continuam lá",
    ],
  },
  {
    data: "02/11/2026",
    itens: [
      "Bingo valendo moedas: a cartela é sorteada pelo site e cada nanicada precisa de outro nanico confirmando",
      "Fechou uma linha com a cartela sorteada: +25 moedas (até 3 bingos pagos por dia)",
      "Cartela montada continua valendo para brincar, mas não dá moedas",
      "Botão \"Fechar a partida\" na cartela para começar outra",
    ],
  },
  {
    data: "02/11/2026",
    itens: [
      "Missões do dia: 3 tarefas por dia que valem moedas, com bônus para quem fizer todas",
      "As missões aparecem no Sítio, em cima da carteira, e no Perfil",
    ],
  },
  {
    data: "02/11/2026",
    itens: [
      "Mídias: galeria de prints do grupo",
      "Links de Twitch, YouTube e outros na ficha, e um mural de links do grupo",
      "Vídeo entra na galeria como link do YouTube, do Medal ou clipe da Twitch",
    ],
  },
  {
    data: "02/11/2026",
    itens: [
      "Celular na loja: compre e entre na rede social nanica para postar, curtir e comentar",
      "A loja mostra quanto falta para o celular, com uma barra de progresso",
    ],
  },
  {
    data: "02/11/2026",
    itens: [
      "Apostas com moedas na partida ao vivo: escolha o time e divida o bolo com quem acertou",
      "Nova missão do dia: apostar numa partida ao vivo",
    ],
  },
  {
    data: "02/11/2026",
    itens: [
      "Sítio arrumado do jeito do grupo: mesa grande, mesa de jogos redonda, sofás, poltronas, cozinha, banheiro e a churrasqueira no canto",
      "Quem chega ao Sítio entra pela porta da frente",
      "O Truco abre pela mesa de jogos e a Loja pela geladeira da cozinha",
    ],
  },
  {
    data: "02/11/2026",
    itens: [{ t: "Tempo no site sem limite de moedas por dia: 1 a cada 6 minutos (no happy hour, 1 a cada 3)", off: "trocado por 5 a cada 6 minutos na v1.117" }],
  },
  {
    data: "02/11/2026",
    itens: [
      { t: "Menu arrumado em grupos (Lugares, Turma e Moedas), com ícones diferentes para o Início e o Sítio", off: "trocado pelos grupos Jogos, Bingo e Turma na v1.68" },
      { t: "Ranking, Loja e Troféus direto no menu", off: "o Ranking saiu do menu na v1.68 (continua na carteira)" },
      { t: "Início novo: o seu dia (moedas, sequência, bônus e missões), o que está acontecendo agora e o ranking de moedas", off: "o site volta a abrir no Nanico Hotel na v1.68" },
    ],
  },
  {
    data: "02/11/2026",
    itens: ["Truco com baralho espanhol desenhado: ouros, copas, espadas e bastos de verdade, com sota, cavalo e rei"],
  },
  {
    data: "02/11/2026",
    itens: [
      "Roleta do Cassino de verdade: a roda gira, a bolinha corre, quica e cai no número sorteado",
      "Sons da roleta com botão de mudo e os seus últimos 10 números",
    ],
  },
  {
    data: "02/11/2026",
    itens: ["Atributos votados aparecem desde o primeiro voto e se atualizam na hora, a cada voto novo"],
  },
  {
    data: "02/11/2026",
    itens: [
      "O Sítio agora se chama Nanico Hotel, e o site volta a abrir direto nele",
      "Menu em grupos que recolhem: Jogos (Nanico Hotel, Truco, Cassino e Loja), Bingo (Nanicadas e Jogar) e Turma",
      "Menu mais estreito",
      "Truco: 20 segundos para cada jogada. Acabou o tempo, sai uma carta sorteada (ou o pedido é aceito)",
      "Perfil aceita um segundo op.gg, do smurf, e a partida ao vivo procura nas duas contas",
      "Ficha mais limpa: só os links do op.gg e da Steam, sem a zoeira da semana, e os atributos em ordem alfabética",
      "Bonecos do Nanico Hotel mais nítidos",
      "A lista de membros à direita não mostra mais quem está falando (isso fica nos canais de voz)",
    ],
  },
  {
    data: "02/11/2026",
    itens: [
      "Emojis e desenho na live voltaram a chegar para todo mundo (a conexão da sala caía quando muita coisa mudava de uma vez)",
      "Cor preta no desenho da live",
    ],
  },
  {
    data: "02/11/2026",
    itens: ["O Nanico Hotel voltou a se chamar K-FOFO no menu e no resto do site"],
  },
  {
    data: "02/11/2026",
    itens: [
      "Tocar num boneco no K-FOFO (inclusive o seu) abre o cartão do perfil no canto, com emblemas e respeitos",
      "Respeitos: cada nanico tem 3 por dia para dar aos outros",
      "Emblemas conquistados: tempo no site, sequência, tela compartilhada, coroa, respeitos, elo, CS, troféus, truco, bingo, cassino e nanicadas",
      "Cigarrinho, latinha e os outros duram minutos, com um contador do seu efeito embaixo do K-FOFO",
    ],
  },
  {
    data: "02/11/2026",
    itens: ["Dá para sentar nos sofás e nas poltronas do K-FOFO: toque no móvel e o boneco vai até lá e senta"],
  },
  {
    data: "02/11/2026",
    itens: ["Tocar no boneco não deixa mais uma caixa escura em volta dele"],
  },
  {
    data: "02/11/2026",
    itens: [
      "Roleta nova no feltro: espalhe fichas pela mesa (número, dúzia, coluna, cor, par/ímpar e metade) e gire tudo de uma vez",
      "Fichas de 5 a 100 com desfazer, limpar, dobrar e repetir a última aposta",
      "Painel do resultado com o que você ganhou em cada ficha, os últimos números e as cores das últimas rodadas",
    ],
  },
  {
    data: "02/11/2026",
    itens: ["Passar o mouse no boneco não pinta mais um quadrado escuro em volta"],
  },
  {
    data: "02/11/2026",
    itens: [
      "Um clique no AO VIVO de alguém (nos canais, nos membros ou no K-FOFO) já abre a tela da pessoa, sem entrar na voz",
      "Com o mouse em cima, o AO VIVO vira \"Assistir\"",
      "A TV do K-FOFO abre direto a live de quem está transmitindo",
    ],
  },
  {
    data: "02/11/2026",
    itens: [
      { t: "Limbo no cassino", off: "trocado pelo Aviãozinho na v1.78" },
      "Aviãozinho no Cassino: o avião decola, o multiplicador sobe e você saca antes dele ir embora",
      "Saque automático no Aviãozinho, últimos voos e quem está jogando agora",
    ],
  },
  {
    data: "02/11/2026",
    itens: [{ t: "Maior ou menor de cara nova: placas de dígitos que param uma a uma, lados grandes, barra colorida para mudar a chance e ½, ×2 e Máx", off: "trocado pelo Pênalti na v1.83" }],
  },
  {
    data: "02/11/2026",
    itens: ["CS na ficha: o Premier atual e o nível da GC de cada nanico, vindos do Leetify (também ao passar o mouse nos rostos da sala de CS)"],
  },
  {
    data: "02/11/2026",
    itens: ["Caça-níquel de cara nova: máquina com lâmpadas, alavanca, rolos que param um de cada vez, painel de LED, giro automático ×10 e modo rápido"],
  },
  {
    data: "02/11/2026",
    itens: [
      "Roleta mais bonita: vermelho de cassino de verdade, números maiores, cruzeta dourada brilhando e um brilho na casa que saiu",
      "Aviãozinho de cara nova: avião desenhado de novo, esperando na pista, nuvens passando, lua, montanhas, escala do multiplicador e fumaça quando ele vai embora",
      "Cassino mais real: roda de madeira com veio, frisos cromados e inclinada como numa mesa, rastro da bolinha, feltro com textura e borda de madeira, fichas com relevo, avião com volume e fumaça de rastro, nuvens macias e luzes na pista",
    ],
  },
  {
    data: "02/11/2026",
    itens: [
      "Cassino ao vivo: roleta e aviãozinho agora são rodadas para todo mundo junto. A primeira aposta abre a rodada, a contagem aparece para todos e quem entrar a tempo joga na mesma roleta e no mesmo avião",
      "Pênalti no lugar do Maior ou menor: cada um chuta contra o goleiro da casa, cada gol sobe o multiplicador (até 7,36× no 5º) e dá para sacar quando quiser; defendeu, a bola espirra para fora",
      "Goleiro novo, com corpo de atleta, e mesa da roleta igual à de cassino: casas vermelhas e pretas inteiras, filetes dourados e o 0 com ponta; a roda fica inclinada como numa mesa de verdade",
      "Jackpot do grupo no caça-níquel: 1% de cada giro de qualquer nanico vai para o prêmio, e quem tirar 3 bolas leva tudo",
    ],
  },
  {
    data: "03/11/2026",
    itens: [
      "Roleta com câmera: quando ela gira, vai para o meio da tela, grande, e mostra o número e quanto você ganhou antes de voltar (toque fora ou Esc fecha)",
      "Bolinha mais real: pula nos losangos e entre as casas, com a sombra se afastando, e balança de leve antes de parar na casa",
      "Pênalti: o botão de sacar voltou a aparecer, verde e pulsando",
      "Roleta nova em laca preta com ouro, maior e com números mais fáceis de ler; a ficha de 5 ganhou listras azuis para não sumir",
    ],
  },
  {
    data: "03/11/2026",
    itens: ["A roleta ao vivo não toca mais som para quem está fora da tela da Roleta (em outra aba, outro jogo ou com o navegador escondido)"],
  },
  {
    data: "03/11/2026",
    itens: [
      "Celular novo: um iPhone 17 Pro Max com Dynamic Island, que avisa quando sai post ou story e enquanto você publica",
      "InstaNanico no lugar da rede nanica: igual ao Instagram, com stories de 24 h (foto ou texto colorido, com quem viu), feed com curtir em dois toques, comentários, explorar, notificações, perfil com grade e postagem só com foto",
    ],
  },
  {
    data: "03/11/2026",
    itens: ["Celular mais bonito: fundo escuro e desfocado em volta (no tema escuro ficava um quadro cinza enorme), a moldura do iPhone mais fina e as fotos do feed em pé (4:5), como no Instagram"],
  },
  {
    data: "03/11/2026",
    itens: [
      "InstaNanico Direct: mande mensagens para os nanicos, responda stories e envie publicações pelo aviãozinho; a Dynamic Island avisa quando chega mensagem",
      { t: "As fotos do feed aparecem inteiras, no formato delas, sem cortar", off: "trocado pelo corte do Instagram na v1.89" },
    ],
  },
  {
    data: "03/11/2026",
    itens: [
      "InstaNanico: ao postar, ajuste a foto na hora (arraste e zoom) em quadrado, em pé (4:5) ou deitado, como no Instagram; o story vem em tela cheia",
      "A Dynamic Island abre e fecha suave como a do iPhone e, tocando no aviso, leva direto à mensagem, ao post ou ao story",
      "O celular ficou maior na tela do computador",
    ],
  },
  {
    data: "03/11/2026",
    itens: [
      "Voz no estilo do Discord: o painel embaixo do menu mostra o sinal da conexão, liga a supressão de ruído e tem os botões de câmera, transmitir a tela, reações e câmeras em janela",
      "Microfone e fone com a setinha: escolha o aparelho, teste o microfone na barrinha, ligue o ruído e o eco e ajuste o volume da voz",
      "Transmitir a tela abre uma janela para escolher tela inteira, janela ou aba, 720p, 1080p ou 1440p, 30 ou 60 fps e se vai o som do PC; enquanto transmite, aparece a miniatura com quantos estão assistindo",
      "O Ao vivo mostra todo mundo da voz em quadrados, com a câmera ou o rosto e a borda dourada em quem fala, e uma tela para cada transmissão: dá para assistir várias ao mesmo tempo",
      "Clique numa tela para ver em destaque, com o resto do canal embaixo; clique direito num quadrado para tela cheia, janela flutuante, volume da pessoa e silenciar",
      "Ligar a câmera mostra uma prévia antes, com a escolha da câmera e a opção de espelhar",
      { t: "A aba Telas do painel do Ao vivo", off: "trocada pela grade do canal e pelo painel de voz na v1.90" },
    ],
  },
  {
    data: "03/11/2026",
    itens: [
      "A sua própria transmissão não aparece mais como tela dentro da tela: o quadro diz que você está transmitindo e tem o botão Ver prévia",
      "Quem está sem câmera aparece num quadro escuro com o rosto maior, e os quadros cabem na tela sem ficar gigantes",
      "O painel da voz cabe inteiro no menu e o aviso de sem som ficou mais curto",
    ],
  },
  {
    data: "03/11/2026",
    itens: [
      "Clique em qualquer quadro do Ao vivo (a sua tela, a tela de alguém, uma câmera) para ver ele grande, com o resto do canal embaixo",
      "O Ao vivo usa a largura toda da tela e as telas em destaque ficam do maior tamanho que cabe",
      "No menu, o seu nome aparece ao lado do microfone e do fone; na voz, as moedas ficam numa linha embaixo",
      "No celular, o botão de transmitir só aparece onde dá para transmitir",
    ],
  },
  {
    data: "03/11/2026",
    itens: [
      "InstaNanico: editor de story como o do Instagram, com textos em 5 estilos e 10 cores (com ou sem fundo na letra), que se arrastam, crescem e giram",
      "No story dá para desenhar (caneta, marca-texto, neon e borracha) e pôr figurinhas: menção a um nanico, hora, local e emojis; arraste até a lixeira para apagar",
      "Quem é mencionado no story fica sabendo pelo Direct",
      "Ver stories: segure para pausar, toque no coração para curtir e mande reações rápidas; no computador, as setas passam e o Esc fecha",
      "Explorar em mosaico, como no Instagram, e o perfil de outro nanico tem o botão Mensagem",
      "O iPhone do InstaNanico tem as medidas do 17 Pro Max de verdade, com a borda fina",
    ],
  },
  {
    data: "03/11/2026",
    itens: [
      "Com o mouse em cima da tela de alguém, aparecem o volume, o botão de tirar o som e a tela cheia, como no Discord; nas outras telas abertas, um toque passa o som para elas",
      "A sua transmissão no menu ficou compacta, dentro do painel da voz: Ao vivo, quantos assistem, a qualidade e os botões de qualidade e parar; tocar no Ao vivo mostra ou esconde a prévia",
    ],
  },
  {
    data: "03/11/2026",
    itens: [
      "Painel da voz caprichado como o do Discord: botões do mesmo tamanho, fundo suave ao passar o mouse e dicas num balãozinho que não sai cortado",
      "Sem o som do PC na transmissão: uma linha com o botão Corrigir, que abre a janela de transmitir explicando o que fazer",
      "A qualidade da sua transmissão aparece curta (1440p60)",
    ],
  },
  {
    data: "03/11/2026",
    itens: [
      "Os botões ligados (transmitir e câmera) continuam na cor deles ao passar o mouse, e todos os botões do painel da voz têm o mesmo fundo",
    ],
  },
  {
    data: "03/11/2026",
    itens: [
      { t: "Bolsa Cassino: quem ficar com menos de 100 moedas ganha 5.000, uma vez por dia, e volta para o jogo", off: "trocado pelo botão da Bolsa Nanica no K-FOFO na v1.118" },
    ],
  },
  {
    data: "03/11/2026",
    itens: [
      "As moedas embaixo do menu abrem o ranking e o extrato, como a carteira do K-FOFO",
      "Mochila no K-FOFO: um botão ao lado da carteira abre o inventário para equipar, usar e abrir o Celular",
      "Passe o mouse (ou toque) num emblema para ver o nome, o nível e quanto falta para o próximo",
    ],
  },
  {
    data: "03/11/2026",
    itens: [
      "No K-FOFO, quem senta no sofá ou na poltrona fica em cima do estofado, e não mais dentro ou atrás dele; nas poltronas e no sofá do canto, o encosto aparece na frente das costas",
      "O cigarrinho e a latinha acompanham quem está sentado",
    ],
  },
  {
    data: "03/11/2026",
    itens: [
      "Ficha caprichada: cada parte num cartão, a posição no ranking com as moedas embaixo do nome e o dia de hoje destacado no gráfico da semana",
      "Os atributos mudam de cor pela nota (baixa, média e alta)",
      "Quarto mais bonito: sol entrando pela janela, sombra no canto, peitoril e uma prateleira com livros e um troféu",
      "Na sua ficha, os botões Minha mochila e Abrir a loja",
    ],
  },
  {
    data: "03/11/2026",
    itens: [
      "10 emblemas novos: Missionário (missões feitas), Dia perfeito (as 3 missões no dia), Mão quente (apostas ganhas), Tubarão (maior prêmio numa aposta), Pé no chão (voos sacados), Artilheiro (gols no Pênalti), Coruja (happy hour), Churrasqueiro (espetinhos), Fênix (Bolsas Cassino) e Colecionador (itens na mochila)",
    ],
  },
  {
    data: "03/11/2026",
    itens: [
      "Loja nova: filtros no topo, cada item com a raridade (comum, rara, épica ou lendária) e uma janela com o item grande ao tocar nele",
      "Cinco itens novos para usar no K-FOFO: cafezinho, pipoca, fatia de pizza, whisky 12 anos e champanhe",
    ],
  },
  {
    data: "03/11/2026",
    itens: [
      "Acessórios para o boneco na loja: boné de aba reta, óculos escuros, headset gamer e cartola do magnata. Equipado, aparece no seu boneco no K-FOFO e no quarto da ficha",
    ],
  },
  {
    data: "03/11/2026",
    itens: [
      "Aba Amigos: os amigos dos nanicos têm uma aba só deles. O primeiro é o Lightzin, que já tem arte e boneco no K-FOFO",
    ],
  },
  {
    data: "03/11/2026",
    itens: [
      "Amigos dos nanicos: o Lightzin chegou! Amigos têm login, boneco no K-FOFO, moedas e truco, e uma aba só deles",
      "Na aba Amigos, quem está online e de quem cada um é amigo; nos membros, uma categoria Amigos; no ranking, a etiqueta amigo",
    ],
  },
  {
    data: "03/11/2026",
    itens: ["No K-FOFO, quando alguém entra no site aparece \"Fulano entrou!\" no canto de cima, embaixo do Na sala agora"],
  },
  {
    data: "03/11/2026",
    itens: [
      "Truco valendo moedas: escolha quanto vale a mesa e quem ganha leva o bolo. Dá para apostar em quem vai ganhar a partida",
      "Mesa fechada no meio do jogo devolve as entradas e as apostas; a mesa grátis continua com o +15",
    ],
  },
  {
    data: "03/11/2026",
    itens: [
      "Truco no K-FOFO: quem está jogando aparece sentado na mesa verde, e dá para chegar perto, assistir e apostar",
      "Na mesa verde, cada um tem as cartas na mão, as jogadas ficam viradas no feltro e a placa mostra o placar e quem ganhou",
    ],
  },
  {
    data: "03/11/2026",
    itens: ["Ficha: o elo do LoL voltou (o mais alto entre solo e flex), com o brasão do elo e o nível da GC como emblemas"],
  },
  {
    data: "03/11/2026",
    itens: [
      "Quarto próprio: compre o seu na Loja (pequeno, médio ou grande), compre móveis e arrume do seu jeito",
      "Doze móveis novos (cama, sofá, setup gamer, TV, estante, frigobar e mais); trocar por um quarto maior custa só a diferença e os móveis continuam no lugar",
    ],
  },
  {
    data: "03/11/2026",
    itens: [
      "Quarto próprio: teletransporte para o seu quarto e visite o quarto dos outros nanicos",
      "No quarto dá para andar e sentar na cama, no sofá, na poltrona e no puff; a lista \"Na sala agora\" e os membros mostram quem está em qual quarto",
    ],
  },
  {
    data: "03/11/2026",
    itens: ["No celular de verdade, o InstaNanico volta a rolar (feed, explorar, perfil) e respeita o recorte da tela e a barrinha de baixo"],
  },
  {
    data: "03/11/2026",
    itens: ["No celular de verdade, o InstaNanico tem um X no topo para sair, e o voltar do celular também fecha"],
  },
  {
    data: "03/11/2026",
    itens: ["Truco repaginado: mesa oval de cassino com borda de couro e feltro, os nanicos sentados em volta com o anel do tempo, o grito em balão, as cartas jogadas viradas para quem jogou e a sua mão grande na beira da mesa"],
  },
  {
    data: "03/11/2026",
    itens: [
      "Cassino: blackjack ao vivo, todo mundo na mesma mesa contra o mesmo dealer; a primeira aposta abre a rodada (10 s para apostar, de 5 a 200)",
      "Na sua vez: pedir, parar, dobrar ou dividir, com 15 s para decidir; o dealer pede até 16 e para em 17, e o blackjack paga 3 para 2",
      "Dá para conferir cada rodada: o sapato é embaralhado por um segredo que aparece no fim",
    ],
  },
  {
    data: "03/11/2026",
    itens: [
      "Pôquer no Cassino: Texas Hold'em entre os nanicos, em mesas como as do truco, com até 6 lugares",
      "Abra uma mesa com blinds de 5/10, 10/20 ou 25/50 e sente com as suas moedas; ao levantar, o que sobrou volta para a carteira",
      "Na sua vez: desistir, passar, pagar ou aumentar (½ pote, ¾ pote, pote ou all-in), com 20 s para decidir; all-in divide o pote certinho",
      "No fim, a mão de quem ganhou acende na mesa; a casa leva 3% do pote, só se a mão chegou ao flop",
      "O seletor de jogos do Cassino ficou numa linha só (no celular, 3 por linha)",
      "Celular: desmutar o microfone na voz volta a mandar o som (antes, às vezes ficava mudo)",
    ],
  },
  {
    data: "03/11/2026",
    itens: [
      "Acentos consertados nos itens da loja, nas missões e nos avisos de erro",
      "Missões do dia pagam bem mais (de 100 a 200 cada) e fazer as 3 dá +250",
      "Tempo no site rende 5 moedas a cada 6 minutos (no happy hour, 5 a cada 3)",
    ],
  },
  {
    data: "03/11/2026",
    itens: ["Bolsa Nanica: com menos de 100 moedas, aparece no K-FOFO o botão para pedir 5.000 moedas, uma vez por dia"],
  },
  {
    data: "03/11/2026",
    itens: ["Voz: toca um som quando alguém entra ou sai do canal em que você está (e quando você entra ou sai)"],
  },
  {
    data: "03/11/2026",
    itens: [
      "Chat do K-FOFO como no Habbo: escreva na barra branca embaixo do cômodo e a mensagem sobe num balão em cima do seu boneco",
      "Os balões aparecem para quem está no mesmo lugar (no K-FOFO ou no mesmo quarto) e a mensagem também fica no #geral",
    ],
  },
  {
    data: "03/11/2026",
    itens: [
      "Emblemas novos, em relevo: aro de metal com luz e sombra, e o símbolo gravado",
      "O número do nível da GC voltou a ser lido no cartão do perfil, e o cartão não deixa mais aparecer o que está atrás",
    ],
  },
  {
    data: "03/11/2026",
    itens: [
      "Troféus viraram o Hall da Fama do LoL e do CS2: quem mais venceu, quem mais perdeu e o melhor KDA da semana em cada jogo",
      "O LoL vem do op.gg e o CS2 do Leetify de cada um; o 1º em vitórias e em KDA ganha +100 moedas",
      "Quem mais perdeu leva o chapéu de burro e o melhor KDA a coroa dourada",
    ],
  },
  {
    data: "03/11/2026",
    itens: ["Pôquer: abrir uma mesa funciona (ela fechava sozinha antes de alguém sentar); mesa vazia por 5 minutos fecha sozinha"],
  },
  {
    data: "03/11/2026",
    itens: [
      "Móveis do K-FOFO e do quarto com sombra no chão, com a luz vindo de cima à esquerda",
      "Os bonecos andam mais macio: aceleram ao sair e freiam ao chegar",
    ],
  },
  {
    data: "03/11/2026",
    itens: [
      "A barra do chat fica dentro do K-FOFO, ao lado do Ir para o meu quarto",
      "Toca uma campainha quando um nanico entra no site",
      "Sem o quadrado escuro em volta do boneco ao passar o mouse (extensões de modo escuro não mexem mais no site)",
    ],
  },
  {
    data: "03/11/2026",
    itens: ["Banca Nanica: tudo que se perde no cassino vai para a banca, e o saldo dela aparece no alto do Cassino"],
  },
  {
    data: "03/11/2026",
    itens: [
      "Blackjack, pôquer e truco no jeito dos cassinos online: barra de cima com o que está acontecendo, o tempo, a carteira e quanto você tem na mesa, e o botão ? com as regras",
      "Blackjack: últimas somas do dealer, círculos de aposta numerados, fichas para montar a aposta (desfazer, repetir, dobrar), botões redondos Pedir, Parar, Dobrar e Dividir e, no celular, a sua mão grande no meio",
      "Pôquer: a jogada de cada um embaixo do lugar (pagou, aumentou, passou), as últimas mãos da mesa, a força da sua mão com a chance de vencer, atalhos de aposta e as jogadas marcadas antes da sua vez",
      "Truco: placar com os tentos na barra de cima, o pedido de truco grande no meio da mesa e os botões TRUCO!, ENVIDO e IR AO MAZO",
      "As cartas saem do baralho voando e viram, as fichas vão e voltam do pote e da banca, e quem ganha acende",
      "A mesa do blackjack no celular ficou menos comprida",
    ],
  },
  {
    data: "03/11/2026",
    itens: [
      "K-FOFO remodelado: o janelão foi para a parede da esquerda, a TV para a da direita e a mesa comprida para perto do Mural",
      "Mural no lugar do antigo janelão: avisos do grupo (hall da fama, banca, eventos) e recados que qualquer nanico prega",
      { t: "A porta de vidro leva à rua (gramado, árvore com bancos, carros e o gol do pênalti x1) e ao corredor dos quartos", off: "os carros saíram da rua e foram para a garagem na v1.152" },
      "Corredor dos quartos: uma porta para cada nanico, aberta para quem já comprou o quarto e fechada para quem não",
      "Lupa no canto do K-FOFO para aumentar e diminuir a cena (arraste para andar pela cena aumentada)",
      "Sentado no quarto e na rua, o boneco afunda no banco como no K-FOFO",
      "Emblemas novos: cada conquista ganhou um desenho próprio, e prata e ouro vêm com louros, fita e brilho",
      "Cassino: Pênalti x1! Abra um duelo valendo quanto quiser (até all-in) e espere alguém aceitar o desafio",
      "No Pênalti x1, quem bate e quem defende escolhem o canto ao mesmo tempo, com 15 segundos por cobrança; empatou, vai para a morte súbita",
      "Quem vence o duelo leva o dobro da aposta, sem taxa da casa",
    ],
  },
  {
    data: "03/11/2026",
    itens: [
      "Cassino mais rápido: as apostas não esperam mais na fila atrás das mesas abertas nos outros aparelhos (quem sai do Cassino para de perguntar ao banco)",
      "Roleta ao vivo: a lista de quem está na rodada voltou ao tamanho certo",
    ],
  },
  {
    data: "03/11/2026",
    itens: [
      "Acabou a borda escura em volta do seu boneco ao passar o mouse",
      "O cartão de quem você toca no K-FOFO mostra o corpo inteiro do nanico e os emblemas em quadradinhos, como no Habbo",
      "Aperte Z no K-FOFO, na rua, no corredor ou num quarto para ver o histórico do chat",
      "A porta do banheiro abre: pixe a parede com o que quiser, e a pixação fica lá para sempre",
      "Pênalti x1: ranking de quem mais venceu, com vitórias, derrotas e o saldo de moedas nos duelos",
      "Pênalti x1: chat dentro do duelo, com reações rápidas ⚽ 🧤 😂 🔥; quem assiste acompanha a conversa",
    ],
  },
  {
    data: "03/11/2026",
    itens: ["Aviãozinho: quem apostou no último voo volta a ter o botão de apostar com a mesa parada (antes ficava preso até outra pessoa abrir um voo)"],
  },
  { data: "03/11/2026", itens: ["O baú do Sítio abre uma prévia dos Campeões Selados"] },
  { data: "03/11/2026", itens: ["A aba K-FOFO Teste foi retirada por enquanto; o K-FOFO continua no menu de Jogos"] },
  {
    data: "03/11/2026",
    itens: ["Ações do boneco: acene, dance ou deite no K-FOFO, na rua e nos quartos pelo botão 👋 da barra do chat (ou escreva o/, :dançar ou :deitar). Andar acaba com a dança"],
  },
  {
    data: "03/11/2026",
    itens: [
      "Chat do K-FOFO como no Habbo: Shift+Enter (ou :g) grita, com o balão grande para todo mundo",
      "Sussurro: escreva :s e o nome do nanico antes da mensagem, e só ele vê (o balão aparece para os dois, e quem recebe ganha um aviso)",
      "Um balãozinho com três pontinhos aparece em cima de quem está escrevendo",
    ],
  },
  {
    data: "03/11/2026",
    itens: ["Seguir amigo: na ficha de quem está no site e no cartão do perfil, o botão Ir até leva você para onde a pessoa está (K-FOFO, rua, corredor ou quarto) e para ao lado dela"],
  },
  { data: "03/11/2026", itens: ["Os Campeões Selados e as chaves restantes são compartilhados entre os Nanicos"] },
  {
    data: "03/11/2026",
    itens: [
      "Móveis que fazem algo no quarto: o Dado gigante rola para todo mundo ver o número, a Luminária liga e desliga, o Regulador de luz pinta o quarto de âmbar, azul, rosa, verde ou roxo, e o Quadro de recados guarda um bilhete para quem visitar",
      "Dado, Regulador e Quadro de recados já estão na Loja; a luminária que você já tem passa a ligar e desligar",
    ],
  },
  {
    data: "03/11/2026",
    itens: [
      "Pênalti e Pênalti x1 ficam numa aba só, a Pênalti: escolha \"Contra o goleiro\" ou \"x1 contra um nanico\"",
      "O goleiro agora é o Gamer, com luvas: balança no gol esperando o chute, pula no canto e segura a bola na luva",
      "A bola virou uma bola de futebol de verdade e faz uma curva no chute",
      "Pênalti x1: quando a partida acaba, a tela volta sozinha para os duelos em 8 segundos",
    ],
  },
  {
    data: "03/11/2026",
    itens: [
      "Troca entre nanicos: no cartão do perfil ou na ficha, toque em Propor troca. Cada um põe itens da mochila e moedas no seu lado e, quando os dois aceitam, a troca acontece de uma vez",
      "Mudar a oferta desfaz os dois aceites; fechar a janela não cancela (a pílula embaixo reabre). Móveis colocados no quarto e o próprio quarto não entram",
    ],
  },
  {
    data: "03/11/2026",
    itens: [
      "Raros na Loja: itens numerados com estoque curto. A Estátua Dourada do Nanico já saiu (só 15 no mundo) e o Globo de Plasma sai no churrasco de sábado, às 20h (só 25)",
      "Cada raro tem o seu número, que aparece na loja (seu nº 3), e o número vai junto numa troca. Esgotou, acabou",
    ],
  },
  {
    data: "03/11/2026",
    itens: [
      "Mercado dos nanicos, na Loja: anuncie um item da mochila pelo preço que quiser e compre o que os outros anunciaram",
      "O item fica guardado no anúncio até alguém comprar ou você retirar; quem vende recebe o preço menos 5%, que vão para a Banca Nanica. Raro vai com o número",
    ],
  },
  {
    data: "03/11/2026",
    itens: [
      "Navegador de quartos: o botão no K-FOFO lista o quarto de todo mundo, com quem está lá agora e as curtidas, e leva você até ele",
      "Curta o quarto dos outros pelo ♡ no topo do quarto; o navegador tem o ranking dos mais curtidos",
    ],
  },
  {
    data: "03/11/2026",
    itens: [
      "Arena de pintar o chão: pela porta do K-FOFO, entre num time (azul ou vermelho) e comece. Em 90 segundos, o chão por onde você anda fica da cor do seu time, e ganha quem pintar mais",
    ],
  },
  {
    data: "03/11/2026",
    itens: [
      "Gatilhos no quarto: no seu quarto, o botão ⚙ Gatilhos monta regras como \"quando alguém entra, aparece um aviso\" ou \"quando alguém pisa no piso 2,3, vai para a porta\". Também dá para tocar a campainha",
    ],
  },
  {
    data: "03/11/2026",
    itens: [
      "Caixa de som na Loja: no seu quarto, escolha a estação (lo-fi, eletrônica ou samba) e quem estiver lá ouve junto. Cada um pode tirar o som só para si",
    ],
  },
  {
    data: "03/11/2026",
    itens: [
      "Grupos: pelo botão no K-FOFO, crie o seu (500 moedas, com nome, cor e símbolo) ou entre no de alguém. O grupo aparece no cartão do perfil",
      "Efeitos para o boneco na Loja: Brilho dourado, Fogo nos pés, Fantasma e Arco-íris. Equipado, aparece no K-FOFO e nos quartos",
    ],
  },
  {
    data: "03/11/2026",
    itens: [
      "Pirapó 114: o apartamento abriu, desenhado das fotos, com o corredor de granito, a cozinha de cadeiras vermelhas, a sala com sacada e o quarto gamer de taco. Entra pela porta do K-FOFO",
      "Para entrar é preciso a Chave da Pirapó 114, um raro de 5.000 moedas na Loja (só 14 no mundo). As chaves da casa do Alemão, da casa do Gordão e da baia da Vó Lia chegam junto com as casas",
    ],
  },
  {
    data: "03/11/2026",
    itens: [
      "Pirapó 114 na planta certa: a porta de entrada no meio do corredor, o quarto com o PC e a cozinha embaixo dele, a sala grande à direita, aberta para o corredor, e a sacada para fora da sala",
    ],
  },
  { data: "03/11/2026", itens: ["Móveis novos em todos os quartos e no K-FOFO: quinas arredondadas, sombra suave e mais capricho (almofadas no sofá, travesseiros e cobertor na cama, livros na estante, portas no guarda-roupa, monitores e teclado no PC)"] },
  { data: "03/11/2026", itens: ["O corredor dos quartos virou corredor de hotel: papel de parede listrado, lambri de madeira, carpete vinho, portas com almofadas e maçaneta dourada e uma arandela acesa ao lado de cada porta"] },
  { data: "03/11/2026", itens: ["Garagem nova ao ar livre, pelo portão da rua: os 14 veículos da turma desenhados das fotos, cada um na sua vaga, com guarita, cancela e postes (toque num carro para ver qual é)"] },
  { data: "03/11/2026", itens: ["No K-FOFO, junto do aviso de quem entrou, agora aparece também quem saiu do site"] },
  {
    data: "03/11/2026",
    itens: [
      "Sons novos: um \"ding\" quando alguém entra no seu canal de voz e um vento quando alguém sai",
      "Clique do Minecraft ao trocar de aba no menu",
      "Som de dinheiro quando você ganha mais de 500 numa jogada do cassino",
      "Pênalti x1: tema de faroeste quando os dois aceitam o duelo",
      "Botão do Pedro na parede do K-FOFO: por 200 moedas, toca \"pedro pedro pedro\" para todo mundo no K-FOFO, com discoteca",
    ],
  },
  { data: "03/11/2026", itens: ["A rua virou uma praça só de grama: a árvore foi para o canto de cima, à esquerda, com os bancos em volta"] },
  {
    data: "03/11/2026",
    itens: [
      "Blackjack ao vivo de verdade: estúdio com luzes, mesa em perspectiva e o Veião de crupiê, que dá as cartas, paga, comemora e fala com a mesa",
      "As cartas do blackjack ficam deitadas no feltro, viradas para cada jogador, e caem do sapato num arco; quem ganha recebe uma chuva de moedas",
      "Roleta ao vivo com o Henry de crupiê: ele chama as apostas, lança a bola e a câmera chega perto da roda em 3D",
      "Em todos os jogos dá para apostar até tudo o que você tem: fichas de 500 e 1.000, valor escrito à mão e o botão TUDO",
      "A ficha de 200 virou laranja, diferente da de 100",
      "O anel e a barra do tempo andam lisos, sem pular de segundo em segundo",
    ],
  },
  {
    data: "04/11/2026",
    itens: [
      "Mesa de truco valendo não fecha mais no meio da partida: quem abriu termina o jogo ou espera 10 minutos com a mesa parada",
      "A Bolsa Nanica agora conta as moedas que estão em jogo nas mesas e nos duelos",
      "No truco, as cartas jogadas ficam na mesa até o fim da mão, para todo mundo ver",
    ],
  },
  {
    data: "04/11/2026",
    itens: [
      "Os bonecos ganharam poses desenhadas: sentar no sofá, acenar, deitar e dançar agora mudam o boneco inteiro, de frente e de costas",
      "Novas ações no K-FOFO: rir, joinha, pular e sentar no chão (também pelo chat: :rir, :joinha, :pular e :sentar)",
    ],
  },
  {
    data: "04/11/2026",
    itens: [
      "Blackjack com mais calma: as cartas saem uma de cada vez, o dealer tira as dele devagar e o resultado só aparece depois",
      "No fim da rodada o Veião recolhe as cartas mão por mão, junta num montinho, vira de costas e põe no descarte",
      "O Veião e o Henry se mexem com quadros desenhados, como num desenho animado: dar carta, pagar, recolher, chamar as apostas e lançar a bolinha",
    ],
  },
  {
    data: "04/11/2026",
    itens: [
      "Botão \"Parar de assistir\" na tela que você está vendo, como no Discord",
      "Clique direito (ou segure o dedo no celular) em alguém no canal de voz ou nos membros: volume da voz, silenciar, a transmissão e a ficha",
      "O volume de cada pessoa vai até 200%, e o volume de cada transmissão fica guardado por pessoa",
      "No canal de voz aparece o volume que você mudou e quem você silenciou (só você vê)",
    ],
  },
  {
    data: "04/11/2026",
    itens: [
      "Visual novo da call, como no Discord: ocupa a tela toda, fundo escuro e os quadrados crescem até preencher",
      "Borda verde em quem está falando, nos quadrados e nas listas",
      "Barra de botões flutuando embaixo (some com o mouse parado): microfone, fone, câmera e tela com a setinha de opções",
      "Botão ⋯ com mais opções: esconder quem está sem câmera, esconder os nomes, ruído, câmeras numa janela e tela cheia",
      "Passe o mouse no olhinho da sua live para ver quem está assistindo",
      "No menu de alguém: ver em destaque, ver a ficha e desligar o vídeo dele só para você",
    ],
  },
  {
    data: "04/11/2026",
    itens: [
      "InstaNanico: o story não fica mais cortado no celular (aparece inteiro, igual ao editor)",
      "Consertos: Explorar e notificações não quebram depois de abrir um perfil, o perfil mostra todas as publicações, a curtida acende na hora e o story apagado não volta",
      "Publicações: até 10 fotos (carrossel), filtros e ajustes, marcar pessoas, convidar colaborador, editar a legenda, salvar, fixar até 3, arquivar, esconder curtidas e desativar comentários",
      "Comentários: responder, curtir e fixar um comentário; @menções viram link e o nome é sugerido enquanto você digita",
      "Stories: enquete, perguntas, contagem, quiz, barrinha de emoji, \"Adicione o seu\", melhores amigos, destaques no perfil e repostar o story em que te mencionaram",
      "Câmera dentro do app com boomerang, rascunhos, visualizações das suas publicações e silenciar alguém",
      "Direct: foto, áudio, foto de ver uma vez, responder e reagir a uma mensagem, apagar a que você mandou, digitando…, Ativo agora, notas e grupos",
      "Perfil com bio e links, notificações completas com a hora certa, busca de publicações, pesquisas recentes e tema claro",
    ],
  },
  {
    data: "04/11/2026",
    itens: [
      "Chat como o do Discord: responder, reagir com emoji, editar e apagar a sua mensagem, fixar, buscar e copiar (passe o mouse na mensagem ou segure o dedo)",
      "Mensagens agrupadas com o rosto grande, separador de dia, a linha \"Novas mensagens\" e o botão para pular para as mais novas",
      "@menções com sugestão enquanto digita (e @todos): quem é mencionado vê a mensagem em amarelo e uma bolinha vermelha no canal",
      "Mande foto ou GIF no chat (também colando), e vídeos do YouTube, da Twitch e do Medal tocam ali mesmo",
      "Formatação: **negrito**, *itálico*, ~~riscado~~, ||spoiler||, `código` e > citação; Enter manda e Shift+Enter pula linha; seta para cima edita a sua última",
      "Quem está digitando aparece embaixo do chat; as mensagens antigas carregam ao rolar para cima e o chat guarda um ano de conversa",
      "Canais: clique direito para marcar como lido ou silenciar o canal",
      "Status como no Discord: Online, Ausente (sozinho depois de 10 min parado), Não perturbe e Invisível, com recado e hora para sumir; toque no seu rosto embaixo do menu",
      "Cartão de perfil ao tocar no nome ou no rosto de alguém: status, recado, o que está jogando no LoL, onde está, cargos e mandar mensagem",
      "Cargos com cor: os moderadores aparecem com o nome dourado; e a lista de membros mostra o recado e o \"Jogando LoL\"",
      "Som da live na saída de som escolhida, volume até 200% e dá para ouvir duas transmissões juntas",
      "Mudar a qualidade da sua transmissão sem cair, qualidade que se adapta à internet e as informações da transmissão (resolução, quadros, atraso)",
      "Voz: reconecta sozinha, lembra se você estava mudo, sons ao mutar e desmutar, e atalhos Ctrl+Shift+M (microfone) e Ctrl+Shift+D (som)",
      "Modo de entrada: detecção de voz com sensibilidade ou apertar para falar com a tecla que quiser; avisa se você fala mudo ou se o microfone está sem som",
      "Aviso quando alguém entra ao vivo no seu canal, o tempo de call e de live, e a tela continua num quadrinho no canto ao sair do Ao vivo",
      "Soundboard na voz, a câmera de quem transmite numa bolinha em cima da tela e desfocar o fundo da câmera (onde o aparelho deixa)",
      "Moderadores podem silenciar alguém na voz para todos, tirar da call e apagar mensagens do chat",
    ],
  },
  {
    data: "04/11/2026",
    itens: [
      "Call como no Discord: clicar em alguém do canal de voz abre o perfil com o volume dele; o clique direito abre o menu com volume, silenciar e perfil",
      "No seu próprio nome (no canal e no seu quadrado da call): ligar e desligar o microfone, parar de ouvir e as configurações de voz",
      "Moderadores também silenciam e tiram da call pelo menu do quadrado; a soundboard ganhou um botão na barra de baixo da call",
      "Clique direito numa pessoa igual ao do Discord: Perfil, Mencionar (já escreve o @ no chat), Mensagem, Chamar para a call, Adicionar nota (só você vê), Volume do usuário, Silenciar, Silenciar efeitos sonoros, Desativar vídeo, Ignorar, Bloquear, Cargos e Copiar nome de usuário",
      "No seu próprio nome: Mudar o status, Editar perfil, Silenciar, Ensurdecer, Configurações de voz e Sair da voz",
      "Ignorar e Bloquear escondem as mensagens da pessoa no seu chat (com \"Mostrar\"); bloquear também silencia a voz dela para você",
      "Moderadores: Mover para outro canal, Silenciar voz e Desativar áudio no servidor, Desconectar e Castigo (sem chat e sem voz de 1 minuto a 1 dia)",
    ],
  },
];

export const versionAt = (i: number) => "v1." + String(i).padStart(2, "0");
export const VERSION = versionAt(CHANGELOG.length - 1);
