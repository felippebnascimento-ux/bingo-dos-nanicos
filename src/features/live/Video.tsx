"use client";
import { useCallback } from "react";

type Props = {
  stream: MediaStream | null;
  className?: string;
  /** recebe o elemento (ou null ao desmontar), para quem precisa dele fora do React */
  onEl?: (el: HTMLVideoElement | null) => void;
};

/** Vídeo sem som de um MediaStream (minis, câmeras, prévia da minha tela). */
export function VideoMudo({ stream, className, onEl }: Props) {
  const ref = useCallback(
    (v: HTMLVideoElement | null) => {
      onEl?.(v);
      if (!v) return;
      v.muted = true;
      if (v.srcObject !== stream) v.srcObject = stream;
      if (stream) v.play().catch(() => {});
      return () => {
        onEl?.(null);
        v.srcObject = null;
      };
    },
    [stream, onEl],
  );
  return <video ref={ref} className={className} autoPlay muted playsInline />;
}
