/*
 * Janela flutuante de documento (Document Picture-in-Picture): ainda não está nos tipos do TypeScript.
 * Fica num tipo local (sem mexer no `Window` global) para não brigar com outra declaração parecida.
 */
export type JanelaPip = Window;

type DocumentPictureInPicture = {
  requestWindow(opts?: { width?: number; height?: number }): Promise<JanelaPip>;
};

const api = () =>
  typeof window !== "undefined"
    ? (window as unknown as { documentPictureInPicture?: DocumentPictureInPicture }).documentPictureInPicture
    : undefined;

/** Chrome e Edge no computador abrem uma janela flutuante com HTML dentro (as câmeras). */
export const canPip = () => !!api();

export function abrirJanelaPip(opts: { width: number; height: number }) {
  const a = api();
  if (!a) return Promise.reject(new Error("sem documentPictureInPicture"));
  return a.requestWindow(opts);
}
