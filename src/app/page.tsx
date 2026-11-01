"use client";
import dynamic from "next/dynamic";

/* O site depende do navegador (login salvo, câmera, WebRTC), então só monta no cliente.
   Enquanto carrega, aparece a mesma tela de "Carregando…" do login. */
const App = dynamic(() => import("@/components/App"), {
  ssr: false,
  loading: () => (
    <div className="gate" role="dialog" aria-modal="true" aria-label="Bingo dos Nanicos">
      <div className="gate-card">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img className="gate-crew" src="/arte/turma.webp" alt="" />
        <h2>Bingo dos Nanicos</h2>
        <p className="gate-wait">Carregando…</p>
      </div>
    </div>
  ),
});

export default function Page() {
  return <App />;
}
