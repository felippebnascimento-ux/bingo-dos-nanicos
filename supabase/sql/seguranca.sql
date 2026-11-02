-- Bingo dos Nanicos: proteções extras do banco (anti-spam e limites de tamanho)
-- Cole tudo no SQL Editor do Supabase e clique em "Run". Pode rodar de novo sem problema.
-- Rode depois do contas-e-ao-vivo.sql. Barra abuso e libera editar/remover nanicadas
-- (com vários nanicos e o modo "qualquer um" ou "todos").

-- 1) contador interno de ações (ninguém do site consegue ler ou mexer) -------------
create table if not exists public.limites (
  user_id uuid not null,
  acao    text not null,
  at      timestamptz not null default now()
);
create index if not exists limites_busca on public.limites (user_id, acao, at desc);
alter table public.limites enable row level security;
revoke all on public.limites from public, anon, authenticated;

-- barra quem passar de p_max ações em p_janela (o SQL Editor do admin não tem limite)
create or replace function public.limitar(p_acao text, p_max int, p_janela interval, p_msg text)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  v_n   int;
begin
  if v_uid is null then return; end if;
  delete from public.limites where user_id = v_uid and acao = p_acao and at < now() - interval '1 day';
  select count(*) into v_n from public.limites where user_id = v_uid and acao = p_acao and at > now() - p_janela;
  if v_n >= p_max then raise exception '%', p_msg using errcode = 'P0001'; end if;
  insert into public.limites (user_id, acao) values (v_uid, p_acao);
end $$;
revoke all on function public.limitar(text, int, interval, text) from public, anon, authenticated;

-- 2) chat: até 8 mensagens a cada 10 s e 300 por hora por pessoa ------------------
create or replace function public.chat_protecao() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  new.text := left(btrim(regexp_replace(new.text, '[\x00-\x08\x0B-\x1F\x7F]', '', 'g')), 300);
  if char_length(new.text) = 0 then raise exception 'Mensagem vazia' using errcode = 'P0001'; end if;
  new.created_at := now();
  perform public.limitar('chat', 8, interval '10 seconds', 'Calma: muitas mensagens seguidas. Espere alguns segundos.');
  perform public.limitar('chat_hora', 300, interval '1 hour', 'Calma: limite de mensagens por hora atingido.');
  return new;
end $$;
drop trigger if exists chat_protecao on public.chat_messages;
create trigger chat_protecao before insert on public.chat_messages for each row execute function public.chat_protecao();

-- 3) nanicadas: vários nanicos, modo "qualquer"/"todos", editar e remover --------------
--    Todo nanico logado pode editar e remover. Cada edição e remoção fica guardada no
--    histórico (public.nanicadas_historico) para dar para desfazer vandalismo pelo Table Editor.
alter table public.phrases add column if not exists friend_ids uuid[] not null default '{}';
alter table public.phrases add column if not exists modo text not null default 'qualquer';
alter table public.phrases add column if not exists updated_at timestamptz;
alter table public.phrases add column if not exists updated_by uuid;
alter table public.phrases drop constraint if exists phrases_modo_valido;
alter table public.phrases add constraint phrases_modo_valido check (modo in ('qualquer', 'todos'));
update public.phrases set friend_ids = array[friend_id] where friend_id is not null and friend_ids = '{}';

create table if not exists public.nanicadas_historico (
  id          bigint generated always as identity primary key,
  acao        text not null,                 -- 'editada' (guarda como era antes) ou 'removida'
  nanicada_id uuid not null,
  text        text,
  friend_ids  uuid[],
  champions   text[],
  modo        text,
  created_by  uuid,
  created_at  timestamptz,
  feito_por   uuid,
  feito_em    timestamptz not null default now()
);
alter table public.nanicadas_historico enable row level security;
revoke all on public.nanicadas_historico from public, anon, authenticated;

grant insert (text, friend_id, friend_ids, champions, modo) on public.phrases to authenticated;
grant update (text, friend_ids, champions, modo) on public.phrases to authenticated;
grant delete on public.phrases to authenticated;
drop policy if exists "nanicos editam"  on public.phrases;
drop policy if exists "nanicos removem" on public.phrases;
create policy "nanicos editam"  on public.phrases for update to authenticated using (public.eh_nanico()) with check (public.eh_nanico());
create policy "nanicos removem" on public.phrases for delete to authenticated using (public.eh_nanico());

create or replace function public.nanicada_protecao() returns trigger
language plpgsql security definer set search_path = public as $$
declare c text;
begin
  new.text := lower(btrim(regexp_replace(new.text, '[\x00-\x1F\x7F]', '', 'g')));
  if char_length(new.text) not between 1 and 90 then raise exception 'A nanicada precisa ter de 1 a 90 letras' using errcode = 'P0001'; end if;
  -- campeões: sem vazio, sem repetir, nome curto, no máximo 20
  new.champions := coalesce((select array_agg(distinct btrim(x)) from unnest(new.champions) x where btrim(x) <> ''), '{}');
  foreach c in array new.champions loop
    if char_length(c) > 30 then raise exception 'Nome de campeão comprido demais' using errcode = 'P0001'; end if;
  end loop;
  if coalesce(array_length(new.champions, 1), 0) > 20 then raise exception 'No máximo 20 campeões por nanicada' using errcode = 'P0001'; end if;
  -- nanicos: site antigo manda friend_id, o novo manda friend_ids; só vale nanico que existe
  if tg_op = 'INSERT' and coalesce(array_length(new.friend_ids, 1), 0) = 0 and new.friend_id is not null then
    new.friend_ids := array[new.friend_id];
  end if;
  new.friend_ids := coalesce((select array_agg(distinct x) from unnest(new.friend_ids) x where x is not null), '{}');
  if exists (select 1 from unnest(new.friend_ids) x where not exists (select 1 from public.friends f where f.id = x)) then
    raise exception 'Nanico não encontrado' using errcode = 'P0001';
  end if;
  new.friend_id := new.friend_ids[1];
  if new.modo is null or new.modo not in ('qualquer', 'todos') then new.modo := 'qualquer'; end if;

  if tg_op = 'INSERT' then
    new.created_at := now();
    perform public.limitar('nanicada', 15, interval '10 minutes', 'Calma: muitas nanicadas seguidas. Espere uns minutos.');
    if (select count(*) from public.phrases) >= 3000 then raise exception 'O banco de nanicadas está cheio' using errcode = 'P0001'; end if;
  else
    new.id := old.id; new.created_at := old.created_at; new.created_by := old.created_by;
    new.updated_at := now(); new.updated_by := auth.uid();
    perform public.limitar('editar', 30, interval '10 minutes', 'Calma: muitas edições seguidas. Espere uns minutos.');
    insert into public.nanicadas_historico (acao, nanicada_id, text, friend_ids, champions, modo, created_by, created_at, feito_por)
      values ('editada', old.id, old.text, old.friend_ids, old.champions, old.modo, old.created_by, old.created_at, auth.uid());
  end if;
  return new;
end $$;
drop trigger if exists nanicada_protecao on public.phrases;
create trigger nanicada_protecao before insert or update on public.phrases for each row execute function public.nanicada_protecao();

create or replace function public.nanicada_remocao() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  perform public.limitar('remover', 20, interval '10 minutes', 'Calma: muitas remoções seguidas. Espere uns minutos.');
  insert into public.nanicadas_historico (acao, nanicada_id, text, friend_ids, champions, modo, created_by, created_at, feito_por)
    values ('removida', old.id, old.text, old.friend_ids, old.champions, old.modo, old.created_by, old.created_at, auth.uid());
  return old;
end $$;
drop trigger if exists nanicada_remocao on public.phrases;
create trigger nanicada_remocao before delete on public.phrases for each row execute function public.nanicada_remocao();

-- Para devolver uma nanicada removida (troque o número pelo id da linha no histórico):
-- insert into public.phrases (text, friend_ids, champions, modo)
--   select text, friend_ids, champions, modo from public.nanicadas_historico where id = 1;

-- 4) escalação: formato certo (5 rotas), tamanho pequeno, até 60 mudanças por minuto ----
create or replace function public.escalacao_protecao() returns trigger
language plpgsql security definer set search_path = public as $$
declare e jsonb;
begin
  if jsonb_typeof(new.players) <> 'array' or jsonb_array_length(new.players) > 5 or length(new.players::text) > 1500 then
    raise exception 'Escalação inválida' using errcode = 'P0001';
  end if;
  for e in select * from jsonb_array_elements(new.players) loop
    if jsonb_typeof(e) <> 'object'
       or (e ? 'friendId' and jsonb_typeof(e->'friendId') <> 'string')
       or (e ? 'champion' and jsonb_typeof(e->'champion') <> 'string')
       or length(coalesce(e->>'friendId', '')) > 64
       or length(coalesce(e->>'champion', '')) > 30
       or exists (select 1 from jsonb_object_keys(e) k where k not in ('friendId', 'champion')) then
      raise exception 'Escalação inválida' using errcode = 'P0001';
    end if;
  end loop;
  new.updated_at := now();
  perform public.limitar('escalacao', 60, interval '1 minute', 'Calma: muitas mudanças na escalação. Espere um pouco.');
  return new;
end $$;
drop trigger if exists escalacao_protecao on public.game;
create trigger escalacao_protecao before update on public.game for each row execute function public.escalacao_protecao();

-- 4b) perfil: cada nanico coloca o link do próprio op.gg (só o dele) -------------------
alter table public.friends add column if not exists opgg text;
alter table public.friends drop constraint if exists friends_opgg_valido;
alter table public.friends add constraint friends_opgg_valido check (
  opgg is null or (char_length(opgg) <= 300 and opgg ~* '^https://([a-z0-9-]+\.)?op\.gg(/[^\s<>"'']*)?$'));
grant update (opgg) on public.friends to authenticated;
drop policy if exists "nanico edita o proprio perfil" on public.friends;
create policy "nanico edita o proprio perfil" on public.friends for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- (a versão atual desta proteção, que deixa passar também a Steam, fica na seção 8)
create or replace function public.perfil_protecao() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then return new; end if;   -- admin pelo SQL Editor
  -- pelo site só muda o op.gg; o resto continua como estava
  new.id := old.id; new.name := old.name; new.photo := old.photo; new.user_id := old.user_id;
  new.username := old.username; new.created_at := old.created_at;
  new.opgg := nullif(btrim(new.opgg), '');
  perform public.limitar('perfil', 10, interval '10 minutes', 'Calma: muitas mudanças no perfil. Espere uns minutos.');
  return new;
end $$;
drop trigger if exists perfil_protecao on public.friends;
create trigger perfil_protecao before update on public.friends for each row execute function public.perfil_protecao();

-- 4c) partida ao vivo pela API da Riot (usada só pela função riot-ao-vivo) ------------
--     Ninguém do site lê estas tabelas direto: a função lê e devolve só o necessário.
create table if not exists public.riot_contas (
  friend_id  uuid primary key references public.friends(id) on delete cascade,
  riot_id    text not null,
  puuid      text,
  atualizado timestamptz not null default now()
);
create table if not exists public.riot_ao_vivo (
  friend_id  uuid primary key references public.friends(id) on delete cascade,
  game_id    bigint,
  jogo       jsonb,
  atualizado timestamptz not null default now()
);
create table if not exists public.riot_meta (
  id         int primary key default 1 check (id = 1),
  checado_em timestamptz,
  erro       text
);
insert into public.riot_meta (id) values (1) on conflict (id) do nothing;
alter table public.riot_contas  enable row level security;
alter table public.riot_ao_vivo enable row level security;
alter table public.riot_meta    enable row level security;
revoke all on public.riot_contas, public.riot_ao_vivo, public.riot_meta from public, anon, authenticated;

-- "é a minha vez de perguntar à Riot?": só uma chamada por intervalo ganha
create or replace function public.riot_vez(p_segundos int) returns boolean
language sql security definer set search_path = public as $$
  update public.riot_meta set checado_em = now()
   where id = 1 and (checado_em is null or checado_em < now() - make_interval(secs => greatest(p_segundos, 20)))
  returning true;
$$;
revoke all on function public.riot_vez(int) from public, anon, authenticated;
do $$ begin
  if exists (select 1 from pg_roles where rolname = 'service_role') then
    grant all on public.riot_contas, public.riot_ao_vivo, public.riot_meta to service_role;
    grant execute on function public.riot_vez(int) to service_role;
  end if;
end $$;

-- 5) funções internas: ninguém do site chama direto
revoke all on function public.chat_protecao()      from public, anon, authenticated;
revoke all on function public.nanicada_protecao()  from public, anon, authenticated;
revoke all on function public.nanicada_remocao()   from public, anon, authenticated;
revoke all on function public.escalacao_protecao() from public, anon, authenticated;
revoke all on function public.perfil_protecao()    from public, anon, authenticated;

-- 6) a conferência fica no fim do arquivo

-- 7) moedas: carteira, bônus diário, sequência e tempo online ---------------------------
--    O saldo só muda por public.creditar(), chamada de dentro de outras funções do banco.
--    Ninguém do site grava nada direto nestas tabelas. O "dia" é sempre o de Brasília.
create table if not exists public.carteiras (
  user_id   uuid primary key references auth.users(id) on delete cascade,
  saldo     int not null default 200 check (saldo >= 0),
  criada_em timestamptz not null default now()
);
create table if not exists public.extrato (
  id      bigint generated always as identity primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  valor   int not null,
  motivo  text not null check (motivo in ('inicio', 'diario', 'sequencia', 'online', 'cassino', 'bingo', 'truco', 'aposta', 'loja', 'admin')),
  ref     text,
  em      timestamptz not null default now()
);
create index if not exists extrato_busca on public.extrato (user_id, em desc);
-- a chave (pessoa, dia) impede pegar o bônus duas vezes no mesmo dia
create table if not exists public.bonus_diario (
  user_id uuid not null references auth.users(id) on delete cascade,
  dia     date not null,
  seq     int not null,
  valor   int not null,
  primary key (user_id, dia)
);
create table if not exists public.online_diario (
  user_id      uuid not null references auth.users(id) on delete cascade,
  dia          date not null,
  minutos      int not null default 0,
  ultimo_pulso timestamptz,
  primary key (user_id, dia)
);
alter table public.carteiras     enable row level security;
alter table public.extrato       enable row level security;
alter table public.bonus_diario  enable row level security;
alter table public.online_diario enable row level security;
revoke all on public.carteiras, public.extrato, public.bonus_diario, public.online_diario from public, anon, authenticated;
grant select on public.carteiras, public.extrato, public.bonus_diario, public.online_diario to authenticated;
drop policy if exists "nanicos veem as carteiras" on public.carteiras;
drop policy if exists "cada um ve o seu extrato"  on public.extrato;
drop policy if exists "cada um ve o seu bonus"    on public.bonus_diario;
drop policy if exists "cada um ve o seu tempo"    on public.online_diario;
-- o saldo de todo mundo é público no grupo (ranking); o resto, só o de cada um
create policy "nanicos veem as carteiras" on public.carteiras     for select to authenticated using (public.eh_nanico());
create policy "cada um ve o seu extrato"  on public.extrato       for select to authenticated using (user_id = auth.uid());
create policy "cada um ve o seu bonus"    on public.bonus_diario  for select to authenticated using (user_id = auth.uid());
create policy "cada um ve o seu tempo"    on public.online_diario for select to authenticated using (user_id = auth.uid());

create or replace function public.hoje_br() returns date language sql stable as $$
  select (now() at time zone 'America/Sao_Paulo')::date;
$$;

-- a ÚNICA coisa que muda saldo. Interna: as outras funções do banco chamam, o site não.
-- Cria a carteira na primeira vez (com +200 no extrato) e não deixa o saldo ficar negativo.
create or replace function public.creditar(p_user uuid, p_valor int, p_motivo text, p_ref text default null)
returns int language plpgsql security definer set search_path = public as $$
declare
  v_saldo int;
begin
  if p_user is null then raise exception 'Sem usuário para creditar.' using errcode = 'P0001'; end if;
  insert into public.carteiras (user_id) values (p_user) on conflict (user_id) do nothing;
  if found then insert into public.extrato (user_id, valor, motivo) values (p_user, 200, 'inicio'); end if;
  select saldo into v_saldo from public.carteiras where user_id = p_user for update;
  if v_saldo + p_valor < 0 then raise exception 'Saldo insuficiente.' using errcode = 'P0001'; end if;
  if p_valor <> 0 then
    update public.carteiras set saldo = saldo + p_valor where user_id = p_user returning saldo into v_saldo;
    insert into public.extrato (user_id, valor, motivo, ref) values (p_user, p_valor, p_motivo, p_ref);
  end if;
  return v_saldo;
end $$;
revoke all on function public.creditar(uuid, int, text, text) from public, anon, authenticated;

-- saldo, sequência atual (0 se quebrou), se já pegou o bônus hoje e os minutos online de hoje
create or replace function public.minha_carteira() returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  v_uid   uuid := auth.uid();
  v_hoje  date := public.hoje_br();
  v_saldo int;
  v_seq   int;
  v_pegou boolean;
  v_min   int;
begin
  if not public.eh_nanico() then raise exception 'Só nanicos têm carteira.' using errcode = 'P0001'; end if;
  select saldo into v_saldo from public.carteiras where user_id = v_uid;
  select seq into v_seq from public.bonus_diario where user_id = v_uid and dia = v_hoje;
  v_pegou := v_seq is not null;
  if not v_pegou then
    select seq into v_seq from public.bonus_diario where user_id = v_uid and dia = v_hoje - 1;
  end if;
  select minutos into v_min from public.online_diario where user_id = v_uid and dia = v_hoje;
  return jsonb_build_object('saldo', coalesce(v_saldo, 200), 'seq', coalesce(v_seq, 0), 'pegou_hoje', v_pegou,
                            'minutos_hoje', coalesce(v_min, 0));
end $$;
revoke all on function public.minha_carteira() from public, anon;
grant execute on function public.minha_carteira() to authenticated;

-- bônus do dia: round(30 × min(1 + 0,1 × (dia − 1), 2)); +100 no 7º dia seguido e +500 no 30º.
-- Chamar de novo no mesmo dia não paga nada (só devolve a carteira).
create or replace function public.bater_ponto() returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_uid   uuid := auth.uid();
  v_hoje  date := public.hoje_br();
  v_seq   int;
  v_valor int;
  v_extra int := 0;
begin
  if not public.eh_nanico() then raise exception 'Só nanicos ganham o bônus.' using errcode = 'P0001'; end if;
  perform public.limitar('ponto', 20, interval '1 minute', 'Calma: espere um pouco e recarregue a página.');
  select seq + 1 into v_seq from public.bonus_diario where user_id = v_uid and dia = v_hoje - 1;
  v_seq := coalesce(v_seq, 1);
  v_valor := round(30 * least(1 + 0.1 * (v_seq - 1), 2));
  insert into public.bonus_diario (user_id, dia, seq, valor) values (v_uid, v_hoje, v_seq, v_valor)
    on conflict (user_id, dia) do nothing;
  if not found then
    return public.minha_carteira() || jsonb_build_object('ganhou', 0, 'bonus_extra', 0);
  end if;
  perform public.creditar(v_uid, v_valor, 'diario', v_hoje::text);
  if v_seq = 7 then v_extra := 100; elsif v_seq = 30 then v_extra := 500; end if;
  if v_extra > 0 then perform public.creditar(v_uid, v_extra, 'sequencia', v_seq || ' dias seguidos'); end if;
  return public.minha_carteira() || jsonb_build_object('ganhou', v_valor, 'bonus_extra', v_extra);
end $$;
revoke all on function public.bater_ponto() from public, anon;
grant execute on function public.bater_ponto() to authenticated;

-- tempo online: o site manda um pulso por minuto (mesmo com a aba escondida).
-- Conta 1 minuto quando o último pulso que valeu foi entre 55 s e 150 s atrás:
-- pulsos mais rápidos (ou várias abas) não aceleram, e mais de 150 s parado recomeça sem contar.
-- A cada 6 minutos, +1 moeda, até 40 por dia (240 minutos).
create or replace function public.pulso() returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_uid  uuid := auth.uid();
  v_hoje date := public.hoje_br();
  v_min  int;
  v_ult  timestamptz;
begin
  if not public.eh_nanico() then raise exception 'Só nanicos ganham moedas.' using errcode = 'P0001'; end if;
  perform public.limitar('pulso', 6, interval '1 minute', 'Calma: muitos pulsos seguidos.');
  insert into public.online_diario (user_id, dia) values (v_uid, v_hoje) on conflict (user_id, dia) do nothing;
  select minutos, ultimo_pulso into v_min, v_ult from public.online_diario
   where user_id = v_uid and dia = v_hoje for update;
  if v_ult is null or now() - v_ult > interval '150 seconds' then
    update public.online_diario set ultimo_pulso = now() where user_id = v_uid and dia = v_hoje;
  elsif now() - v_ult >= interval '55 seconds' then
    v_min := v_min + 1;
    update public.online_diario set minutos = v_min, ultimo_pulso = now() where user_id = v_uid and dia = v_hoje;
    if v_min % 6 = 0 and v_min <= 240 then perform public.creditar(v_uid, 1, 'online', v_hoje::text); end if;
  end if;
  return public.minha_carteira();
end $$;
revoke all on function public.pulso() from public, anon;
grant execute on function public.pulso() to authenticated;

-- 8) ficha do nanico: link da Steam e números dos jogos (Riot e Steam) -------------------
--    Os números vêm da função ficha-jogos (com as chaves secretas); o site só lê.
alter table public.friends add column if not exists steam text;
alter table public.friends drop constraint if exists friends_steam_valido;
alter table public.friends add constraint friends_steam_valido check (
  steam is null or steam ~ '^https://steamcommunity\.com/(id/[A-Za-z0-9_-]{2,32}|profiles/7656\d{13})/?$');
grant update (steam) on public.friends to authenticated;

-- a mesma proteção do perfil (4b), agora deixando passar o op.gg e a Steam
create or replace function public.perfil_protecao() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then return new; end if;   -- admin pelo SQL Editor
  -- pelo site só mudam o op.gg e a Steam; o resto continua como estava
  new.id := old.id; new.name := old.name; new.photo := old.photo; new.user_id := old.user_id;
  new.username := old.username; new.created_at := old.created_at;
  new.opgg := nullif(btrim(new.opgg), '');
  new.steam := nullif(btrim(new.steam), '');
  perform public.limitar('perfil', 10, interval '10 minutes', 'Calma: muitas mudanças no perfil. Espere uns minutos.');
  return new;
end $$;
revoke all on function public.perfil_protecao() from public, anon, authenticated;

-- números de cada nanico por fonte, guardados pela função (no máximo uma busca a cada 6 h)
--   lol:   {tier, rank, lp, vitorias, derrotas, kda, main, partidas}
--   steam: {cs2_horas, total_horas, privado}
create table if not exists public.jogos_stats (
  friend_id  uuid not null references public.friends(id) on delete cascade,
  fonte      text not null check (fonte in ('lol', 'steam')),
  dados      jsonb not null default '{}'::jsonb check (octet_length(dados::text) <= 2000),
  erro       text,
  atualizado timestamptz not null default now(),
  primary key (friend_id, fonte)
);
-- partidas do LoL já lidas: o KDA das últimas 20 é calculado sem buscar tudo de novo
create table if not exists public.riot_partidas_vistas (
  friend_id uuid not null references public.friends(id) on delete cascade,
  match_id  text not null,
  kills     int not null default 0,
  deaths    int not null default 0,
  assists   int not null default 0,
  campeao   text,
  em        timestamptz,
  primary key (friend_id, match_id)
);
alter table public.jogos_stats          enable row level security;
alter table public.riot_partidas_vistas enable row level security;
revoke all on public.jogos_stats, public.riot_partidas_vistas from public, anon, authenticated;
grant select on public.jogos_stats to authenticated;
drop policy if exists "nanicos leem os numeros" on public.jogos_stats;
create policy "nanicos leem os numeros" on public.jogos_stats for select to authenticated using (public.eh_nanico());
do $$ begin
  if exists (select 1 from pg_roles where rolname = 'service_role') then
    grant all on public.jogos_stats, public.riot_partidas_vistas to service_role;
  end if;
end $$;

-- 9) atributos: a metade zoeira da ficha (tilt, choro, clutch, farm, sorte e call), com voto anônimo -----
--    Ninguém lê os votos direto (nem select): o site só recebe a média e a contagem por atributo.
--    Com menos de 3 votos a média não aparece, para ninguém adivinhar quem votou.
create table if not exists public.atributos_votos (
  de       uuid not null references auth.users(id) on delete cascade,
  para     uuid not null references public.friends(id) on delete cascade,
  atributo text not null check (atributo in ('tilt', 'choro', 'clutch', 'farm', 'sorte', 'call')),
  nota     smallint not null check (nota between 0 and 10),
  em       timestamptz not null default now(),
  primary key (de, para, atributo)
);
alter table public.atributos_votos enable row level security;
revoke all on public.atributos_votos from public, anon, authenticated;

-- vota nas 6 notas de um nanico (nunca em si mesmo); dá para mudar uma vez por semana
create or replace function public.votar_atributos(p_para uuid, p_notas jsonb) returns void
language plpgsql security definer set search_path = public as $$
declare
  v_uid    uuid := auth.uid();
  v_chaves text[] := array['tilt', 'choro', 'clutch', 'farm', 'sorte', 'call'];
  v_nome   text;
  v_ultimo timestamptz;
  k        text;
begin
  if not public.eh_nanico() then raise exception 'Só nanicos votam.' using errcode = 'P0001'; end if;
  select name into v_nome from public.friends where id = p_para;
  if v_nome is null then raise exception 'Nanico não encontrado.' using errcode = 'P0001'; end if;
  if exists (select 1 from public.friends where id = p_para and user_id = v_uid) then
    raise exception 'Você não pode votar em você mesmo.' using errcode = 'P0001';
  end if;
  if p_notas is null or jsonb_typeof(p_notas) <> 'object'
     or (select count(*) from jsonb_object_keys(p_notas)) <> 6
     or exists (select 1 from jsonb_object_keys(p_notas) c where c <> all (v_chaves)) then
    raise exception 'Mande as 6 notas: tilt, choro, clutch, farm, sorte e call.' using errcode = 'P0001';
  end if;
  foreach k in array v_chaves loop
    if jsonb_typeof(p_notas -> k) <> 'number' or (p_notas ->> k)::numeric not in (0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10) then
      raise exception 'Cada nota é um número inteiro de 0 a 10.' using errcode = 'P0001';
    end if;
  end loop;
  select max(em) into v_ultimo from public.atributos_votos where de = v_uid and para = p_para;
  if v_ultimo > now() - interval '7 days' then
    raise exception 'Você já votou no % esta semana. Dá para mudar a partir de %.', v_nome,
      to_char((v_ultimo + interval '7 days') at time zone 'America/Sao_Paulo', 'DD/MM') using errcode = 'P0001';
  end if;
  perform public.limitar('votar', 20, interval '10 minutes', 'Calma: muitos votos seguidos. Espere uns minutos.');
  insert into public.atributos_votos (de, para, atributo, nota, em)
    select v_uid, p_para, c, ((p_notas ->> c)::numeric)::smallint, now() from unnest(v_chaves) c
  on conflict (de, para, atributo) do update set nota = excluded.nota, em = excluded.em;
end $$;
revoke all on function public.votar_atributos(uuid, jsonb) from public, anon;
grant execute on function public.votar_atributos(uuid, jsonb) to authenticated;

-- média (só com 3 votos ou mais) e contagem de cada atributo de um nanico
create or replace function public.atributos_de(p_para uuid) returns jsonb
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.eh_nanico() then raise exception 'Só nanicos veem os atributos.' using errcode = 'P0001'; end if;
  return (
    select jsonb_object_agg(t.atributo, jsonb_build_object('media', t.media, 'votos', t.votos))
      from (select a.atributo, count(v.nota)::int as votos,
                   case when count(v.nota) >= 3 then round(avg(v.nota), 1)::numeric(3, 1) end as media
              from unnest(array['tilt', 'choro', 'clutch', 'farm', 'sorte', 'call']) a(atributo)
              left join public.atributos_votos v on v.atributo = a.atributo and v.para = p_para
             group by a.atributo) t);
end $$;
revoke all on function public.atributos_de(uuid) from public, anon;
grant execute on function public.atributos_de(uuid) to authenticated;

-- os atributos de todos os nanicos de uma vez ({id do nanico: atributos_de})
create or replace function public.atributos_todos() returns jsonb
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.eh_nanico() then raise exception 'Só nanicos veem os atributos.' using errcode = 'P0001'; end if;
  return (select coalesce(jsonb_object_agg(f.id, public.atributos_de(f.id)), '{}'::jsonb) from public.friends f);
end $$;
revoke all on function public.atributos_todos() from public, anon;
grant execute on function public.atributos_todos() to authenticated;

-- as MINHAS notas para um nanico e a partir de quando posso mudar (nunca as dos outros)
create or replace function public.meu_voto(p_para uuid) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  v_notas jsonb;
  v_em    timestamptz;
begin
  if not public.eh_nanico() then raise exception 'Só nanicos votam.' using errcode = 'P0001'; end if;
  select jsonb_object_agg(atributo, nota), max(em) into v_notas, v_em
    from public.atributos_votos where de = auth.uid() and para = p_para;
  return jsonb_build_object('notas', v_notas, 'muda_em', case when v_em is not null then v_em + interval '7 days' end);
end $$;
revoke all on function public.meu_voto(uuid) from public, anon;
grant execute on function public.meu_voto(uuid) to authenticated;

-- 10) confere: deve listar as 5 proteções, as 4 funções das moedas, as 2 tabelas da ficha e as 4 funções dos atributos
select tgname::text as item, tgrelid::regclass::text as onde from pg_trigger
 where tgname in ('chat_protecao', 'nanicada_protecao', 'nanicada_remocao', 'escalacao_protecao', 'perfil_protecao')
union all
select proname::text, 'moedas' from pg_proc
 where pronamespace = 'public'::regnamespace and proname in ('creditar', 'minha_carteira', 'bater_ponto', 'pulso')
union all
select tablename::text, 'ficha' from pg_tables
 where schemaname = 'public' and tablename in ('jogos_stats', 'riot_partidas_vistas')
union all
select proname::text, 'atributos' from pg_proc
 where pronamespace = 'public'::regnamespace and proname in ('votar_atributos', 'atributos_de', 'atributos_todos', 'meu_voto')
order by 2, 1;
