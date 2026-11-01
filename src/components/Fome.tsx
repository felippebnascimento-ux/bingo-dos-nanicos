"use client";
import { useEffect, useState } from "react";
import { IcFechar, IcFome } from "@/components/ui/icones";
import { local } from "@/lib/util";

/* easter egg: "Estou com fome" aparece das 18h às 22h (horário de quem está vendo).
   O X esconde o botão até o dia seguinte (fica salvo no navegador). */
const hojeStr = () => {
  const d = new Date();
  return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
};
const deveMostrar = () => {
  const h = new Date().getHours();
  return h >= 18 && h < 22 && local.get("fome-fechado") !== hojeStr();
};

export function Fome() {
  const [ver, setVer] = useState(false);
  useEffect(() => {
    const f = () => setVer(deveMostrar());
    f();
    const t = setInterval(f, 60000);
    return () => clearInterval(t);
  }, []);
  return (
    <div className="fome-wrap" id="fome" hidden={!ver}>
      <a className="fome" href="https://heim.ratskeller.com.br" target="_blank" rel="noopener">
        <IcFome />
        Estou com fome
      </a>
      <button
        className="fome-x"
        id="fomeX"
        type="button"
        aria-label="Tirar o botão Estou com fome por hoje"
        title="Tirar por hoje"
        onClick={() => {
          local.set("fome-fechado", hojeStr());
          setVer(false);
        }}
      >
        <IcFechar />
      </button>
    </div>
  );
}
