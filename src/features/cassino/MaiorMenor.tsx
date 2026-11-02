"use client";
/*
 * Maior ou menor (aba do Cassino), no feltro da roleta: 4 placas de dígitos que giram e param uma de cada vez,
 * os dois lados grandes (abaixo / acima de N), a barra colorida para mudar a chance, as caixas de chance,
 * multiplicador e prêmio, e as fichas com ½, ×2 e Máx. A regra é a mesma de antes (apostar_dado: sorteio de
 * 0 a 9999 no banco, paga 0,97 ÷ chance, a casa leva 3%); a animação só mostra o número que o banco mandou.
 */
import { useEffect, useRef, useState, type CSSProperties } from "react";
import { IcSemSom, IcVolume } from "@/components/ui/icones";
import { ajustarSaldo, useCarteira } from "@/lib/carteira";
import { formatarMoedas } from "@/lib/moedas";
import { sb } from "@/lib/supabase";
import { toast } from "@/lib/toast";
import { local, reduzMovimento } from "@/lib/util";
import { carregar, msgDe, useCassino } from "./estado";
import { APOSTA_MAX, APOSTA_MIN, chanceDado, chanceValida, FICHAS, pagamentoDado, type Lado } from "./regras";
import { FichaVisual } from "./RoletaMesa";

type Res = { numero: number; pagou: number; saldo: number; lado: Lado; n: number; aposta: number };

/** "tec" curto quando uma placa para. */
function tec(ctx: AudioContext | null, grave = false) {
  if (!ctx) return;
  const o = ctx.createOscillator(), g = ctx.createGain(), t = ctx.currentTime;
  o.type = "square";
  o.frequency.setValueAtTime(grave ? 300 : 900, t);
  g.gain.setValueAtTime(0.06, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + 0.06);
  o.connect(g).connect(ctx.destination);
  o.start(t);
  o.stop(t + 0.08);
}

const pct = (c: number) => `${(c * 100).toFixed(1).replace(".", ",")}%`;
const mult = (c: number) => `${(0.97 / c).toFixed(2).replace(".", ",")}×`;

export function MaiorMenor() {
  const saldo = useCarteira((s) => s.carteira?.saldo);
  const historico = useCassino((s) => s.historico);
  const [aposta, setAposta] = useState(10);
  const [lado, setLado] = useState<Lado>("acima");
  const [n, setN] = useState(5000);
  const [placas, setPlacas] = useState<string[]>(["?", "?", "?", "?"]);
  const [paradas, setParadas] = useState(4);
  const [res, setRes] = useState<Res | null>(null);
  const [jogando, setJogando] = useState(false);
  const [mudo, setMudo] = useState(() => local.get("roleta-som") === "0");
  const giro = useRef<ReturnType<typeof setInterval> | undefined>(undefined);
  useEffect(() => () => clearInterval(giro.current), []);

  const chance = chanceDado(lado, n);
  const ok = chanceValida(chance);
  const premio = ok ? pagamentoDado(lado, n, aposta) : 0;
  const ganhou = !!res && res.pagou > 0;

  const sortear = async () => {
    if (!ok || jogando || (saldo !== undefined && saldo < aposta)) return;
    setJogando(true);
    setRes(null);
    const ctx = mudo || reduzMovimento() ? null : (() => { try { return new AudioContext(); } catch { return null; } })();
    /* as placas giram enquanto o banco sorteia */
    let paradasAgora = 0;
    setParadas(0);
    if (!reduzMovimento()) giro.current = setInterval(() => setPlacas((p) => p.map((d, k) => (k < paradasAgora ? d : String(Math.floor(Math.random() * 10))))), 55);
    try {
      const { data, error } = await sb().rpc("apostar_dado", { p_aposta: aposta, p_lado: lado, p_n: n });
      if (error) throw error;
      const r = data as { numero: number; pagou: number; saldo: number };
      const digitos = String(r.numero).padStart(4, "0").split("");
      /* param uma de cada vez, da esquerda para a direita (~1,2 s) */
      for (let k = 0; k < 4; k++) {
        if (!reduzMovimento()) await new Promise((ok2) => setTimeout(ok2, 300));
        paradasAgora = k + 1;
        setParadas(k + 1);
        setPlacas((p) => p.map((d, i) => (i === k ? digitos[k] : d)));
        tec(ctx, k === 3);
      }
      clearInterval(giro.current);
      setRes({ ...r, lado, n, aposta });
      ajustarSaldo(r.saldo);
      void carregar();
    } catch (e) {
      clearInterval(giro.current);
      setPlacas(["?", "?", "?", "?"]);
      toast(msgDe(e, "Não deu para sortear. Confira a internet."));
    } finally {
      setParadas(4);
      setJogando(false);
      setTimeout(() => void ctx?.close(), 400);
    }
  };

  const ultimos = historico
    .filter((a) => a.jogo === "dado")
    .slice(0, 10)
    .map((a) => ({ numero: Number(a.resultado.numero), ganhou: a.pagou > 0, id: a.id }));
  /* a barra: a parte que ganha em verde, a que perde em vermelho */
  const corte = (n / 9999) * 100;
  const estiloBarra = { "--corte": `${corte}%` } as CSSProperties;
  const marcador = res ? (res.numero / 9999) * 100 : null;
  const faixa = (l: Lado) => (l === "abaixo" ? `sai de 0 a ${n - 1}` : `sai de ${n + 1} a 9999`);

  return (
    <div className="rm mm">
      <button type="button" className="av-mudo" aria-pressed={mudo} aria-label={mudo ? "Ligar o som" : "Desligar o som"} onClick={() => { setMudo(!mudo); local.set("roleta-som", mudo ? "1" : "0"); }}>
        {mudo ? <IcSemSom /> : <IcVolume />}
      </button>
      {ultimos.length > 0 && (
        <ol className="mm-hist" aria-label="Últimos números">
          {ultimos.map((u) => (
            <li key={u.id} className={u.ganhou ? "w" : "l"}>
              {u.numero}
            </li>
          ))}
        </ol>
      )}

      <div className="mm-placas" aria-live="polite" aria-label={res ? `Saiu ${res.numero}` : jogando ? "Sorteando" : "Esperando o sorteio"}>
        {placas.map((d, k) => (
          <span key={k} className={"mm-placa" + (k >= paradas ? " gira" : "") + (res ? (ganhou ? " win" : " lose") : "")}>
            {d}
          </span>
        ))}
      </div>
      <p className={"mm-sub" + (res ? (ganhou ? " win" : " lose") : "")}>
        {res
          ? `${res.lado === "abaixo" ? "▼ ABAIXO" : "▲ ACIMA"} DE ${res.n} · ${ganhou ? `VOCÊ GANHOU +${formatarMoedas(res.pagou - res.aposta)} MOEDAS` : `NÃO FOI DESSA VEZ · −${res.aposta} MOEDAS`}`
          : jogando
            ? "SORTEANDO…"
            : "ESCOLHA O LADO E SORTEIE"}
      </p>

      <div className="mm-lados" role="radiogroup" aria-label="Abaixo ou acima">
        {(["abaixo", "acima"] as const).map((l) => (
          <button key={l} type="button" role="radio" aria-checked={lado === l} className={lado === l ? "on" : undefined} disabled={jogando} onClick={() => setLado(l)}>
            <b>{l === "abaixo" ? `▼ ABAIXO DE ${n}` : `▲ ACIMA DE ${n}`}</b>
            <small>{faixa(l)}</small>
          </button>
        ))}
      </div>

      <p className="rm-rotulo mm-centro">Arraste para mudar a chance</p>
      <div className={"mm-barra " + lado} style={estiloBarra}>
        {marcador !== null && (
          <span className="mm-pino" style={{ left: `${marcador}%` }}>
            <b>{res!.numero}</b>
          </span>
        )}
        <input type="range" min={1} max={9998} value={n} disabled={jogando} onChange={(e) => setN(Number(e.target.value))} aria-label={`Número N: ${n}`} />
      </div>
      <p className="mm-escala">
        <span>0</span>
        <span>2500</span>
        <span>5000</span>
        <span>7500</span>
        <span>9999</span>
      </p>

      <div className="mm-caixas">
        <p>
          <small>Chance de ganhar</small>
          <b>{pct(chance)}</b>
        </p>
        <p>
          <small>Multiplicador</small>
          <b>{ok ? mult(chance) : "—"}</b>
        </p>
        <p>
          <small>Se ganhar, recebe</small>
          <b className="verde">{ok ? `${formatarMoedas(premio)} moedas` : "—"}</b>
        </p>
      </div>
      {!ok && <p className="mm-aviso">A chance precisa ficar entre 1% e 95%: arraste a barra.</p>}

      <div className="rm-controles">
        <div className="rm-fichas" role="radiogroup" aria-label="Valor da aposta">
          {FICHAS.map((v) => (
            <button key={v} type="button" role="radio" aria-checked={aposta === v} className={aposta === v ? "sel" : undefined} disabled={jogando} onClick={() => setAposta(v)}>
              <FichaVisual v={v} />
            </button>
          ))}
        </div>
        <div className="rm-botoes">
          <button type="button" className="btn soft sm" disabled={jogando} onClick={() => setAposta(Math.max(APOSTA_MIN, Math.floor(aposta / 2)))}>
            ½
          </button>
          <button type="button" className="btn soft sm" disabled={jogando} onClick={() => setAposta(Math.min(APOSTA_MAX, aposta * 2))}>
            ×2
          </button>
          <button type="button" className="btn soft sm" disabled={jogando} onClick={() => setAposta(Math.min(APOSTA_MAX, Math.max(APOSTA_MIN, saldo ?? APOSTA_MAX)))}>
            Máx
          </button>
        </div>
        <p className="rm-total">
          <small>Aposta</small>
          <b>{aposta} moedas</b>
        </p>
      </div>
      <button type="button" className="rm-girar" disabled={!ok || jogando || (saldo !== undefined && saldo < aposta)} onClick={() => void sortear()}>
        {jogando ? "SORTEANDO…" : saldo !== undefined && saldo < aposta ? "Sem moedas" : `SORTEAR · ${aposta} MOEDAS`}
      </button>
      <p className="hint rm-pe">Sorteio de 0 a 9999. Paga 0,97 dividido pela chance: quanto menor a chance, maior o prêmio. A casa leva 3%.</p>
    </div>
  );
}
