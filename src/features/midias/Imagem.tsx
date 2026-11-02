"use client";
/* Imagem do bucket privado "midias" (galeria e rede nanica): baixa com o login só quando chega perto da tela. */
import { useEffect, useRef, useState } from "react";
import { urlDaImagem } from "./midiasDados";

export function Imagem({ caminho, alt, cheia = false }: { caminho: string; alt: string; cheia?: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  const [url, setUrl] = useState<string | null>(null);
  const [falhou, setFalhou] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    let vivo = true;
    const carregar = () =>
      void urlDaImagem(caminho).then((u) => {
        if (!vivo) return;
        if (u) setUrl(u);
        else setFalhou(true);
      });
    if (cheia || typeof IntersectionObserver === "undefined") {
      carregar();
      return () => void (vivo = false);
    }
    const io = new IntersectionObserver(
      (es) => {
        if (es.some((e) => e.isIntersecting)) {
          io.disconnect();
          carregar();
        }
      },
      { rootMargin: "200px" },
    );
    io.observe(el);
    return () => {
      vivo = false;
      io.disconnect();
    };
  }, [caminho, cheia]);
  return (
    <div ref={ref} className={"midia-img" + (cheia ? " cheia" : "")}>
      {url ? (
        /* blob: do bucket privado; o next/image não serve aqui (site estático) */
        // eslint-disable-next-line @next/next/no-img-element
        <img src={url} alt={alt} />
      ) : (
        <span className="status">{falhou ? "Não carregou" : "Carregando…"}</span>
      )}
    </div>
  );
}
