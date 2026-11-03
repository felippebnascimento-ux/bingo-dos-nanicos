"use client";
/* O selo da Banca Nanica no alto do Cassino (e no Mural do K-FOFO): quanto a casa já ganhou dos nanicos. */
import { useEffect } from "react";
import { formatarMoedas } from "@/lib/moedas";
import { iniciarBanca, useBanca } from "./banca";

export function BancaNanica({ compacta = false }: { compacta?: boolean }) {
  const valor = useBanca((s) => s.valor);
  useEffect(() => void iniciarBanca(), []);
  if (valor === null) return null;
  return (
    <div className={"banca-nanica" + (compacta ? " compacta" : "")} title="Tudo que os nanicos perdem no cassino vai para a Banca Nanica; o que o cassino paga sai dela.">
      <span className="banca-cofre" aria-hidden="true">
        <svg viewBox="0 0 24 24" width="20" height="20">
          <rect x="3.5" y="5" width="17" height="14" rx="2.5" />
          <circle cx="12" cy="12" r="3.6" />
          <path d="M12 8.4v1.2M12 14.4v1.2M8.4 12h1.2M14.4 12h1.2M6.5 19v1.5M17.5 19v1.5" />
        </svg>
      </span>
      <span>
        <small>Banca Nanica</small>
        <b>{formatarMoedas(valor)}</b>
      </span>
    </div>
  );
}
