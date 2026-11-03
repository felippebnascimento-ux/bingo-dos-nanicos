/*
 * Mapeamento do hall para assets do Habbo: classnames dos móveis e figures dos avatares.
 * A imaging API é pública e não precisa de token: /imaging/furniture/{classname}.png e /imaging/avatar.png?figure=...
 */

const IMG = "https://www.habboassets.com/imaging";

/** Gera a URL de um móvel do Habbo. `direction` é a face isométrica (0, 2, 4, 6). */
export function urlMovel(classname: string, direction = 2) {
  return `${IMG}/furniture/${classname}.png?direction=${direction}`;
}

/** Gera a URL de um avatar do Habbo. `direction` 0–7, `size` s/m/l. */
export function urlAvatar(figure: string, direction = 4, action = "std", size = "l") {
  return `${IMG}/avatar.png?figure=${encodeURIComponent(figure)}&direction=${direction}&head_direction=${direction}&action=${action}&size=${size}`;
}

/* ---------- móveis do hall → classnames do Habbo ---------- */
export type HabboMovel = { classname: string; direction: number; escala?: number; dy?: number };

export const HABBO_MOVEIS: Record<string, HabboMovel> = {
  "churrasqueira": { classname: "val09_fireplace", direction: 2, escala: 1.4 },
  "cozinha": { classname: "kitchen_c15_counter", direction: 4, escala: 1.2 },
  "geladeira": { classname: "kitchen_c15_fridge", direction: 4, escala: 1.1 },
  "mesa-comprida": { classname: "lodge_dinertable", direction: 2, escala: 1.8 },
  "mesa-jogos": { classname: "rare_dnc_table", direction: 2, escala: 1.3 },
  "mesa-lado": { classname: "plasto_table", direction: 2, escala: 1.2 },
  "sofa-parede": { classname: "club_sofa", direction: 6, escala: 1.6, dy: -10 },
  "sofa-canto": { classname: "club_sofa", direction: 4, escala: 1.6, dy: -10 },
  "poltrona-1": { classname: "throne", direction: 2, escala: 1.0 },
  "poltrona-2": { classname: "throne", direction: 2, escala: 1.0 },
  "banco-truco-0": { classname: "chair_basic", direction: 0 },
  "banco-truco-1": { classname: "chair_basic", direction: 2 },
  "banco-truco-2": { classname: "chair_basic", direction: 4 },
  "banco-truco-3": { classname: "chair_basic", direction: 6 },
};

/* ---------- figures dos nanicos (cada um com um visual diferente) ---------- */
export const FIGURAS: Record<string, string> = {
  "Abreutz": "hr-115-42.hd-195-19.ch-3030-82.lg-275-1408.sh-305-64",
  "Alemão": "hr-831-37.hd-180-2.ch-210-66.lg-270-82.sh-305-1408",
  "DD": "hr-802-40.hd-190-10.ch-215-82.lg-280-110.sh-290-62",
  "Gamer": "hr-828-45.hd-185-14.ch-220-1408.lg-285-64.sh-295-110",
  "Grito": "hr-170-37.hd-180-19.ch-3030-110.lg-270-64.sh-300-82",
  "Guiperino": "hr-826-42.hd-195-2.ch-210-1408.lg-275-82.sh-305-110",
  "Le Bubu": "hr-115-40.hd-190-14.ch-215-64.lg-280-1408.sh-290-82",
  "Henry": "hr-831-45.hd-185-10.ch-220-82.lg-285-110.sh-295-64",
  "Pitoco": "hr-802-37.hd-180-19.ch-3030-1408.lg-270-82.sh-300-110",
  "John": "hr-828-42.hd-195-2.ch-210-110.lg-275-64.sh-305-82",
  "Veião": "hr-170-40.hd-190-14.ch-215-82.lg-280-64.sh-290-1408",
  "Max": "hr-826-45.hd-185-10.ch-220-64.lg-285-82.sh-295-1408",
  "Gordão": "hr-115-37.hd-180-19.ch-3030-64.lg-270-1408.sh-300-82",
  "Pin": "hr-831-42.hd-195-14.ch-210-82.lg-275-110.sh-305-1408",
};

/** Figure do Habbo de um nanico, ou um genérico. */
export function figureDe(nome: string) {
  return FIGURAS[nome] ?? "hr-115-42.hd-195-19.ch-3030-82.lg-275-1408.sh-305-64";
}

/** Sentido do boneco → direction do Habbo (0–7). */
export function habboDir(sentido: string): number {
  switch (sentido) {
    case "frente-direita": return 3;
    case "frente-esquerda": return 5;
    case "costas-direita": return 1;
    case "costas-esquerda": return 7;
    default: return 4;
  }
}
