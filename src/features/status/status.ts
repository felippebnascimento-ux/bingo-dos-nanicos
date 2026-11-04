/*
 * Status como no Discord (seção 70): Online, Ausente, Não perturbe e Invisível, com um recado ("jogando ranked 🎮")
 * que pode sumir sozinho. Fica no banco (status_nanico) e o modo também no aparelho (`status-modo`, para a presença
 * já sair certa). Ausente também vem sozinho depois de 10 minutos parado (`ausente` no store, vai na presença).
 * Invisível: a presença avisa (`inv`) e as listas mostram a pessoa como offline (na voz ela continua aparecendo).
 * Os cargos: Moderador (tabela moderadores, que todo membro passa a ler), Nanico ou Amigo (friends.tipo).
 */
import { create } from "zustand";
import { aoMudarTabela, trackMe } from "@/lib/sala";
import { getApp, setApp } from "@/lib/store";
import { sb } from "@/lib/supabase";
import type { Friend, Presence } from "@/lib/tipos";
import { toast } from "@/lib/toast";
import { local } from "@/lib/util";

export type Modo = "on" | "aus" | "np" | "inv";
export type Status = { modo: Modo; texto: string; emoji: string; ate: number | null };
export const MODOS: { id: Modo; nome: string; dica: string }[] = [
  { id: "on", nome: "Online", dica: "" },
  { id: "aus", nome: "Ausente", dica: "" },
  { id: "np", nome: "Não perturbe", dica: "Os avisos e sons de mensagem ficam quietos." },
  { id: "inv", nome: "Invisível", dica: "Você aparece offline para os outros, mas continua usando tudo." },
];
const SEM: Status = { modo: "on", texto: "", emoji: "", ate: null };
const modoSalvo = (): Modo => {
  const v = local.get("status-modo");
  return v === "aus" || v === "np" || v === "inv" ? v : "on";
};

export const useStatus = create<{ porUser: Record<string, Status>; mods: string[]; meu: Status }>()(() => ({
  porUser: {},
  mods: [],
  meu: { ...SEM, modo: modoSalvo() },
}));

const lerLinha = (r: Record<string, unknown>): Status => ({
  modo: r.modo === "aus" || r.modo === "np" || r.modo === "inv" ? r.modo : "on",
  texto: String(r.texto ?? "").slice(0, 60),
  emoji: String(r.emoji ?? "").slice(0, 8),
  ate: r.ate ? Date.parse(String(r.ate)) || null : null,
});

/** O recado ainda vale? (o "limpar depois de" do Discord) */
export const recadoValido = (s: Status | undefined, agora = Date.now()) => !!s && (!!s.texto || !!s.emoji) && (!s.ate || s.ate > agora);

async function carregar() {
  const [st, mods] = await Promise.all([sb().from("status_nanico").select("user_id,modo,texto,emoji,ate"), sb().from("moderadores").select("friend_id")]);
  if (!st.error) {
    const porUser = Object.fromEntries((st.data ?? []).map((r) => [String(r.user_id), lerLinha(r as Record<string, unknown>)]));
    const eu = getApp().myUid;
    useStatus.setState({ porUser, ...(eu && porUser[eu] ? { meu: porUser[eu] } : {}) });
    if (eu && porUser[eu]) local.set("status-modo", porUser[eu].modo);
  }
  if (!mods.error) useStatus.setState({ mods: (mods.data ?? []).map((r) => String(r.friend_id)) });
}

/** Muda o meu status (modo e/ou recado). */
export async function mudarStatus(p: Partial<Status>) {
  const eu = getApp().myUid;
  const meu = { ...useStatus.getState().meu, ...p };
  useStatus.setState({ meu, porUser: eu ? { ...useStatus.getState().porUser, [eu]: meu } : useStatus.getState().porUser });
  local.set("status-modo", meu.modo);
  trackMe();
  if (!eu) return;
  const { error } = await sb()
    .from("status_nanico")
    .upsert({ user_id: eu, modo: meu.modo, texto: meu.texto.trim().slice(0, 60), emoji: meu.emoji.slice(0, 8), ate: meu.ate ? new Date(meu.ate).toISOString() : null });
  if (error) {
    /* sem o SQL da seção 70: o modo continua valendo pela presença, só o recado não fica salvo */
    if (/status_nanico|does not exist|42P01/.test(`${error.code} ${error.message}`)) return;
    toast(error.message.startsWith("Calma") ? error.message : "Não deu para salvar o status.");
  }
}

/**
 * Como a pessoa aparece agora: "off" (fora do site ou invisível), "np", "aus" (escolheu ou está parada) ou "on".
 * `p` é a presença dela (null = fora do site).
 */
export function situacao(userId: string | null | undefined, p: Pick<Presence, "aus" | "inv"> | null, eu = false): "off" | "on" | "aus" | "np" {
  if (!p) return "off";
  const s = userId ? useStatus.getState().porUser[userId] : undefined;
  const modo = eu ? useStatus.getState().meu.modo : (s?.modo ?? "on");
  if (p.inv || modo === "inv") return eu ? "off" : "off";
  if (modo === "np") return "np";
  if (modo === "aus" || p.aus) return "aus";
  return "on";
}
export const NOME_SITUACAO = { on: "Online", aus: "Ausente", np: "Não perturbe", off: "Offline" } as const;

/** Os cargos de um nanico (Moderador e Nanico ou Amigo), com a classe da cor. */
export function cargosDe(f: Friend | null | undefined, mods = useStatus.getState().mods): { nome: string; cls: string }[] {
  if (!f) return [];
  const out: { nome: string; cls: string }[] = [];
  if (mods.includes(f.id)) out.push({ nome: "Moderador", cls: "mod" });
  out.push(f.tipo === "amigo" ? { nome: "Amigo dos nanicos", cls: "amigo" } : { nome: "Nanico", cls: "nanico" });
  return out;
}
/** A classe da cor do nome (moderador em destaque, amigo mais apagado). */
export const corDoNome = (f: Friend | null | undefined, mods: string[]) => (!f ? "" : mods.includes(f.id) ? "nome-mod" : f.tipo === "amigo" ? "nome-amigo" : "");

/* ---------- ausente sozinho: 10 minutos sem mexer ---------- */
const PARADO_MS = 10 * 60_000;
let ultimoMovimento = Date.now();
function mexeu() {
  ultimoMovimento = Date.now();
  if (getApp().ausente) setApp({ ausente: false });
}

let ligado = false;
export function iniciarStatus() {
  void carregar();
  if (ligado) return;
  ligado = true;
  aoMudarTabela("status_nanico", () => void carregar());
  for (const ev of ["pointerdown", "keydown", "wheel", "touchstart"] as const) addEventListener(ev, mexeu, { passive: true });
  addEventListener("pointermove", () => {
    if (Date.now() - ultimoMovimento > 20_000) mexeu();
  }, { passive: true });
  setInterval(() => {
    /* na voz falando ninguém fica ausente (a voz conta como estar ali) */
    const parado = Date.now() - ultimoMovimento > PARADO_MS && !getApp().myVozSid;
    if (parado !== getApp().ausente) setApp({ ausente: parado });
    /* o recado que venceu some */
    const meu = useStatus.getState().meu;
    if (meu.ate && meu.ate < Date.now() && (meu.texto || meu.emoji)) void mudarStatus({ texto: "", emoji: "", ate: null });
  }, 30_000);
}
