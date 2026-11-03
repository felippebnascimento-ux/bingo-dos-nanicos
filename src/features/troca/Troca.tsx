"use client";
/*
 * Janela da troca entre nanicos (seção 54, como no Habbo): dois lados, cada um com itens da mochila e moedas.
 * Mexer no meu lado manda a oferta na hora (e desfaz os "aceito" dos dois); quando os dois aceitam, o banco troca
 * tudo de uma vez. Fechar a janela não cancela: a pílula embaixo reabre.
 */
import { useEffect, useMemo, useRef, useState } from "react";
import { Avatar } from "@/components/ui/Avatar";
import { useSure } from "@/components/ui/useSure";
import { useLoja, useMinhaMochila } from "@/features/loja/lojaDados";
import { useQuartos } from "@/features/quarto/quartoDados";
import { useCarteira } from "@/lib/carteira";
import { formatarMoedas } from "@/lib/moedas";
import { useApp } from "@/lib/store";
import { aceitarTroca, cancelarTroca, iniciarTrocas, ladosDe, oferecer, useTroca } from "./trocas";

export function TrocaJanela() {
  const troca = useTroca((s) => s.troca);
  const aberta = useTroca((s) => s.aberta);
  const myUid = useApp((s) => s.myUid);
  const fase = useApp((s) => s.fase);
  useEffect(() => {
    if (fase === "app") iniciarTrocas();
  }, [fase]);
  if (!troca || !myUid) return null;
  const { outro } = ladosDe(troca, myUid);
  if (!aberta) return <PilulaTroca outro={outro} />;
  return <Janela key={troca.id} />;
}

function PilulaTroca({ outro }: { outro: string }) {
  const f = useApp((s) => s.friends.find((x) => x.user_id === outro));
  return (
    <button type="button" className="troca-pilula" onClick={() => useTroca.setState({ aberta: true })}>
      🔁 Troca com {f?.name ?? "um nanico"}
    </button>
  );
}

function Janela() {
  const troca = useTroca((s) => s.troca)!;
  const myUid = useApp((s) => s.myUid)!;
  const friends = useApp((s) => s.friends);
  const itens = useLoja((s) => s.itens);
  const mochila = useMinhaMochila();
  const moveis = useQuartos((s) => s.moveis);
  const saldo = useCarteira((s) => s.carteira?.saldo ?? 0);
  const { meu, dele, outro } = ladosDe(troca, myUid);
  const f = friends.find((x) => x.user_id === outro);
  const nome = (id: string) => itens?.find((x) => x.id === id)?.nome ?? id;
  const sair = useSure();

  /* o que eu tenho livre: a mochila menos os móveis colocados no quarto; o quarto em si não troca */
  const livres = useMemo(() => {
    const colocados: Record<string, number> = {};
    for (const m of Object.values(moveis)) if (m.userId === myUid) colocados[m.itemId] = (colocados[m.itemId] ?? 0) + 1;
    return mochila
      .filter((l) => itens?.find((x) => x.id === l.itemId)?.espaco !== "quarto")
      .map((l) => ({ id: l.itemId, livre: l.qtd - (colocados[l.itemId] ?? 0) }))
      .filter((l) => l.livre > 0);
  }, [mochila, moveis, myUid, itens]);

  /* o meu lado, mexido aqui e mandado ao banco 400 ms depois do último toque */
  const [rascunho, setRascunho] = useState({ itens: meu.itens, moedas: meu.moedas });
  const envio = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  useEffect(() => () => clearTimeout(envio.current), []);
  const mudar = (novo: { itens: Record<string, number>; moedas: number }) => {
    setRascunho(novo);
    clearTimeout(envio.current);
    envio.current = setTimeout(() => void oferecer(troca.id, novo.itens, novo.moedas), 400);
  };
  const passo = (id: string, d: number, max: number) => {
    const n = Math.max(0, Math.min(max, Math.min(20, (rascunho.itens[id] ?? 0) + d)));
    const novo = { ...rascunho.itens };
    if (n) novo[id] = n;
    else delete novo[id];
    mudar({ ...rascunho, itens: novo });
  };

  return (
    <div className="gate troca-gate" role="dialog" aria-modal="true" aria-label={`Troca com ${f?.name ?? "um nanico"}`} onClick={(e) => e.target === e.currentTarget && useTroca.setState({ aberta: false })}>
      <div className="troca">
        <header className="troca-topo">
          {f && <Avatar f={f} size="xs" />}
          <b>Troca com {f?.name ?? "um nanico"}</b>
          <button type="button" className="perfil-fechar" aria-label="Fechar a janela (a troca continua)" onClick={() => useTroca.setState({ aberta: false })}>
            ×
          </button>
        </header>
        <div className="troca-lados">
          <section className={"troca-lado" + (meu.ok ? " ok" : "")}>
            <h3>Você oferece {meu.ok && <span className="troca-ok">✔ aceitou</span>}</h3>
            {livres.length === 0 && <p className="hint">Nada livre na mochila (móveis colocados no quarto não entram).</p>}
            <ul className="troca-itens">
              {livres.map((l) => (
                <li key={l.id} className={rascunho.itens[l.id] ? "on" : undefined}>
                  <span>{nome(l.id)}</span>
                  <span className="troca-passo">
                    <button type="button" aria-label={`Tirar ${nome(l.id)}`} disabled={!rascunho.itens[l.id]} onClick={() => passo(l.id, -1, l.livre)}>
                      −
                    </button>
                    <b>
                      {rascunho.itens[l.id] ?? 0}/{l.livre}
                    </b>
                    <button type="button" aria-label={`Pôr ${nome(l.id)}`} disabled={(rascunho.itens[l.id] ?? 0) >= l.livre} onClick={() => passo(l.id, 1, l.livre)}>
                      +
                    </button>
                  </span>
                </li>
              ))}
            </ul>
            <label className="troca-moedas">
              Moedas
              <input
                type="number"
                min={0}
                max={saldo}
                inputMode="numeric"
                value={rascunho.moedas || ""}
                placeholder="0"
                onChange={(e) => mudar({ ...rascunho, moedas: Math.max(0, Math.min(saldo, Math.floor(Number(e.target.value) || 0))) })}
              />
            </label>
          </section>
          <section className={"troca-lado" + (dele.ok ? " ok" : "")}>
            <h3>
              {f?.name ?? "O outro"} oferece {dele.ok && <span className="troca-ok">✔ aceitou</span>}
            </h3>
            {!Object.keys(dele.itens).length && !dele.moedas && <p className="hint">Ainda nada.</p>}
            <ul className="troca-itens">
              {Object.entries(dele.itens).map(([id, n]) => (
                <li key={id} className="on">
                  <span>{nome(id)}</span>
                  <b>×{n}</b>
                </li>
              ))}
            </ul>
            {dele.moedas > 0 && <p className="troca-moedas-dele">+ {formatarMoedas(dele.moedas)} moedas</p>}
          </section>
        </div>
        <p className="hint troca-dica">Mudar a oferta desfaz os dois “aceitou”. A troca só acontece quando os dois aceitam a mesma oferta.</p>
        <div className="troca-botoes">
          <button type="button" className={"btn soft sm" + (sair.sure ? " sure" : "")} onClick={() => sair.pedir() && void cancelarTroca(troca.id)}>
            {sair.sure ? "Confirmar" : "Cancelar troca"}
          </button>
          <button type="button" className="btn" disabled={meu.ok} onClick={() => void aceitarTroca(troca.id)}>
            {meu.ok ? (dele.ok ? "Trocando…" : `Esperando ${f?.name ?? "o outro"}`) : "Aceitar"}
          </button>
        </div>
      </div>
    </div>
  );
}
