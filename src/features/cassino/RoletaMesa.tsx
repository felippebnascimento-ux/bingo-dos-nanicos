"use client";
/*
 * Roleta de mesa (aba Cassino): no feltro, a roda e o painel do resultado (número, cor, o que ganhou, últimos
 * números e as cores das últimas rodadas); embaixo, a mesa para espalhar fichas (número, dúzia, coluna, cor,
 * par/ímpar, metade), as fichas de 5 a 100 e os botões de desfazer, limpar, dobrar e repetir.
 * O banco sorteia uma vez e paga todas as fichas (apostar_roleta_mesa); a roda só anima até a casa que ele mandou.
 * No celular a mesa fica em pé (3 colunas de números), com as mesmas posições calculadas.
 */
import { useEffect, useMemo, useState, type CSSProperties } from "react";
import { useCarteira } from "@/lib/carteira";
import { formatarMoedas } from "@/lib/moedas";
import { toast } from "@/lib/toast";
import { msgDe } from "./estado";
import { conferirRodada, faltam, JANELA_MS, passouDaJanela, type Fase, type JogoMesa, type Pessoa, type Rodada } from "./mesa";
import { chamarMesa, useMesa } from "./mesaDados";
import {
  APOSTA_MAX, casaDaRoleta, cobre, corDa, detalhesDaCasa, dobrarMesa, FICHAS, mesaValida, nomeLugar, porFicha, totalMesa, type Cor, type Ficha, type TipoAposta,
} from "./regras";
import { RodaRoleta, type Giro } from "./RodaRoleta";

const NOME_COR: Record<Cor, string> = { vermelho: "VERMELHO", preto: "PRETO", verde: "VERDE" };

/** Uma ficha de cassino desenhada em CSS (cor pelo valor). */
export function FichaVisual({ v, mini }: { v: number; mini?: boolean }) {
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

export function RoletaMesa({ ativa = true }: { ativa?: boolean }) {
  const saldo = useCarteira((s) => s.carteira?.saldo);
  const { estado, ligada, agora, recarregar } = useMesa("roleta", ativa);
  /* fichas que eu ainda não mandei (as já mandadas vêm do banco, em estado.meu) */
  const [mesa, setMesa] = useState<Ficha[]>([]);
  const [passos, setPassos] = useState<Ficha[][]>([]);
  const [ultima, setUltima] = useState<Ficha[]>([]);
  const [ficha, setFicha] = useState<number>(25);
  const [enviando, setEnviando] = useState(false);
  /* a rodada em que a roda já parou na tela */
  const [parouEm, setParouEm] = useState<number | null>(null);
  const [conferida, setConferida] = useState<Record<number, string>>({});
  const relogio = useRelogio(ativa);

  const r = estado?.rodada ?? null;
  const fase = estado?.fase ?? "parada";
  const res = r?.resultado && typeof r.resultado.casa === "number" ? (r.resultado.casa as number) : null;

  /* o banco sorteou: a roda gira para todo mundo até a casa que ele mandou (o mesmo giro enquanto a rodada durar) */
  const rid = r?.id ?? null;
  const parada = fase === "parada";
  const giro: Giro | null = useMemo(() => (rid !== null && res !== null && !parada ? { id: rid, casa: res } : null), [rid, res, parada]);
  const girando = giro !== null && parouEm !== giro.id;
  const fimDoGiro = () => {
    if (giro) setParouEm(giro.id);
    void recarregar();
  };

  /* as minhas fichas nesta rodada (já cobradas) */
  const meu = estado?.meu ?? null;
  /* com a mesa parada (rodada acabou), as fichas dela saem da mesa; o resultado continua no painel */
  const minhas: Ficha[] = useMemo(() => {
    const e = meu?.escolha as { fichas?: unknown } | undefined;
    return fase !== "parada" && Array.isArray(e?.fichas) ? (e.fichas as Ficha[]) : [];
  }, [meu, fase]);
  const resultadoNaTela = r && parouEm === r.id && res !== null ? res : null;

  /* números das últimas rodadas da mesa (de todo mundo, mais nova primeiro) */
  const casas = useMemo(() => (estado?.ultimos ?? []).map((x) => Number(x.casa)).filter((n) => n >= 0 && n <= 36), [estado]);
  const pct = (c: Cor) => (casas.length ? Math.round((casas.filter((n) => corDa(n) === c).length / casas.length) * 100) : 0);

  const mudar = (fazer: (m: Ficha[]) => Ficha[]) =>
    setMesa((m) => {
      setPassos((p) => [...p.slice(-40), m]);
      return fazer(m);
    });
  const total = totalMesa(mesa);
  const problema = mesaValida(mesa);
  const semSaldo = saldo !== undefined && total > saldo;
  const fechada = fase === "jogo" || girando;
  const segundos = r && fase === "apostas" ? faltam(r.fechaEm, agora()) : 0;

  const apostar = async () => {
    if (enviando || fechada || problema || semSaldo || !mesa.length) return;
    setEnviando(true);
    try {
      await chamarMesa("mesa_apostar_roleta", { p_fichas: mesa });
      setUltima(mesa);
      setMesa([]);
      setPassos([]);
      await recarregar();
    } catch (e) {
      toast(msgDe(e, "Não deu para apostar. Confira a internet."));
    } finally {
      setEnviando(false);
    }
  };

  const conferirEsta = async () => {
    if (!r) return;
    const c = await conferirRodada("roleta", r);
    if (!c) return;
    const casa = casaDaRoleta(c.u);
    setConferida((x) => ({ ...x, [r.id]: `${c.hashOk ? "O segredo bate com o hash" : "O segredo NÃO bate com o hash"} · a conta dá ${casa}${casa === res ? ", igual ao que saiu" : ", DIFERENTE do que saiu"}` }));
  };

  const naMesa = (t: TipoAposta, v: number) =>
    (mesa.find((f) => f.tipo === t && f.valor === v)?.aposta ?? 0) + minhas.filter((f) => f.tipo === t && f.valor === v).reduce((s, f) => s + f.aposta, 0);
  const ganhou = (t: TipoAposta, v: number) => resultadoNaTela !== null && cobre(t, v, resultadoNaTela);
  const totalMeu = Number(meu?.aposta) || 0;
  const pagouMeu = Number(meu?.pagou) || 0;
  const pago = meu && meu.estado !== "aberta";
  const lucro = pagouMeu - totalMeu;
  const vencedoras = resultadoNaTela !== null ? minhas.filter((f) => cobre(f.tipo, f.valor, resultadoNaTela)) : [];
  const corRes = resultadoNaTela !== null ? corDa(resultadoNaTela) : null;
  void relogio;

  if (ligada === false) return <p className="block hint">A roleta ao vivo ainda não foi ligada no banco (seção 32 do seguranca.sql).</p>;

  return (
    <div className="roleta rm">
      <div className="rm-topo">
        <RodaRoleta giro={giro} onFim={fimDoGiro} />
        <div className="rm-lado" aria-live="polite">
          <MesaStatus jogo="roleta" fase={fase} rodada={r} agora={agora()} gente={estado?.gente.length ?? 0} />
          {resultadoNaTela !== null && corRes ? (
            <div className="rm-res">
              <span className={"rm-bola rm-" + corRes}>{resultadoNaTela}</span>
              <span>
                <b>{NOME_COR[corRes]}</b>
                <small>{detalhesDaCasa(resultadoNaTela)}</small>
              </span>
            </div>
          ) : (
            <p className="rm-espera">
              {fechada ? "Girando…" : fase === "apostas" ? (minhas.length ? "Você está na rodada. Pode pôr mais fichas." : "Ponha fichas e aposte para entrar.") : "Espalhe as fichas e aposte: a rodada abre para todo mundo."}
            </p>
          )}
          {resultadoNaTela !== null && totalMeu > 0 && (
            <div className={"rm-ganho" + (!pago ? "" : lucro > 0 ? " bom" : lucro < 0 ? " ruim" : "")}>
              <b>{!pago ? "Pagando…" : lucro > 0 ? `+ Você ganhou ${formatarMoedas(lucro)} moedas` : pagouMeu > 0 ? `Voltaram ${formatarMoedas(pagouMeu)} de ${formatarMoedas(totalMeu)}` : `Não foi dessa vez: −${formatarMoedas(totalMeu)}`}</b>
              {vencedoras.length > 0 && <small>{vencedoras.map((f) => nomeLugar(f.tipo, f.valor)).join(" · ")}</small>}
            </div>
          )}
          <NaMesa gente={estado?.gente ?? []} mostrarResultado={resultadoNaTela !== null} />
          {casas.length > 0 && (
            <>
              <p className="rm-rotulo">Últimos números da mesa</p>
              <ol className="rm-ultimos">
                {casas.slice(0, 12).map((n, k) => (
                  <li key={k} className={"rm-" + corDa(n) + (k === 0 ? " primeiro" : "")}>
                    {n}
                  </li>
                ))}
              </ol>
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
          {r && (
            <p className="rm-justo">
              Rodada #{r.id} · hash <span className="hash">{r.hash.slice(0, 12)}…</span>
              {r.segredo && (
                <button type="button" className="linkish" onClick={() => void conferirEsta()}>
                  Conferir
                </button>
              )}
              {conferida[r.id] && <small>{conferida[r.id]}</small>}
            </p>
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
              disabled={fechada}
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
          <button type="button" className="btn soft sm" disabled={fechada || !passos.length} onClick={() => { setMesa(passos[passos.length - 1]); setPassos((p) => p.slice(0, -1)); }}>
            ↶ Desfazer
          </button>
          <button type="button" className="btn soft sm" disabled={fechada || !mesa.length} onClick={() => mudar(() => [])}>
            Limpar
          </button>
          <button type="button" className="btn soft sm" disabled={fechada || !mesa.length || mesa.every((f) => f.aposta >= APOSTA_MAX)} onClick={() => mudar(dobrarMesa)}>
            ×2 Dobrar
          </button>
          <button type="button" className="btn soft sm" disabled={fechada || !ultima.length} onClick={() => mudar(() => ultima)}>
            ↻ Repetir
          </button>
        </div>
        <p className="rm-total">
          <small>{minhas.length ? `Na rodada: ${formatarMoedas(totalMeu)} · nova aposta` : "Aposta"}</small>
          <b>{formatarMoedas(total)} moedas</b>
        </p>
      </div>
      <button type="button" className="btn rm-girar" disabled={enviando || fechada || !!problema || semSaldo || !mesa.length} onClick={() => void apostar()}>
        {fechada
          ? "Girando… aposte na próxima rodada"
          : semSaldo
            ? "Sem moedas para essa aposta"
            : !mesa.length
              ? fase === "apostas"
                ? `Gira em ${segundos} s · ponha fichas para entrar`
                : "Ponha fichas na mesa"
              : fase === "apostas"
                ? `APOSTAR · ${formatarMoedas(total)} MOEDAS · gira em ${segundos} s`
                : `APOSTAR · ${formatarMoedas(total)} MOEDAS`}
      </button>
      <p className="hint rm-pe">
        Mesa ao vivo: a primeira aposta abre a rodada e todo mundo tem {JANELA_MS.roleta / 1000} s para entrar · Número paga 35× · Dúzia e coluna pagam 2× · Cor, par/ímpar e metade pagam 1× · O 0 perde nas apostas de fora · Até 1.000 por rodada
      </p>
    </div>
  );
}

/** Um tique a cada 250 ms (para as contagens na tela). */
export function useRelogio(ativo = true) {
  const [t, setT] = useState(0);
  useEffect(() => {
    if (!ativo) return;
    const i = setInterval(() => setT((x) => x + 1), 250);
    return () => clearInterval(i);
  }, [ativo]);
  return t;
}

const TEXTO_FASE: Record<JogoMesa, Record<Fase, string>> = {
  roleta: { parada: "Mesa esperando a primeira aposta", apostas: "Apostas abertas", jogo: "Girando", resultado: "Resultado" },
  aviao: { parada: "Esperando o primeiro passageiro", apostas: "Embarque aberto", jogo: "No ar", resultado: "Pousou" },
};

/** Faixa de cima de toda mesa ao vivo: o que está acontecendo, a contagem e quantos estão na rodada. */
export function MesaStatus({ jogo, fase, rodada, agora, gente }: { jogo: JogoMesa; fase: Fase; rodada: Rodada | null; agora: number; gente: number }) {
  const abertas = fase === "apostas" && rodada;
  return (
    <div className={"mesa-status " + fase}>
      <span className="mesa-ao-vivo">
        <i aria-hidden="true" /> AO VIVO
      </span>
      <b>{TEXTO_FASE[jogo][fase]}</b>
      {abertas && <span className="mesa-conta">{faltam(rodada.fechaEm, agora)} s</span>}
      {gente > 0 && fase !== "parada" && <small>{gente === 1 ? "1 na rodada" : `${gente} na rodada`}</small>}
      {abertas && (
        <span className="mesa-barra" aria-hidden="true">
          <span style={{ width: `${(1 - passouDaJanela(rodada, agora)) * 100}%` }} />
        </span>
      )}
    </div>
  );
}

/** Quem está na rodada da roleta (ou do avião): nome, quanto e, no fim, quanto levou. */
export function NaMesa({ gente, mostrarResultado, titulo = "Na rodada" }: { gente: Pessoa[]; mostrarResultado: boolean; titulo?: string }) {
  if (!gente.length) return null;
  return (
    <>
      <p className="rm-rotulo">{titulo}</p>
      <ul className="mesa-gente">
        {gente.map((p, k) => (
          <li key={k} className={p.eu ? "eu" : undefined}>
            <span className="av-av" aria-hidden="true">
              {p.nome[0]}
            </span>
            <span className="mesa-nome">
              {p.nome}
              {p.eu && <small> (você)</small>}
            </span>
            <span className="mesa-valor">
              {p.aposta}
              {p.fichas ? <small> · {p.fichas === 1 ? "1 ficha" : `${p.fichas} fichas`}</small> : null}
            </span>
            {mostrarResultado && p.estado !== "aberta" && (
              <b className={p.pagou > 0 ? "ok" : "ruim"}>{p.pagou > 0 ? `+${formatarMoedas(p.pagou - p.aposta)}` : `−${p.aposta}`}</b>
            )}
          </li>
        ))}
      </ul>
    </>
  );
}
