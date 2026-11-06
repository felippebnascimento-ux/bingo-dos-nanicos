import { create } from "zustand";

/** O tipo muda o ícone e a cor (como os avisos do Discord); sem dizer, o tipo sai do próprio texto. */
export type TipoAviso = "ok" | "erro" | "dinheiro" | "aviso" | "info";
export type Aviso = { id: number; texto: string; tipo: TipoAviso; saindo?: boolean };

export const useToast = create<{ avisos: Aviso[] }>()(() => ({ avisos: [] }));

const ERRO = /^(não deu|não dá|só |saldo insuficiente|calma|o microfone foi bloqueado|a câmera foi bloqueada|o navegador bloqueou|nenhum microfone|nenhuma câmera|erro)|bloquead|não foi possível|precisa |rode o sql/i;
const DINHEIRO = /moedas?\b|\+\s?\d|jackpot|bolsa nanica|prêmio|ganhou/i;
const OK = /fixada no canal|^(pronto|copiado|salvo|fixada|desafixada|desbloqueado|chamado|movido|castigo tirado|de castigo|silenciado|ensurdecido|microfone liberado|som liberado|desconectado|nota apagada|configurações de voz redefinidas|ignorado|não está mais ignorado|bloqueado)/i;
const AVISO = /ao vivo|mencionou|chamando|moderador|você está mudo|sem som|parou de transmitir/i;
export function tipoDoTexto(t: string): TipoAviso {
  if (ERRO.test(t)) return "erro";
  if (OK.test(t)) return "ok";
  if (AVISO.test(t)) return "aviso";
  if (DINHEIRO.test(t)) return "dinheiro";
  return "info";
}

let seq = 0;
/** Aviso rápido no rodapé da tela: empilham (até 3) e cada um some em 3,2 s. */
export function toast(texto: string, tipo: TipoAviso = tipoDoTexto(texto)) {
  const id = ++seq;
  const atuais = useToast.getState().avisos.filter((a) => a.texto !== texto);
  useToast.setState({ avisos: [...atuais, { id, texto, tipo }].slice(-3) });
  setTimeout(() => useToast.setState((s) => ({ avisos: s.avisos.map((a) => (a.id === id ? { ...a, saindo: true } : a)) })), 3000);
  setTimeout(() => useToast.setState((s) => ({ avisos: s.avisos.filter((a) => a.id !== id) })), 3300);
}
