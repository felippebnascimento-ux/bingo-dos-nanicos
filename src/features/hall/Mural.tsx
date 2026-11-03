"use client";
/*
 * Mural do K-FOFO (seção 49), na parede da direita, no lugar do antigo janelão: um quadro de cortiça com os últimos
 * recados pregados e, ao tocar, a janela do mural (avisos automáticos, recados e "Pregar um recado"). Dali se abre o
 * Hall da Fama. O quadro fica numa camada própria (o texto muda) e um botão invisível por cima abre a janela.
 */
import { memo, useEffect, useMemo, useRef, useState, type KeyboardEvent as KE } from "react";
import { Avatar } from "@/components/ui/Avatar";
import { useSure } from "@/components/ui/useSure";
import { BancaNanica } from "@/features/cassino/BancaNanica";
import { useBanca } from "@/features/cassino/banca";
import { useRanking } from "@/features/moedas/Ranking";
import { useTrofeus } from "@/features/trofeus/trofeusDados";
import { friendName, setApp, useApp } from "@/lib/store";
import { abrirMural, avisosDoMural, CORES_RECADO, iniciarMural, pregarRecado, tirarRecado, useMural, type CorRecado, type Recado } from "./muralDados";
import { tela, TH, TW, type Caixa2D } from "./hall";
import { viewBox } from "./Sala";

/* o quadro na parede da direita (j = 0): de i = A a i = B, de z = Z0 a z = Z1 */
const A = 5.0;
const B = 8.85;
const Z0 = 52;
const Z1 = 146;
/** comprimento na tela de 1 piso ao longo da parede */
const L = Math.hypot(TW, TH);
const LARG = (B - A) * L;
const ALT = Z1 - Z0;
/* desenha num papel reto (u para a direita, v para baixo) e entorta para o plano da parede da direita */
const [ox, oy] = tela(A, 0, Z1);
const PAREDE = `matrix(${TW / L} ${TH / L} 0 1 ${ox} ${oy})`;
const curto = (t: string, n: number) => (t.length > n ? t.slice(0, n - 1) + "…" : t);

export const QuadroMural = memo(function QuadroMural({ vb }: { vb: Caixa2D }) {
  const recados = useMural((s) => s.recados);
  const friends = useApp((s) => s.friends);
  useEffect(() => void iniciarMural(), []);
  /* 4 notas: as mais novas, em duas fileiras, um pouco tortas */
  const notas = recados.slice(0, 4);
  return (
    <svg className="hall-camada hall-quadro" viewBox={viewBox(vb)} aria-hidden="true">
      <g transform={PAREDE}>
        <rect x={0} y={0} width={LARG} height={ALT} rx={2} className="f-madeira s-madeiral" strokeWidth={2} />
        <rect x={5} y={5} width={LARG - 10} height={ALT - 10} className="mural-cortica" />
        <rect x={LARG / 2 - 28} y={8} width={56} height={13} rx={2} className="quadro-papel" />
        <text x={LARG / 2} y={18} textAnchor="middle" className="quadro-titulo">
          MURAL
        </text>
        {notas.length === 0 && (
          <text x={LARG / 2} y={ALT / 2 + 8} textAnchor="middle" className="quadro-linha">
            pregue o primeiro recado
          </text>
        )}
        {notas.map((r, k) => {
          const x = 10 + (k % 2) * (LARG / 2 - 4);
          const y = 26 + Math.floor(k / 2) * 32;
          const rot = [-3, 2, 1.5, -2][k];
          return (
            <g key={r.id} transform={`rotate(${rot} ${x + 40} ${y + 14})`}>
              <rect x={x} y={y} width={LARG / 2 - 14} height={28} className={"mural-nota n-" + r.cor} />
              <circle cx={x + (LARG / 2 - 14) / 2} cy={y + 2} r={2} className="mural-tachinha" />
              <text x={x + 3} y={y + 11} className="mural-nota-nome">
                {curto(friendName(friends.find((f) => f.user_id === r.userId)?.id ?? "", friends) || "nanico", 14)}
              </text>
              <text x={x + 3} y={y + 21} className="mural-nota-texto">
                {curto(r.texto, 22)}
              </text>
            </g>
          );
        })}
      </g>
    </svg>
  );
});

/** Caixa (em % do palco) do botão por cima do quadro. */
export function muralCaixa(vb: Caixa2D) {
  const [xa, ya] = tela(A, 0, Z1);
  const [xb, yb] = tela(B, 0, Z0);
  return { left: ((xa - vb.x) / vb.w) * 100, top: ((ya - vb.y) / vb.h) * 100, width: ((xb - xa) / vb.w) * 100, height: ((yb - ya) / vb.h) * 100 };
}

/** Botão invisível por cima do quadro: abre a janela do mural. */
export function BotaoMural({ vb }: { vb: Caixa2D }) {
  const c = muralCaixa(vb);
  return (
    <button
      type="button"
      className="hall-tv hall-quadro-botao"
      tabIndex={-1}
      aria-hidden="true"
      style={{ left: `${c.left}%`, top: `${c.top}%`, width: `${c.width}%`, height: `${c.height}%` }}
      onClick={(e) => {
        e.stopPropagation();
        abrirMural();
      }}
    />
  );
}

const NOME_COR: Record<CorRecado, string> = { amarelo: "Amarelo", rosa: "Rosa", azul: "Azul", verde: "Verde" };
const quando = (iso: string) => {
  const d = new Date(iso);
  return isNaN(d.getTime()) ? "" : d.toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
};

function LinhaRecado({ r }: { r: Recado }) {
  const friends = useApp((s) => s.friends);
  const myUid = useApp((s) => s.myUid);
  const f = friends.find((x) => x.user_id === r.userId);
  const { sure, pedir } = useSure();
  return (
    <li className={"mural-recado n-" + r.cor}>
      {f && <Avatar f={f} size="xs" />}
      <div>
        <b>{f?.name ?? "Nanico"}</b> <small>{quando(r.em)}</small>
        <p>{r.texto}</p>
      </div>
      {r.userId === myUid && (
        <button type="button" className={"linkish" + (sure ? " sure" : "")} onClick={() => pedir() && void tirarRecado(r.id)}>
          {sure ? "Confirmar" : "Tirar"}
        </button>
      )}
    </li>
  );
}

/** A janela do mural: avisos automáticos, os recados e o formulário. */
export function MuralJanela() {
  const aberto = useMural((s) => s.aberto);
  const recados = useMural((s) => s.recados);
  const ok = useMural((s) => s.ok);
  const linhas = useTrofeus((s) => s.linhas);
  const banca = useBanca((s) => s.valor);
  const friends = useApp((s) => s.friends);
  const ranking = useRanking();
  const [texto, setTexto] = useState("");
  const [cor, setCor] = useState<CorRecado>("amarelo");
  const [indo, setIndo] = useState(false);
  const fecharRef = useRef<HTMLButtonElement>(null);
  const fechar = () => useMural.setState({ aberto: false });
  useEffect(() => {
    if (aberto) fecharRef.current?.focus();
  }, [aberto]);
  const avisos = useMemo(() => {
    const topo = ranking?.find((l) => l.saldo !== null);
    return avisosDoMural({
      linhas,
      nome: (fid) => friendName(fid, friends) || null,
      banca,
      maisRico: topo ? { nome: friendName(topo.fid, friends), saldo: topo.saldo! } : null,
      agora: new Date(),
    });
  }, [linhas, friends, banca, ranking]);
  if (!aberto) return null;
  const tecla = (e: KE<HTMLDivElement>) => e.key === "Escape" && fechar();
  const pregar = async () => {
    if (indo || !texto.trim()) return;
    setIndo(true);
    if (await pregarRecado(texto, cor)) setTexto("");
    setIndo(false);
  };
  return (
    <div className="gate carteira-gate" role="dialog" aria-modal="true" aria-labelledby="muralTitulo" onKeyDown={tecla} onClick={(e) => e.target === e.currentTarget && fechar()}>
      <div className="carteira-painel mural-painel">
        <div className="carteira-topo">
          <span>
            <b id="muralTitulo">Mural do K-FOFO</b>
            <small>avisos e recados dos nanicos</small>
          </span>
          <button className="ficha-fechar" type="button" ref={fecharRef} aria-label="Fechar o mural" onClick={fechar}>
            ×
          </button>
        </div>
        <section aria-label="Avisos" className="mural-avisos">
          {avisos.map((a) => (
            <p key={a.id} className={"mural-aviso a-" + a.tipo}>
              {a.texto}
            </p>
          ))}
          <div className="mural-acoes">
            <BancaNanica compacta />
            <button
              type="button"
              className="btn soft sm"
              onClick={() => {
                fechar();
                setApp({ aba: "trofeus" });
              }}
            >
              Abrir o Hall da Fama
            </button>
          </div>
        </section>
        <form
          className="mural-form"
          onSubmit={(e) => {
            e.preventDefault();
            void pregar();
          }}
        >
          <textarea value={texto} onChange={(e) => setTexto(e.target.value)} maxLength={200} rows={2} placeholder="Escreva um recado para o grupo…" aria-label="Recado para o mural" />
          <div className="mural-form-pe">
            <div className="seg" role="radiogroup" aria-label="Cor do recado">
              {CORES_RECADO.map((c) => (
                <button key={c} type="button" role="radio" aria-checked={cor === c} aria-label={NOME_COR[c]} className={"mural-cor n-" + c + (cor === c ? " on" : "")} onClick={() => setCor(c)} />
              ))}
            </div>
            <small className="hint">{texto.length}/200</small>
            <button type="submit" className="btn sm" disabled={indo || !texto.trim()}>
              Pregar no mural
            </button>
          </div>
        </form>
        {ok === false ? (
          <p className="hint">O mural ainda não foi ligado no banco (seção 49 do seguranca.sql).</p>
        ) : recados.length ? (
          <ul className="mural-lista">
            {recados.map((r) => (
              <LinhaRecado key={r.id} r={r} />
            ))}
          </ul>
        ) : (
          <p className="hint">Nenhum recado ainda. Pregue o primeiro!</p>
        )}
      </div>
    </div>
  );
}
