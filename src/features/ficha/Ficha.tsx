"use client";
/*
 * Ficha do nanico (abre ao tocar num nanico na aba Nanicos): o boneco no quarto, à esquerda,
 * e os links do jogo (op.gg, smurf, Steam, com o Premier e a GC do CS) e os atributos votados, à direita. Fecha com Esc ou no X; o foco fica preso dentro.
 */
import { useEffect, useMemo, useRef, type KeyboardEvent as KE } from "react";
import { Avatar } from "@/components/ui/Avatar";
import { IcFechar, IcLoja, IcMochila } from "@/components/ui/icones";
import { TituloNanico } from "@/features/loja/Itens";
import { useEquipados, useLoja } from "@/features/loja/lojaDados";
import { tipoAcessorio } from "@/features/loja/Acessorio";
import { QuartoCena } from "@/features/quarto/QuartoCena";
import { paraCena } from "@/features/quarto/ArrumarQuarto";
import { abrirArrumar, iniciarQuartos, moveisDe, useQuartos } from "@/features/quarto/quartoDados";
import { abrirCarteira, useRanking } from "@/features/moedas/Ranking";
import { formatarMoedas, ordinal } from "@/lib/moedas";
import { verNanicadas } from "@/features/nanicos/NanicosView";
import { opggNick, opggOf, opggSmurfOf } from "@/features/perfil/opgg";
import { steamNome, steamOf } from "@/features/perfil/steam";
import { linksDe, useMidias } from "@/features/midias/midiasDados";
import { TIPOS_LINK } from "@/features/perfil/links";
import { artOf, bonecoOf, ehAmigo } from "@/lib/dados/nanicos";
import { friendOf, getApp, setApp, useApp } from "@/lib/store";
import type { Friend } from "@/lib/tipos";
import { AtributosFicha } from "./AtributosFicha";
import { NoSitio } from "./NoSitio";
import { carregarFicha, useFicha } from "./estado";
import { csTexto, eloDaFicha, textoElo } from "./numeros";
import { BrasaoElo, NivelGc } from "@/features/emblemas/brasao";
import { EmblemasFicha } from "@/features/emblemas/EmblemasFicha";
import { Quarto, type EquipQuarto } from "./Quarto";

/** Como deixar as horas da Steam visíveis (usado aqui e no Perfil). */
export function DicaSteamPrivada() {
  return (
    <details className="dica-steam">
      <summary>Como deixar as horas visíveis</summary>
      <p>
        Na Steam, abra o seu perfil, clique em <b>Editar perfil</b> e depois em <b>Privacidade</b>. Deixe <b>Meu perfil</b> e <b>Detalhes de jogos</b>{" "}
        como <b>Público</b>. As horas aparecem aqui na próxima atualização (até 6 horas).
      </p>
    </details>
  );
}

/** "No jogo": só os links (op.gg, o do smurf, Steam e os outros do perfil), sem números. */
function Links({ f }: { f: Friend }) {
  const csDados = useFicha((s) => s.porNanico[f.id]?.cs?.dados);
  const cs = csTexto(csDados);
  /* o elo do LoL (o mais alto entre solo e flex, fase 33); KDA, main e vitórias continuam de fora */
  const elo = eloDaFicha(useFicha((s) => s.porNanico[f.id]?.lol?.dados));
  const opgg = opggOf(f);
  const smurf = opggSmurfOf(f);
  const steam = steamOf(f);
  /* elo, Premier e GC vêm da função ficha-jogos (Riot e Leetify), guardados por 6 h */
  useEffect(() => {
    if (steam || opgg) void carregarFicha(f.id);
  }, [f.id, steam, opgg]);
  const extras = linksDe(useMidias((s) => s.links), f.id);
  return (
    <section className="ficha-sec">
      <h3>No jogo</h3>
      {elo && (
        <p className="ficha-cs ficha-lol">
          <BrasaoElo tier={elo.elo.tier} tam={26} />
          <b>LoL</b> {textoElo(elo.elo, elo.fila)}
        </p>
      )}
      {cs && (
        <p className="ficha-cs">
          {csDados?.gc ? <NivelGc n={csDados.gc} tam={22} /> : null}
          <b>CS2</b> {cs}
        </p>
      )}
      {!opgg && !smurf && !steam && !extras.length && <p className="hint">{f.name} ainda não colocou o op.gg no Perfil.</p>}
      {(opgg || smurf || steam || extras.length > 0) && (
        <div className="ficha-links">
          {opgg && (
            <a className="btn soft sm" href={opgg} target="_blank" rel="noopener noreferrer" title={opggNick(opgg)}>
              op.gg ↗
            </a>
          )}
          {smurf && (
            <a className="btn soft sm" href={smurf} target="_blank" rel="noopener noreferrer" title={opggNick(smurf)}>
              op.gg do smurf ↗
            </a>
          )}
          {steam && (
            <a className="btn soft sm" href={steam} target="_blank" rel="noopener noreferrer" title={steamNome(steam)}>
              Steam ↗
            </a>
          )}
          {extras.map((l) => (
            <a key={l.tipo} className="btn soft sm ficha-link" href={l.url} target="_blank" rel="noopener noreferrer">
              {TIPOS_LINK.find((d) => d.tipo === l.tipo)?.nome ?? l.tipo} ↗
            </a>
          ))}
        </div>
      )}
    </section>
  );
}

/** Selos embaixo do nome: posição no ranking com o saldo, e "você" na própria ficha. */
function Selos({ f, eu }: { f: Friend; eu: boolean }) {
  const lista = useRanking();
  const linha = lista?.find((l) => l.fid === f.id);
  if (!eu && !linha?.pos && !ehAmigo(f)) return null;
  return (
    <div className="ficha-selos">
      {eu && <span className="ficha-selo eu">você</span>}
      {ehAmigo(f) && <span className="ficha-selo amigo">amigo dos nanicos</span>}
      {linha?.pos && linha.saldo !== null && (
        <button type="button" className="ficha-selo" title="Abrir o ranking" onClick={() => {
            setApp({ fichaAberta: null });
            abrirCarteira();
          }}>
          <span className="hall-moeda" aria-hidden="true">$</span>
          {ordinal(linha.pos)} · {formatarMoedas(linha.saldo)}
        </button>
      )}
    </div>
  );
}

export function FichaNanico() {
  const fid = useApp((s) => s.fichaAberta);
  const friends = useApp((s) => s.friends);
  const f = friendOf(fid, friends);
  return f ? <FichaAberta key={f.id} f={f} /> : null;
}

function FichaAberta({ f }: { f: Friend }) {
  const caixa = useRef<HTMLDivElement>(null);
  const fecharRef = useRef<HTMLButtonElement>(null);
  const fechar = () => setApp({ fichaAberta: null });

  useEffect(() => {
    const antes = document.activeElement as HTMLElement | null;
    fecharRef.current?.focus();
    return () => antes?.focus?.();
  }, [f.id]);

  /* Esc fecha; Tab fica dentro da ficha */
  const tecla = (e: KE<HTMLDivElement>) => {
    if (e.key === "Escape") return fechar();
    if (e.key !== "Tab" || !caixa.current) return;
    const foco = [...caixa.current.querySelectorAll<HTMLElement>("a[href], button:not([disabled]), summary, input")];
    if (!foco.length) return;
    const [primeiro, ultimo] = [foco[0], foco[foco.length - 1]];
    if (e.shiftKey && document.activeElement === primeiro) {
      e.preventDefault();
      ultimo.focus();
    } else if (!e.shiftKey && document.activeElement === ultimo) {
      e.preventDefault();
      primeiro.focus();
    }
  };

  const art = artOf(f);
  const eu = f.id === getApp().myFid;
  const temQuarto = useQuartos((s) => !!f.user_id && !!s.quartos[f.user_id]);
  return (
    <div className="gate ficha-gate" role="dialog" aria-modal="true" aria-labelledby="fichaNome" onKeyDown={tecla} onClick={(e) => e.target === e.currentTarget && fechar()}>
      <div className="ficha-card" ref={caixa}>
        <div className="ficha-quarto">
          <QuartoDe f={f} arte={art ? { src: art.full, w: art.w, h: art.h } : null} />
        </div>
        <div className="ficha">
          <div className="ficha-topo">
            <Avatar f={f} size="lg" />
            <div className="ficha-nome">
              <h2 id="fichaNome">
                {f.name}
                <TituloNanico userId={f.user_id} />
              </h2>
              <Selos f={f} eu={eu} />
            </div>
            <button className="ficha-fechar" type="button" ref={fecharRef} aria-label="Fechar a ficha" title="Fechar" onClick={fechar}>
              <IcFechar />
            </button>
          </div>
          <NoSitio fid={f.id} eu={eu} />
          <EmblemasFicha fid={f.id} />
          <Links f={f} />
          {/* amigo dos nanicos não recebe votos nos atributos (o banco também recusa) */}
          {!ehAmigo(f) && <AtributosFicha f={f} eu={eu} />}
          {eu && (
            <div className="ficha-acoes">
              <button
                type="button"
                className="btn soft sm"
                onClick={() => {
                  fechar();
                  useLoja.setState({ mochilaAberta: true });
                }}
              >
                <IcMochila tam={16} /> Minha mochila
              </button>
              <button type="button" className="btn soft sm" onClick={() => setApp({ aba: "loja", fichaAberta: null })}>
                <IcLoja tam={16} /> Abrir a loja
              </button>
              {temQuarto && (
                <button
                  type="button"
                  className="btn soft sm"
                  onClick={() => {
                    fechar();
                    abrirArrumar();
                  }}
                >
                  Arrumar meu quarto
                </button>
              )}
            </div>
          )}
          <button
            className="linkish"
            type="button"
            onClick={() => {
              fechar();
              verNanicadas(f.id);
            }}
          >
            Ver as nanicadas de {f.name}
          </button>
        </div>
      </div>
    </div>
  );
}

/** O quarto com os itens que o nanico equipou na loja (a RLS deixa todo mundo ver os equipados). */
function QuartoDe({ f, arte }: { f: Friend; arte: { src: string; w: number; h: number } | null }) {
  const eq = useEquipados(f.user_id);
  const equip = useMemo(() => {
    const out: EquipQuarto = {};
    for (const k of ["cadeira", "mesa", "tapete", "poster", "planta", "parede", "luz"] as const) if (eq[k]?.dados.cor) out[k] = eq[k]!.dados.cor;
    return out;
  }, [eq]);
  /* quarto próprio (fase 34): com ele, o quarto de verdade, com os móveis onde a pessoa pôs; sem ele, o fixo de antes */
  const tamanho = useQuartos((s) => (f.user_id ? s.quartos[f.user_id] : undefined));
  const todos = useQuartos((s) => s.moveis);
  const itens = useLoja((s) => s.itens);
  useEffect(() => {
    void iniciarQuartos();
  }, []);
  const cena = useMemo(() => paraCena(moveisDe(todos, f.user_id), itens), [todos, f.user_id, itens]);
  const equipCena = useMemo(() => ({ parede: equip.parede, luz: equip.luz, poster: equip.poster }), [equip]);
  if (tamanho) return <QuartoCena tamanho={tamanho} equip={equipCena} moveis={cena} nome={f.name} boneco={bonecoOf(f)} />;
  return <Quarto nome={f.name} boneco={bonecoOf(f)} arte={arte} equip={equip} cabeca={tipoAcessorio(eq.cabeca?.dados.cor)} />;
}
