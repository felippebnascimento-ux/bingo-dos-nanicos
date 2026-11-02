"use client";
import { useEffect } from "react";
import { Fome } from "./Fome";
import { PortaLog, PortaLogin, PortaPrimeiraSenha, PortaTrocarSenha } from "./portas/Portas";
import { Sidebar } from "./shell/Sidebar";
import { Toast } from "./ui/Toast";
import { FichaNanico } from "@/features/ficha/Ficha";
import { HallView } from "@/features/hall/HallView";
import { JogarView } from "@/features/jogar/JogarView";
import { NanicadasView } from "@/features/nanicadas/NanicadasView";
import { NanicosView } from "@/features/nanicos/NanicosView";
import { PerfilView } from "@/features/perfil/PerfilView";
import { LiveView } from "@/features/live/LiveView";
import { TrucoView } from "@/features/truco/TrucoView";
import { CamadaReacoesMinha } from "@/features/live/CamadaReacoesMinha";
import { boot } from "@/lib/dados";
import { CHAMPS } from "@/lib/dados/campeoes";
import { CREW } from "@/lib/dados/nanicos";
import { useApp } from "@/lib/store";

/**
 * O site inteiro (só roda no navegador). As abas ficam sempre montadas e só são escondidas,
 * como no site antigo: a live, as câmeras e a mesa de truco continuam vivas ao trocar de aba.
 */
export default function App() {
  const aba = useApp((s) => s.aba);
  useEffect(() => {
    boot();
  }, []);

  return (
    <>
      <div className="wm" aria-hidden="true">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={CREW} alt="" decoding="async" />
      </div>
      <div className="app">
        <Sidebar />
        <main className="main">
          <div className="inner">
            <HallView hidden={aba !== "hall"} />
            <JogarView hidden={aba !== "jogar"} />
            <NanicadasView hidden={aba !== "frases"} />
            <NanicosView hidden={aba !== "nanicos"} />
            <TrucoView hidden={aba !== "truco"} />
            <PerfilView hidden={aba !== "perfil"} />
            <LiveView hidden={aba !== "live"} />
          </div>
        </main>
      </div>

      <PortaLogin />
      <PortaPrimeiraSenha />
      <PortaLog />
      <PortaTrocarSenha />
      <FichaNanico />

      <Fome />
      <datalist id="champs">
        {CHAMPS.map((c) => (
          <option key={c} value={c} />
        ))}
      </datalist>
      <Toast />
      <CamadaReacoesMinha />
    </>
  );
}
