/*
 * Nota sobre uma pessoa, como no Discord: um texto que só eu vejo (no cartão de perfil e no menu do clique direito).
 * Aqui ficam também quem eu ignorei e quem eu bloqueei (as mensagens deles somem do meu chat; bloquear também
 * silencia a voz e a soundboard, só para mim), guardados do mesmo jeito.
 * Fica na minha conta (user_metadata.notas, pelo auth.updateUser, como o "já vi" do Log), então vale em todo aparelho;
 * o navegador guarda uma cópia (`notas`). Não precisa de SQL.
 */
import { create } from "zustand";
import { sb } from "@/lib/supabase";
import { local } from "@/lib/util";

export const NOTA_MAX = 200;
const MAX_NOTAS = 40;

/** Confere o que veio da conta ou do navegador: friend id → texto curto. */
export function lerNotas(v: unknown): Record<string, string> {
  if (!v || typeof v !== "object" || Array.isArray(v)) return {};
  const out: Record<string, string> = {};
  for (const [k, t] of Object.entries(v as Record<string, unknown>)) {
    if (Object.keys(out).length >= MAX_NOTAS) break;
    if (/^[A-Za-z0-9_-]{1,64}$/.test(k) && typeof t === "string" && t.trim()) out[k] = t.slice(0, NOTA_MAX);
  }
  return out;
}

const lerLista = (v: unknown): string[] => (Array.isArray(v) ? v.filter((x): x is string => typeof x === "string" && /^[A-Za-z0-9_-]{1,64}$/.test(x)).slice(0, 40) : []);
const salvoLocal = local.json<{ ignorados?: unknown; bloqueados?: unknown }>("ignorados") || {};

export const useNotas = create<{ porFid: Record<string, string>; ignorados: string[]; bloqueados: string[] }>()(() => ({
  porFid: lerNotas(local.json("notas")),
  ignorados: lerLista(salvoLocal.ignorados),
  bloqueados: lerLista(salvoLocal.bloqueados),
}));

/** O que estava na conta chegou no login: vale o da conta, junto com o do navegador. */
export function notasDaConta(v: unknown, ign?: unknown, bloq?: unknown) {
  const st = useNotas.getState();
  useNotas.setState({
    porFid: { ...st.porFid, ...lerNotas(v) },
    ignorados: [...new Set([...st.ignorados, ...lerLista(ign)])],
    bloqueados: [...new Set([...st.bloqueados, ...lerLista(bloq)])],
  });
}
/** A pessoa (friend id) está ignorada ou bloqueada por mim? */
export const escondoMensagensDe = (fid: string | null | undefined) => {
  const st = useNotas.getState();
  return !!fid && (st.ignorados.includes(fid) || st.bloqueados.includes(fid));
};

let espera: ReturnType<typeof setTimeout> | undefined;
/** Grava a nota (vazia apaga), no navegador na hora e na conta logo depois. */
export function salvarNota(fid: string, texto: string) {
  const porFid = { ...useNotas.getState().porFid };
  const t = texto.slice(0, NOTA_MAX);
  if (t.trim()) porFid[fid] = t;
  else delete porFid[fid];
  useNotas.setState({ porFid });
  local.setJson("notas", porFid);
  gravarNaConta();
}
function gravarNaConta() {
  clearTimeout(espera);
  espera = setTimeout(() => {
    const { porFid, ignorados, bloqueados } = useNotas.getState();
    sb()
      .auth.updateUser({ data: { notas: porFid, ignorados, bloqueados } })
      .catch(() => {});
  }, 800);
}

/** Ignorar (ou deixar de) alguém: as mensagens dele somem do meu chat, com "Mostrar" para ver. */
export function ignorar(fid: string, sim: boolean) {
  const l = useNotas.getState().ignorados.filter((x) => x !== fid);
  const ignorados = sim ? [...l, fid] : l;
  useNotas.setState({ ignorados });
  local.setJson("ignorados", { ignorados, bloqueados: useNotas.getState().bloqueados });
  gravarNaConta();
}
/** Bloquear (ou desbloquear): como ignorar; quem chama também silencia a voz e a soundboard dele. */
export function bloquear(fid: string, sim: boolean) {
  const l = useNotas.getState().bloqueados.filter((x) => x !== fid);
  const bloqueados = sim ? [...l, fid] : l;
  useNotas.setState({ bloqueados });
  local.setJson("ignorados", { ignorados: useNotas.getState().ignorados, bloqueados });
  gravarNaConta();
}
