/*
 * Eventos com horário (puro e testado): happy hour, todo dia das 22h à meia-noite, e churrasco de sábado,
 * das 18h às 23h. A hora é sempre a de Brasília (Intl), não a do aparelho de quem usa. Serve só para
 * MOSTRAR: quem paga em dobro e quem libera o espetinho é o banco (agora_br, pulso e churrasco_pegar).
 */
export type Evento = "happy" | "churrasco";

export const HAPPY_INI = 22;
export const CHURRASCO_INI = 18;
export const CHURRASCO_FIM = 23;
/** no happy hour: 1 moeda a cada 3 minutos (sem teto por dia desde 02/11/2026) */
export const MIN_POR_MOEDA_HAPPY = 3;

const FMT = new Intl.DateTimeFormat("en-US", {
  timeZone: "America/Sao_Paulo",
  hourCycle: "h23",
  weekday: "short",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
});
const DIAS: Record<string, number> = { Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6, Sun: 7 };

/** Data e hora de Brasília: dia da semana (1 = segunda, 6 = sábado), hora, minuto, segundo e o dia "AAAA-MM-DD". */
export function horaBr(d: Date) {
  const p: Record<string, string> = {};
  for (const x of FMT.formatToParts(d)) p[x.type] = x.value;
  return { dow: DIAS[p.weekday] ?? 0, h: Number(p.hour), m: Number(p.minute), s: Number(p.second), dia: `${p.year}-${p.month}-${p.day}` };
}

/** Evento de agora. No sábado das 22h às 23h vale o churrasco (o happy hour paga junto: veja `happyAgora`). */
export function eventoAgora(d: Date): Evento | null {
  const b = horaBr(d);
  if (b.dow === 6 && b.h >= CHURRASCO_INI && b.h < CHURRASCO_FIM) return "churrasco";
  if (b.h >= HAPPY_INI) return "happy";
  return null;
}

/** O tempo online está pagando em dobro agora (todo dia das 22h à meia-noite, sábado também). */
export const happyAgora = (d: Date) => horaBr(d).h >= HAPPY_INI;

/** Quando o evento de agora termina (null fora de evento). */
export function fimDoEvento(d: Date): Date | null {
  const ev = eventoAgora(d);
  if (!ev) return null;
  const b = horaBr(d);
  const fimH = ev === "churrasco" ? CHURRASCO_FIM : 24;
  const faltaS = (fimH - b.h) * 3600 - b.m * 60 - b.s;
  return new Date(Math.floor(d.getTime() / 1000) * 1000 + faltaS * 1000);
}

/** Quanto falta, curto: "1h 05min", "12min", "45s". */
export function textoFalta(ms: number) {
  const s = Math.max(0, Math.ceil(ms / 1000));
  if (s < 60) return `${s}s`;
  const min = Math.ceil(s / 60);
  if (min < 60) return `${min}min`;
  return `${Math.floor(min / 60)}h ${String(min % 60).padStart(2, "0")}min`;
}
