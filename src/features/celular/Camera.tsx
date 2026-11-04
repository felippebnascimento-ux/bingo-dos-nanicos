"use client";
/*
 * A câmera dentro do InstaNanico (seção 69): tira a foto ali mesmo (frontal ou traseira) ou grava um boomerang, um
 * pedacinho que vai e volta, salvo como GIF (gif.ts). Entrega o arquivo pronto para o story ou para a publicação.
 */
import { useEffect, useRef, useState } from "react";
import { toast } from "@/lib/toast";
import { indexar, montarGif } from "./gif";

export const temCamera = () => typeof navigator !== "undefined" && !!navigator.mediaDevices?.getUserMedia;

/** Recorta o quadro do vídeo no formato pedido (largura ÷ altura), no meio, como a tela mostra. */
function recorteDoVideo(v: HTMLVideoElement, proporcao: number) {
  const vw = v.videoWidth, vh = v.videoHeight;
  let w = vw, h = vw / proporcao;
  if (h > vh) {
    h = vh;
    w = vh * proporcao;
  }
  return { x: (vw - w) / 2, y: (vh - h) / 2, w, h };
}

export function Camera({ proporcao, fechar, pronto, boomerang = true }: { proporcao: number; fechar: () => void; pronto: (f: File) => void; boomerang?: boolean }) {
  const video = useRef<HTMLVideoElement>(null);
  const [frente, setFrente] = useState(true);
  const [modo, setModo] = useState<"foto" | "boomerang">("foto");
  const [gravando, setGravando] = useState<number | null>(null);
  const [montando, setMontando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    let st: MediaStream | null = null, vivo = true;
    void navigator.mediaDevices
      .getUserMedia({ video: { facingMode: frente ? "user" : "environment", width: { ideal: 1920 }, height: { ideal: 1080 } }, audio: false })
      .then((s) => {
        if (!vivo) return s.getTracks().forEach((t) => t.stop());
        st = s;
        if (video.current) {
          video.current.srcObject = s;
          void video.current.play().catch(() => {});
        }
      })
      .catch(() => setErro("Não deu para abrir a câmera. Libere a câmera no cadeado ao lado do endereço do site."));
    return () => {
      vivo = false;
      st?.getTracks().forEach((t) => t.stop());
    };
  }, [frente]);

  /** Desenha o quadro atual (espelhado na frontal, como a gente se vê) num canvas de `largura`. */
  const quadro = (largura: number) => {
    const v = video.current!;
    const r = recorteDoVideo(v, proporcao);
    const c = document.createElement("canvas");
    c.width = Math.round(largura);
    c.height = Math.round(largura / proporcao);
    const g = c.getContext("2d", { willReadFrequently: true })!;
    if (frente) {
      g.translate(c.width, 0);
      g.scale(-1, 1);
    }
    g.drawImage(v, r.x, r.y, r.w, r.h, 0, 0, c.width, c.height);
    return { c, g };
  };

  const disparar = async () => {
    const v = video.current;
    if (!v || !v.videoWidth || montando || gravando !== null) return;
    if (modo === "foto") {
      const { c } = quadro(Math.min(1080, recorteDoVideo(v, proporcao).w));
      const blob = await new Promise<Blob | null>((ok) => c.toBlob(ok, "image/jpeg", 0.92));
      if (blob) pronto(new File([blob], "camera.jpg", { type: "image/jpeg" }));
      return;
    }
    /* boomerang: 14 quadros em ~1,1 s, depois volta de trás para frente */
    const largura = 320, alt = Math.round(largura / proporcao);
    const quadros: Uint8Array[] = [];
    setGravando(0);
    for (let i = 0; i < 14; i++) {
      const { g } = quadro(largura);
      quadros.push(indexar(g.getImageData(0, 0, largura, alt).data, largura, alt));
      setGravando(i + 1);
      await new Promise((ok) => setTimeout(ok, 80));
    }
    setGravando(null);
    setMontando(true);
    await new Promise((ok) => setTimeout(ok, 30));
    try {
      const ida = [...quadros, ...quadros.slice(1, -1).reverse()];
      const gif = montarGif(ida, largura, alt, 7);
      const arquivo = new File([gif.buffer as ArrayBuffer], "boomerang.gif", { type: "image/gif" });
      if (arquivo.size > 5 * 1024 * 1024) throw new Error("grande");
      pronto(arquivo);
    } catch {
      toast("Não deu para montar o boomerang.");
    } finally {
      setMontando(false);
    }
  };

  return (
    <div className="ig-camera" role="dialog" aria-label="Câmera">
      <div className="ig-camera-visor" style={{ aspectRatio: String(proporcao) }}>
        {erro ? <p className="ig-camera-erro">{erro}</p> : <video ref={video} className={frente ? "espelho" : undefined} autoPlay muted playsInline />}
        {gravando !== null && <span className="ig-camera-rec" style={{ "--p": `${(gravando / 14) * 100}%` } as React.CSSProperties} aria-label="Gravando o boomerang" />}
        {montando && <span className="ig-camera-montando">Montando o boomerang…</span>}
      </div>
      <button type="button" className="ig-sem-botao ig-camera-fechar" aria-label="Fechar a câmera" onClick={fechar}>
        ✕
      </button>
      <div className="ig-camera-pe">
        <span />
        <button type="button" className={"ig-camera-disparo" + (modo === "boomerang" ? " boomerang" : "")} aria-label={modo === "foto" ? "Tirar a foto" : "Gravar o boomerang"} disabled={!!erro || montando} onClick={() => void disparar()}>
          {modo === "boomerang" && <span aria-hidden="true">∞</span>}
        </button>
        <button type="button" className="ig-sem-botao ig-camera-virar" aria-label="Trocar de câmera" onClick={() => setFrente((f) => !f)}>
          ⟲
        </button>
      </div>
      {boomerang && (
        <div className="ig-camera-modos" role="radiogroup" aria-label="Modo">
          {(["foto", "boomerang"] as const).map((m) => (
            <button key={m} type="button" role="radio" aria-checked={modo === m} className={modo === m ? "on" : undefined} onClick={() => setModo(m)}>
              {m === "foto" ? "FOTO" : "BOOMERANG"}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
