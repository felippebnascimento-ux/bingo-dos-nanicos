"use client";
/*
 * Visitas ao quarto próprio (fase 35): no lugar do cômodo do K-FOFO, o quarto de alguém com todo mundo que está nele
 * andando e sentando (os bonecos de bonecos.ts, que já filtram pela cena). Tocar num piso livre anda; tocar num
 * móvel de sentar senta no lugar mais perto. As setas andam um piso. "Ir para o meu quarto" fica no canto do K-FOFO.
 */
import { useEffect, useMemo, useState, type KeyboardEvent } from "react";
import { andarAte, andarUmPiso, useHall } from "@/features/hall/bonecos";
import { useEquipados, useLoja } from "@/features/loja/lojaDados";
import { IcQuarto } from "@/components/ui/icones";
import { bonecoOf } from "@/lib/dados/nanicos";
import { umPorNanico } from "@/lib/presenca";
import { friendDaPresenca, MY_KEY, useApp } from "@/lib/store";
import { assentoDoQuarto, gradeDoQuarto } from "./grade";
import { QuartoCena, type BonecoCena } from "./QuartoCena";
import { moveisDe, useQuartos } from "./quartoDados";
import { irParaQuarto, paraCena } from "./visita";
import { CORES_PIXO, ehCenaEspecial, gradeEspecial, GOL_RUA, moveisDaCena, NOME_CENA, portasDoCorredor, TAM_CENA, type CorPixo } from "./cenas";
import { iniciarPixacoes, pixar, usePixacoes } from "./pixacoes";
import { abrirDuelo } from "@/features/cassino/dueloDados";
import { soNanicos } from "@/lib/dados/nanicos";
import { toast } from "@/lib/toast";

const SETAS: Record<string, [number, number]> = { ArrowRight: [1, 0], ArrowLeft: [-1, 0], ArrowDown: [0, 1], ArrowUp: [0, -1] };

export function QuartoVisita({ dono }: { dono: string }) {
  const friends = useApp((s) => s.friends);
  /* a rua e o corredor (cenas.ts) usam a mesma tela, com o desenho e a grade fixos deles */
  const especial = ehCenaEspecial(dono) ? dono : null;
  const f = especial ? undefined : friends.find((x) => x.id === dono);
  const tamQuarto = useQuartos((s) => (f?.user_id ? s.quartos[f.user_id] : undefined));
  const tamanho = especial ? TAM_CENA[especial] : tamQuarto;
  const quartos = useQuartos((s) => s.quartos);
  const todos = useQuartos((s) => s.moveis);
  const itens = useLoja((s) => s.itens);
  const eq = useEquipados(f?.user_id);
  const pixos = usePixacoes((s) => s.lista);
  useEffect(() => {
    if (especial === "banheiro") void iniciarPixacoes();
  }, [especial]);
  const portas = useMemo(() => (especial === "corredor" ? portasDoCorredor(soNanicos(friends), (uid) => !!quartos[uid]) : undefined), [especial, friends, quartos]);
  const bonecos = useHall((s) => s.bonecos);
  const brilhos = useHall((s) => s.brilhos);
  const cena = useMemo(() => (especial ? [...moveisDaCena(especial)] : paraCena(moveisDe(todos, f?.user_id), itens)), [especial, todos, f?.user_id, itens]);
  const grade = useMemo(() => (especial ? gradeEspecial(especial) : tamanho ? gradeDoQuarto(tamanho, cena) : null), [especial, tamanho, cena]);
  const equip = useMemo(() => ({ parede: eq.parede?.dados.cor, luz: eq.luz?.dados.cor, poster: eq.poster?.dados.cor }), [eq]);
  const vistos = useMemo<BonecoCena[]>(
    () =>
      bonecos.map((b) => {
        const a = grade && b.senta ? assentoDoQuarto(grade, b.senta) : null;
        return {
          key: b.key,
          nome: b.name,
          folha: bonecoOf(friendDaPresenca(b, friends) || { name: b.name }),
          i: b.i,
          j: b.j,
          sentido: a?.olha ?? b.sentido,
          quadro: a ? 0 : b.quadro,
          sentado: a ? { i: a.i, j: a.j, movel: a.movel } : null,
          eu: b.key === MY_KEY,
          uid: friendDaPresenca(b, friends)?.user_id ?? null,
        };
      }),
    [bonecos, grade, friends],
  );

  if ((!especial && !f) || !tamanho || !grade) return <p className="hint quarto-visita-vazio">Abrindo o quarto…</p>;
  const nomeCena = especial ? NOME_CENA[especial] : `Quarto de ${f!.name}`;

  /* sentar: o lugar daquele móvel mais perto de onde estou */
  const sentarNo = (movel: number) => {
    /* na rua, o gol abre o pênalti x1 */
    if (movel === GOL_RUA) return abrirDuelo();
    const eu = bonecos.find((b) => b.key === MY_KEY);
    const lugares = grade.assentos.filter((a) => a.movel === movel);
    if (!lugares.length) return;
    const longe = (a: (typeof lugares)[number]) => (eu ? Math.hypot(a.chegar.i - eu.i, a.chegar.j - eu.j) : 0);
    const perto = lugares.reduce((x, y) => (longe(y) < longe(x) ? y : x));
    andarAte(perto.chegar, perto.id);
  };
  const tocarPiso = (i: number, j: number) => {
    if (grade.livre(i, j)) return andarAte({ i, j });
    const m = cena.find((x) => i >= x.ret.i && i < x.ret.i + x.ret.w && j >= x.ret.j && j < x.ret.j + x.ret.d);
    if (m) sentarNo(m.id);
  };
  const tecla = (e: KeyboardEvent<HTMLDivElement>) => {
    const d = SETAS[e.key];
    if (!d || e.target !== e.currentTarget) return;
    e.preventDefault();
    andarUmPiso(d[0], d[1]);
  };

  return (
    <div
      className={"hall-palco quarto-visita quarto-vars" + (especial ? " cena-" + especial : "")}
      tabIndex={0}
      role="group"
      aria-label={`${nomeCena}. Toque no chão ou use as setas para andar.`}
      onKeyDown={tecla}
    >
      <QuartoCena
        tamanho={tamanho}
        equip={equip}
        moveis={cena}
        nome={especial ? undefined : f!.name}
        aoTocarPiso={tocarPiso}
        aoTocarMovel={sentarNo}
        bonecos={vistos}
        brilhos={brilhos}
        tipo={especial ?? "quarto"}
        portas={portas}
        aoTocarPorta={(fid) => (portas?.find((p) => p.fid === fid)?.aberta ? irParaQuarto(fid) : toast("Esse nanico ainda não comprou o quarto: a porta está fechada."))}
        aoTocarSaida={especial ? () => irParaQuarto(null) : undefined}
        pixos={especial === "banheiro" ? pixos : undefined}
      />
      {especial === "banheiro" && <PixarForm />}
    </div>
  );
}

/** "Ir para o meu quarto" (só para quem tem quarto e não está nele). */
export function BotaoMeuQuarto() {
  const myUid = useApp((s) => s.myUid);
  const myFid = useApp((s) => s.myFid);
  const meuQuarto = useApp((s) => s.meuQuarto);
  const tem = useQuartos((s) => !!(myUid && s.quartos[myUid]));
  if (!tem || !myFid || meuQuarto === myFid) return null;
  return (
    <button type="button" className="btn soft sm hall-meu-quarto" onClick={() => irParaQuarto(myFid)}>
      Ir para o meu quarto
    </button>
  );
}

/** Em cima da cena do quarto: de quem é e o botão de voltar. */
export function TopoQuarto({ dono }: { dono: string }) {
  const nome = useApp((s) => s.friends.find((f) => f.id === dono)?.name ?? "");
  const eu = useApp((s) => s.myFid === dono);
  return (
    <header className="hero quarto-topo">
      <h1>{ehCenaEspecial(dono) ? NOME_CENA[dono] : eu ? "Meu quarto" : `Quarto do ${nome}`}</h1>
      {!ehCenaEspecial(dono) && (
        <button type="button" className="btn soft sm" onClick={() => irParaQuarto("corredor")}>
          Corredor dos quartos
        </button>
      )}
      <button type="button" className="btn soft sm" onClick={() => irParaQuarto(null)}>
        Voltar ao K-FOFO
      </button>
    </header>
  );
}

/** Na ficha de quem tem quarto: quantos estão lá agora e o botão de visitar (o meu: "Ir para o meu quarto"). */
export function FichaQuarto({ fid, uid, eu }: { fid: string; uid: string | null | undefined; eu: boolean }) {
  const tem = useQuartos((s) => !!(uid && s.quartos[uid]));
  const online = useApp((s) => s.online);
  const meuQuarto = useApp((s) => s.meuQuarto);
  const n = useMemo(() => umPorNanico(online, MY_KEY).filter((p) => (p.chaves.includes(MY_KEY) ? meuQuarto : p.quarto) === fid).length, [online, meuQuarto, fid]);
  if (!tem) return null;
  return (
    <div className="ficha-visita">
      {n > 0 && <span className="hint">{n === 1 ? "1 pessoa no quarto agora" : `${n} pessoas no quarto agora`}</span>}
      {meuQuarto !== fid && (
        <button type="button" className="btn soft sm" onClick={() => irParaQuarto(fid)}>
          <IcQuarto tam={16} /> {eu ? "Ir para o meu quarto" : "Visitar o quarto"}
        </button>
      )}
    </div>
  );
}

const NOME_PIXO: Record<CorPixo, string> = { preto: "Preto", vermelho: "Vermelho", azul: "Azul", verde: "Verde", rosa: "Rosa", amarelo: "Amarelo" };

/** No banheiro: escreva na parede (até 60 letras, numa cor de spray). Fica para sempre. */
function PixarForm() {
  const [texto, setTexto] = useState("");
  const [cor, setCor] = useState<CorPixo>("preto");
  const [indo, setIndo] = useState(false);
  const ir = async () => {
    if (indo || !texto.trim()) return;
    setIndo(true);
    if (await pixar(texto, cor)) setTexto("");
    setIndo(false);
  };
  return (
    <form
      className="pixar-form"
      onClick={(e) => e.stopPropagation()}
      onSubmit={(e) => {
        e.preventDefault();
        void ir();
      }}
    >
      <input value={texto} onChange={(e) => setTexto(e.target.value)} maxLength={60} placeholder="Pixe a parede (fica para sempre)…" aria-label="O que pixar na parede do banheiro" autoComplete="off" />
      <div className="seg" role="radiogroup" aria-label="Cor do spray">
        {CORES_PIXO.map((c) => (
          <button key={c} type="button" role="radio" aria-checked={cor === c} aria-label={NOME_PIXO[c]} className={"pixar-cor p-" + c + (cor === c ? " on" : "")} onClick={() => setCor(c)} />
        ))}
      </div>
      <button type="submit" className="btn sm" disabled={indo || !texto.trim()}>
        Pixar
      </button>
    </form>
  );
}
