"use client";
/*
 * O menu de uma pessoa, como o do Discord: clique direito no nome (ou segurar o dedo no celular) na lista do canal de
 * voz, na lista de membros e nos quadrados do Ao vivo. Volume da voz (até 200%), silenciar, a transmissão dela
 * (assistir, ouvir, volume e parar de assistir) e a ficha. Tudo só no meu aparelho.
 */
import { useCallback, useRef, useState } from "react";
import { assistirLive } from "@/components/shell/People";
import type { PresencaNanico } from "@/lib/presenca";
import { MY_KEY, setApp } from "@/lib/store";
import { useLive } from "./estado";
import { Balao, Chave, lugarDe, type Lugar } from "./PainelVoz";
import { LIVE, mudarVolumeTela, unwatch, watch } from "./tela";
import { ajustarVoz, silenciarNanico, useAjustesVoz, VOLUME_MAX } from "./voz";

/** Volume da voz (0 a 200%) e silenciar, de um nanico (friend id). */
export function OpcoesVoz({ fid, nome }: { fid: string; nome: string }) {
  const por = useAjustesVoz((s) => s.por);
  const silenciados = useAjustesVoz((s) => s.silenciados);
  const v = por[fid] ?? 1;
  return (
    <>
      <h4>Volume da voz</h4>
      <label className="vz-vol">
        <input
          aria-label={`Volume da voz de ${nome}`}
          type="range"
          min={0}
          max={VOLUME_MAX * 100}
          step={5}
          value={Math.round(v * 100)}
          /* passa pelos 100% com um "ímã", como no Discord */
          onChange={(e) => {
            const n = Number(e.target.value);
            ajustarVoz({ por: { ...por, [fid]: (Math.abs(n - 100) <= 4 ? 100 : n) / 100 } });
          }}
          onDoubleClick={() => ajustarVoz({ por: { ...por, [fid]: 1 } })}
        />
        <b>{Math.round(v * 100)}%</b>
      </label>
      <Chave rotulo={`Silenciar ${nome}`} ligado={silenciados.includes(fid)} onChange={(x) => silenciarNanico(fid, x)} />
    </>
  );
}

/** A transmissão de quem está ao vivo: assistir, ouvir, volume e parar de assistir. */
export function OpcoesTela({ chave, sala, nome, fechar }: { chave: string; sala: string | null; nome: string; fechar: () => void }) {
  useLive((s) => s.v);
  const vol = useLive((s) => s.vol);
  const vendo = LIVE.watching.has(chave);
  const principal = vendo && LIVE.main === chave;
  return (
    <>
      <h4>Transmissão</h4>
      {!vendo ? (
        <button type="button" className="vz-item" onClick={() => (fechar(), assistirLive(chave, sala))}>
          <span>Assistir a tela de {nome}</span>
        </button>
      ) : principal ? (
        <label className="vz-vol">
          <input aria-label={`Volume da transmissão de ${nome}`} type="range" min={0} max={100} value={Math.round(vol * 100)} onChange={(e) => mudarVolumeTela(Number(e.target.value) / 100)} />
          <b>{Math.round(vol * 100)}%</b>
        </label>
      ) : (
        <button type="button" className="vz-item" onClick={() => (fechar(), watch(chave, true))}>
          <span>Ouvir esta transmissão</span>
        </button>
      )}
      {vendo && (
        <button type="button" className="vz-item perigo" onClick={() => (fechar(), unwatch(chave))}>
          <span>Parar de assistir</span>
        </button>
      )}
    </>
  );
}

/** O menu inteiro de uma pessoa (nome, voz, transmissão e ficha). */
export function MenuPessoa({ p, fid, nome, lugar, fechar }: { p: PresencaNanico | null; fid: string | null; nome: string; lugar: Lugar; fechar: () => void }) {
  const eu = !!p?.chaves.includes(MY_KEY);
  /* o balão vai para o corpo da página, mas os eventos do React sobem pela árvore: sem isto, tocar no menu contaria
     como tocar na linha da pessoa (abrir a ficha, entrar no canal) */
  const parar = (e: React.SyntheticEvent) => e.stopPropagation();
  return (
    <span className="menu-pessoa" onClick={parar} onPointerDown={parar} onContextMenu={parar} onKeyDown={parar}>
    <Balao lugar={lugar} fechar={fechar} rotulo={`Opções de ${nome}`}>
      <h4>{nome}</h4>
      {!eu && fid && <OpcoesVoz fid={fid} nome={nome} />}
      {!eu && p?.live && (
        <>
          <div className="vz-sep" />
          <OpcoesTela chave={p.key} sala={p.sala ?? null} nome={nome} fechar={fechar} />
        </>
      )}
      {fid && (
        <>
          <div className="vz-sep" />
          <button type="button" className="vz-item" onClick={() => (fechar(), setApp({ fichaAberta: fid }))}>
            <span>{eu ? "Ver a minha ficha" : "Ver a ficha"}</span>
          </button>
        </>
      )}
    </Balao>
    </span>
  );
}

/**
 * Abre um menu com o clique direito ou segurando o dedo (0,5 s) no celular, como no Discord. Depois de segurar, o
 * toque que vem em seguida não conta como clique (senão abriria a ficha ou entraria no canal junto).
 */
export function useMenuDeToque(largura = 280) {
  const [lugar, setLugar] = useState<Lugar | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const inicio = useRef<{ x: number; y: number } | null>(null);
  const engolir = useRef(false);
  const abrirEm = (x: number, y: number) => setLugar(lugarDe(new DOMRect(x, y, 0, 0), largura));
  const cancelar = () => {
    clearTimeout(timer.current);
    inicio.current = null;
  };
  const fechar = useCallback(() => setLugar(null), []);
  const props = {
    onContextMenu: (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      cancelar();
      abrirEm(e.clientX, e.clientY);
    },
    onPointerDown: (e: React.PointerEvent) => {
      if (e.pointerType !== "touch") return;
      const { clientX: x, clientY: y } = e;
      inicio.current = { x, y };
      clearTimeout(timer.current);
      timer.current = setTimeout(() => {
        engolir.current = true;
        navigator.vibrate?.(15);
        abrirEm(x, y);
      }, 500);
    },
    onPointerMove: (e: React.PointerEvent) => {
      const i = inicio.current;
      if (i && Math.hypot(e.clientX - i.x, e.clientY - i.y) > 10) cancelar();
    },
    onPointerUp: cancelar,
    onPointerCancel: cancelar,
    onClickCapture: (e: React.MouseEvent) => {
      if (!engolir.current) return;
      engolir.current = false;
      e.preventDefault();
      e.stopPropagation();
    },
  };
  return { lugar, fechar, props };
}
