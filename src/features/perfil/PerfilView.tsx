"use client";
/* Aba Perfil: os links do meu op.gg e da minha Steam, as minhas moedas e a lista do op.gg de todo mundo (com quem está em partida). */
import { useEffect, useState } from "react";
import { Avatar } from "@/components/ui/Avatar";
import { riotEmJogo, useRiot } from "@/features/jogar/riot";
import { MoedasBloco } from "@/features/moedas/Moedas";
import { CampoLinks } from "./CampoLinks";
import { Missoes } from "@/features/missoes/Missoes";
import { carregarFicha, useFicha } from "@/features/ficha/estado";
import { DicaSteamPrivada } from "@/features/ficha/Ficha";
import { api, loadFriends } from "@/lib/dados";
import { friendOf, getApp, useApp } from "@/lib/store";
import { errMsg } from "@/lib/supabase";
import type { Friend } from "@/lib/tipos";
import { toast } from "@/lib/toast";
import { byName } from "@/lib/util";
import { cleanOpgg, opggNick, opggOf, opggSmurfOf } from "./opgg";
import { cleanSteam, steamOf } from "./steam";

/** Meu bloco: rosto, nome, o op.gg (e o do smurf), a Steam e os outros links. */
function MeuPerfil({ me }: { me: Friend }) {
  const smurfOk = useApp((s) => s.smurfOk);
  return (
    <>
      <div className="me-head">
        <Avatar f={me} size="lg" />
        <div>
          <b>{me.name}</b>
          <span>Seu perfil</span>
        </div>
      </div>
      <CampoOpgg me={me} smurf={false} />
      {smurfOk && <CampoOpgg me={me} smurf />}
      <CampoSteam me={me} />
      <CampoLinks />
    </>
  );
}

/** Link do op.gg (a conta principal ou a do smurf): a partida ao vivo procura nas duas. */
function CampoOpgg({ me, smurf }: { me: Friend; smurf: boolean }) {
  const cur = smurf ? opggSmurfOf(me) : opggOf(me);
  /* enquanto a pessoa edita, o texto fica aqui; fora isso, o campo mostra o link salvo */
  const [rascunho, setRascunho] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);
  const id = smurf ? "opggSmurf" : "opgg";

  const salvar = async (v: string) => {
    if (!getApp().opggOk) return toast("Para salvar o op.gg, rode o SQL novo no Supabase.");
    const url = cleanOpgg(v);
    if (url === null) return toast("Esse link não é do op.gg. Copie o endereço da página do seu perfil no op.gg.");
    setSalvando(true);
    try {
      const r = await api.saveOpgg(me.id, url || null, smurf);
      if (!r || !r.length) throw new Error("nada salvo");
      toast(url ? (smurf ? "op.gg do smurf salvo" : "op.gg salvo") : "Link tirado");
      await loadFriends().catch(() => {});
      setRascunho(null);
    } catch (err) {
      console.error(err);
      toast(errMsg(err, "Não deu para salvar. Confira a internet."));
    } finally {
      setSalvando(false);
    }
  };

  return (
    <form
      id={id + "Form"}
      className="opgg-form"
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
        salvar(rascunho ?? cur);
      }}
    >
      <label className="lbl" htmlFor={id + "Input"}>
        {smurf ? "op.gg do seu smurf (opcional)" : "Link do seu op.gg"}
      </label>
      <input
        id={id + "Input"}
        type="url"
        inputMode="url"
        maxLength={300}
        autoComplete="off"
        spellCheck={false}
        placeholder="https://op.gg/lol/summoners/br/Nome-BR1"
        value={rascunho ?? cur}
        onChange={(e) => setRascunho(e.target.value)}
      />
      {!smurf && <p className="hint opgg-dica">No op.gg, procure seu nome, abra seu perfil e copie o endereço da página.</p>}
      <div className="row">
        <button className="btn" type="submit" id={id + "Save"} disabled={salvando}>
          Salvar
        </button>
        {cur && (
          <a className="btn soft" id={id + "Open"} href={cur} target="_blank" rel="noopener noreferrer">
            {smurf ? "Abrir o smurf" : "Abrir meu op.gg"}
          </a>
        )}
      </div>
      {cur && (
        <button type="button" className="linkish" id={id + "Clear"} onClick={() => salvar("")}>
          Tirar o link
        </button>
      )}
    </form>
  );
}

/** Link da minha Steam (as horas de CS2 aparecem na ficha). Mesma gravação e mensagens do op.gg. */
function CampoSteam({ me }: { me: Friend }) {
  const steamOk = useApp((s) => s.steamOk);
  const cur = steamOf(me);
  const [rascunho, setRascunho] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);
  const naAba = useApp((s) => s.aba === "perfil");
  const privado = useFicha((s) => !!s.porNanico[me.id]?.steam?.dados?.privado);
  /* com o Perfil aberto, confere se a Steam está privada (a função guarda por 6 h) */
  useEffect(() => {
    if (naAba && cur) carregarFicha(me.id);
  }, [naAba, cur, me.id]);
  if (!steamOk) return null;

  const salvar = async (v: string) => {
    const url = cleanSteam(v);
    if (url === null)
      return toast("Esse link não é de um perfil da Steam. Use steamcommunity.com/id/seu-nome ou steamcommunity.com/profiles/seu-número.");
    setSalvando(true);
    try {
      const r = await api.saveSteam(me.id, url || null);
      if (!r || !r.length) throw new Error("nada salvo");
      toast(url ? "Steam salva" : "Link tirado");
      await loadFriends().catch(() => {});
      setRascunho(null);
    } catch (err) {
      console.error(err);
      toast(errMsg(err, "Não deu para salvar. Confira a internet."));
    } finally {
      setSalvando(false);
    }
  };

  return (
    <form
      id="steamForm"
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
        salvar(rascunho ?? cur);
      }}
    >
      <label className="lbl" htmlFor="steamInput">
        Link da sua Steam
      </label>
      <input
        id="steamInput"
        type="url"
        inputMode="url"
        maxLength={120}
        autoComplete="off"
        spellCheck={false}
        placeholder="https://steamcommunity.com/id/seu-nome"
        value={rascunho ?? cur}
        onChange={(e) => setRascunho(e.target.value)}
      />
      <p className="hint">Na Steam, abra o seu perfil e copie o endereço da página.</p>
      {privado && <DicaSteamPrivada />}
      <div className="row">
        <button className="btn" type="submit" disabled={salvando}>
          Salvar
        </button>
        {cur && (
          <a className="btn soft" href={cur} target="_blank" rel="noopener noreferrer">
            Abrir minha Steam
          </a>
        )}
      </div>
      {cur && (
        <button type="button" className="linkish" onClick={() => salvar("")}>
          Tirar o link
        </button>
      )}
    </form>
  );
}

export function PerfilView({ hidden }: { hidden: boolean }) {
  const friends = useApp((s) => s.friends);
  const myFid = useApp((s) => s.myFid);
  const jogos = useRiot((s) => s.jogos);
  const me = friendOf(myFid, friends);
  const emJogo = riotEmJogo(jogos);
  const list = friends.slice().sort((a, b) => (a.id === myFid ? -1 : b.id === myFid ? 1 : 0) || byName(a, b));

  return (
    <section id="view-perfil" className="inner" hidden={hidden}>
      <header className="hero">
        <h1>Perfil</h1>
      </header>
      <div className="perfil-grid">
        <div className="perfil-col">
          <div className="block me-block" id="meBlock">
            {me ? <MeuPerfil key={me.id} me={me} /> : <p className="status">Carregando…</p>}
          </div>
          <MoedasBloco />
          <Missoes />
        </div>
        <div className="block">
          <h2>op.gg dos nanicos</h2>
          <ul className="opgg-list" id="opggList">
            {list.map((f) => {
              const u = opggOf(f),
                smurf = opggSmurfOf(f),
                ch = emJogo.get(f.id);
              return (
                <li key={f.id} className={f.id === myFid ? "me" : ""}>
                  <Avatar f={f} />
                  <span className="nm">
                    {f.name}
                    {u && <small title={opggNick(u)}>{opggNick(u)}</small>}
                  </span>
                  {emJogo.has(f.id) && (
                    <span className="ingame-pill" title="Em partida agora">
                      EM PARTIDA{ch ? " · " + ch : ""}
                    </span>
                  )}
                  {u ? (
                    <a className="btn sm opgg-go" href={u} target="_blank" rel="noopener noreferrer" aria-label={`Abrir o op.gg de ${f.name}`}>
                      op.gg
                    </a>
                  ) : (
                    !smurf && <span className="opgg-none">sem link</span>
                  )}
                  {smurf && (
                    <a className="btn sm soft opgg-go" href={smurf} target="_blank" rel="noopener noreferrer" title={opggNick(smurf)} aria-label={`Abrir o op.gg do smurf de ${f.name}`}>
                      smurf
                    </a>
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      </div>
    </section>
  );
}
