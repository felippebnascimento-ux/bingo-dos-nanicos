// Bingo dos Nanicos: hall da fama da semana, no LoL e no CS2 (quem mais venceu, quem mais perdeu e o melhor KDA)
// ------------------------------------------------------------------
// O site chama esta função às segundas (ou quando a semana anterior ainda não está pronta). Ela:
//   1. confere se quem chamou é um nanico logado;
//   2. se a semana anterior já está pronta, só devolve "pronta";
//   3. senão, pede a vez (semana_vez: uma pessoa por vez) e busca as partidas da semana de cada nanico
//      com op.gg (match-v5), em partes: no máximo MAX_CHAMADAS por chamada, com pausa entre elas,
//      porque a chave da Riot aceita 100 chamadas a cada 2 min. O que já foi lido fica no banco e a
//      próxima chamada continua dali;
//   4. lê o CS2 pelo Leetify (API pública, sem chave): as partidas da semana de cada nanico com o link da Steam
//      com número (/profiles/<17 dígitos>) e, de cada partida, os abates, mortes e assistências (v2/matches);
//      também em partes (MAX_LEETIFY por chamada), guardadas com o id "cs:<partida>";
//   5. com tudo lido, calcula os troféus (calculo.ts), grava o pódio e paga (trofeus_pagar, uma vez só).
// Das partidas só guardamos os números dos nanicos, nunca os de terceiros.
// A chave da Riot fica só aqui, no segredo RIOT_API_KEY do Supabase. Nunca no site.

import { createClient } from "npm:@supabase/supabase-js@2.45.4";
import { calcularTrofeus, nanicoDoLeetify, semanaAnterior, type NanicoNaPartida, type PartidaSemana } from "./calculo.ts";

const RIOT_KEY = Deno.env.get("RIOT_API_KEY") ?? "";
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
/** chamadas à Riot por vez (com a pausa, cabe folgado no limite de 100 a cada 2 min) */
const MAX_CHAMADAS = 40;
const PAUSA_MS = 1250;
/** filas que contam: normal (escolha, às cegas, partida rápida) e ranqueadas (solo e flex) */
const FILAS = new Set([400, 420, 430, 440, 490]);

// região do link do op.gg → servidor da Riot (a mesma tabela da riot-ao-vivo)
const PLATAFORMA: Record<string, string> = {
  br: "br1", na: "na1", lan: "la1", las: "la2", euw: "euw1", eune: "eun1", tr: "tr1", ru: "ru",
  me: "me1", kr: "kr", jp: "jp1", oce: "oc1", ph: "ph2", sg: "sg2", th: "th2", tw: "tw2", vn: "vn2",
};
// servidor → região das partidas (match-v5)
const REGIAO: Record<string, string> = {
  br1: "americas", na1: "americas", la1: "americas", la2: "americas",
  euw1: "europe", eun1: "europe", tr1: "europe", ru: "europe", me1: "europe",
  kr: "asia", jp1: "asia", oc1: "sea", ph2: "sea", sg2: "sea", th2: "sea", tw2: "sea", vn2: "sea",
};

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

// "https://op.gg/lol/summoners/br/Nome%20Bom-BR1" → { nome, tag, plataforma } (a mesma regra da riot-ao-vivo)
function lerOpgg(link: string): { nome: string; tag: string; plataforma: string } | null {
  let u: URL;
  try { u = new URL(link); } catch { return null; }
  if (!/(^|\.)op\.gg$/i.test(u.hostname)) return null;
  const partes = u.pathname.split("/").filter(Boolean);
  const i = partes.findIndex((p) => p.toLowerCase() === "summoners" || p.toLowerCase() === "summoner");
  if (i < 0 || partes.length < i + 3) return null;
  const regiao = partes[i + 1].toLowerCase();
  const plataforma = PLATAFORMA[regiao];
  if (!plataforma) return null;
  let id: string;
  try { id = decodeURIComponent(partes[i + 2]).replace(/\+/g, " ").trim(); } catch { return null; }
  const corte = id.lastIndexOf("-");
  const nome = (corte > 0 ? id.slice(0, corte) : id).trim();
  const tag = (corte > 0 ? id.slice(corte + 1) : regiao.toUpperCase() + "1").trim();
  if (!nome || nome.length > 32 || !tag || tag.length > 8) return null;
  return { nome, tag, plataforma };
}

/* ---------- Riot, uma chamada por vez ---------- */
class LimiteRiot extends Error {}
let chamadas = 0;
let ultima = 0;
async function riot(url: string): Promise<{ status: number; body: any }> {
  if (chamadas >= MAX_CHAMADAS) throw new LimiteRiot();
  const espera = ultima + PAUSA_MS - Date.now();
  if (espera > 0) await new Promise((r) => setTimeout(r, espera));
  chamadas++;
  ultima = Date.now();
  const r = await fetch(url, { headers: { "X-Riot-Token": RIOT_KEY } });
  if (r.status === 429) throw new LimiteRiot();
  if (r.status === 401 || r.status === 403) throw new Error("A chave da Riot está errada ou venceu.");
  let body: any = null;
  try { body = await r.json(); } catch { /* sem corpo */ }
  return { status: r.status, body };
}

/* ---------- Leetify, uma chamada por vez (a API pública não tem chave; vamos com calma) ---------- */
const LEETIFY = "https://api-public.cs-prod.leetify.com";
const MAX_LEETIFY = 60;
const PAUSA_LEETIFY_MS = 350;
let chamadasLeetify = 0;
let ultimaLeetify = 0;
async function leetify(caminho: string): Promise<{ status: number; body: any }> {
  if (chamadasLeetify >= MAX_LEETIFY) throw new LimiteRiot();
  const espera = ultimaLeetify + PAUSA_LEETIFY_MS - Date.now();
  if (espera > 0) await new Promise((r) => setTimeout(r, espera));
  chamadasLeetify++;
  ultimaLeetify = Date.now();
  const r = await fetch(LEETIFY + caminho);
  if (r.status === 429) throw new LimiteRiot();
  let body: any = null;
  try { body = await r.json(); } catch { /* sem corpo */ }
  return { status: r.status, body };
}

type Progresso = { ids?: Record<string, string[]>; cs?: Record<string, string[]> };
type Alvo = { fid: string; puuid: string; regiao: string };

/** Nanicos com op.gg e a conta Riot (o PUUID fica guardado em riot_contas, como na riot-ao-vivo). */
async function alvos(admin: any): Promise<Alvo[]> {
  /* os troféus são só dos 14: amigo dos nanicos não entra (seção 39) */
  const { data: amigos } = await admin.from("friends").select("id,opgg").eq("tipo", "nanico").not("opgg", "is", null);
  const { data: contas } = await admin.from("riot_contas").select("friend_id,riot_id,puuid");
  const porFid = new Map<string, any>((contas ?? []).map((c: any) => [c.friend_id, c]));
  const out: Alvo[] = [];
  for (const f of amigos ?? []) {
    const id = lerOpgg(f.opgg);
    if (!id) continue;
    const chave = `${id.nome}#${id.tag}@${id.plataforma}`.toLowerCase();
    let puuid: string | null = porFid.get(f.id)?.riot_id === chave ? porFid.get(f.id)?.puuid ?? null : null;
    if (!puuid) {
      const r = await riot(`https://americas.api.riotgames.com/riot/account/v1/accounts/by-riot-id/${encodeURIComponent(id.nome)}/${encodeURIComponent(id.tag)}`);
      puuid = r.status === 200 && typeof r.body?.puuid === "string" ? r.body.puuid : null;
      await admin.from("riot_contas").upsert({ friend_id: f.id, riot_id: chave, puuid, atualizado: new Date().toISOString() });
    }
    if (puuid) out.push({ fid: f.id, puuid, regiao: REGIAO[id.plataforma] ?? "americas" });
  }
  return out;
}

/** Lê a semana em partes. Devolve true quando todas as partidas já foram lidas. */
async function ler(admin: any, semana: string, inicio: number, fim: number, progresso: Progresso): Promise<boolean> {
  const lista = await alvos(admin);
  const porPuuid = new Map(lista.map((a) => [a.puuid, a.fid]));
  const ids = (progresso.ids ??= {});
  /* 1) os ids das partidas de cada nanico na semana (ranqueadas e normais) */
  for (const a of lista) {
    if (ids[a.fid]) continue;
    const achados = new Set<string>();
    for (const tipo of ["ranked", "normal"]) {
      const r = await riot(`https://${a.regiao}.api.riotgames.com/lol/match/v5/matches/by-puuid/${encodeURIComponent(a.puuid)}/ids?startTime=${inicio}&endTime=${fim}&type=${tipo}&start=0&count=100`);
      if (Array.isArray(r.body)) for (const m of r.body) if (typeof m === "string" && m.length < 40) achados.add(m);
    }
    ids[a.fid] = [...achados];
  }
  /* 2) cada partida uma vez só (partidas em grupo aparecem para vários nanicos) */
  const regiaoDe = new Map<string, string>();
  for (const a of lista) for (const m of ids[a.fid] ?? []) if (!regiaoDe.has(m)) regiaoDe.set(m, a.regiao);
  const { data: lidas } = await admin.from("riot_semana_partidas").select("match_id").eq("semana", semana);
  const jaLi = new Set((lidas ?? []).map((l: any) => l.match_id));
  for (const [m, regiao] of regiaoDe) {
    if (jaLi.has(m)) continue;
    const r = await riot(`https://${regiao}.api.riotgames.com/lol/match/v5/matches/${encodeURIComponent(m)}`);
    const info = r.body?.info;
    const conta = r.status === 200 && info && FILAS.has(Number(info.queueId));
    const nanicos: NanicoNaPartida[] = conta
      ? (info.participants ?? [])
          .filter((p: any) => porPuuid.has(p?.puuid))
          .map((p: any) => ({
            fid: porPuuid.get(p.puuid)!,
            k: Number(p.kills) || 0,
            d: Number(p.deaths) || 0,
            a: Number(p.assists) || 0,
            visao: Number(p.visionScore) || 0,
            v: p.win === true,
          }))
      : [];
    await admin.from("riot_semana_partidas").upsert({ semana, match_id: m, dados: { jogo: "lol", duracao: conta ? Number(info.gameDuration) || 0 : 0, nanicos } });
  }
  return true;
}

/** CS2 pelo Leetify: as partidas da semana de cada nanico e os números de cada uma. Devolve true quando leu tudo. */
async function lerCs(admin: any, semana: string, inicio: number, fim: number, progresso: Progresso): Promise<boolean> {
  /* só o link da Steam com o número (o Leetify precisa dele; /id/<nome> precisaria da chave da Steam) */
  const { data: amigos } = await admin.from("friends").select("id,steam").eq("tipo", "nanico").not("steam", "is", null);
  const alvosCs = (amigos ?? []).flatMap((f: any) => {
    const m = /^https:\/\/steamcommunity\.com\/profiles\/(\d{17})\/?$/.exec(String(f.steam));
    return m ? [{ fid: f.id as string, steam: m[1] }] : [];
  });
  const porSteam = new Map<string, string>(alvosCs.map((a: any) => [a.steam, a.fid]));
  const ids = (progresso.cs ??= {});
  /* 1) as partidas de cada um na semana (o perfil traz as 100 últimas) */
  for (const a of alvosCs) {
    if (ids[a.fid]) continue;
    const r = await leetify(`/v3/profile?steam64_id=${a.steam}`);
    const lista = r.status === 200 && Array.isArray(r.body?.recent_matches) ? r.body.recent_matches : [];
    ids[a.fid] = lista
      .filter((x: any) => {
        const t = Date.parse(x?.finished_at) / 1000;
        return typeof x?.id === "string" && x.id.length < 60 && t >= inicio && t < fim;
      })
      .map((x: any) => x.id as string);
  }
  /* 2) cada partida uma vez só: os números de cada nanico que estava nela */
  const todas = new Set<string>(Object.values(ids).flat());
  const { data: lidas } = await admin.from("riot_semana_partidas").select("match_id").eq("semana", semana).like("match_id", "cs:%");
  const jaLi = new Set((lidas ?? []).map((l: any) => l.match_id));
  for (const m of todas) {
    if (jaLi.has("cs:" + m)) continue;
    const r = await leetify(`/v2/matches/${encodeURIComponent(m)}`);
    const stats = r.status === 200 && Array.isArray(r.body?.stats) ? r.body.stats : [];
    const nanicos: NanicoNaPartida[] = stats
      .filter((s: any) => porSteam.has(String(s?.steam64_id)))
      .map((s: any) => nanicoDoLeetify(porSteam.get(String(s.steam64_id))!, s));
    await admin.from("riot_semana_partidas").upsert({ semana, match_id: "cs:" + m, dados: { jogo: "cs", duracao: 0, nanicos } });
  }
  return true;
}

/** Tudo lido: calcula, grava o pódio, marca pronta e paga. */
async function fechar(admin: any, semana: string) {
  const { data: linhas } = await admin.from("riot_semana_partidas").select("match_id,dados").eq("semana", semana);
  const partidas: PartidaSemana[] = (linhas ?? [])
    .filter((l: any) => Array.isArray(l.dados?.nanicos) && l.dados.nanicos.length)
    .map((l: any) => ({ id: l.match_id, jogo: l.dados.jogo === "cs" ? "cs" : "lol", duracao: Number(l.dados.duracao) || 0, nanicos: l.dados.nanicos }));
  const trofeus = calcularTrofeus(partidas);
  await admin.from("trofeus_semana").delete().eq("semana", semana);
  if (trofeus.length)
    await admin.from("trofeus_semana").insert(trofeus.map((t) => ({ semana, trofeu: t.trofeu, posicao: t.posicao, friend_id: t.fid, valor: t.valor, partidas: t.partidas })));
  await admin.from("riot_semana_meta").update({ estado: "pronta", terminou_em: new Date().toISOString(), progresso: {}, erro: null }).eq("semana", semana);
  await admin.rpc("trofeus_pagar", { p_semana: semana });
  /* as partidas lidas só servem para continuar o cálculo: some o que tem mais de 4 semanas */
  const corte = new Date(Date.parse(semana) - 28 * 86400 * 1000).toISOString().slice(0, 10);
  await admin.from("riot_semana_partidas").delete().lt("semana", corte);
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
    const { data: eu2 } = await admin.from("friends").select("id").eq("user_id", u.user.id).in("tipo", ["nanico", "amigo"]).maybeSingle();
    if (!eu2) return json(req, { erro: "Conta sem nanico." }, 403);

    const { semana, inicio, fim } = semanaAnterior(new Date());
    const { data: meta } = await admin.from("riot_semana_meta").select("estado").eq("semana", semana).maybeSingle();
    if (meta?.estado === "pronta") return json(req, { estado: "pronta", semana });
    if (!RIOT_KEY) return json(req, { estado: "sem-chave", semana, erro: "Falta a chave da Riot (segredo RIOT_API_KEY) no Supabase." });

    // uma pessoa por vez calcula; as outras esperam
    const { data: vez } = await admin.rpc("semana_vez", { p_semana: semana });
    if (vez !== true) return json(req, { estado: "calculando", semana });

    const { data: atual } = await admin.from("riot_semana_meta").select("progresso").eq("semana", semana).maybeSingle();
    const progresso: Progresso = atual?.progresso && typeof atual.progresso === "object" ? atual.progresso : {};
    chamadas = 0;
    chamadasLeetify = 0;
    try {
      await ler(admin, semana, inicio, fim, progresso);
      await lerCs(admin, semana, inicio, fim, progresso);
    } catch (e) {
      // acabou a vez (limite de chamadas ou a Riot pediu para esperar): guarda o progresso e libera para a próxima
      const erro = e instanceof LimiteRiot ? null : String((e as Error)?.message ?? e).slice(0, 160);
      await admin.from("riot_semana_meta").update({ estado: "parcial", progresso, erro }).eq("semana", semana);
      return json(req, { estado: "calculando", semana, erro });
    }
    await fechar(admin, semana);
    return json(req, { estado: "pronta", semana });
  } catch (e) {
    console.error(e);
    return json(req, { erro: "Falha ao calcular o hall da fama." }, 500);
  }
});
