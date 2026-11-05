/*
 * Corrida de cavalos (seção 71): pergunta ao banco como está a corrida (corrida_estado) enquanto ela está na tela, guarda a
 * diferença do relógio do banco e deixa a tela apostar e inscrever. Perguntar faz a corrida andar no banco (abrir, montar o
 * campo, sortear e pagar), como nas mesas ao vivo; fora da tela, para (useLaco).
 * Os cavalos (tabela `cavalos`) são lidos direto: os meus no Haras da loja e todos no ranking.
 */
import { useCallback, useRef, useState } from "react";
import { create } from "zustand";
import { useLaco } from "@/features/cassino/laco";
import { carregar } from "@/features/cassino/estado";
import { errMsg, sb } from "@/lib/supabase";
import { toast } from "@/lib/toast";
import { faseEm, lerCavalo, lerEstado, type Atributo, type Cavalo, type EstadoCorrida, type Pelagem, type TipoAposta } from "./corridaRegras";

/** Mais rápido durante a corrida e perto das viradas de fase; devagar no resto. */
function intervalo(e: EstadoCorrida | null, dif: number) {
  if (!e) return 2000;
  const agora = Date.now() + dif;
  const f = faseEm(e.tempos, agora);
  const prox = f === "inscricoes" ? e.tempos.apostasEm : f === "apostas" ? e.tempos.fechaEm : f === "correndo" ? e.tempos.fimEm : e.tempos.fimEm + 10000;
  return Math.max(400, Math.min(2000, prox - agora + 150));
}

export function useCorrida(ativo: boolean) {
  const [estado, setEstado] = useState<EstadoCorrida | null>(null);
  const [ligada, setLigada] = useState<boolean | null>(null);
  const dif = useRef(0);
  const pago = useRef<number | null>(null);

  const ler = useCallback(async () => {
    const antes = Date.now();
    const { data, error } = await sb().rpc("corrida_estado");
    if (error) {
      /* sem o SQL da seção 71, a corrida não existe */
      if (/corrida_estado|function|does not exist|não existe/i.test(error.message)) setLigada(false);
      return null;
    }
    const e = lerEstado(data);
    if (!e) return null;
    dif.current = e.agora - (antes + (Date.now() - antes) / 2);
    setLigada(true);
    setEstado(e);
    /* corrida paga: atualiza o histórico do cassino e os cavalos uma vez */
    if (e.segredo && pago.current !== e.id) {
      pago.current = e.id;
      void carregar();
      void carregarCavalos();
    }
    return e;
  }, []);

  useLaco(ler, (e) => intervalo(e, dif.current), ativo);
  return { estado, ligada, dif, atualizar: ler };
}

export async function apostarCorrida(tipo: TipoAposta, raia: number, raia2: number | null, valor: number) {
  const { data, error } = await sb().rpc("corrida_apostar", { p_tipo: tipo, p_raia: raia, p_raia2: raia2, p_valor: valor });
  if (error) {
    toast(errMsg(error, "Não deu para apostar. Tente de novo."));
    return null;
  }
  return data as { odd: number };
}

export async function inscreverCavalo(cavalo: number) {
  const { error } = await sb().rpc("corrida_inscrever", { p_cavalo: cavalo });
  if (error) {
    toast(errMsg(error, "Não deu para inscrever. Tente de novo."));
    return false;
  }
  toast("Inscrito! Agora é torcer.");
  return true;
}

/* ---------- os cavalos ---------- */
type Cavalos = { todos: Cavalo[] | null; ocupado: string | null };
export const useCavalos = create<Cavalos>(() => ({ todos: null, ocupado: null }));

export async function carregarCavalos() {
  const { data, error } = await sb().from("cavalos").select("id,dono,nome,pelagem,velocidade,arrancada,resistencia,constancia,corridas,vitorias,podios,ganhos,forma");
  if (error) return;
  useCavalos.setState({ todos: (data ?? []).map(lerCavalo).filter((c): c is Cavalo => !!c) });
}

async function ocupar<T>(chave: string, f: () => Promise<T>) {
  if (useCavalos.getState().ocupado) return null;
  useCavalos.setState({ ocupado: chave });
  try {
    return await f();
  } finally {
    useCavalos.setState({ ocupado: null });
  }
}

export async function comprarCavalo(nome: string, pelagem: Pelagem) {
  return ocupar("comprar", async () => {
    const { error } = await sb().rpc("cavalo_comprar", { p_nome: nome.trim(), p_pelagem: pelagem });
    if (error) {
      toast(errMsg(error, "Não deu para comprar o cavalo. Tente de novo."));
      return false;
    }
    toast(`${nome.trim()} chegou ao seu haras!`);
    await carregarCavalos();
    return true;
  });
}

export async function treinarCavalo(cavalo: number, atributo: Atributo, pontos: number) {
  return ocupar(`${cavalo}:${atributo}`, async () => {
    const { data, error } = await sb().rpc("cavalo_treinar", { p_cavalo: cavalo, p_atributo: atributo, p_pontos: pontos });
    if (error) {
      toast(errMsg(error, "Não deu para treinar. Tente de novo."));
      return false;
    }
    const r = data as { valor: number; custo: number };
    toast(`Treinou! Agora está em ${r.valor}.`);
    await carregarCavalos();
    return true;
  });
}
