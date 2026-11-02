"use client";
/*
 * Caça-níquel (aba do Cassino), no feltro da roleta: uma máquina de verdade, com gabinete vinho, letreiro e
 * lâmpadas, 3 rolos que giram com desfoque e param um de cada vez no símbolo que o banco sorteou, alavanca,
 * painel de LED e a tabela de pagamentos sempre à vista. A regra é a mesma de antes (apostar_slot: um sorteio
 * por rolo no banco, a casa leva cerca de 8%); a animação só mostra o que o banco mandou.
 */
import { useEffect, useRef, useState, type CSSProperties } from "react";
import { IcSemSom, IcVolume } from "@/components/ui/icones";
import { ajustarSaldo, useCarteira } from "@/lib/carteira";
import { MARCA } from "@/lib/dados/nanicos";
import { formatarMoedas } from "@/lib/moedas";
import { sb } from "@/lib/supabase";
import { toast } from "@/lib/toast";
import { local, reduzMovimento } from "@/lib/util";
import { carregar, msgDe, useCassino } from "./estado";
import { comboSlot, FICHAS } from "./regras";
import { FichaVisual } from "./RoletaMesa";

type Rolo = { tira: string[]; y: number; dur: number; fase: "parado" | "loop" | "parando" };
type Res = { simbolos: string[]; pagou: number; aposta: number; combo: string | null };

const LINHAS: { k: string; nome: string; sims: string[] }[] = [
  { k: "tres_bola", nome: "3 bolas", sims: ["bola", "bola", "bola"] },
  { k: "tres_moeda", nome: "3 moedas", sims: ["moeda", "moeda", "moeda"] },
  { k: "tres_rosto", nome: "3 rostos iguais", sims: ["n9", "n9", "n9"] },
  { k: "duas_moedas", nome: "2 moedas", sims: ["moeda", "moeda"] },
  { k: "uma_moeda", nome: "1 moeda", sims: ["moeda"] },
];
const LAMPADAS = 14;
const espera = (ms: number) => new Promise((ok) => setTimeout(ok, ms));

/** Um símbolo: o rosto do nanico n1…n14, a bola de bingo (a moeda B) ou a moeda $. */
function Simbolo({ s, mini }: { s: string; mini?: boolean }) {
  if (s === "moeda")
    return (
      <span className={"cn-moeda" + (mini ? " mini" : "")} role="img" aria-label="moeda">
        $
      </span>
    );
  const src = s === "bola" ? MARCA : `/arte/nanicos/${Number(s.slice(1))}-rosto.webp`;
  // eslint-disable-next-line @next/next/no-img-element
  return <img className={"cn-img" + (mini ? " mini" : "")} src={src} alt={s === "bola" ? "bola de bingo" : "rosto de um nanico"} draggable={false} />;
}

/* ---------- sons (Web Audio, nada de arquivo) ---------- */
function bip(ctx: AudioContext | null, freq: number, ini: number, dur: number, tipo: OscillatorType = "square", vol = 0.05) {
  if (!ctx) return;
  const o = ctx.createOscillator(), g = ctx.createGain(), t = ctx.currentTime + ini;
  o.type = tipo;
  o.frequency.setValueAtTime(freq, t);
  g.gain.setValueAtTime(vol, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + dur);
  o.connect(g).connect(ctx.destination);
  o.start(t);
  o.stop(t + dur + 0.02);
}
/** "clac" do rolo travando */
const clac = (ctx: AudioContext | null) => {
  bip(ctx, 140, 0, 0.07, "square", 0.08);
  bip(ctx, 900, 0, 0.03, "triangle", 0.04);
};
/** musiquinha da vitória; a do prêmio máximo é mais longa */
function festa(ctx: AudioContext | null, grande: boolean) {
  const notas = grande ? [523, 659, 784, 1047, 784, 1047, 1319, 1568] : [523, 659, 784, 1047];
  notas.forEach((f, i) => bip(ctx, f, i * 0.11, 0.16, "triangle", 0.07));
}

export function CacaNiquel() {
  const { rolos, pagamentos } = useCassino();
  const saldo = useCarteira((s) => s.carteira?.saldo);
  const [aposta, setAposta] = useState(10);
  const [maq, setMaq] = useState<Rolo[]>(() => ["n9", "bola", "moeda"].map((s) => ({ tira: ["n3", s, "n5"], y: 0, dur: 0, fase: "parado" })));
  const [res, setRes] = useState<Res | null>(null);
  const [jogando, setJogando] = useState(false);
  const [suspense, setSuspense] = useState(false);
  const [led, setLed] = useState(0);
  const [puxou, setPuxou] = useState(false);
  const [rapido, setRapido] = useState(false);
  const [auto, setAuto] = useState(0);
  const [mudo, setMudo] = useState(() => local.get("roleta-som") === "0");
  const [chuva, setChuva] = useState(0);
  const autoRef = useRef(0);
  const contaLed = useRef<ReturnType<typeof setInterval> | undefined>(undefined);
  useEffect(() => () => clearInterval(contaLed.current), []);

  const simbolos = rolos.length ? rolos.map((r) => r.simbolo) : ["n1", "n2", "bola", "moeda"];
  const qualquer = () => simbolos[Math.floor(Math.random() * simbolos.length)];
  const mudar = (k: number, r: Partial<Rolo>) => setMaq((m) => m.map((x, i) => (i === k ? { ...x, ...r } : x)));
  const semSaldo = saldo !== undefined && saldo < aposta;

  /** Um giro inteiro. Devolve false se não deu para girar (sem saldo, erro). */
  const girar = async (): Promise<boolean> => {
    if (jogando || !rolos.length || semSaldo) return false;
    setJogando(true);
    setRes(null);
    setSuspense(false);
    clearInterval(contaLed.current);
    setLed(0);
    setPuxou(true);
    setTimeout(() => setPuxou(false), 450);
    const calmo = reduzMovimento();
    const ctx = mudo ? null : (() => { try { return new AudioContext(); } catch { return null; } })();
    bip(ctx, 220, 0, 0.12, "sawtooth", 0.03);
    /* os rolos giram enquanto o banco sorteia */
    if (!calmo) setMaq((m) => m.map(() => ({ tira: Array.from({ length: 8 }, qualquer), y: 0, dur: 0, fase: "loop" })));
    const { data, error } = await sb().rpc("apostar_slot", { p_aposta: aposta });
    if (error) {
      toast(msgDe(error, "Não deu para girar. Confira a internet."));
      setMaq((m) => m.map((x) => ({ ...x, fase: "parado", tira: x.tira.slice(0, 3), y: 0 })));
      setJogando(false);
      void ctx?.close();
      return false;
    }
    const r = data as { simbolos: string[]; pagou: number; saldo: number };
    const s = r.simbolos;
    /* param da esquerda para a direita, ~0,4 s um do outro; com dois iguais parados, o terceiro demora mais */
    const passo = rapido ? 180 : 400, dur = rapido ? 450 : 850;
    const doisIguais = s[0] === s[1] || (s[0] === "moeda" && s[1] === "moeda");
    await Promise.all(
      [0, 1, 2].map(async (k) => {
        const extra = k === 2 && doisIguais ? (rapido ? 500 : 1300) : 0;
        if (calmo) return mudar(k, { tira: [qualquer(), s[k], qualquer()], y: 0, dur: 0, fase: "parado" });
        await espera(k * passo + (k === 2 && doisIguais ? passo : 0));
        if (k === 2 && doisIguais) setSuspense(true);
        const giros = Math.round((dur + extra) / 70);
        const tira = [...Array.from({ length: giros }, qualquer), qualquer(), s[k], qualquer()];
        mudar(k, { tira, y: 0, dur: 0, fase: "parando" });
        await espera(30);
        mudar(k, { y: tira.length - 3, dur: dur + extra });
        await espera(dur + extra);
        clac(ctx);
        mudar(k, { fase: "parado" });
      }),
    );
    setSuspense(false);
    const combo = comboSlot(s[0], s[1], s[2]);
    setRes({ simbolos: s, pagou: r.pagou, aposta, combo });
    ajustarSaldo(r.saldo);
    void carregar();
    if (r.pagou > 0) {
      const grande = combo === "tres_bola";
      festa(ctx, grande);
      if (!calmo) setChuva((c) => c + 1);
      /* o LED conta até o prêmio */
      const passos = calmo ? 1 : 24;
      let i = 0;
      contaLed.current = setInterval(() => {
        i++;
        setLed(Math.round((r.pagou * i) / passos));
        if (i >= passos) clearInterval(contaLed.current);
      }, 35);
    } else bip(ctx, 160, 0, 0.25, "sine", 0.05);
    setTimeout(() => void ctx?.close(), 1500);
    setJogando(false);
    return true;
  };

  /* giro automático: 10 giros seguidos (para no fim, sem saldo, com erro ou no botão) */
  const automatico = async () => {
    if (autoRef.current) {
      autoRef.current = 0;
      setAuto(0);
      return;
    }
    autoRef.current = 10;
    setAuto(10);
    while (autoRef.current > 0) {
      const ok = await girar();
      if (!ok || !autoRef.current) break;
      autoRef.current--;
      setAuto(autoRef.current);
      if (autoRef.current) await espera(rapido ? 500 : 1100);
    }
    autoRef.current = 0;
    setAuto(0);
  };
  useEffect(() => () => void (autoRef.current = 0), []);

  const ganhou = !!res && res.pagou > 0;
  const textoLed = jogando
    ? suspense
      ? "SERÁ?…"
      : "GIRANDO…"
    : res
      ? ganhou
        ? `+${formatarMoedas(led)} MOEDAS`
        : "NÃO FOI DESSA VEZ"
      : "BOA SORTE";
  const lampadas = (lado: string) => (
    <div className={"cn-lampadas " + lado} aria-hidden="true">
      {Array.from({ length: LAMPADAS }, (_, i) => (
        <i key={i} style={{ "--i": i } as CSSProperties} />
      ))}
    </div>
  );

  return (
    <div className={"rm cn" + (ganhou ? " festa" : "") + (rapido ? " rapido" : "")}>
      <button type="button" className="av-mudo" aria-pressed={mudo} aria-label={mudo ? "Ligar o som" : "Desligar o som"} onClick={() => { setMudo(!mudo); local.set("roleta-som", mudo ? "1" : "0"); }}>
        {mudo ? <IcSemSom /> : <IcVolume />}
      </button>

      <div className="cn-grid">
        <div className="cn-maq-caixa">
          <div className={"cn-maq" + (ganhou ? " ganhou" : "") + (res?.combo === "tres_bola" ? " maximo" : "")}>
            {lampadas("cima")}
            <p className="cn-letreiro">CAÇA-NÍQUEL</p>
            <div className={"cn-janela" + (suspense ? " suspense" : "")} aria-live="polite" aria-label={res ? `Rolos: ${res.simbolos.join(", ")}` : jogando ? "Rolos girando" : "Rolos parados"}>
              {maq.map((r, k) => (
                <div key={k} className="cn-rolo">
                  <div
                    className={"cn-tira " + r.fase}
                    style={{ "--y": r.y, "--dur": `${r.dur}ms` } as CSSProperties}
                  >
                    {(r.fase === "loop" ? [...r.tira, ...r.tira] : r.tira).map((s, i) => (
                      <span key={i} className={"cn-casa" + (ganhou && r.fase === "parado" && i === r.y + 1 ? " vence" : "")}>
                        <Simbolo s={s} />
                      </span>
                    ))}
                  </div>
                </div>
              ))}
              <span className="cn-linha" aria-hidden="true" />
            </div>
            <p className={"cn-led" + (ganhou ? " ganhou" : "")} aria-live="polite">
              {textoLed}
            </p>
            {lampadas("baixo")}
            <button type="button" className={"cn-alavanca" + (puxou ? " puxa" : "")} aria-label="Puxar a alavanca e girar" disabled={jogando || semSaldo} onClick={() => void girar()}>
              <i />
              <b />
            </button>
          </div>
          {chuva > 0 && ganhou && (
            <div key={chuva} className={"cn-moedas" + (res?.combo === "tres_bola" ? " chuva" : "")} aria-hidden="true">
              {Array.from({ length: res?.combo === "tres_bola" ? 40 : 12 }, (_, i) => (
                <i key={i} style={{ "--x": `${(i * 37) % 100}%`, "--d": `${(i % 7) * 70}ms`, "--dx": `${((i * 53) % 140) - 70}px` } as CSSProperties}>
                  $
                </i>
              ))}
            </div>
          )}
        </div>

        <div className="cn-tabela">
          <p className="rm-rotulo">Tabela de pagamentos</p>
          <ul>
            {LINHAS.map((l) => (
              <li key={l.k} className={ganhou && res?.combo === l.k ? "on" : undefined}>
                <span className="cn-sims">
                  {l.sims.map((s, i) => (
                    <Simbolo key={i} s={s} mini />
                  ))}
                </span>
                <span className="cn-nome">{l.nome}</span>
                <b>{pagamentos[l.k] ? `${pagamentos[l.k]}×` : "…"}</b>
              </li>
            ))}
          </ul>
          <p className="hint rm-pe">Três rostos do mesmo nanico pagam 80×. A casa leva cerca de 8%.</p>
        </div>
      </div>

      <div className="rm-controles">
        <div className="rm-fichas" role="radiogroup" aria-label="Valor da aposta">
          {FICHAS.map((v) => (
            <button key={v} type="button" role="radio" aria-checked={aposta === v} className={aposta === v ? "sel" : undefined} disabled={jogando || auto > 0} onClick={() => setAposta(v)}>
              <FichaVisual v={v} />
            </button>
          ))}
        </div>
        <div className="rm-botoes">
          <button type="button" className={"btn soft sm cn-auto" + (auto ? " on" : "")} disabled={(!auto && (jogando || semSaldo)) || !rolos.length} onClick={() => void automatico()}>
            {auto ? `Parar automático (${auto})` : "Giro automático ×10"}
          </button>
          <button type="button" className={"btn soft sm cn-rapido" + (rapido ? " on" : "")} aria-pressed={rapido} onClick={() => setRapido(!rapido)}>
            ⚡ Rápido
          </button>
        </div>
      </div>
      <button type="button" className="rm-girar" disabled={jogando || semSaldo || auto > 0 || !rolos.length} onClick={() => void girar()}>
        {jogando ? "GIRANDO…" : semSaldo ? "Sem moedas" : `GIRAR · ${aposta} MOEDAS`}
      </button>
    </div>
  );
}
