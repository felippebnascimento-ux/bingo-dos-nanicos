"use client";
/*
 * Mochila pelo K-FOFO: o botão ao lado da carteira e a janela com a MochilaLista (equipar, usar, abrir o
 * Celular). Usar um consumível fecha a janela, e o boneco aparece usando no cômodo.
 */
import { useEffect, useRef, type KeyboardEvent as KE } from "react";
import { IcFechar, IcMochila } from "@/components/ui/icones";
import { setApp } from "@/lib/store";
import { MochilaLista } from "./LojaView";
import { useLoja, useMinhaMochila } from "./lojaDados";

const abrir = () => useLoja.setState({ mochilaAberta: true });
const fechar = () => useLoja.setState({ mochilaAberta: false });

/** Botão do canto do K-FOFO, com quantos itens diferentes tenho. Some enquanto a loja não carregou. */
export function MochilaCanto() {
  const itens = useLoja((s) => s.itens);
  const qtd = useMinhaMochila().length;
  if (!itens) return null;
  return (
    <button type="button" className="hall-canto hall-mochila" aria-label={`Mochila, ${qtd} ${qtd === 1 ? "item" : "itens"}. Abrir o inventário`} onClick={abrir}>
      <IcMochila tam={20} />
      <span>
        <b>Mochila</b>
        <small>{qtd === 1 ? "1 item" : `${qtd} itens`}</small>
      </span>
    </button>
  );
}

export function PainelMochila() {
  const aberta = useLoja((s) => s.mochilaAberta);
  return aberta ? <MochilaAberta /> : null;
}

function MochilaAberta() {
  const fecharRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    fecharRef.current?.focus();
  }, []);
  const tecla = (e: KE<HTMLDivElement>) => e.key === "Escape" && fechar();
  return (
    <div className="gate carteira-gate" role="dialog" aria-modal="true" aria-labelledby="mochilaTitulo" onKeyDown={tecla} onClick={(e) => e.target === e.currentTarget && fechar()}>
      <div className="carteira-painel mochila-painel">
        <div className="carteira-topo">
          <span className="mochila-icone" aria-hidden="true">
            <IcMochila tam={20} />
          </span>
          <span>
            <b id="mochilaTitulo">Mochila</b>
            <small>equipe, use no K-FOFO ou abra o Celular</small>
          </span>
          <button className="ficha-fechar" type="button" ref={fecharRef} aria-label="Fechar a mochila" onClick={fechar}>
            <IcFechar />
          </button>
        </div>
        <MochilaLista />
        <button
          type="button"
          className="btn soft"
          onClick={() => {
            fechar();
            setApp({ aba: "loja" });
          }}
        >
          Abrir a loja
        </button>
      </div>
    </div>
  );
}
