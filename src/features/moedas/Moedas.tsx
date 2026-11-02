"use client";
/* Moedas na tela: o selinho do menu (saldo e dias seguidos) e o quadro do Perfil (com o extrato). */
import { useEffect } from "react";
import { IcMoeda } from "@/components/ui/icones";
import { carregarExtrato, useCarteira } from "@/lib/carteira";
import { bonusDoDia, diasSeguidos, formatarMoedas, MOTIVOS, textoTempo } from "@/lib/moedas";
import { setApp, useApp } from "@/lib/store";

/** Selinho do menu. Tocar abre o Perfil, onde fica o extrato. Some se as moedas estiverem desligadas. */
export function CarteiraChip() {
  const c = useCarteira((s) => s.carteira);
  if (!c) return null;
  const rotulo = `${formatarMoedas(c.saldo)} moedas` + (c.seq ? `, ${diasSeguidos(c.seq)}` : "") + ". Abrir o extrato no Perfil";
  return (
    <button type="button" className="moedas-chip" aria-label={rotulo} title={rotulo} onClick={() => setApp({ aba: "perfil" })}>
      <IcMoeda tam={18} />
      <b>{formatarMoedas(c.saldo)}</b>
      {c.seq > 0 && <span className="seq">{c.seq === 1 ? "1 dia" : `${c.seq} dias`}</span>}
    </button>
  );
}

const quando = (iso: string) => {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "" : d.toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
};

/** Quadro "Moedas" do Perfil: saldo, sequência, bônus de amanhã, minutos de hoje e extrato. */
export function MoedasBloco() {
  const c = useCarteira((s) => s.carteira);
  const extrato = useCarteira((s) => s.extrato);
  const naAba = useApp((s) => s.aba === "perfil");
  const saldo = c?.saldo;
  /* o extrato só é buscado com o Perfil aberto (e de novo quando o saldo muda) */
  useEffect(() => {
    if (naAba && saldo !== undefined) carregarExtrato();
  }, [naAba, saldo]);
  if (!c) return null;
  return (
    <div className="block moedas-block">
      <h2>Moedas</h2>
      <div className="moedas-saldo">
        <IcMoeda tam={28} />
        <b>{formatarMoedas(c.saldo)}</b>
        <span>moedas</span>
      </div>
      <dl className="moedas-info">
        <div>
          <dt>Sequência</dt>
          <dd>{c.seq ? diasSeguidos(c.seq) : "começa hoje"}</dd>
        </div>
        <div>
          <dt>Bônus de amanhã</dt>
          <dd>+{bonusDoDia(c.seq + 1)}</dd>
        </div>
        <div>
          <dt>Tempo no site hoje</dt>
          <dd>{textoTempo(c.minutosHoje)}</dd>
        </div>
      </dl>
      <details className="moedas-como">
        <summary>Como ganhar moedas</summary>
        <p>
          Todo dia que você entra ganha um bônus, maior a cada dia seguido (até 60 por dia), com prêmio de +100 no 7º dia e +500 no 30º. Com o site
          aberto, ganha 1 moeda a cada 6 minutos, sem limite por dia. No happy hour, das 22h à meia-noite, é 1 a cada 3 minutos. No sábado, das 18h às 23h, tem espetinho surpresa na churrasqueira do Nanico Hotel. Faltou um dia, a sequência recomeça.
        </p>
      </details>
      {extrato.length > 0 && (
        <>
          <h3>Extrato</h3>
          <ul className="moedas-extrato">
            {extrato.map((l) => (
              <li key={l.id}>
                <span className="mot">{MOTIVOS[l.motivo] || l.motivo}</span>
                <time>{quando(l.em)}</time>
                <b className={l.valor < 0 ? "neg" : ""}>
                  {l.valor > 0 ? "+" : ""}
                  {formatarMoedas(l.valor)}
                </b>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
