/*
 * Comandos da barra do chat do K-FOFO (como no Habbo). Regra pura, sem React:
 *   o/  :dançar  :deitar        → ação do boneco (acoes.ts)
 *   :g texto  (ou Shift+Enter)  → grito: balão grande para todo mundo
 *   :s Nome texto               → sussurro: só a pessoa vê
 * O resto é uma fala normal.
 */
import { comandoAcao, type Acao } from "./acoes";

export type Comando =
  | { tipo: "acao"; acao: Acao }
  | { tipo: "fala"; texto: string; grito: boolean }
  | { tipo: "sussurro"; para: string; texto: string }
  | { tipo: "erro"; msg: string };

const semAcento = (s: string) => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");

/** Lê o que foi escrito. `pessoas` são os membros (id e nome) que podem receber um sussurro. */
export function lerComando(texto: string, pessoas: readonly { id: string; name: string }[], gritar = false): Comando {
  const t = texto.trim();
  const acao = comandoAcao(t);
  if (acao) return { tipo: "acao", acao };
  const g = /^:g\s+([\s\S]+)$/i.exec(t);
  if (g) return { tipo: "fala", texto: g[1].trim(), grito: true };
  const s = /^:s\s+([\s\S]+)$/i.exec(t);
  if (s) {
    const resto = s[1].trim();
    const r = semAcento(resto);
    /* o nome mais comprido que casa com o começo ("Le Bubu" antes de "Le") */
    const quem = [...pessoas]
      .sort((a, b) => b.name.length - a.name.length)
      .find((p) => {
        const n = semAcento(p.name);
        return r.startsWith(n) && (r.length === n.length || /\s/.test(r[n.length]));
      });
    if (!quem) return { tipo: "erro", msg: "Não achei esse nanico. Escreva :s Nome mensagem" };
    const msg = resto.slice(quem.name.length).trim();
    if (!msg) return { tipo: "erro", msg: `Escreva o que vai sussurrar para ${quem.name}` };
    return { tipo: "sussurro", para: quem.id, texto: msg };
  }
  return { tipo: "fala", texto: t, grito: gritar };
}
