// Bingo dos Nanicos: partida ao vivo pela API oficial da Riot
// ------------------------------------------------------------------
// O site chama esta função mais ou menos a cada minuto. Ela:
//   1. confere se quem chamou é um nanico logado;
//   2. no máximo uma vez a cada 55 s (para todo mundo junto), pergunta à Riot
//      quem dos nanicos com op.gg salvo (ou o do smurf) está em partida agora;
//   3. abre as apostas de cada partida nova e, quando a partida acaba, pergunta à Riot quem venceu e paga;
//   4. devolve as partidas guardadas no banco.
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

// servidor → região da match-v5 (para buscar o resultado da partida)
const REGIAO: Record<string, string> = {
  br1: "americas", na1: "americas", la1: "americas", la2: "americas",
  euw1: "europe", eun1: "europe", tr1: "europe", ru: "europe", me1: "europe",
  kr: "asia", jp1: "asia", oc1: "sea", ph2: "sea", sg2: "sea", th2: "sea", tw2: "sea", vn2: "sea",
};
// apostas: no máximo 3 resultados por ciclo; sem resultado depois de 6 h, devolve
const RESULTADOS_POR_VEZ = 3;
const DESISTE_MS = 6 * 3600_000;

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

type Conta = {
  friend_id: string; riot_id: string; puuid: string | null; atualizado: string;
  riot_id_smurf?: string | null; puuid_smurf?: string | null; atualizado_smurf?: string | null;
};

async function atualizar(admin: any): Promise<string | null> {
  const { data: amigos } = await admin.from("friends").select("id,name,opgg,opgg_smurf").neq("tipo", "inativo").or("opgg.not.is.null,opgg_smurf.not.is.null");
  const { data: contasArr } = await admin.from("riot_contas").select("friend_id,riot_id,puuid,atualizado,riot_id_smurf,puuid_smurf,atualizado_smurf");
  const contas = new Map<string, Conta>((contasArr ?? []).map((c: Conta) => [c.friend_id, c]));
  const alvos: { fid: string; puuid: string; plataforma: string }[] = [];
  let erro: string | null = null;

  // Riot ID → PUUID (só pergunta de novo se o link mudou ou depois de 1 dia sem achar).
  // "erro" = a Riot recusou a chave ou pediu para esperar: para tudo
  async function puuidDe(id: { nome: string; tag: string; plataforma: string }, guardado: { riot_id?: string | null; puuid?: string | null; atualizado?: string | null } | null) {
    const chave = `${id.nome}#${id.tag}@${id.plataforma}`.toLowerCase();
    const velho = guardado && !guardado.puuid && Date.now() - Date.parse(guardado.atualizado ?? "") > 86400000;
    if (guardado && guardado.riot_id === chave && !velho) return { chave, puuid: guardado.puuid ?? null, novo: false };
    const r = await riot(`https://americas.api.riotgames.com/riot/account/v1/accounts/by-riot-id/${encodeURIComponent(id.nome)}/${encodeURIComponent(id.tag)}`);
    if (r.status === 401 || r.status === 403) return { erro: "A chave da Riot está errada ou venceu." };
    if (r.status === 429) return { erro: "A Riot pediu para esperar (limite de consultas)." };
    if (r.status !== 200 && r.status !== 404) return { aviso: `Riot respondeu ${r.status} ao buscar uma conta.` };
    return { chave, puuid: r.status === 200 && typeof r.body?.puuid === "string" ? (r.body.puuid as string) : null, novo: true };
  }

  // 1) as contas de cada nanico: a do op.gg e, se tiver, a do smurf (as duas na mesma linha de riot_contas)
  for (const f of amigos ?? []) {
    const c = contas.get(f.id) ?? null;
    const id = f.opgg ? lerOpgg(f.opgg) : null;
    if (id) {
      const r = await puuidDe(id, c);
      if ("erro" in r) return r.erro!;
      if ("aviso" in r) erro = r.aviso!;
      else {
        if (r.novo) await admin.from("riot_contas").upsert({ friend_id: f.id, riot_id: r.chave, puuid: r.puuid, atualizado: new Date().toISOString() });
        if (r.puuid) alvos.push({ fid: f.id, puuid: r.puuid, plataforma: id.plataforma });
      }
    }
    const sm = f.opgg_smurf ? lerOpgg(f.opgg_smurf) : null;
    if (sm) {
      const r = await puuidDe(sm, c && { riot_id: c.riot_id_smurf, puuid: c.puuid_smurf, atualizado: c.atualizado_smurf });
      if ("erro" in r) return r.erro!;
      if ("aviso" in r) erro = r.aviso!;
      else {
        if (r.novo) {
          const linha = { friend_id: f.id, riot_id_smurf: r.chave, puuid_smurf: r.puuid, atualizado_smurf: new Date().toISOString() };
          // sem linha da principal ainda, a coluna riot_id (obrigatória) fica vazia até a principal aparecer
          if (c) await admin.from("riot_contas").update(linha).eq("friend_id", f.id);
          else await admin.from("riot_contas").upsert({ ...linha, riot_id: "" });
        }
        if (r.puuid) alvos.push({ fid: f.id, puuid: r.puuid, plataforma: sm.plataforma });
      }
    }
  }

  // 2) quem está em partida agora (Spectator-V5); com duas contas, vale a que estiver jogando
  const nanicoPorPuuid = new Map(alvos.map((a) => [a.puuid, a.fid]));
  const resultado = new Map<string, any>(); // friend_id → partida
  let completo = true; // todos os nanicos foram consultados (sem isso, não dá para dizer que uma partida acabou)
  for (const a of alvos) {
    if (resultado.get(a.fid)) continue; // a outra conta já está em partida
    const r = await riot(`https://${a.plataforma}.api.riotgames.com/lol/spectator/v5/active-games/by-summoner/${encodeURIComponent(a.puuid)}`);
    if (r.status === 401 || r.status === 403) return "A chave da Riot está errada ou venceu.";
    if (r.status === 429) { erro = "A Riot pediu para esperar (limite de consultas)."; completo = false; break; }
    if (r.status === 404) { if (!resultado.has(a.fid)) resultado.set(a.fid, null); continue; }
    if (r.status !== 200 || !r.body) { erro = `Riot respondeu ${r.status} ao procurar partida.`; completo = false; continue; }
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

  // 4) apostas: abre o mercado de cada partida de dois times (fecha 5 min depois do início)
  const vivos = new Set<number>();
  for (const l of linhas) {
    const j = l.jogo;
    if (!j || !j.gameId || vivos.has(j.gameId)) continue; // vários nanicos na mesma partida: uma vez só
    vivos.add(j.gameId);
    const times = new Set(j.participantes.map((p: any) => p.time));
    if (j.queueId === 1700 || times.size !== 2 || !times.has(100) || !times.has(200)) continue; // Arena e afins: sem aposta
    const nanicos: Record<string, number> = {};
    for (const p of j.participantes) if (p.fid) nanicos[p.fid] = p.time;
    const { error: ea } = await admin.rpc("apostas_abrir", { p_game: j.gameId, p_plataforma: j.plataforma, p_inicio_ms: j.inicio, p_nanicos: nanicos });
    if (ea) console.error("apostas_abrir", ea.message);
  }
  // 5) partida que sumiu: pergunta o resultado à Riot e paga (tenta de novo nos próximos ciclos até achar)
  if (completo) {
    const { data: abertos } = await admin.from("apostas_mercados").select("game_id,plataforma,aberto_em").eq("estado", "aberto").order("aberto_em").limit(20);
    let consultas = 0;
    for (const m of abertos ?? []) {
      const game = Number(m.game_id);
      if (vivos.has(game)) continue;
      const plat = String(m.plataforma ?? "").toLowerCase();
      const velho = Date.now() - Date.parse(m.aberto_em) > DESISTE_MS;
      const regiao = REGIAO[plat];
      if (!regiao || consultas >= RESULTADOS_POR_VEZ) {
        if (velho) await liquidar(admin, game, null, true, "sem_resultado");
        continue;
      }
      consultas++;
      const r = await riot(`https://${regiao}.api.riotgames.com/lol/match/v5/matches/${plat.toUpperCase()}_${game}`);
      if (r.status === 401 || r.status === 403) return "A chave da Riot está errada ou venceu.";
      if (r.status === 429) break;
      const info = r.status === 200 ? r.body?.info : null;
      if (info && Array.isArray(info.teams)) {
        // gameDuration vem em segundos quando existe gameEndTimestamp (senão, em milissegundos)
        const dur = info.gameEndTimestamp ? Number(info.gameDuration) : Number(info.gameDuration) / 1000;
        const remake = dur < 300 || (info.participants ?? []).some((p: any) => p.gameEndedInEarlySurrender);
        const venc = Number(info.teams.find((t: any) => t.win === true)?.teamId) || null;
        await liquidar(admin, game, venc, remake, remake ? "remake" : null);
      } else if (velho) {
        await liquidar(admin, game, null, true, "sem_resultado");
      }
    }
  }
  return erro;
}

async function liquidar(admin: any, game: number, vencedor: number | null, remake: boolean, fim: string | null) {
  const { error } = await admin.rpc("apostas_liquidar", { p_game: game, p_vencedor: vencedor, p_remake: remake, p_fim: fim });
  if (error) console.error("apostas_liquidar", game, error.message);
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
