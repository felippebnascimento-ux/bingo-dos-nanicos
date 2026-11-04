"use client";
/*
 * Cartão de perfil como o do Discord (seção 70): abre ao clicar no nome ou no rosto de alguém (chat, membros, voz).
 * Rosto grande com a bolinha do status, nome, @, cargos, o recado, o que está jogando (pela Riot), onde está, e os
 * botões de mandar mensagem (Direct do InstaNanico, para quem tem o Celular), ver a ficha e o volume (na voz).
 * Também o menu do meu status (Online, Ausente, Não perturbe, Invisível e o recado).
 */
import { useEffect, useMemo, useRef, useState } from "react";
import { Avatar } from "@/components/ui/Avatar";
import { useTemCelular } from "@/features/celular/Celular";
import { abrirCelular, abrirConversa } from "@/features/celular/rede";
import { riotEmJogo, useRiot } from "@/features/jogar/riot";
import { OpcoesVoz } from "@/features/live/MenuPessoa";
import { castigoAte, useVozMod } from "@/features/live/vozMod";
import { NOTA_MAX, salvarNota, useNotas } from "@/features/status/notas";
import { nomeDaSala } from "@/features/salas/trocar";
import { cargosDe, MODOS, mudarStatus, NOME_SITUACAO, recadoValido, situacao, useStatus, type Modo } from "@/features/status/status";
import { useNanicosOnline } from "./People";
import { getApp, MY_KEY, setApp, useApp } from "@/lib/store";
import type { Presence } from "@/lib/tipos";

/** Abre o cartão de alguém (friend id) perto de onde tocou; `nota` já abre escrevendo a nota. */
export function abrirCartao(fid: string | null | undefined, e: { clientX: number; clientY: number }, nota = false) {
  if (!fid) return;
  setApp({ cartao: { fid, x: e.clientX, y: e.clientY, nota } });
}

/** A nota sobre a pessoa, como no Discord: só eu vejo; grava ao sair do campo. */
function CampoNota({ fid, foco }: { fid: string; foco: boolean }) {
  const salva = useNotas((s) => s.porFid[fid] ?? "");
  const [texto, setTexto] = useState(salva);
  return (
    <label className="cartao-nota">
      <span className="cartao-sec">Nota</span>
      <textarea
        rows={2}
        maxLength={NOTA_MAX}
        autoFocus={foco}
        placeholder="Clique para adicionar uma nota (só você vê)"
        value={texto}
        onChange={(e) => setTexto(e.target.value)}
        onBlur={() => texto !== salva && salvarNota(fid, texto)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            (e.target as HTMLTextAreaElement).blur();
          }
        }}
      />
    </label>
  );
}

/** A bolinha do status no canto do rosto (verde, amarelo, vermelho ou cinza). */
export function PontoStatus({ sit }: { sit: "off" | "on" | "aus" | "np" }) {
  return <i className={"ponto-status " + sit} role="img" aria-label={NOME_SITUACAO[sit]} title={NOME_SITUACAO[sit]} />;
}

/** A situação de alguém agora (para a bolinha), pela presença e pelo status. */
export function useSituacao(fid: string | null | undefined): "off" | "on" | "aus" | "np" {
  const pessoas = useNanicosOnline();
  useStatus((s) => s.porUser);
  useStatus((s) => s.meu);
  const f = useApp((s) => s.friends.find((x) => x.id === fid));
  const p = pessoas.find((x) => x.fid === fid) ?? null;
  return situacao(f?.user_id, p as Presence | null, !!p?.chaves.includes(MY_KEY));
}

export function CartaoPerfil() {
  const cartao = useApp((s) => s.cartao);
  const friends = useApp((s) => s.friends);
  const salas = useApp((s) => s.salas);
  const myFid = useApp((s) => s.myFid);
  const naVoz = useApp((s) => !!s.myVozSid);
  const pessoas = useNanicosOnline();
  const mods = useStatus((s) => s.mods);
  const porUser = useStatus((s) => s.porUser);
  const jogos = useRiot((s) => s.jogos);
  const temCelular = useTemCelular();
  const caixa = useRef<HTMLDivElement>(null);
  const f = friends.find((x) => x.id === cartao?.fid);
  const p = pessoas.find((x) => x.fid === cartao?.fid) ?? null;
  const sit = useSituacao(cartao?.fid);
  const castigos = useVozMod((s) => s.castigos);
  const campeao = useMemo(() => (cartao ? riotEmJogo(jogos).get(cartao.fid) : undefined), [jogos, cartao]);
  useEffect(() => {
    if (!cartao) return;
    const fora = (e: PointerEvent) => caixa.current && !caixa.current.contains(e.target as Node) && setApp({ cartao: null });
    const esc = (e: KeyboardEvent) => e.key === "Escape" && setApp({ cartao: null });
    /* o toque que abriu não fecha: só os próximos */
    const t = setTimeout(() => document.addEventListener("pointerdown", fora), 0);
    document.addEventListener("keydown", esc);
    return () => {
      clearTimeout(t);
      document.removeEventListener("pointerdown", fora);
      document.removeEventListener("keydown", esc);
    };
  }, [cartao]);
  if (!cartao || !f) return null;
  const eu = f.id === myFid;
  const st = f.user_id ? porUser[f.user_id] : undefined;
  const ateCastigo = f.user_id ? castigoAte(castigos[f.user_id]) : 0;
  const onde = p?.sala ? nomeDaSala(p.sala, salas) : p ? "No lobby" : null;
  const naMinhaVoz = !eu && naVoz && !!p?.voz && p.sala === getApp().minhaSala;
  /* cabe na tela: perto do toque, sem sair pela borda */
  /* o meu é mais alto (tem o status); se não couber, rola por dentro */
  const L = 300, A = Math.min(eu ? 680 : 440, window.innerHeight - 16);
  const left = Math.max(8, Math.min(cartao.x + 12, window.innerWidth - L - 8));
  const top = Math.max(8, Math.min(cartao.y - 40, window.innerHeight - A - 8));
  const arroba = f.name.toLowerCase().normalize("NFD").replace(/[^a-z0-9]+/g, "");
  return (
    <div ref={caixa} className="cartao-perfil" role="dialog" aria-label={`Perfil de ${f.name}`} style={{ left, top, width: L }}>
      <div className="cartao-faixa" aria-hidden="true" />
      <div className="cartao-rosto">
        <Avatar f={f} size="lg" />
        <PontoStatus sit={sit} />
      </div>
      <div className="cartao-corpo">
        <b className="cartao-nome">{f.name}</b>
        <small className="cartao-at">
          @{arroba} · {NOME_SITUACAO[sit]}
        </small>
        {recadoValido(st) && (
          <p className="cartao-recado">
            {st!.emoji} {st!.texto}
          </p>
        )}
        {campeao !== undefined && (
          <p className="cartao-jogando">
            <span className="cartao-sec">Jogando</span>
            🎮 League of Legends{campeao ? ` · ${campeao}` : ""}
          </p>
        )}
        {onde && (
          <p className="cartao-onde">
            <span className="cartao-sec">Onde está</span>
            {onde}
            {p?.voz ? " · na voz" : ""}
            {p?.live ? " · AO VIVO" : ""}
          </p>
        )}
        <div className="cartao-cargos">
          <span className="cartao-sec">Cargos</span>
          {cargosDe(f, mods).map((c) => (
            <span key={c.nome} className={"cargo " + c.cls}>
              <i aria-hidden="true" />
              {c.nome}
            </span>
          ))}
        </div>
        {ateCastigo > 0 && (
          <p className="cartao-castigo">
            <span className="cartao-sec">De castigo</span>
            Sem falar no chat e na voz até {new Date(ateCastigo).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
          </p>
        )}
        {!eu && <CampoNota key={f.id} fid={f.id} foco={!!cartao.nota} />}
        {naMinhaVoz && (
          <div className="cartao-voz vz-balao-dentro">
            <OpcoesVoz fid={f.id} nome={f.name} />
          </div>
        )}
        <div className="cartao-bts">
          {!eu && temCelular && f.user_id && (
            <button
              type="button"
              className="btn sm"
              onClick={() => {
                setApp({ cartao: null });
                abrirCelular();
                abrirConversa(f.user_id!);
              }}
            >
              Mandar mensagem
            </button>
          )}
          <button
            type="button"
            className="btn soft sm"
            onClick={() => setApp({ cartao: null, fichaAberta: f.id })}
          >
            Ver a ficha
          </button>
        </div>
        {eu && <MeuStatus />}
      </div>
    </div>
  );
}

const DURACOES: { nome: string; ms: number | null }[] = [
  { nome: "Não limpar", ms: null },
  { nome: "30 minutos", ms: 30 * 60_000 },
  { nome: "1 hora", ms: 3600_000 },
  { nome: "4 horas", ms: 4 * 3600_000 },
  { nome: "Hoje", ms: -1 },
];
const fimDoDia = () => {
  const d = new Date();
  d.setHours(23, 59, 59, 0);
  return d.getTime();
};

/** O meu status: os 4 modos e o recado (com emoji e quando some). */
export function MeuStatus() {
  const meu = useStatus((s) => s.meu);
  const [texto, setTexto] = useState(meu.texto);
  const [emoji, setEmoji] = useState(meu.emoji);
  const [dur, setDur] = useState(0);
  return (
    <div className="meu-status">
      <span className="cartao-sec">Seu status</span>
      <div className="meu-status-modos" role="radiogroup" aria-label="Status">
        {MODOS.map((m) => (
          <button key={m.id} type="button" role="radio" aria-checked={meu.modo === m.id} className={meu.modo === m.id ? "on" : undefined} title={m.dica} onClick={() => void mudarStatus({ modo: m.id as Modo })}>
            <PontoStatus sit={m.id === "inv" ? "off" : m.id} />
            {m.nome}
          </button>
        ))}
      </div>
      <form
        className="meu-recado"
        onSubmit={(e) => {
          e.preventDefault();
          const ms = DURACOES[dur].ms;
          void mudarStatus({ texto, emoji, ate: !texto.trim() && !emoji ? null : ms === null ? null : ms < 0 ? fimDoDia() : Date.now() + ms });
        }}
      >
        <span className="meu-recado-linha">
          <select aria-label="Emoji do recado" value={emoji} onChange={(e) => setEmoji(e.target.value)}>
            {["", "🎮", "🍻", "😴", "📚", "💼", "🔥", "🎧", "🏖️", "🤒"].map((x) => (
              <option key={x} value={x}>
                {x || "—"}
              </option>
            ))}
          </select>
          <input aria-label="Recado" maxLength={60} placeholder="Defina um recado (ex.: jogando ranked)" value={texto} onChange={(e) => setTexto(e.target.value)} />
        </span>
        <span className="meu-recado-linha">
          <select aria-label="Limpar depois de" value={dur} onChange={(e) => setDur(Number(e.target.value))}>
            {DURACOES.map((d, i) => (
              <option key={d.nome} value={i}>
                Limpar: {d.nome}
              </option>
            ))}
          </select>
          <button type="submit" className="btn sm">
            Salvar
          </button>
          {(meu.texto || meu.emoji) && (
            <button type="button" className="btn soft sm" onClick={() => (setTexto(""), setEmoji(""), void mudarStatus({ texto: "", emoji: "", ate: null }))}>
              Limpar
            </button>
          )}
        </span>
      </form>
    </div>
  );
}
