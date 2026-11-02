import { create } from "zustand";

type ToastState = { texto: string; visivel: boolean; n: number };

export const useToast = create<ToastState>()(() => ({ texto: "", visivel: false, n: 0 }));

let timer: ReturnType<typeof setTimeout> | undefined;

/** Aviso rápido no rodapé da tela (some em 2,4 s). */
export function toast(texto: string) {
  useToast.setState((s) => ({ texto, visivel: true, n: s.n + 1 }));
  clearTimeout(timer);
  timer = setTimeout(() => useToast.setState({ visivel: false }), 2400);
}
