"use client";
import { CartaoPerfil } from "@/components/shell/CartaoPerfil";
import { MiniPlayer } from "@/features/live/MiniPlayer";
import { useEffect } from "react";
import { Fome } from "./Fome";
import { PortaLog, PortaLogin, PortaPrimeiraSenha, PortaTrocarSenha } from "./portas/Portas";
import { Membros } from "./shell/People";
import { Sidebar } from "./shell/Sidebar";
import { Toast } from "./ui/Toast";
import { CassinoView } from "@/features/cassino/CassinoView";
import { MidiasView } from "@/features/midias/MidiasView";
import { Celular } from "@/features/celular/Celular";
import { ChatView } from "@/features/chat/ChatView";
import { ConfigJanela } from "@/features/config/ConfigView";
import { FichaNanico } from "@/features/ficha/Ficha";
import { TrocaJanela } from "@/features/troca/Troca";
import { NavegadorJanela } from "@/features/quarto/NavegadorQuartos";
import { GruposJanela } from "@/features/grupos/GruposJanela";
import { PainelCarteira } from "@/features/moedas/Ranking";
import { PainelMochila } from "@/features/loja/MochilaPainel";
import { ArrumarQuarto } from "@/features/quarto/ArrumarQuarto";
import { SalasJanela } from "@/features/salas/Salas";
import { HallView } from "@/features/hall/HallView";
import { LojaView } from "@/features/loja/LojaView";
import { TrofeusView } from "@/features/trofeus/TrofeusView";
import { JogarView } from "@/features/jogar/JogarView";
import { NanicadasView } from "@/features/nanicadas/NanicadasView";
import { NanicosView } from "@/features/nanicos/NanicosView";
import { AmigosView } from "@/features/amigos/AmigosView";
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
  /* a lista de membros some no K-FOFO (ele tem a própria lista no canto) */
  useEffect(() => {
    document.body.classList.toggle("sem-membros", aba === "hall");
  }, [aba]);

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
            <TrofeusView hidden={aba !== "trofeus"} />
            <LojaView hidden={aba !== "loja"} />
            <JogarView hidden={aba !== "jogar"} />
            <NanicadasView hidden={aba !== "frases"} />
            <NanicosView hidden={aba !== "nanicos"} />
            <AmigosView hidden={aba !== "amigos"} />
            <TrucoView hidden={aba !== "truco"} />
            <CassinoView hidden={aba !== "cassino"} />
            <MidiasView hidden={aba !== "midias"} />
            <PerfilView hidden={aba !== "perfil"} />
            <LiveView hidden={aba !== "live"} />
            <ChatView hidden={aba !== "chat"} />
          </div>
        </main>
        <Membros />
      </div>

      <PortaLogin />
      <PortaPrimeiraSenha />
      <PortaLog />
      <PortaTrocarSenha />
      <PainelCarteira />
      <PainelMochila />
      <ArrumarQuarto />
      <FichaNanico />
      <TrocaJanela />
      <NavegadorJanela />
      <GruposJanela />
      <SalasJanela />
      <ConfigJanela />

      <Fome />
      <datalist id="champs">
        {CHAMPS.map((c) => (
          <option key={c} value={c} />
        ))}
      </datalist>
      <Celular />
      <CartaoPerfil />
      <MiniPlayer />
      <Toast />
      <CamadaReacoesMinha />
    </>
  );
}
