/*
 * Cenas especiais (03/11/2026, desenho do João): a rua, do lado de fora do K-FOFO (gramado, árvore com bancos, 5 carros
 * estacionados e a marca do pênalti x1), e o corredor dos quartos (uma porta para cada nanico: aberta para quem já
 * comprou o quarto, fechada para quem não). As duas são como um quarto: a mesma grade, os mesmos bonecos e a mesma
 * presença (`quarto` = "rua" ou "corredor"). Regra pura e testada.
 */
import type { Friend } from "@/lib/tipos";
import { gradeDoQuarto, type Grade, type MovelGrade } from "./grade";

export const CENAS = ["rua", "corredor", "banheiro", "arena", "pirapo", "garagem"] as const;
export type CenaEspecial = (typeof CENAS)[number];
export const ehCenaEspecial = (x: unknown): x is CenaEspecial => CENAS.includes(x as CenaEspecial);

/* a arena (seção 58): chão vazio de 10×10 para o jogo de pintar o chão */
export const TAM_CENA: Record<CenaEspecial, number> = { rua: 12, corredor: 9, banheiro: 5, arena: 10, pirapo: 16, garagem: 14 };
export const NOME_CENA: Record<CenaEspecial, string> = { rua: "A rua", corredor: "Corredor dos quartos", banheiro: "Banheiro do K-FOFO", arena: "Arena de pintar o chão", pirapo: "Pirapó 114", garagem: "Garagem" };

/** O banheiro (a porta do canto do K-FOFO): o vaso (dá para sentar) e a pia; as paredes são das pixações (seção 51). */
export const MOVEIS_BANHEIRO: readonly MovelGrade[] = [
  { id: -20, desenho: "vaso", ret: { i: 4, j: 1, w: 1, d: 1 }, giro: true },
  { id: -21, desenho: "pia", ret: { i: 1, j: 4, w: 1, d: 1 }, giro: false },
];

/** A rua: a árvore no meio com 3 bancos, o gol do pênalti x1 e o portão da garagem (os carros moram lá agora). */
export const MOVEIS_RUA: readonly MovelGrade[] = [
  { id: -1, desenho: "arvore", ret: { i: 5, j: 5, w: 2, d: 2 }, giro: false },
  { id: -2, desenho: "banco-praca", ret: { i: 5, j: 3, w: 2, d: 1 }, giro: false },
  { id: -3, desenho: "banco-praca", ret: { i: 3, j: 5, w: 1, d: 2 }, giro: true },
  { id: -4, desenho: "banco-praca", ret: { i: 5, j: 8, w: 2, d: 1 }, giro: false },
  { id: -10, desenho: "gol", ret: { i: 11, j: 2, w: 1, d: 3 }, giro: true },
  { id: -11, desenho: "portao-garagem", ret: { i: 11, j: 9, w: 1, d: 2 }, giro: true },
];
/** o gol do pênalti x1 (tocar nele abre o duelo) e a marca do pênalti no gramado */
export const GOL_RUA = -10;
/** o portão da garagem na rua: tocar nele leva para a garagem */
export const PORTAO_GARAGEM = -11;

/**
 * Os veículos da garagem (03/11/2026, desenhados das fotos que o João mandou): cada desenho "veiculo-<id>" é a imagem
 * public/arte/carros/<id>.svg, na mesma projeção das cenas; L e W são o comprimento e a largura em pisos (para
 * centralizar na vaga) e o nome aparece ao tocar.
 */
export const VEICULOS: Readonly<Record<string, { nome: string; L: number; W: number }>> = {
  x3: { nome: "BMW X3 M", L: 2.682, W: 1.08 },
  fastback: { nome: "Fiat Fastback", L: 2.517, W: 1.017 },
  hrv: { nome: "Honda HR-V", L: 2.46, W: 1.017 },
  renegade: { nome: "Jeep Renegade", L: 2.415, W: 1.023 },
  fit: { nome: "Honda Fit", L: 2.216, W: 0.966 },
  fiesta: { nome: "Ford Fiesta", L: 2.244, W: 0.955 },
  onixAzul: { nome: "Chevrolet Onix azul", L: 2.233, W: 0.972 },
  pulse: { nome: "Fiat Pulse", L: 2.33, W: 1.006 },
  stonic: { nome: "Kia Stonic", L: 2.352, W: 1 },
  hb20: { nome: "Hyundai HB20", L: 2.284, W: 0.977 },
  onix: { nome: "Chevrolet Onix branco", L: 2.233, W: 0.972 },
  crosser: { nome: "Yamaha Crosser 150", L: 1.3, W: 0.4 },
  patineteLaranja: { nome: "Patinete laranja", L: 0.6, W: 0.3 },
  patineteAzul: { nome: "Patinete Soflow", L: 0.7, W: 0.3 },
};
export const veiculoDo = (desenho: string) => (desenho.startsWith("veiculo-") ? desenho.slice(8) : null);

/**
 * A garagem ao ar livre (a que o João aprovou), 14×14, com a entrada pela rua no canto do fundo (piso 11, 0), ao
 * lado da guarita e da cancela: a faixa de grama com os postes, duas fileiras de 4 vagas, 3 vagas no meio e as
 * duas rodas no canto da frente.
 */
export const MOVEIS_GARAGEM: readonly MovelGrade[] = [
  { id: -201, desenho: "guarita", ret: { i: 13, j: 0, w: 1, d: 1 }, giro: false },
  { id: -202, desenho: "cancela", ret: { i: 12, j: 1, w: 1, d: 1 }, giro: false },
  { id: -203, desenho: "poste", ret: { i: 2, j: 0, w: 1, d: 1 }, giro: false },
  { id: -204, desenho: "poste", ret: { i: 7, j: 0, w: 1, d: 1 }, giro: false },
  ...["x3", "fastback", "hrv", "renegade"].map((v, n) => ({ id: -210 - n, desenho: "veiculo-" + v, ret: { i: 1 + n * 3, j: 3, w: 3, d: 1 }, giro: false })),
  ...["fit", "fiesta", "onixAzul"].map((v, n) => ({ id: -220 - n, desenho: "veiculo-" + v, ret: { i: 1 + n * 4, j: 6, w: 3, d: 1 }, giro: false })),
  ...["pulse", "stonic", "hb20", "onix"].map((v, n) => ({ id: -230 - n, desenho: "veiculo-" + v, ret: { i: 1 + n * 3, j: 9, w: 3, d: 1 }, giro: false })),
  { id: -240, desenho: "veiculo-crosser", ret: { i: 10, j: 12, w: 2, d: 1 }, giro: false },
  { id: -241, desenho: "veiculo-patineteLaranja", ret: { i: 12, j: 12, w: 1, d: 1 }, giro: false },
  { id: -242, desenho: "veiculo-patineteAzul", ret: { i: 12, j: 13, w: 1, d: 1 }, giro: false },
];
export const MARCA_PENALTI = { i: 8.5, j: 3.5 };

/**
 * A Pirapó 114 (03/11/2026, das fotos e da planta desenhada pelo João; só entra quem tem a chave rara), 16×16:
 * no fundo, à esquerda, o corredor (i 0–7, j 0–2) com a porta de entrada no meio (piso 5, 0) e a faixa de granito;
 * embaixo dele, o quarto com o PC (i 0–2) e a cozinha com a mesa e a geladeira (i 4–7), cada um com a sua porta;
 * à direita, de ponta a ponta, a sala grande e vazia (i 9–13), aberta para o corredor; e, para fora da sala, a sacada
 * (i 14–15, j 4–7). As meias-paredes (como no Habbo) separam os cômodos; "fora" é o lado de fora do prédio.
 */
export const MOVEIS_PIRAPO: readonly MovelGrade[] = [
  /* a parede de baixo do corredor, com a porta do quarto (i = 1) e a da cozinha (i = 5 e 6) */
  { id: -101, desenho: "meia-parede", ret: { i: 0, j: 3, w: 1, d: 1 }, giro: false },
  { id: -102, desenho: "meia-parede", ret: { i: 2, j: 3, w: 3, d: 1 }, giro: false },
  { id: -103, desenho: "meia-parede", ret: { i: 7, j: 3, w: 1, d: 1 }, giro: false },
  /* quarto | cozinha, e cozinha | sala (com o pedaço de cima do corredor, que deixa a passagem para a sala) */
  { id: -104, desenho: "meia-parede", ret: { i: 3, j: 4, w: 1, d: 12 }, giro: false },
  { id: -105, desenho: "meia-parede-sanca", ret: { i: 8, j: 3, w: 1, d: 13 }, giro: false },
  { id: -106, desenho: "meia-parede-sanca", ret: { i: 8, j: 0, w: 1, d: 1 }, giro: false },
  /* a parede da direita da sala, aberta só para a sacada (j 4–7), e o lado de fora do prédio */
  { id: -107, desenho: "meia-parede-sanca", ret: { i: 14, j: 0, w: 1, d: 4 }, giro: false },
  { id: -108, desenho: "meia-parede-sanca", ret: { i: 14, j: 8, w: 1, d: 8 }, giro: false },
  { id: -109, desenho: "fora", ret: { i: 15, j: 0, w: 1, d: 4 }, giro: false },
  { id: -110, desenho: "fora", ret: { i: 15, j: 8, w: 1, d: 8 }, giro: false },
  /* corredor: a estante branca no fim, perto da passagem para a sala */
  { id: -111, desenho: "estante-branca", ret: { i: 7, j: 0, w: 1, d: 1 }, giro: false },
  /* quarto com o PC */
  { id: -120, desenho: "rack-tv", ret: { i: 0, j: 4, w: 1, d: 3 }, giro: true },
  { id: -121, desenho: "guitarra", ret: { i: 2, j: 11, w: 1, d: 1 }, giro: false },
  { id: -122, desenho: "gaveteiro", ret: { i: 2, j: 6, w: 1, d: 1 }, giro: false },
  { id: -123, desenho: "cama-baixa", ret: { i: 1, j: 8, w: 2, d: 2 }, giro: false },
  { id: -124, desenho: "cadeira-gamer-vermelha", ret: { i: 0, j: 12, w: 1, d: 1 }, giro: false },
  { id: -125, desenho: "pc", ret: { i: 0, j: 13, w: 1, d: 2 }, giro: true },
  { id: -126, desenho: "guarda-roupa-creme", ret: { i: 1, j: 15, w: 2, d: 1 }, giro: false },
  /* cozinha: a mesa branca com as 4 cadeiras vermelhas, a bancada de granito, a geladeira e o armário alto */
  { id: -130, desenho: "mesa-branca", ret: { i: 4, j: 8, w: 2, d: 1 }, giro: false },
  { id: -131, desenho: "cadeira-vermelha", ret: { i: 4, j: 7, w: 1, d: 1 }, giro: false },
  { id: -132, desenho: "cadeira-vermelha", ret: { i: 5, j: 7, w: 1, d: 1 }, giro: false },
  { id: -133, desenho: "cadeira-vermelha", ret: { i: 4, j: 9, w: 1, d: 1 }, giro: false },
  { id: -134, desenho: "cadeira-vermelha", ret: { i: 5, j: 9, w: 1, d: 1 }, giro: false },
  { id: -135, desenho: "balcao", ret: { i: 4, j: 15, w: 2, d: 1 }, giro: false },
  { id: -136, desenho: "geladeira", ret: { i: 7, j: 14, w: 1, d: 1 }, giro: false },
  { id: -137, desenho: "armario-alto", ret: { i: 7, j: 15, w: 1, d: 1 }, giro: false },
];
/** onde fica a porta de cada cena especial (as outras entram pelo piso 0, 0) */
const PORTA_DA_CENA: Partial<Record<CenaEspecial, { i: number; j: number }>> = { pirapo: { i: 5, j: 0 }, garagem: { i: 11, j: 0 } };
/** O piso da porta de uma cena (dono de quarto ou cena especial): por onde se entra e por onde se sai. */
export const portaDaCena = (c: string | null | undefined): { i: number; j: number } => (ehCenaEspecial(c) && PORTA_DA_CENA[c]) || { i: 0, j: 0 };

export const moveisDaCena = (c: CenaEspecial): readonly MovelGrade[] =>
  c === "rua" ? MOVEIS_RUA : c === "banheiro" ? MOVEIS_BANHEIRO : c === "pirapo" ? MOVEIS_PIRAPO : c === "garagem" ? MOVEIS_GARAGEM : [];

/* ---------- pixações do banheiro (seção 51): onde cada uma fica na parede ---------- */
export const CORES_PIXO = ["preto", "vermelho", "azul", "verde", "rosa", "amarelo"] as const;
export type CorPixo = (typeof CORES_PIXO)[number];
export type LugarPixo = { parede: "esq" | "dir"; a: number; z: number; rot: number };
/** Um lugar sorteado numa das duas paredes do banheiro (longe da porta do piso 0, 0 na parede da direita). */
export function lugarDePixo(r: () => number = Math.random): LugarPixo {
  const parede = r() < 0.5 ? "esq" : "dir";
  const ini = parede === "dir" ? 1.3 : 0.3;
  return { parede, a: Math.round((ini + r() * (4.7 - ini)) * 100) / 100, z: 18 + Math.floor(r() * 116), rot: Math.round(r() * 20 - 10) };
}

const grades = new Map<CenaEspecial, Grade>();
/** A grade de andar de uma cena especial (sempre a mesma). */
export function gradeEspecial(c: CenaEspecial): Grade {
  let g = grades.get(c);
  if (!g) grades.set(c, (g = gradeDoQuarto(TAM_CENA[c], moveisDaCena(c))));
  return g;
}

export type PortaCorredor = { fid: string; nome: string; aberta: boolean; parede: "esq" | "dir"; a: number; b: number };

/**
 * As portas do corredor, uma por nanico (em ordem alfabética): metade na parede da esquerda e o resto na da direita,
 * depois da saída para o K-FOFO (que fica no piso 0, 0). `aberta` = o nanico tem quarto.
 */
export function portasDoCorredor(nanicos: readonly Pick<Friend, "id" | "name" | "user_id">[], temQuarto: (uid: string) => boolean): PortaCorredor[] {
  const n = TAM_CENA.corredor;
  const lista = [...nanicos].sort((x, y) => x.name.localeCompare(y.name, "pt-BR"));
  const naEsq = Math.ceil(lista.length / 2);
  return lista.map((f, k) => {
    const esq = k < naEsq;
    const qtd = esq ? naEsq : lista.length - naEsq;
    const pos = esq ? k : k - naEsq;
    /* esquerda: de 0,3 a n − 0,3; direita: depois da saída (1,1 em diante) */
    const ini = esq ? 0.3 : 1.15;
    const passo = (n - 0.3 - ini) / Math.max(1, qtd);
    const a = ini + pos * passo + passo * 0.12;
    return { fid: f.id, nome: f.name, aberta: !!f.user_id && temQuarto(f.user_id), parede: esq ? "esq" : "dir", a, b: a + passo * 0.76 };
  });
}
