"use client";
/*
 * Janela de Configurações (abre pela engrenagem embaixo do menu, por cima de qualquer aba):
 * microfone, saída de som e câmera, cancelamento de eco e ruído, teste do microfone, trocar senha e sair.
 */
import { useEffect, useRef, useState, type KeyboardEvent as KE } from "react";
import { IcFechar } from "@/components/ui/icones";
import { volumeDe } from "@/features/live/vozRegras";
import { logout } from "@/lib/dados";
import { setApp, useApp } from "@/lib/store";
import { toast } from "@/lib/toast";
import { acompanharAparelhos, listarAparelhos, podeEscolherSaida, restricoesMic, salvarMidia, useMidia, type Dispositivo } from "./midia";

/** Lista de aparelhos com "Padrão do sistema" no topo. Aparelho salvo que sumiu volta para o padrão. */
function Escolha({ rotulo, valor, lista, onChange }: { rotulo: string; valor: string; lista: Dispositivo[]; onChange: (id: string) => void }) {
  const existe = !valor || lista.some((d) => d.id === valor);
  return (
    <label className="cfg-campo">
      <span className="seg-lbl">{rotulo}</span>
      <select value={existe ? valor : ""} onChange={(e) => onChange(e.target.value)}>
        <option value="">Padrão do sistema</option>
        {lista.map((d) => (
          <option key={d.id} value={d.id}>
            {d.nome}
          </option>
        ))}
      </select>
    </label>
  );
}

/** Teste do microfone: uma barra que mexe com a voz (com o aparelho, o eco e o ruído escolhidos). */
function TesteMic() {
  const [ligado, setLigado] = useState(false);
  const barra = useRef<HTMLSpanElement>(null);
  const mic = useMidia((s) => s.mic);
  const eco = useMidia((s) => s.eco);
  const ruido = useMidia((s) => s.ruido);

  useEffect(() => {
    if (!ligado) return;
    const el = barra.current;
    let fim = false;
    let st: MediaStream | null = null;
    let ctx: AudioContext | null = null;
    let quadro = 0;
    (async () => {
      try {
        st = await navigator.mediaDevices.getUserMedia({ audio: restricoesMic({ ...useMidia.getState(), mic, eco, ruido }), video: false });
        if (fim) return st.getTracks().forEach((t) => t.stop());
        listarAparelhos();
        /* só mede, não toca: sem abrir a saída de som */
        try {
          ctx = new AudioContext({ sinkId: { type: "none" } } as AudioContextOptions);
        } catch {
          ctx = new AudioContext();
        }
        const an = ctx.createAnalyser();
        an.fftSize = 512;
        ctx.createMediaStreamSource(st).connect(an);
        const buf = new Float32Array(an.fftSize);
        const passo = () => {
          an.getFloatTimeDomainData(buf);
          /* a fala fica entre 0,01 e 0,2: a raiz espalha melhor na barra */
          const n = Math.min(1, Math.sqrt(volumeDe(buf) / 0.2));
          el?.style.setProperty("--nivel", String(n));
          quadro = requestAnimationFrame(passo);
        };
        passo();
      } catch (e) {
        console.warn(e);
        toast("Não deu para ligar o microfone. Libere no cadeado ao lado do endereço do site.");
        setLigado(false);
      }
    })();
    return () => {
      fim = true;
      cancelAnimationFrame(quadro);
      st?.getTracks().forEach((t) => t.stop());
      ctx?.close().catch(() => {});
      el?.style.setProperty("--nivel", "0");
    };
  }, [ligado, mic, eco, ruido]);

  return (
    <div className="cfg-teste">
      <button type="button" className="btn soft sm" aria-pressed={ligado} onClick={() => setLigado(!ligado)}>
        {ligado ? "Parar o teste" : "Testar o microfone"}
      </button>
      <span className="cfg-nivel" ref={barra} aria-hidden="true">
        <i />
      </span>
    </div>
  );
}

/** A janela só existe aberta (fechar desliga o teste do microfone). */
export function ConfigJanela() {
  const aberto = useApp((s) => s.configAberto);
  return aberto ? <ConfigAberta /> : null;
}

function ConfigAberta() {
  const m = useMidia();
  const naVoz = useApp((s) => !!s.myVozSid);
  const fecharRef = useRef<HTMLButtonElement>(null);
  const fechar = () => setApp({ configAberto: false });

  /* a lista de aparelhos é lida ao abrir (e quando um aparelho é ligado ou desligado) */
  useEffect(() => {
    fecharRef.current?.focus();
    acompanharAparelhos();
    listarAparelhos();
  }, []);
  const tecla = (e: KE<HTMLDivElement>) => e.key === "Escape" && fechar();

  const liberar = async () => {
    try {
      const st = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
      st.getTracks().forEach((t) => t.stop());
      await listarAparelhos();
    } catch {
      toast("O microfone foi bloqueado. Libere no cadeado ao lado do endereço do site.");
    }
  };

  return (
    <div className="gate cfg-gate" role="dialog" aria-modal="true" aria-labelledby="cfgTitulo" onKeyDown={tecla} onClick={(e) => e.target === e.currentTarget && fechar()}>
      <div className="cfg-card">
        <div className="cfg-topo">
          <h2 id="cfgTitulo" className="cfg-titulo">Configurações</h2>
          <button className="ficha-fechar" type="button" ref={fecharRef} aria-label="Fechar as configurações" onClick={fechar}>
            <IcFechar />
          </button>
        </div>

        <div className="block cfg-bloco">
          <h2>Voz e vídeo</h2>
          <p className="hint">{naVoz ? "Você está na voz: o que mudar aqui vale na hora." : "Vale para a próxima vez que você entrar na voz ou ligar a câmera."}</p>
          {!m.liberado && (
            <p className="cfg-aviso">
              O navegador só mostra o nome dos aparelhos depois de liberar o microfone.{" "}
              <button type="button" className="linkish" onClick={liberar}>
                Liberar o microfone
              </button>
            </p>
          )}
          <Escolha rotulo="Microfone" valor={m.mic} lista={m.mics} onChange={(mic) => salvarMidia({ mic })} />
          {podeEscolherSaida() && <Escolha rotulo="Saída de som (a voz da sala)" valor={m.saida} lista={m.saidas} onChange={(saida) => salvarMidia({ saida })} />}
          <Escolha rotulo="Câmera" valor={m.cam} lista={m.cams} onChange={(cam) => salvarMidia({ cam })} />
          <label className="cfg-chk">
            <input type="checkbox" checked={m.eco} onChange={(e) => salvarMidia({ eco: e.target.checked })} />
            <span>
              Cancelamento de eco
              <small>Com fone de ouvido, dá para desligar. Em alguns fones Bluetooth, desligar evita um soluço na música ao entrar na voz.</small>
            </span>
          </label>
          <label className="cfg-chk">
            <input type="checkbox" checked={m.ruido} onChange={(e) => salvarMidia({ ruido: e.target.checked })} />
            <span>
              Supressão de ruído
              <small>Corta ventilador, teclado e barulho de fundo.</small>
            </span>
          </label>
          <TesteMic />
        </div>

        <div className="block cfg-bloco">
          <h2>Conta</h2>
          <div className="cfg-conta">
            <button type="button" className="btn soft" onClick={() => setApp({ configAberto: false, pwAberto: true })}>
              Trocar senha
            </button>
            <button
              type="button"
              className="btn soft cfg-sair"
              onClick={() => {
                setApp({ configAberto: false });
                logout();
              }}
            >
              Sair da conta
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
