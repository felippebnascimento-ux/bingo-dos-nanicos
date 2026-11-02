"use client";
/*
 * "Segundo os nanicos": as seis barras dos atributos votados e o formulário de votar.
 * O site só recebe médias e contagens (nunca quem votou). Some se o SQL dos atributos não rodou.
 */
import { useEffect, useState } from "react";
import { ATRIBUTOS, diaMes, notasPadrao, textoMedia, totalVotos, type Notas } from "@/features/nanicos/atributos";
import type { Friend } from "@/lib/tipos";
import { toast } from "@/lib/toast";
import { carregarAtributos, carregarMeuVoto, useAtributos, votar } from "./estado";

export function AtributosFicha({ f, eu }: { f: Friend; eu: boolean }) {
  const at = useAtributos((s) => s.todos?.[f.id]);
  const carregou = useAtributos((s) => s.todos !== null);
  const meu = useAtributos((s) => s.meu[f.id]);
  const [votando, setVotando] = useState(false);

  useEffect(() => {
    if (!carregou) carregarAtributos();
    if (!eu) carregarMeuVoto(f.id);
  }, [carregou, eu, f.id]);

  if (!at) return null;
  const n = totalVotos(at);
  const travado = !!meu?.travado && !!meu.mudaEm;

  return (
    <section className="ficha-sec">
      <h3>
        Segundo os nanicos
        <small>{n === 0 ? "ninguém votou ainda" : n === 1 ? "1 voto anônimo" : `${n} votos anônimos`}</small>
      </h3>
      {votando ? (
        <FormVoto f={f} inicial={meu?.notas ?? notasPadrao()} fechar={() => setVotando(false)} />
      ) : (
        <>
          <div className="attrs">
            {ATRIBUTOS.map((a) => {
              const m = at[a.chave];
              const valor = m.media ?? 0;
              return (
                <div className="attr" key={a.chave} title={a.dica}>
                  <span className="n">
                    {a.nome}
                    {a.cs2 && <small> CS2</small>}
                  </span>
                  <span
                    className="bar"
                    role="meter"
                    aria-label={`${a.nome}: ${textoMedia(m)}`}
                    aria-valuemin={0}
                    aria-valuemax={10}
                    aria-valuenow={m.media ?? undefined}
                  >
                    <i className={valor >= 9 ? "max" : ""} style={{ width: `${valor * 10}%` }} />
                  </span>
                  <span className={"v" + (m.media === null ? " poucos" : "")}>{textoMedia(m)}</span>
                </div>
              );
            })}
          </div>
          {!eu &&
            (travado ? (
              <p className="hint">
                Você já votou no {f.name}. Dá para mudar a partir de {diaMes(meu!.mudaEm!)}.
              </p>
            ) : (
              <div className="attr-rodape">
                <button className="btn sm" type="button" onClick={() => setVotando(true)}>
                  {meu?.notas ? `Mudar meu voto no ${f.name}` : `Votar no ${f.name}`}
                </button>
                <span className="hint">Ninguém vê quem votou. Dá para mudar o voto uma vez por semana.</span>
              </div>
            ))}
        </>
      )}
    </section>
  );
}

function FormVoto({ f, inicial, fechar }: { f: Friend; inicial: Notas; fechar: () => void }) {
  const [notas, setNotas] = useState<Notas>(inicial);
  const [salvando, setSalvando] = useState(false);

  const salvar = async () => {
    setSalvando(true);
    try {
      await votar(f.id, notas);
      toast("Votos salvos");
      fechar();
    } catch (e) {
      /* as mensagens do banco já dizem o que fazer ("Você já votou no … a partir de …") */
      const msg = e && typeof e === "object" && "message" in e ? String((e as { message: unknown }).message) : "";
      toast(msg && msg.length < 160 ? msg : "Não deu para salvar os votos. Confira a internet.");
    } finally {
      setSalvando(false);
    }
  };

  return (
    <form
      className="voto-form"
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
        salvar();
      }}
    >
      {ATRIBUTOS.map((a) => (
        <label className="voto-linha" key={a.chave}>
          <span className="n">
            {a.nome}
            {a.cs2 && <small> CS2</small>}
            <em>{a.dica}</em>
          </span>
          <input
            type="range"
            min={0}
            max={10}
            step={1}
            value={notas[a.chave]}
            aria-label={`${a.nome} do ${f.name}, de 0 a 10`}
            onChange={(e) => setNotas({ ...notas, [a.chave]: Number(e.target.value) })}
          />
          <b className="v">{notas[a.chave]}</b>
        </label>
      ))}
      <p className="hint">Depois de salvar, você só muda o voto no {f.name} daqui a uma semana.</p>
      <div className="row">
        <button className="btn soft" type="button" onClick={fechar}>
          Cancelar
        </button>
        <button className="btn" type="submit" disabled={salvando}>
          {salvando ? "Salvando…" : "Salvar votos"}
        </button>
      </div>
    </form>
  );
}
