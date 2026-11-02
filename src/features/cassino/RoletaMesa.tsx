"use client";
/*
 * Roleta de mesa (aba Cassino): no feltro, a roda e o painel do resultado (número, cor, o que ganhou, últimos
 * números e as cores das últimas rodadas); embaixo, a mesa para espalhar fichas (número, dúzia, coluna, cor,
 * par/ímpar, metade), as fichas de 5 a 100 e os botões de desfazer, limpar, dobrar e repetir.
 * O banco sorteia uma vez e paga todas as fichas (apostar_roleta_mesa); a roda só anima até a casa que ele mandou.
 * No celular a mesa fica em pé (3 colunas de números), com as mesmas posições calculadas.
 */
import { useMemo, useRef, useState, type CSSProperties } from "react";
import { ajustarSaldo, useCarteira } from "@/lib/carteira";
import { formatarMoedas } from "@/lib/moedas";
import { sb } from "@/lib/supabase";
import { toast } from "@/lib/toast";
import { carregar, msgDe, useCassino } from "./estado";
import {
  APOSTA_MAX, cobre, corDa, detalhesDaCasa, dobrarMesa, FICHAS, mesaValida, nomeLugar, porFicha, totalMesa, type Cor, type Ficha, type TipoAposta,
} from "./regras";
import { RodaRoleta, type Giro } from "./RodaRoleta";

type Resposta = { casa: number; cor: Cor; pagou: number; saldo: number; fichas: (Ficha & { pagou: number })[] };
const NOME_COR: Record<Cor, string> = { vermelho: "VERMELHO", preto: "PRETO", verde: "VERDE" };

/** Uma ficha de cassino desenhada em CSS (cor pelo valor). */
function FichaVisual({ v, mini }: { v: number; mini?: boolean }) {
  /* a cor é a da maior ficha que cabe no valor */
  const cor = [...FICHAS].reverse().find((x) => x <= v) ?? 5;
  return (
    <span className={"rm-ficha f" + cor + (mini ? " mini" : "")} aria-hidden="true">
      <i>{v}</i>
    </span>
  );
}

/** Um lugar da mesa: `pos` = linha/coluna na mesa deitada (computador) e em pé (celular). */
type Lugar = { tipo: TipoAposta; valor: number; rotulo: React.ReactNode; aria: string; cls: string; pos: [number, number, number, number, number, number, number, number] };

function lugares(): Lugar[] {
  const L: Lugar[] = [];
  /* [linha, coluna, altura, largura] deitada e [linha, coluna, altura, largura] em pé */
  L.push({ tipo: "numero", valor: 0, rotulo: "0", aria: "Número 0", cls: "rm-zero", pos: [1, 1, 3, 1, 1, 1, 1, 3] });
  for (let n = 1; n <= 36; n++) {
    const linha = 3 - ((n - 1) % 3), coluna = Math.floor((n - 1) / 3) + 2;
    L.push({ tipo: "numero", valor: n, rotulo: <b>{n}</b>, aria: `Número ${n}`, cls: "rm-num rm-" + corDa(n), pos: [linha, coluna, 1, 1, Math.floor((n - 1) / 3) + 2, ((n - 1) % 3) + 1, 1, 1] });
  }
  for (let v = 0; v < 3; v++) L.push({ tipo: "coluna", valor: v, rotulo: "2:1", aria: `${v + 1}ª coluna`, cls: "rm-fora", pos: [3 - v, 14, 1, 1, 14, v + 1, 1, 1] });
  for (let v = 0; v < 3; v++) L.push({ tipo: "duzia", valor: v, rotulo: `${v + 1}ª 12`, aria: `${v + 1}ª dúzia`, cls: "rm-fora", pos: [4, 2 + v * 4, 1, 4, 15, v + 1, 1, 1] });
  const fora: [TipoAposta, number, React.ReactNode, string][] = [
    ["metade", 0, "1-18", "1 a 18"],
    ["paridade", 0, "PAR", "Par"],
    ["cor", 0, <span key="v" className="rm-losango rm-vermelho" />, "Vermelho"],
    ["cor", 1, <span key="p" className="rm-losango rm-preto" />, "Preto"],
    ["paridade", 1, "ÍMPAR", "Ímpar"],
    ["metade", 1, "19-36", "19 a 36"],
  ];
  fora.forEach(([t, v, r, a], k) => L.push({ tipo: t, valor: v, rotulo: r, aria: a, cls: "rm-fora", pos: [5, 2 + k * 2, 1, 2, 16 + Math.floor(k / 3), (k % 3) + 1, 1, 1] }));
  return L;
}

/* os 49 lugares da mesa, calculados uma vez */
const LUGARES = lugares();

export function RoletaMesa() {
  const saldo = useCarteira((s) => s.carteira?.saldo);
  const historico = useCassino((s) => s.historico);
  const [mesa, setMesa] = useState<Ficha[]>([]);
  const [passos, setPassos] = useState<Ficha[][]>([]);
  const [ultima, setUltima] = useState<Ficha[]>([]);
  const [ficha, setFicha] = useState<number>(25);
  const [giro, setGiro] = useState<Giro | null>(null);
  const [girando, setGirando] = useState(false);
  const [resultado, setResultado] = useState<(Resposta & { total: number }) | null>(null);
  const resposta = useRef<(Resposta & { total: number }) | null>(null);


  /* as minhas últimas rodadas da roleta (mais nova primeiro), para os últimos números e as cores */
  const casas = useMemo(() => historico.filter((a) => a.jogo === "roleta").map((a) => Number(a.resultado.casa)).filter((n) => n >= 0 && n <= 36), [historico]);
  const ultimas50 = casas.slice(0, 50);
  const pct = (c: Cor) => (ultimas50.length ? Math.round((ultimas50.filter((n) => corDa(n) === c).length / ultimas50.length) * 100) : 0);

  /* toda mudança guarda a mesa de antes (para o Desfazer); a conta parte sempre da mesa mais nova */
  const mudar = (fazer: (m: Ficha[]) => Ficha[]) =>
    setMesa((m) => {
      setPassos((p) => [...p.slice(-40), m]);
      return fazer(m);
    });
  const total = totalMesa(mesa);
  const problema = mesaValida(mesa);
  const semSaldo = saldo !== undefined && total > saldo;

  const girar = async () => {
    if (girando || problema || semSaldo) return;
    setGirando(true);
    setResultado(null);
    try {
      const { data, error } = await sb().rpc("apostar_roleta_mesa", { p_fichas: mesa });
      if (error) throw error;
      resposta.current = { ...(data as Resposta), total };
      setUltima(mesa);
      setGiro((g) => ({ id: (g?.id ?? 0) + 1, casa: (data as Resposta).casa }));
    } catch (e) {
      toast(msgDe(e, "Não deu para girar. Confira a internet."));
      setGirando(false);
    }
  };
  const fimDoGiro = (casa: number) => {
    const r = resposta.current;
    resposta.current = null;
    setGirando(false);
    if (!r || r.casa !== casa) return;
    setResultado(r);
    ajustarSaldo(r.saldo);
    void carregar();
  };

  const naMesa = (t: TipoAposta, v: number) => mesa.find((f) => f.tipo === t && f.valor === v)?.aposta ?? 0;
  const ganhou = (t: TipoAposta, v: number) => resultado !== null && cobre(t, v, resultado.casa);
  const lucro = resultado ? resultado.pagou - resultado.total : 0;
  const vencedoras = resultado?.fichas.filter((f) => f.pagou > 0) ?? [];
  const corRes = resultado ? corDa(resultado.casa) : null;

  return (
    <div className="roleta rm">
      <div className="rm-topo">
        <RodaRoleta giro={giro} onFim={fimDoGiro} />
        <div className="rm-lado" aria-live="polite">
          <p className="rm-rotulo">Resultado</p>
          {resultado && corRes ? (
            <div className="rm-res">
              <span className={"rm-bola rm-" + corRes}>{resultado.casa}</span>
              <span>
                <b>{NOME_COR[corRes]}</b>
                <small>{detalhesDaCasa(resultado.casa)}</small>
              </span>
            </div>
          ) : (
            <p className="rm-espera">{girando ? "Girando…" : "Espalhe as fichas na mesa e gire."}</p>
          )}
          {resultado && (
            <div className={"rm-ganho" + (lucro > 0 ? " bom" : lucro < 0 ? " ruim" : "")}>
              <b>{lucro > 0 ? `+ Você ganhou ${formatarMoedas(lucro)} moedas` : resultado.pagou > 0 ? `Voltaram ${formatarMoedas(resultado.pagou)} de ${formatarMoedas(resultado.total)}` : `Não foi dessa vez: −${formatarMoedas(resultado.total)}`}</b>
              {vencedoras.length > 0 && <small>{vencedoras.map((f) => `${nomeLugar(f.tipo, f.valor)} (+${formatarMoedas(f.pagou - f.aposta)})`).join(" · ")}</small>}
            </div>
          )}
          {casas.length > 0 && (
            <>
              <p className="rm-rotulo">Últimos números</p>
              <ol className="rm-ultimos">
                {casas.slice(0, 12).map((n, k) => (
                  <li key={k} className={"rm-" + corDa(n) + (k === 0 ? " primeiro" : "")}>
                    {n}
                  </li>
                ))}
              </ol>
              <p className="rm-rotulo">Últimas {ultimas50.length} rodadas</p>
              <div className="rm-barra" aria-label={`Vermelho ${pct("vermelho")}%, preto ${pct("preto")}%, zero ${pct("verde")}%`}>
                <span className="rm-vermelho" style={{ width: `${pct("vermelho")}%` }} />
                <span className="rm-preto" style={{ width: `${pct("preto")}%` }} />
                <span className="rm-verde" style={{ width: `${pct("verde")}%` }} />
              </div>
              <p className="rm-barra-legenda">
                <span className="v">Vermelho {pct("vermelho")}%</span>
                <span>Preto {pct("preto")}%</span>
                <span className="z">Zero {pct("verde")}%</span>
              </p>
            </>
          )}
        </div>
      </div>

      <div className="rm-mesa" role="group" aria-label="Mesa: toque num lugar para pôr a ficha escolhida">
        {LUGARES.map((l) => {
          const v = naMesa(l.tipo, l.valor);
          const p = l.pos;
          const estilo = { "--r": p[0], "--c": p[1], "--h": p[2], "--w": p[3], "--rm": p[4], "--cm": p[5], "--hm": p[6], "--wm": p[7] } as CSSProperties;
          return (
            <button
              key={l.tipo + l.valor}
              type="button"
              className={"rm-lugar " + l.cls + (ganhou(l.tipo, l.valor) ? " ganhou" : "")}
              style={estilo}
              disabled={girando}
              aria-label={`${l.aria}${v ? `, ${v} moedas` : ""}`}
              onClick={() => mudar((m) => porFicha(m, l.tipo, l.valor, ficha))}
            >
              {l.rotulo}
              {v > 0 && <FichaVisual v={v} mini />}
            </button>
          );
        })}
      </div>

      <div className="rm-controles">
        <div className="rm-fichas" role="radiogroup" aria-label="Valor da ficha">
          {FICHAS.map((v) => (
            <button key={v} type="button" role="radio" aria-checked={ficha === v} className={ficha === v ? "sel" : undefined} onClick={() => setFicha(v)}>
              <FichaVisual v={v} />
            </button>
          ))}
        </div>
        <div className="rm-botoes">
          <button type="button" className="btn soft sm" disabled={girando || !passos.length} onClick={() => { setMesa(passos[passos.length - 1]); setPassos((p) => p.slice(0, -1)); }}>
            ↶ Desfazer
          </button>
          <button type="button" className="btn soft sm" disabled={girando || !mesa.length} onClick={() => mudar(() => [])}>
            Limpar
          </button>
          <button type="button" className="btn soft sm" disabled={girando || !mesa.length || mesa.every((f) => f.aposta >= APOSTA_MAX)} onClick={() => mudar(dobrarMesa)}>
            ×2 Dobrar
          </button>
          <button type="button" className="btn soft sm" disabled={girando || !ultima.length} onClick={() => mudar(() => ultima)}>
            ↻ Repetir
          </button>
        </div>
        <p className="rm-total">
          <small>Aposta total</small>
          <b>{formatarMoedas(total)} moedas</b>
        </p>
      </div>
      <button type="button" className="btn rm-girar" disabled={girando || !!problema || semSaldo} onClick={() => void girar()}>
        {girando ? "Girando…" : semSaldo ? "Sem moedas para essa aposta" : mesa.length ? `GIRAR · ${formatarMoedas(total)} MOEDAS` : "Ponha fichas na mesa"}
      </button>
      <p className="hint rm-pe">Número paga 35× · Dúzia e coluna pagam 2× · Cor, par/ímpar e metade pagam 1× · O 0 perde nas apostas de fora · Cada lugar até 100, até 1.000 por rodada</p>
    </div>
  );
}
