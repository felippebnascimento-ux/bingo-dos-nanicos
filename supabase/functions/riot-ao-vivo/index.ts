// Bingo dos Nanicos: partida ao vivo pela API oficial da Riot
// ------------------------------------------------------------------
// O site chama esta função mais ou menos a cada minuto. Ela:
//   1. confere se quem chamou é um nanico logado;
//   2. no máximo uma vez a cada 55 s (para todo mundo junto), pergunta à Riot
//      quem dos nanicos com op.gg salvo está em partida agora;
//   3. devolve as partidas guardadas no banco.
// A chave da Riot fica só aqui, no segredo RIOT_API_KEY do Supabase. Nunca no site.

import { createClient } from "npm:@supabase/supabase-js@2.45.4";

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
const INTERVALO_S = 55;
const ORIGENS = ["https://bingo-dos-nanicos.vercel.app", "http://localhost:8810", "http://localhost:8811"];

// região do link do op.gg → servidor da Riot
const PLATAFORMA: Record<string, string> = {
  br: "br1", na: "na1", lan: "la1", las: "la2", euw: "euw1", eune: "eun1", tr: "tr1", ru: "ru",
  me: "me1", kr: "kr", jp: "jp1", oce: "oc1", ph: "ph2", sg: "sg2", th: "th2", tw: "tw2", vn: "vn2",
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

// "https://op.gg/lol/summoners/br/Nome%20Bom-BR1" → { nome: "Nome Bom", tag: "BR1", plataforma: "br1" }
export function lerOpgg(link: string): { nome: string; tag: string; plataforma: string } | null {
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

async function riot(url: string): Promise<{ status: number; body: any }> {
  const r = await fetch(url, { headers: { "X-Riot-Token": RIOT_KEY } });
  let body: any = null;
  try { body = await r.json(); } catch { /* sem corpo */ }
  return { status: r.status, body };
}

// nomes e imagens dos campeões (Data Dragon), guardados enquanto a função estiver de pé
let CAMPEOES: { versao: string; porId: Record<string, { nome: string; img: string }> } | null = null;
async function campeoes() {
  if (CAMPEOES) return CAMPEOES;
  try {
    const versoes = await (await fetch("https://ddragon.leagueoflegends.com/api/versions.json")).json();
    const versao = String(versoes[0]);
    const dados = await (await fetch(`https://ddragon.leagueoflegends.com/cdn/${versao}/data/en_US/champion.json`)).json();
    const porId: Record<string, { nome: string; img: string }> = {};
    for (const c of Object.values<any>(dados.data)) porId[String(c.key)] = { nome: String(c.name), img: String(c.id) };
    CAMPEOES = { versao, porId };
  } catch (e) {
    console.error("data dragon", e);
    return { versao: "", porId: {} as Record<string, { nome: string; img: string }> };
  }
  return CAMPEOES;
}

type Conta = { friend_id: string; riot_id: string; puuid: string | null; atualizado: string };

async function atualizar(admin: any): Promise<string | null> {
  const { data: amigos } = await admin.from("friends").select("id,name,opgg").not("opgg", "is", null);
  const { data: contasArr } = await admin.from("riot_contas").select("friend_id,riot_id,puuid,atualizado");
  const contas = new Map<string, Conta>((contasArr ?? []).map((c: Conta) => [c.friend_id, c]));
  const alvos: { fid: string; puuid: string; plataforma: string }[] = [];
  let erro: string | null = null;

  // 1) Riot ID do op.gg → PUUID (só pergunta de novo se o link mudou ou depois de 1 dia sem achar)
  for (const f of amigos ?? []) {
    const id = lerOpgg(f.opgg);
    if (!id) continue;
    const chave = `${id.nome}#${id.tag}@${id.plataforma}`.toLowerCase();
    let c = contas.get(f.id);
    const velho = c && !c.puuid && Date.now() - Date.parse(c.atualizado) > 86400000;
    if (!c || c.riot_id !== chave || velho) {
      const r = await riot(`https://americas.api.riotgames.com/riot/account/v1/accounts/by-riot-id/${encodeURIComponent(id.nome)}/${encodeURIComponent(id.tag)}`);
      if (r.status === 401 || r.status === 403) return "A chave da Riot está errada ou venceu.";
      if (r.status === 429) return "A Riot pediu para esperar (limite de consultas).";
      const puuid = r.status === 200 && typeof r.body?.puuid === "string" ? r.body.puuid : null;
      if (r.status !== 200 && r.status !== 404) { erro = `Riot respondeu ${r.status} ao buscar uma conta.`; continue; }
      c = { friend_id: f.id, riot_id: chave, puuid, atualizado: new Date().toISOString() };
      await admin.from("riot_contas").upsert(c);
    }
    if (c.puuid) alvos.push({ fid: f.id, puuid: c.puuid, plataforma: id.plataforma });
  }

  // 2) quem está em partida agora (Spectator-V5)
  const nanicoPorPuuid = new Map(alvos.map((a) => [a.puuid, a.fid]));
  const resultado = new Map<string, any>(); // friend_id → partida
  for (const a of alvos) {
    const r = await riot(`https://${a.plataforma}.api.riotgames.com/lol/spectator/v5/active-games/by-summoner/${encodeURIComponent(a.puuid)}`);
    if (r.status === 401 || r.status === 403) return "A chave da Riot está errada ou venceu.";
    if (r.status === 429) { erro = "A Riot pediu para esperar (limite de consultas)."; break; }
    if (r.status === 404) { resultado.set(a.fid, null); continue; }
    if (r.status !== 200 || !r.body) { erro = `Riot respondeu ${r.status} ao procurar partida.`; continue; }
    resultado.set(a.fid, r.body);
  }

  // 3) guarda no banco só o que o site usa (sem PUUID de ninguém)
  const camp = await campeoes();
  const nomeCamp = (id: number) => camp.porId[String(id)] ?? { nome: "", img: "" };
  const linhas = [] as any[];
  for (const [fid, g] of resultado) {
    if (!g) { linhas.push({ friend_id: fid, game_id: null, jogo: null, atualizado: new Date().toISOString() }); continue; }
    const jogo = {
      gameId: Number(g.gameId) || 0,
      queueId: Number(g.gameQueueConfigId) || 0,
      modo: String(g.gameMode ?? ""),
      inicio: Number(g.gameStartTime) || 0,
      duracao: Number(g.gameLength) || 0,
      plataforma: String(g.platformId ?? ""),
      versao: camp.versao,
      participantes: (g.participants ?? []).slice(0, 12).map((p: any) => ({
        riotId: String(p.riotId ?? "").slice(0, 40),
        campeaoId: Number(p.championId) || 0,
        campeao: nomeCamp(p.championId).nome,
        img: nomeCamp(p.championId).img,
        time: Number(p.teamId) || 0,
        feiticos: [Number(p.spell1Id) || 0, Number(p.spell2Id) || 0],
        fid: nanicoPorPuuid.get(p.puuid) ?? null,
      })),
      bans: (g.bannedChampions ?? []).slice(0, 10).map((b: any) => ({ campeao: nomeCamp(b.championId).nome, img: nomeCamp(b.championId).img, time: Number(b.teamId) || 0 })),
    };
    linhas.push({ friend_id: fid, game_id: jogo.gameId, jogo, atualizado: new Date().toISOString() });
  }
  if (linhas.length) await admin.from("riot_ao_vivo").upsert(linhas);
  // quem tirou o op.gg sai da lista
  const comLink = new Set(alvos.map((a) => a.fid));
  const { data: todos } = await admin.from("riot_ao_vivo").select("friend_id");
  const sair = (todos ?? []).map((r: any) => r.friend_id).filter((id: string) => !comLink.has(id));
  if (sair.length) await admin.from("riot_ao_vivo").delete().in("friend_id", sair);
  return erro;
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
    const { data: eu2 } = await admin.from("friends").select("id").eq("user_id", u.user.id).maybeSingle();
    if (!eu2) return json(req, { erro: "Conta sem nanico." }, 403);

    if (!RIOT_KEY) return json(req, { erro: "Falta a chave da Riot (segredo RIOT_API_KEY) no Supabase.", jogos: [] });

    // uma consulta à Riot por vez para o grupo inteiro
    const { data: vez } = await admin.rpc("riot_vez", { p_segundos: INTERVALO_S });
    if (vez === true) {
      const erro = await atualizar(admin);
      await admin.from("riot_meta").update({ erro }).eq("id", 1);
    }

    const { data: linhas } = await admin.from("riot_ao_vivo").select("friend_id,game_id,jogo,atualizado");
    const { data: meta } = await admin.from("riot_meta").select("checado_em,erro").eq("id", 1).maybeSingle();
    return json(req, { linhas: linhas ?? [], checado_em: meta?.checado_em ?? null, erro: meta?.erro ?? null });
  } catch (e) {
    console.error(e);
    return json(req, { erro: "Falha ao consultar a partida." }, 500);
  }
});
