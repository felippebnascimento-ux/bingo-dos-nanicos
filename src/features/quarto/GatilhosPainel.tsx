"use client";
/*
 * O painel dos gatilhos (seção 59), só para o dono, no próprio quarto: a lista das regras (com apagar) e o
 * formulário QUANDO → ENTÃO. Os pisos são as coordenadas da grade (a porta é o 0,0).
 */
import { useEffect, useState } from "react";
import { apagarGatilho, criarGatilho, descrever, iniciarGatilhos, useGatilhos, type Gatilho } from "./gatilhos";

export function GatilhosPainel({ uid, tam }: { uid: string; tam: number }) {
  const [aberto, setAberto] = useState(false);
  const lista = useGatilhos((s) => s.lista).filter((g) => g.dono === uid);
  const [quando, setQuando] = useState<Gatilho["quando"]>("entra");
  const [entao, setEntao] = useState<Gatilho["entao"]>("aviso");
  const [piso, setPiso] = useState({ i: 1, j: 1 });
  const [alvo, setAlvo] = useState({ i: 0, j: 1 });
  const [texto, setTexto] = useState("");
  const [indo, setIndo] = useState(false);
  useEffect(iniciarGatilhos, []);
  const num = (v: string) => Math.max(0, Math.min(tam - 1, Math.floor(Number(v) || 0)));
  const valido = entao !== "aviso" || !!texto.trim();

  if (!aberto)
    return (
      <button type="button" className="btn soft sm gatilhos-abrir" onClick={() => setAberto(true)}>
        ⚙ Gatilhos ({lista.length})
      </button>
    );
  return (
    <div className="movel-painel gatilhos" role="dialog" aria-label="Gatilhos do quarto" onClick={(e) => e.stopPropagation()}>
      <header>
        <b>Gatilhos do quarto</b>
        <button type="button" className="perfil-fechar" aria-label="Fechar" onClick={() => setAberto(false)}>
          ×
        </button>
      </header>
      {!lista.length && <p className="hint">Nenhuma regra ainda. Monte a primeira abaixo.</p>}
      <ul className="gatilhos-lista">
        {lista.map((g) => (
          <li key={g.id}>
            <span>{descrever(g)}</span>
            <button type="button" className="linkish" aria-label="Apagar a regra" onClick={() => void apagarGatilho(g.id)}>
              apagar
            </button>
          </li>
        ))}
      </ul>
      <form
        className="gatilhos-form"
        onSubmit={async (e) => {
          e.preventDefault();
          if (!valido || indo) return;
          setIndo(true);
          if (await criarGatilho({ quando, piso: quando === "pisa" ? piso : null, entao, texto: entao === "aviso" ? texto.trim() : null, alvo: entao === "vai" ? alvo : null })) setTexto("");
          setIndo(false);
        }}
      >
        <label>
          Quando
          <select value={quando} onChange={(e) => setQuando(e.target.value as Gatilho["quando"])}>
            <option value="entra">alguém entra no quarto</option>
            <option value="pisa">alguém pisa no piso…</option>
          </select>
        </label>
        {quando === "pisa" && (
          <span className="gatilhos-piso">
            <input type="number" min={0} max={tam - 1} value={piso.i} onChange={(e) => setPiso({ ...piso, i: num(e.target.value) })} aria-label="Coluna do piso" />
            <input type="number" min={0} max={tam - 1} value={piso.j} onChange={(e) => setPiso({ ...piso, j: num(e.target.value) })} aria-label="Linha do piso" />
          </span>
        )}
        <label>
          Então
          <select value={entao} onChange={(e) => setEntao(e.target.value as Gatilho["entao"])}>
            <option value="aviso">aparece um aviso</option>
            <option value="campainha">toca a campainha</option>
            <option value="vai">vai para o piso…</option>
          </select>
        </label>
        {entao === "aviso" && <input value={texto} onChange={(e) => setTexto(e.target.value)} maxLength={80} placeholder="O texto do aviso" aria-label="Texto do aviso" />}
        {entao === "vai" && (
          <span className="gatilhos-piso">
            <input type="number" min={0} max={tam - 1} value={alvo.i} onChange={(e) => setAlvo({ ...alvo, i: num(e.target.value) })} aria-label="Coluna do piso de destino" />
            <input type="number" min={0} max={tam - 1} value={alvo.j} onChange={(e) => setAlvo({ ...alvo, j: num(e.target.value) })} aria-label="Linha do piso de destino" />
          </span>
        )}
        <button type="submit" className="btn sm" disabled={!valido || indo}>
          Criar regra
        </button>
      </form>
      <p className="hint">Os pisos são contados a partir da porta (0,0). A regra roda para quem entra ou pisa.</p>
    </div>
  );
}
