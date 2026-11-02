// Bingo dos Nanicos: truco no servidor
// ------------------------------------------------------------------
// O juiz do truco. Antes, o navegador de quem abria a mesa embaralhava e guardava as cartas de todo mundo.
// Agora é esta função: embaralha (crypto.getRandomValues), guarda a mesa completa em truco_estado (ninguém lê),
// confere cada jogada com as mesmas regras do site (engine.ts, cópia gerada por `npm run sincronizar:truco`)
// e grava só o que cada um pode ver: a mesa pública em truco_mesas e a mão de cada lugar em truco_maos
// (o RLS deixa cada um ler só a sua). O site recebe tudo pelo tempo real dessas duas tabelas.
// A resposta nunca traz cartas: só { ok } ou { erro }.
// Cada jogada tem 20 s (TR_TEMPO_MS): quem está na mesa manda "tempo" quando acaba, e a função joga uma carta
// sorteada (ou aceita o pedido) por quem não jogou, se o relógio dela também disser que acabou.
// No fim da partida chama truco_premiar (+15 por vencedor, até 3 vitórias pagas por dia).

import { createClient } from "npm:@supabase/supabase-js@2.45.4";
import {
  TR_APOSTAS, trAcao, trLog, trNovaMao, trNovaMesa, trPublica, trTempoEsgotado, trValido,
  type Aposta, type Mesa,
} from "./engine.ts";

const SB_URL = Deno.env.get("SUPABASE_URL") ?? "";
// chave secreta do próprio Supabase (o Supabase já entrega isso para a função; não precisa configurar)
function chaveSecreta(): string {
  const antiga = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (antiga) return antiga;
  try {
    const novas = JSON.parse(Deno.env.get("SUPABASE_SECRET_KEYS") ?? "{}");
    const v = novas.default ?? Object.values(novas)[0];
    if (typeof v === "string" && v) return v;
  } catch { /* formato inesperado */ }
  return Deno.env.get("SUPABASE_SECRET_KEY") ?? "";
}
const SB_SERVICE = chaveSecreta();
const ORIGENS = ["https://bingo-dos-nanicos.vercel.app", "http://localhost:8810", "http://localhost:8811"];
/** espera entre o fim de uma mão e a próxima (dá tempo de ver a última carta) */
const PAUSA_MAO_MS = 3000;
const JOGO = ["jogar", "truco", "envido", "quero", "naoquero", "mazo"];

function cors(req: Request): Record<string, string> {
  const o = req.headers.get("Origin") ?? "";
  return {
    "Access-Control-Allow-Origin": ORIGENS.includes(o) ? o : ORIGENS[0],
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Vary": "Origin",
  };
}
const json = (req: Request, body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors(req), "Content-Type": "application/json", "Cache-Control": "no-store" } });

/** número de 0 a 1 do sorteio seguro (nunca Math.random) */
function rnd(): number {
  const a = new Uint32Array(1);
  crypto.getRandomValues(a);
  return a[0] / 2 ** 32;
}
function novoId(): string {
  const abc = "abcdefghijklmnopqrstuvwxyz0123456789";
  let s = "";
  for (let i = 0; i < 12; i++) s += abc[Math.floor(rnd() * abc.length)];
  return s;
}

/** A mesa completa guardada no banco: as regras (M), a partida (para o prêmio) e quando a mão acabou. */
type Estado = { M: Mesa; partida: number; fimEm: number | null };
type Eu = { uid: string; fid: string; nome: string };
class Recusa extends Error {}

/** O que vai para truco_maos: as cartas na mão de cada lugar ocupado. */
function maos(M: Mesa) {
  return M.lugares.flatMap((l, i) =>
    l ? [{ lugar: i, user_id: l.key, cartas: M.h ? M.h.maos[i] ?? [] : [], mao_n: M.h?.n ?? 0 }] : [],
  );
}

/** Aplica a ação na mesa (muda E). Devolve true se a mesa mudou. Recusa vira { erro }. */
function aplicar(E: Estado, eu: Eu, acao: string, b: Record<string, unknown>): boolean {
  const M = E.M;
  let lugar = M.lugares.findIndex((l) => l && l.key === eu.uid);
  if (acao === "sentar") {
    if (lugar >= 0) return false;
    const i = b.lugar;
    if (M.fase !== "espera") throw new Recusa("A partida já começou.");
    if (typeof i !== "number" || !Number.isInteger(i) || i < 0 || i >= M.modo) throw new Recusa("Lugar inválido.");
    if (M.lugares[i]) throw new Recusa("Esse lugar já foi ocupado.");
    M.lugares[i] = { fid: eu.fid, key: eu.uid, nome: eu.nome };
    trLog(M, `${eu.nome} sentou`);
    return true;
  }
  if (acao === "sair") {
    if (lugar < 0) return false;
    if (eu.uid === M.host) throw new Recusa("Quem abriu a mesa fecha a mesa.");
    if (M.fase === "jogo") throw new Recusa("Não dá para levantar no meio da partida.");
    M.lugares[lugar] = null;
    trLog(M, `${eu.nome} levantou`);
    return true;
  }
  if (acao === "comecar") {
    if (eu.uid !== M.host) throw new Recusa("Só quem abriu a mesa começa.");
    if (M.lugares.some((l) => !l)) throw new Recusa("Faltam jogadores.");
    if (M.fase === "jogo") return false;
    M.fase = "jogo";
    M.placar = [0, 0];
    M.vencedor = null;
    M.h = null;
    M.maoN = 0;
    M.log = [];
    E.partida += 1;
    E.fimEm = null;
    trNovaMao(M, rnd);
    if (M.h?.fim) E.fimEm = Date.now();
    return true;
  }
  if (lugar < 0) throw new Recusa("Você não está nesta mesa.");
  if (acao === "nova_mao") {
    /* todo mundo pede a mão nova sozinho depois da pausa; vale o primeiro pedido, os outros não mudam nada */
    if (M.fase !== "jogo" || !M.h?.fim || M.h.n !== b.n) return false;
    if (Date.now() - (E.fimEm ?? 0) < PAUSA_MAO_MS) return false;
    trNovaMao(M, rnd);
    E.fimEm = M.h?.fim ? Date.now() : null;
    return true;
  }
  if (acao === "tempo") {
    /* acabou os 20 s da jogada: quem está na mesa avisa, e só vale se o relógio daqui concordar */
    if (M.fase !== "jogo" || !M.h || M.h.fim || M.h.n !== b.n) return false;
    if (!trTempoEsgotado(M, Date.now(), rnd)) return false;
    if (M.h?.fim && !E.fimEm) E.fimEm = Date.now();
    return true;
  }
  if (!JOGO.includes(acao)) throw new Recusa("Ação desconhecida.");
  if (acao === "jogar" && !trValido(b.arg)) throw new Recusa("Carta inválida.");
  if (acao === "envido" && !TR_APOSTAS.includes(b.arg as Aposta)) throw new Recusa("Canto inválido.");
  const erro = trAcao(M, lugar, acao, b.arg);
  if (erro) throw new Recusa(erro);
  if (M.h?.fim && !E.fimEm) E.fimEm = Date.now();
  return true;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors(req) });
  if (req.method !== "POST") return json(req, { erro: "Use POST" }, 405);
  try {
    const token = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "");
    if (!token) return json(req, { erro: "Faça login." }, 401);
    const admin = createClient(SB_URL, SB_SERVICE, { auth: { persistSession: false, autoRefreshToken: false } });

    // só nanicos logados
    const { data: u, error: eu } = await admin.auth.getUser(token);
    if (eu || !u?.user) return json(req, { erro: "Faça login de novo." }, 401);
    const { data: f } = await admin.from("friends").select("id,name").eq("user_id", u.user.id).maybeSingle();
    if (!f) return json(req, { erro: "Conta sem nanico." }, 403);
    const eu2: Eu = { uid: u.user.id, fid: f.id, nome: String(f.name ?? "?").slice(0, 30) };

    let b: Record<string, unknown>;
    try {
      b = await req.json();
    } catch {
      return json(req, { erro: "Pedido inválido." }, 400);
    }
    const acao = typeof b?.acao === "string" ? b.acao : "";
    const { error: lim } = await admin.rpc("truco_vez", { p_user: eu2.uid });
    if (lim) return json(req, { erro: lim.message });

    if (acao === "abrir") {
      const modo = b.modo === 4 ? 4 : 2;
      const alvo = [12, 24, 30].includes(b.alvo as number) ? (b.alvo as number) : 24;
      const flor = b.flor !== false;
      const id = novoId();
      const M = trNovaMesa(id, { fid: eu2.fid, key: eu2.uid, nome: eu2.nome }, modo, alvo, flor);
      const E: Estado = { M, partida: 0, fimEm: null };
      const { error } = await admin.rpc("truco_salvar", {
        p_mesa: id, p_versao: -1, p_estado: E, p_publico: trPublica(M), p_fase: M.fase, p_maos: maos(M),
        p_user: eu2.uid, p_opcoes: { modo, alvo, flor },
      });
      if (error) return json(req, { erro: error.message });
      return json(req, { ok: true, id });
    }

    const mesa = typeof b.mesa === "string" && /^[a-z0-9]{6,20}$/.test(b.mesa) ? b.mesa : null;
    if (!mesa) return json(req, { erro: "Mesa inválida." }, 400);

    if (acao === "fechar") {
      const { error } = await admin.rpc("truco_fechar", { p_mesa: mesa, p_user: eu2.uid });
      return json(req, error ? { erro: error.message } : { ok: true });
    }

    // carrega, aplica e grava; se alguém gravou no meio, tenta de novo com a mesa nova
    for (let tentativa = 0; tentativa < 4; tentativa++) {
      const { data: c, error: ec } = await admin.rpc("truco_carregar", { p_mesa: mesa });
      if (ec) throw ec;
      if (!c) return json(req, { erro: "Essa mesa foi fechada." });
      const E = c.estado as Estado;
      let mudou: boolean;
      try {
        mudou = aplicar(E, eu2, acao, b);
      } catch (e) {
        if (e instanceof Recusa) return json(req, { erro: e.message });
        throw e;
      }
      if (!mudou) return json(req, { ok: true });
      const { data: gravou, error: es } = await admin.rpc("truco_salvar", {
        p_mesa: mesa, p_versao: c.versao, p_estado: E, p_publico: trPublica(E.M), p_fase: E.M.fase, p_maos: maos(E.M),
        p_user: eu2.uid,
      });
      if (es) throw es;
      if (!gravou) continue;
      if (E.M.fase === "fim") {
        const { error: ep } = await admin.rpc("truco_premiar", { p_mesa: mesa });
        if (ep) console.error("prêmio do truco", ep);
      }
      return json(req, { ok: true });
    }
    return json(req, { erro: "A mesa está concorrida. Tente de novo." });
  } catch (e) {
    console.error(e);
    return json(req, { erro: "Falha no servidor do truco." }, 500);
  }
});
