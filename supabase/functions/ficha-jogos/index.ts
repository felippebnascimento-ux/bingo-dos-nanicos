// Bingo dos Nanicos: números da ficha de cada nanico (Riot, Steam e Leetify)
// ------------------------------------------------------------------
// O site chama esta função ao abrir a ficha de um nanico. Ela:
//   1. confere se quem chamou é um nanico logado;
//   2. para aquele nanico, busca de novo cada fonte só se o que está guardado tem mais de 6 h;
//      - LoL: elo e vitórias da ranqueada solo (league-v4) e KDA e main das últimas 20 partidas
//        (match-v5; só busca as partidas que ainda não foram lidas);
//      - Steam: horas de CS2 e o total de horas (perfil privado vira privado: true);
//      - CS (Leetify, API pública sem chave): o Premier atual e o nível da Gamers Club da última partida na GC;
//   3. devolve o que está guardado em jogos_stats.
// As chaves ficam só aqui, nos segredos RIOT_API_KEY e STEAM_API_KEY do Supabase. Nunca no site.

import { createClient } from "npm:@supabase/supabase-js@2.45.4";

const RIOT_KEY = Deno.env.get("RIOT_API_KEY") ?? "";
const STEAM_KEY = Deno.env.get("STEAM_API_KEY") ?? "";
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
const FRESCO_MS = 6 * 3600 * 1000;
const MAX_CHAMADAS_RIOT = 25;
const PARTIDAS = 20;
const CS2 = 730;

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

/* ---------- LoL ---------- */
class LimiteRiot extends Error {}
let chamadas = 0;
async function riot(url: string): Promise<{ status: number; body: any }> {
  if (++chamadas > MAX_CHAMADAS_RIOT) throw new LimiteRiot();
  const r = await fetch(url, { headers: { "X-Riot-Token": RIOT_KEY } });
  if (r.status === 429) throw new LimiteRiot();
  let body: any = null;
  try { body = await r.json(); } catch { /* sem corpo */ }
  return { status: r.status, body };
}

async function puuidDe(admin: any, fid: string, id: { nome: string; tag: string; plataforma: string }) {
  const chave = `${id.nome}#${id.tag}@${id.plataforma}`.toLowerCase();
  const { data: c } = await admin.from("riot_contas").select("riot_id,puuid").eq("friend_id", fid).maybeSingle();
  if (c?.puuid && c.riot_id === chave) return c.puuid as string;
  const r = await riot(`https://americas.api.riotgames.com/riot/account/v1/accounts/by-riot-id/${encodeURIComponent(id.nome)}/${encodeURIComponent(id.tag)}`);
  if (r.status === 401 || r.status === 403) throw new Error("A chave da Riot está errada ou venceu.");
  const puuid = r.status === 200 && typeof r.body?.puuid === "string" ? r.body.puuid : null;
  await admin.from("riot_contas").upsert({ friend_id: fid, riot_id: chave, puuid, atualizado: new Date().toISOString() });
  if (!puuid) throw new Error(`Não achei a conta ${id.nome}#${id.tag} na Riot. Confira o link do op.gg.`);
  return puuid;
}

async function buscarLol(admin: any, fid: string, opgg: string) {
  const id = lerOpgg(opgg);
  if (!id) throw new Error("O link do op.gg não tem o nome e a região da conta.");
  const puuid = await puuidDe(admin, fid, id);

  // elo e vitórias da ranqueada solo
  const liga = await riot(`https://${id.plataforma}.api.riotgames.com/lol/league/v4/entries/by-puuid/${encodeURIComponent(puuid)}`);
  if (liga.status === 401 || liga.status === 403) throw new Error("A chave da Riot está errada ou venceu.");
  const solo = Array.isArray(liga.body) ? liga.body.find((e: any) => e?.queueType === "RANKED_SOLO_5x5") : null;

  // últimas 20 partidas: só busca as que ainda não foram lidas
  const regiao = REGIAO[id.plataforma] ?? "americas";
  const ids = await riot(`https://${regiao}.api.riotgames.com/lol/match/v5/matches/by-puuid/${encodeURIComponent(puuid)}/ids?start=0&count=${PARTIDAS}`);
  const lista: string[] = Array.isArray(ids.body) ? ids.body.filter((x: unknown) => typeof x === "string").slice(0, PARTIDAS) : [];
  const { data: vistas } = await admin.from("riot_partidas_vistas").select("match_id").eq("friend_id", fid);
  const jaVi = new Set((vistas ?? []).map((v: any) => v.match_id));
  for (const m of lista.filter((x) => !jaVi.has(x))) {
    let r: { status: number; body: any };
    try { r = await riot(`https://${regiao}.api.riotgames.com/lol/match/v5/matches/${encodeURIComponent(m)}`); }
    catch (e) { if (e instanceof LimiteRiot) break; throw e; }
    const eu = r.body?.info?.participants?.find((p: any) => p?.puuid === puuid);
    if (!eu) continue;
    await admin.from("riot_partidas_vistas").upsert({
      friend_id: fid, match_id: m,
      kills: Number(eu.kills) || 0, deaths: Number(eu.deaths) || 0, assists: Number(eu.assists) || 0,
      campeao: String(eu.championName ?? "").slice(0, 40),
      em: r.body?.info?.gameStartTimestamp ? new Date(Number(r.body.info.gameStartTimestamp)).toISOString() : null,
    });
  }
  // guarda só as 20 mais recentes
  if (lista.length) {
    const { data: todas } = await admin.from("riot_partidas_vistas").select("match_id").eq("friend_id", fid);
    const sair = (todas ?? []).map((v: any) => v.match_id).filter((x: string) => !lista.includes(x));
    if (sair.length) await admin.from("riot_partidas_vistas").delete().eq("friend_id", fid).in("match_id", sair);
  }
  const { data: ps } = await admin.from("riot_partidas_vistas").select("kills,deaths,assists,campeao").eq("friend_id", fid);
  const partidas = ps ?? [];
  const k = partidas.reduce((s: number, p: any) => s + p.kills, 0);
  const d = partidas.reduce((s: number, p: any) => s + p.deaths, 0);
  const a = partidas.reduce((s: number, p: any) => s + p.assists, 0);
  const conta = new Map<string, number>();
  for (const p of partidas) if (p.campeao) conta.set(p.campeao, (conta.get(p.campeao) ?? 0) + 1);
  const main = [...conta.entries()].sort((x, y) => y[1] - x[1])[0]?.[0] ?? null;
  return {
    tier: solo ? String(solo.tier) : null,
    rank: solo ? String(solo.rank) : null,
    lp: solo ? Number(solo.leaguePoints) || 0 : null,
    vitorias: solo ? Number(solo.wins) || 0 : 0,
    derrotas: solo ? Number(solo.losses) || 0 : 0,
    kda: partidas.length ? Math.round(((k + a) / Math.max(1, d)) * 100) / 100 : null,
    main,
    partidas: partidas.length,
  };
}

/* ---------- Steam ---------- */
async function steamApi(url: string) {
  const r = await fetch(url);
  if (r.status === 401 || r.status === 403) throw new Error("A chave da Steam está errada.");
  if (!r.ok) throw new Error(`A Steam respondeu ${r.status}.`);
  return await r.json();
}

async function buscarSteam(link: string) {
  const m = /^https:\/\/steamcommunity\.com\/(id|profiles)\/([^/]+)\/?$/.exec(link);
  if (!m) throw new Error("Link da Steam inválido.");
  let steamid = m[2];
  if (m[1] === "id") {
    const v = await steamApi(`https://api.steampowered.com/ISteamUser/ResolveVanityURL/v1/?key=${STEAM_KEY}&vanityurl=${encodeURIComponent(m[2])}`);
    if (v?.response?.success !== 1) throw new Error("Não achei esse perfil na Steam. Confira o link.");
    steamid = String(v.response.steamid);
  }
  const g = await steamApi(`https://api.steampowered.com/IPlayerService/GetOwnedGames/v1/?key=${STEAM_KEY}&steamid=${encodeURIComponent(steamid)}&include_played_free_games=1`);
  const jogos = g?.response?.games;
  // perfil ou "detalhes de jogos" privado: a Steam devolve a resposta vazia
  if (!Array.isArray(jogos)) return { cs2_horas: null, total_horas: null, privado: true };
  const min = (j: any) => Number(j?.playtime_forever) || 0;
  const cs2 = jogos.find((j: any) => Number(j?.appid) === CS2);
  return {
    cs2_horas: cs2 ? Math.round(min(cs2) / 60) : 0,
    total_horas: Math.round(jogos.reduce((s: number, j: any) => s + min(j), 0) / 60),
    privado: false,
  };
}

/* ---------- CS (Leetify) ---------- */
// O Leetify precisa do número de 17 dígitos; link /id/<nome> só dá para traduzir com a chave da Steam.
async function steam64De(link: string): Promise<string> {
  const m = /^https:\/\/steamcommunity\.com\/(id|profiles)\/([^/]+)\/?$/.exec(link);
  if (!m) throw new Error("Link da Steam inválido.");
  if (m[1] === "profiles") return m[2];
  if (!STEAM_KEY) throw new Error("Use o link da Steam com o número (steamcommunity.com/profiles/...).");
  const v = await steamApi(`https://api.steampowered.com/ISteamUser/ResolveVanityURL/v1/?key=${STEAM_KEY}&vanityurl=${encodeURIComponent(m[2])}`);
  if (v?.response?.success !== 1) throw new Error("Não achei esse perfil na Steam. Confira o link.");
  return String(v.response.steamid);
}

async function buscarCs(link: string) {
  const id = await steam64De(link);
  const r = await fetch(`https://api-public.cs-prod.leetify.com/v3/profile?steam64_id=${encodeURIComponent(id)}`);
  if (r.status === 404) throw new Error("Esse perfil não está no Leetify.");
  if (!r.ok) throw new Error(`O Leetify respondeu ${r.status}.`);
  const p = await r.json();
  const premier = Number(p?.ranks?.premier);
  // a GC não vem nos ranks: o nível é o "rank" da partida mais recente da Gamers Club
  const gc = (Array.isArray(p?.recent_matches) ? p.recent_matches : [])
    .filter((x: any) => x?.data_source === "gamers_club" && Number(x?.rank) > 0)
    .sort((a: any, b: any) => Date.parse(b?.finished_at) - Date.parse(a?.finished_at))[0];
  return {
    premier: Number.isFinite(premier) && premier > 0 ? Math.round(premier) : null,
    gc: gc ? Math.round(Number(gc.rank)) : null,
    gc_em: gc?.finished_at ? String(gc.finished_at).slice(0, 30) : null,
  };
}

/* ---------- atualizar uma fonte de um nanico ---------- */
async function atualizar(admin: any, fid: string, fonte: "lol" | "steam" | "cs", buscar: () => Promise<Record<string, unknown>>) {
  const { data: atual } = await admin.from("jogos_stats").select("atualizado,erro").eq("friend_id", fid).eq("fonte", fonte).maybeSingle();
  if (atual && Date.now() - Date.parse(atual.atualizado) < FRESCO_MS) return;
  try {
    const dados = await buscar();
    await admin.from("jogos_stats").upsert({ friend_id: fid, fonte, dados, erro: null, atualizado: new Date().toISOString() });
  } catch (e) {
    if (e instanceof LimiteRiot) return; // a Riot pediu para esperar: não marca como atualizado, tenta na próxima vez
    const erro = String((e as Error)?.message ?? e).slice(0, 160);
    if (atual) await admin.from("jogos_stats").update({ erro, atualizado: new Date().toISOString() }).eq("friend_id", fid).eq("fonte", fonte);
    else await admin.from("jogos_stats").insert({ friend_id: fid, fonte, dados: {}, erro, atualizado: new Date().toISOString() });
  }
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

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

    let corpo: any = {};
    try { corpo = await req.json(); } catch { /* sem corpo */ }
    const fid = typeof corpo?.friend_id === "string" && UUID.test(corpo.friend_id) ? corpo.friend_id : null;
    if (!fid) return json(req, { erro: "Falta o nanico." }, 400);
    const { data: f } = await admin.from("friends").select("id,opgg,steam").eq("id", fid).maybeSingle();
    if (!f) return json(req, { erro: "Nanico não encontrado." }, 404);

    chamadas = 0;
    const avisos: string[] = [];
    if (f.opgg && RIOT_KEY) await atualizar(admin, fid, "lol", () => buscarLol(admin, fid, f.opgg));
    else if (f.opgg) avisos.push("Falta a chave da Riot (segredo RIOT_API_KEY) no Supabase.");
    if (f.steam && STEAM_KEY) await atualizar(admin, fid, "steam", () => buscarSteam(f.steam));
    else if (f.steam) avisos.push("Falta a chave da Steam (segredo STEAM_API_KEY) no Supabase.");
    if (f.steam) await atualizar(admin, fid, "cs", () => buscarCs(f.steam));

    const { data: linhas } = await admin.from("jogos_stats").select("fonte,dados,erro,atualizado").eq("friend_id", fid);
    return json(req, { linhas: linhas ?? [], avisos });
  } catch (e) {
    console.error(e);
    return json(req, { erro: "Falha ao buscar os números." }, 500);
  }
});
