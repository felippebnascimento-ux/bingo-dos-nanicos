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
  motivo  text not null check (motivo in ('inicio', 'diario', 'sequencia', 'online', 'cassino', 'bingo', 'truco', 'aposta', 'loja', 'admin', 'zoeira')),
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

-- 7b) moedas ao vivo: o último ganho de cada um, para o Sítio mostrar os ganhos de todo mundo ---------
--     Vem do banco (tempo real da tabela carteiras), nunca de broadcast: ninguém consegue forjar.
alter table public.carteiras add column if not exists ultimo_valor  int;
alter table public.carteiras add column if not exists ultimo_motivo text;
alter table public.carteiras add column if not exists ultimo_em     timestamptz;

-- a mesma creditar() da seção 7, agora gravando o último ganho no mesmo update do saldo
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
    update public.carteiras set saldo = saldo + p_valor, ultimo_valor = p_valor, ultimo_motivo = p_motivo, ultimo_em = now()
     where user_id = p_user returning saldo into v_saldo;
    insert into public.extrato (user_id, valor, motivo, ref) values (p_user, p_valor, p_motivo, p_ref);
  end if;
  return v_saldo;
end $$;
revoke all on function public.creditar(uuid, int, text, text) from public, anon, authenticated;

do $$
begin
  begin alter publication supabase_realtime add table public.carteiras; exception when duplicate_object then null; end;
end $$;

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

-- 10) salas tipo lan house: LoL 1, LoL 2, CS e Resenha --------------------------------------
--     O lobby continua no canal "bingo-dos-nanicos" (quem está com o site antigo aberto segue funcionando).
--     Cada sala tem o seu canal "sala:<id>" para a live, as câmeras, as reações e o desenho.
create table if not exists public.salas (
  id      text primary key check (id ~ '^[a-z0-9-]{2,20}$'),
  nome    text not null check (char_length(nome) between 1 and 30),
  jogo    text not null check (jogo in ('lol', 'cs', 'outro')),
  discord text check (discord is null or char_length(discord) <= 40),
  ordem   int not null default 0
);
insert into public.salas (id, nome, jogo, ordem) values
  ('lol-1', 'LoL 1', 'lol', 1), ('lol-2', 'LoL 2', 'lol', 2), ('cs', 'CS', 'cs', 3), ('resenha', 'Resenha', 'outro', 4)
on conflict (id) do nothing;
alter table public.salas enable row level security;
revoke all on public.salas from public, anon, authenticated;
grant select on public.salas to authenticated;
drop policy if exists "nanicos veem as salas" on public.salas;
create policy "nanicos veem as salas" on public.salas for select to authenticated using (public.eh_nanico());

-- canal do lobby (o mesmo de antes) e um canal por sala existente; sempre só nanicos
drop policy if exists "nanicos entram na sala" on realtime.messages;
drop policy if exists "nanicos falam na sala"  on realtime.messages;
create policy "nanicos entram na sala" on realtime.messages for select to authenticated
  using (public.eh_nanico() and (realtime.topic() = 'bingo-dos-nanicos'
         or exists (select 1 from public.salas s where 'sala:' || s.id = realtime.topic())));
create policy "nanicos falam na sala" on realtime.messages for insert to authenticated
  with check (public.eh_nanico() and (realtime.topic() = 'bingo-dos-nanicos'
         or exists (select 1 from public.salas s where 'sala:' || s.id = realtime.topic())));

-- chat: 'geral' é o do lobby; nas salas, o id da sala (o chat antigo vira o geral)
alter table public.chat_messages add column if not exists sala text not null default 'geral';
create index if not exists chat_messages_sala on public.chat_messages (sala, created_at desc);
grant insert (text, sala) on public.chat_messages to authenticated;
create or replace function public.chat_sala_protecao() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.sala <> 'geral' and not exists (select 1 from public.salas where id = new.sala) then
    raise exception 'Essa sala não existe.' using errcode = 'P0001';
  end if;
  return new;
end $$;
revoke all on function public.chat_sala_protecao() from public, anon, authenticated;
drop trigger if exists chat_sala_protecao on public.chat_messages;
create trigger chat_sala_protecao before insert on public.chat_messages for each row execute function public.chat_sala_protecao();

-- escalação: uma linha por sala de LoL (a linha 1, a de sempre, vira a da LoL 1)
alter table public.game add column if not exists sala text;
alter table public.game drop constraint if exists game_id_check;
alter table public.game drop constraint if exists game_id_faixa;
alter table public.game add constraint game_id_faixa check (id between 1 and 100);
update public.game set sala = 'lol-1' where id = 1 and sala is null;
insert into public.game (id, sala) values (2, 'lol-2') on conflict (id) do nothing;
create unique index if not exists game_sala on public.game (sala);
drop policy if exists "nanicos mudam a escalacao" on public.game;
create policy "nanicos mudam a escalacao" on public.game for update to authenticated
  using (public.eh_nanico() and sala is not null) with check (public.eh_nanico() and sala is not null);

-- 11) cassino: motor justo ("provably fair") e a roleta europeia ------------------------------
--     Moedas fictícias, sem compra e sem saque. O sorteio acontece AQUI, nunca no navegador:
--     u = primeiros 52 bits de HMAC-SHA256(chave = semente do servidor, texto = "semente_cliente:nonce").
--     Antes de apostar a pessoa vê o hash da semente; ao trocar de semente, a antiga é revelada e
--     qualquer um recalcula os resultados.
create extension if not exists pgcrypto with schema extensions;

create table if not exists public.cassino_sementes (
  user_id         uuid primary key references auth.users(id) on delete cascade,
  semente         bytea not null,
  hash            text not null,
  semente_cliente text not null default 'nanico' check (semente_cliente ~ '^[A-Za-z0-9_-]{1,32}$'),
  nonce           int not null default 0,
  criada_em       timestamptz not null default now()
);
create table if not exists public.cassino_sementes_antigas (
  id              bigint generated always as identity primary key,
  user_id         uuid not null references auth.users(id) on delete cascade,
  semente_hex     text not null,
  hash            text not null,
  semente_cliente text not null,
  ultimo_nonce    int not null,
  revelada_em     timestamptz not null default now()
);
create table if not exists public.cassino_apostas (
  id        bigint generated always as identity primary key,
  user_id   uuid not null references auth.users(id) on delete cascade,
  jogo      text not null check (jogo in ('roleta', 'limbo', 'dado', 'slot')),
  aposta    int not null check (aposta between 5 and 100),
  escolha   jsonb not null,
  resultado jsonb not null,
  pagou     int not null default 0,
  hash      text not null,
  nonce     int not null,
  em        timestamptz not null default now()
);
create index if not exists cassino_apostas_busca on public.cassino_apostas (user_id, em desc);
alter table public.cassino_sementes         enable row level security;
alter table public.cassino_sementes_antigas enable row level security;
alter table public.cassino_apostas          enable row level security;
revoke all on public.cassino_sementes, public.cassino_sementes_antigas, public.cassino_apostas from public, anon, authenticated;
-- a semente atual NUNCA é lida pelo site: só o hash, a semente do cliente e o nonce
grant select (user_id, hash, semente_cliente, nonce, criada_em) on public.cassino_sementes to authenticated;
grant select on public.cassino_sementes_antigas, public.cassino_apostas to authenticated;
drop policy if exists "cada um ve a sua semente"   on public.cassino_sementes;
drop policy if exists "cada um ve as reveladas"    on public.cassino_sementes_antigas;
drop policy if exists "cada um ve as suas apostas" on public.cassino_apostas;
create policy "cada um ve a sua semente"   on public.cassino_sementes         for select to authenticated using (user_id = auth.uid());
create policy "cada um ve as reveladas"    on public.cassino_sementes_antigas for select to authenticated using (user_id = auth.uid());
create policy "cada um ve as suas apostas" on public.cassino_apostas          for select to authenticated using (user_id = auth.uid());

-- cria a semente da pessoa na primeira vez
create or replace function public.cassino_garantir(p_user uuid) returns void
language plpgsql security definer set search_path = public, extensions as $$
declare
  v_s bytea;
begin
  if exists (select 1 from public.cassino_sementes where user_id = p_user) then return; end if;
  v_s := extensions.gen_random_bytes(32);
  insert into public.cassino_sementes (user_id, semente, hash) values (p_user, v_s, encode(extensions.digest(v_s, 'sha256'), 'hex'))
  on conflict (user_id) do nothing;
end $$;
revoke all on function public.cassino_garantir(uuid) from public, anon, authenticated;

-- o número sorteado (interna): incrementa o nonce e devolve u em [0, 1), o hash e o nonce usados
create or replace function public.cassino_numero(p_user uuid, out u numeric, out hash text, out nonce int)
language plpgsql security definer set search_path = public, extensions as $$
declare
  v public.cassino_sementes;
  h bytea;
begin
  perform public.cassino_garantir(p_user);
  select * into v from public.cassino_sementes where user_id = p_user for update;
  update public.cassino_sementes set nonce = v.nonce + 1 where user_id = p_user;
  nonce := v.nonce + 1;
  hash := v.hash;
  h := extensions.hmac(convert_to(v.semente_cliente || ':' || nonce, 'UTF8'), v.semente, 'sha256');
  u := ('x' || lpad(substr(encode(h, 'hex'), 1, 13), 16, '0'))::bit(64)::bigint / 4503599627370496.0;
end $$;
revoke all on function public.cassino_numero(uuid) from public, anon, authenticated;

-- o que o site mostra antes de apostar: o hash da semente atual, a semente do cliente e o nonce
create or replace function public.cassino_estado() returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v public.cassino_sementes;
begin
  if not public.eh_nanico() then raise exception 'Só nanicos jogam.' using errcode = 'P0001'; end if;
  perform public.cassino_garantir(auth.uid());
  select * into v from public.cassino_sementes where user_id = auth.uid();
  return jsonb_build_object('hash', v.hash, 'cliente', v.semente_cliente, 'nonce', v.nonce);
end $$;
revoke all on function public.cassino_estado() from public, anon;
grant execute on function public.cassino_estado() to authenticated;

-- revela a semente atual (vai para as antigas, em hex) e começa uma nova com a semente do cliente escolhida
create or replace function public.trocar_semente(p_cliente text) returns jsonb
language plpgsql security definer set search_path = public, extensions as $$
declare
  v   public.cassino_sementes;
  v_s bytea;
begin
  if not public.eh_nanico() then raise exception 'Só nanicos jogam.' using errcode = 'P0001'; end if;
  if p_cliente is null or p_cliente !~ '^[A-Za-z0-9_-]{1,32}$' then
    raise exception 'A semente do cliente usa só letras, números, _ e -, até 32.' using errcode = 'P0001';
  end if;
  perform public.limitar('semente', 10, interval '10 minutes', 'Calma: muitas trocas de semente. Espere uns minutos.');
  perform public.cassino_garantir(auth.uid());
  select * into v from public.cassino_sementes where user_id = auth.uid() for update;
  insert into public.cassino_sementes_antigas (user_id, semente_hex, hash, semente_cliente, ultimo_nonce)
    values (auth.uid(), encode(v.semente, 'hex'), v.hash, v.semente_cliente, v.nonce);
  v_s := extensions.gen_random_bytes(32);
  update public.cassino_sementes set semente = v_s, hash = encode(extensions.digest(v_s, 'sha256'), 'hex'),
         semente_cliente = p_cliente, nonce = 0, criada_em = now()
   where user_id = auth.uid();
  return public.cassino_estado();
end $$;
revoke all on function public.trocar_semente(text) from public, anon;
grant execute on function public.trocar_semente(text) to authenticated;

-- roleta europeia: 37 casas; número paga 35× (volta 36×); cor, paridade e metade pagam 1× (voltam 2×); o 0 perde nelas
create or replace function public.apostar_roleta(p_aposta int, p_tipo text, p_valor int) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_uid   uuid := auth.uid();
  v_verm  int[] := array[1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36];
  r       record;
  v_casa  int;
  v_cor   text;
  v_ganha boolean;
  v_paga  int := 0;
  v_saldo int;
begin
  if not public.eh_nanico() then raise exception 'Só nanicos jogam.' using errcode = 'P0001'; end if;
  if p_aposta is null or p_aposta not between 5 and 100 then raise exception 'A aposta vai de 5 a 100 moedas.' using errcode = 'P0001'; end if;
  if p_tipo is null or p_tipo not in ('numero', 'cor', 'paridade', 'metade')
     or p_valor is null or (p_tipo = 'numero' and p_valor not between 0 and 36) or (p_tipo <> 'numero' and p_valor not in (0, 1)) then
    raise exception 'Aposta inválida.' using errcode = 'P0001';
  end if;
  perform public.limitar('cassino', 30, interval '1 minute', 'Calma: muitas apostas seguidas. Espere um pouco.');
  perform public.creditar(v_uid, -p_aposta, 'cassino', 'roleta');
  select * into r from public.cassino_numero(v_uid);
  v_casa := floor(r.u * 37)::int;
  v_cor := case when v_casa = 0 then 'verde' when v_casa = any (v_verm) then 'vermelho' else 'preto' end;
  v_ganha := case p_tipo
    when 'numero'   then v_casa = p_valor
    when 'cor'      then v_casa <> 0 and (v_cor = 'vermelho') = (p_valor = 0)
    when 'paridade' then v_casa <> 0 and v_casa % 2 = p_valor
    when 'metade'   then v_casa <> 0 and (v_casa <= 18) = (p_valor = 0)
  end;
  if v_ganha then v_paga := p_aposta * case when p_tipo = 'numero' then 36 else 2 end; end if;
  if v_paga > 0 then v_saldo := public.creditar(v_uid, v_paga, 'cassino', 'roleta');
  else select saldo into v_saldo from public.carteiras where user_id = v_uid; end if;
  insert into public.cassino_apostas (user_id, jogo, aposta, escolha, resultado, pagou, hash, nonce)
    values (v_uid, 'roleta', p_aposta, jsonb_build_object('tipo', p_tipo, 'valor', p_valor),
            jsonb_build_object('casa', v_casa, 'cor', v_cor), v_paga, r.hash, r.nonce);
  return jsonb_build_object('casa', v_casa, 'cor', v_cor, 'pagou', v_paga, 'saldo', v_saldo, 'hash', r.hash, 'nonce', r.nonce);
end $$;
revoke all on function public.apostar_roleta(int, text, int) from public, anon;
grant execute on function public.apostar_roleta(int, text, int) to authenticated;

-- as últimas 20 apostas de todo mundo (com o nome do nanico), para o feed do cassino
create or replace function public.cassino_feed() returns jsonb
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.eh_nanico() then raise exception 'Só nanicos jogam.' using errcode = 'P0001'; end if;
  return coalesce((select jsonb_agg(x order by x.em desc) from (
    select a.em, a.jogo, a.aposta, a.pagou, a.resultado, f.name as nome
      from public.cassino_apostas a left join public.friends f on f.user_id = a.user_id
     order by a.em desc limit 20) x), '[]'::jsonb);
end $$;
revoke all on function public.cassino_feed() from public, anon;
grant execute on function public.cassino_feed() to authenticated;

-- 11b) cassino, parte 2: limbo, maior ou menor (dado) e caça-níquel dos nanicos -----------------
--      Mesmo motor (cassino_numero), mesmas regras: aposta de 5 a 100, creditar, limitar e cassino_apostas.
alter table public.cassino_apostas drop constraint if exists cassino_apostas_jogo_check;
alter table public.cassino_apostas add constraint cassino_apostas_jogo_check check (jogo in ('roleta', 'limbo', 'dado', 'slot'));

-- limbo: resultado = max(1, floor(0,97 / (1 − u) × 100) / 100); ganha alvo × aposta se o resultado ≥ alvo (a casa leva 3%)
create or replace function public.apostar_limbo(p_aposta int, p_alvo numeric) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  r     record;
  v_res numeric;
  v_pg  int := 0;
  v_sal int;
begin
  if not public.eh_nanico() then raise exception 'Só nanicos jogam.' using errcode = 'P0001'; end if;
  if p_aposta is null or p_aposta not between 5 and 100 then raise exception 'A aposta vai de 5 a 100 moedas.' using errcode = 'P0001'; end if;
  if p_alvo is null or p_alvo < 1.01 or p_alvo > 100 or round(p_alvo, 2) <> p_alvo then
    raise exception 'O alvo vai de 1,01× a 100×, com até 2 casas depois da vírgula.' using errcode = 'P0001';
  end if;
  perform public.limitar('cassino', 30, interval '1 minute', 'Calma: muitas apostas seguidas. Espere um pouco.');
  perform public.creditar(v_uid, -p_aposta, 'cassino', 'limbo');
  select * into r from public.cassino_numero(v_uid);
  v_res := greatest(1, floor((0.97 / (1 - r.u)) * 100) / 100);
  if v_res >= p_alvo then v_pg := floor(p_aposta * p_alvo)::int; end if;
  if v_pg > 0 then v_sal := public.creditar(v_uid, v_pg, 'cassino', 'limbo');
  else select saldo into v_sal from public.carteiras where user_id = v_uid; end if;
  insert into public.cassino_apostas (user_id, jogo, aposta, escolha, resultado, pagou, hash, nonce)
    values (v_uid, 'limbo', p_aposta, jsonb_build_object('alvo', p_alvo), jsonb_build_object('valor', v_res), v_pg, r.hash, r.nonce);
  return jsonb_build_object('valor', v_res, 'pagou', v_pg, 'saldo', v_sal, 'hash', r.hash, 'nonce', r.nonce);
end $$;
revoke all on function public.apostar_limbo(int, numeric) from public, anon;
grant execute on function public.apostar_limbo(int, numeric) to authenticated;

-- maior ou menor: número de 0 a 9999; "abaixo de N" ganha com número < N, "acima de N" com número > N;
-- paga aposta × 0,97 / chance (a casa leva 3%); a chance fica entre 1% e 95%
create or replace function public.apostar_dado(p_aposta int, p_lado text, p_n int) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_uid    uuid := auth.uid();
  r        record;
  v_chance numeric;
  v_num    int;
  v_pg     int := 0;
  v_sal    int;
begin
  if not public.eh_nanico() then raise exception 'Só nanicos jogam.' using errcode = 'P0001'; end if;
  if p_aposta is null or p_aposta not between 5 and 100 then raise exception 'A aposta vai de 5 a 100 moedas.' using errcode = 'P0001'; end if;
  if p_lado is null or p_lado not in ('abaixo', 'acima') or p_n is null or p_n not between 0 and 9999 then
    raise exception 'Aposta inválida.' using errcode = 'P0001';
  end if;
  v_chance := case when p_lado = 'abaixo' then p_n / 10000.0 else (9999 - p_n) / 10000.0 end;
  if v_chance < 0.01 or v_chance > 0.95 then raise exception 'A chance precisa ficar entre 1%% e 95%%.' using errcode = 'P0001'; end if;
  perform public.limitar('cassino', 30, interval '1 minute', 'Calma: muitas apostas seguidas. Espere um pouco.');
  perform public.creditar(v_uid, -p_aposta, 'cassino', 'dado');
  select * into r from public.cassino_numero(v_uid);
  v_num := floor(r.u * 10000)::int;
  if (p_lado = 'abaixo' and v_num < p_n) or (p_lado = 'acima' and v_num > p_n) then v_pg := floor(p_aposta * 0.97 / v_chance)::int; end if;
  if v_pg > 0 then v_sal := public.creditar(v_uid, v_pg, 'cassino', 'dado');
  else select saldo into v_sal from public.carteiras where user_id = v_uid; end if;
  insert into public.cassino_apostas (user_id, jogo, aposta, escolha, resultado, pagou, hash, nonce)
    values (v_uid, 'dado', p_aposta, jsonb_build_object('lado', p_lado, 'n', p_n), jsonb_build_object('numero', v_num), v_pg, r.hash, r.nonce);
  return jsonb_build_object('numero', v_num, 'pagou', v_pg, 'saldo', v_sal, 'hash', r.hash, 'nonce', r.nonce);
end $$;
revoke all on function public.apostar_dado(int, text, int) from public, anon;
grant execute on function public.apostar_dado(int, text, int) to authenticated;

-- caça-níquel: os 14 rostos (n1…n14) e dois especiais (bola e moeda), com pesos e pagamentos AQUI no banco
create table if not exists public.cassino_rolos (
  simbolo text primary key check (simbolo ~ '^(n([1-9]|1[0-4])|bola|moeda)$'),
  peso    int not null check (peso > 0),
  ordem   int not null
);
create table if not exists public.cassino_pagamentos (
  combinacao    text primary key check (combinacao in ('tres_bola', 'tres_moeda', 'tres_rosto', 'duas_moedas', 'uma_moeda')),
  multiplicador numeric not null check (multiplicador > 0)
);
insert into public.cassino_rolos (simbolo, peso, ordem)
  select 'n' || k, 10, k from generate_series(1, 14) k
  union all select 'bola', 4, 15 union all select 'moeda', 6, 16
on conflict (simbolo) do nothing;
insert into public.cassino_pagamentos (combinacao, multiplicador) values
  ('tres_bola', 1000), ('tres_moeda', 200), ('tres_rosto', 80), ('duas_moedas', 25), ('uma_moeda', 4)
on conflict (combinacao) do nothing;
alter table public.cassino_rolos      enable row level security;
alter table public.cassino_pagamentos enable row level security;
revoke all on public.cassino_rolos, public.cassino_pagamentos from public, anon, authenticated;
grant select on public.cassino_rolos, public.cassino_pagamentos to authenticated;
drop policy if exists "nanicos veem os rolos"      on public.cassino_rolos;
drop policy if exists "nanicos veem os pagamentos" on public.cassino_pagamentos;
create policy "nanicos veem os rolos"      on public.cassino_rolos      for select to authenticated using (public.eh_nanico());
create policy "nanicos veem os pagamentos" on public.cassino_pagamentos for select to authenticated using (public.eh_nanico());

-- quanto paga uma combinação: 3 iguais (bola, moeda ou rosto) ou a quantidade de moedas
create or replace function public.cassino_slot_mult(a text, b text, c text) returns numeric
language sql stable security definer set search_path = public as $$
  select coalesce((select multiplicador from public.cassino_pagamentos where combinacao =
    case
      when a = b and b = c then case a when 'bola' then 'tres_bola' when 'moeda' then 'tres_moeda' else 'tres_rosto' end
      when (a = 'moeda')::int + (b = 'moeda')::int + (c = 'moeda')::int = 2 then 'duas_moedas'
      when (a = 'moeda')::int + (b = 'moeda')::int + (c = 'moeda')::int = 1 then 'uma_moeda'
    end), 0);
$$;
revoke all on function public.cassino_slot_mult(text, text, text) from public, anon, authenticated;

-- símbolo de um rolo para um número u: anda pelos pesos na ordem dos símbolos
create or replace function public.cassino_simbolo(p_u numeric) returns text
language sql stable security definer set search_path = public as $$
  select simbolo from (
    select simbolo, sum(peso) over (order by ordem) as acum, sum(peso) over () as total from public.cassino_rolos) t
   where floor(p_u * total) < acum order by acum limit 1;
$$;
revoke all on function public.cassino_simbolo(numeric) from public, anon, authenticated;

-- caça-níquel: 3 números (3 nonces seguidos), um por rolo; paga aposta × multiplicador da tabela (a casa leva 8%)
create or replace function public.apostar_slot(p_aposta int) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  r1 record; r2 record; r3 record;
  s1 text; s2 text; s3 text;
  v_pg  int := 0;
  v_sal int;
begin
  if not public.eh_nanico() then raise exception 'Só nanicos jogam.' using errcode = 'P0001'; end if;
  if p_aposta is null or p_aposta not between 5 and 100 then raise exception 'A aposta vai de 5 a 100 moedas.' using errcode = 'P0001'; end if;
  perform public.limitar('cassino', 30, interval '1 minute', 'Calma: muitas apostas seguidas. Espere um pouco.');
  perform public.creditar(v_uid, -p_aposta, 'cassino', 'slot');
  select * into r1 from public.cassino_numero(v_uid);
  select * into r2 from public.cassino_numero(v_uid);
  select * into r3 from public.cassino_numero(v_uid);
  s1 := public.cassino_simbolo(r1.u); s2 := public.cassino_simbolo(r2.u); s3 := public.cassino_simbolo(r3.u);
  v_pg := floor(p_aposta * public.cassino_slot_mult(s1, s2, s3))::int;
  if v_pg > 0 then v_sal := public.creditar(v_uid, v_pg, 'cassino', 'slot');
  else select saldo into v_sal from public.carteiras where user_id = v_uid; end if;
  insert into public.cassino_apostas (user_id, jogo, aposta, escolha, resultado, pagou, hash, nonce)
    values (v_uid, 'slot', p_aposta, '{}'::jsonb, jsonb_build_object('simbolos', jsonb_build_array(s1, s2, s3)), v_pg, r1.hash, r1.nonce);
  return jsonb_build_object('simbolos', jsonb_build_array(s1, s2, s3), 'pagou', v_pg, 'saldo', v_sal, 'hash', r1.hash, 'nonce', r1.nonce);
end $$;
revoke all on function public.apostar_slot(int) from public, anon;
grant execute on function public.apostar_slot(int) to authenticated;

-- conferência do RTP do caça-níquel: soma exata de todas as combinações com os pesos; tem que dar entre 91,5% e 92,5%
do $$
declare
  v_rtp numeric;
begin
  select sum(a.peso::numeric * b.peso * c.peso * public.cassino_slot_mult(a.simbolo, b.simbolo, c.simbolo)) / power((select sum(peso) from public.cassino_rolos), 3)::numeric
    into v_rtp from public.cassino_rolos a, public.cassino_rolos b, public.cassino_rolos c;
  if v_rtp < 0.915 or v_rtp > 0.925 then
    raise exception 'RTP do caça-níquel fora do combinado: % (tem que ficar entre 0,915 e 0,925). Ajuste pesos e multiplicadores.', round(v_rtp, 4);
  end if;
  raise notice 'RTP do caça-níquel: %', round(v_rtp, 4);
end $$;

-- 26) presença pública: sequência de dias e tempo online na ficha -------------------------------
-- As tabelas bonus_diario e online_diario continuam fechadas (cada um lê só as suas). O que fica público
-- para os nanicos é só o resumo, calculado aqui.

-- resumo de um nanico: sequência atual (de hoje ou de ontem, senão 0), recorde, minutos de hoje,
-- os 7 últimos dias (de hoje para trás, 0 nos dias sem linha) e o total desde que as moedas começaram
create or replace function public.presenca_de(p_friend uuid) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  v_uid   uuid;
  v_hoje  date := public.hoje_br();
  v_seq   int;
  v_pegou boolean;
begin
  if not public.eh_nanico() then raise exception 'Só nanicos veem a presença.' using errcode = 'P0001'; end if;
  select user_id into v_uid from public.friends where id = p_friend;
  if v_uid is null then return null; end if;
  select seq into v_seq from public.bonus_diario where user_id = v_uid and dia = v_hoje;
  v_pegou := v_seq is not null;
  if not v_pegou then
    select seq into v_seq from public.bonus_diario where user_id = v_uid and dia = v_hoje - 1;
  end if;
  return jsonb_build_object(
    'seq', coalesce(v_seq, 0),
    'pegou_hoje', v_pegou,
    'recorde', coalesce((select max(seq) from public.bonus_diario where user_id = v_uid), 0),
    'hoje_min', coalesce((select minutos from public.online_diario where user_id = v_uid and dia = v_hoje), 0),
    'semana', (select jsonb_agg(jsonb_build_object('dia', d.dia, 'min', coalesce(o.minutos, 0)) order by d.dia desc)
                 from (select (v_hoje - k) as dia from generate_series(0, 6) k) d
                 left join public.online_diario o on o.user_id = v_uid and o.dia = d.dia),
    'total_min', coalesce((select sum(minutos) from public.online_diario where user_id = v_uid), 0));
end $$;
revoke all on function public.presenca_de(uuid) from public, anon;
grant execute on function public.presenca_de(uuid) to authenticated;

-- só a sequência atual e os minutos de hoje dos 14 ({id do nanico: {seq, hoje_min}}), para a chama na lista
create or replace function public.presenca_todos() returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  v_hoje date := public.hoje_br();
begin
  if not public.eh_nanico() then raise exception 'Só nanicos veem a presença.' using errcode = 'P0001'; end if;
  return (select coalesce(jsonb_object_agg(f.id, jsonb_build_object(
            'seq', coalesce((select b.seq from public.bonus_diario b where b.user_id = f.user_id and b.dia >= v_hoje - 1 order by b.dia desc limit 1), 0),
            'hoje_min', coalesce((select o.minutos from public.online_diario o where o.user_id = f.user_id and o.dia = v_hoje), 0))), '{}'::jsonb)
            from public.friends f where f.user_id is not null);
end $$;
revoke all on function public.presenca_todos() from public, anon;
grant execute on function public.presenca_todos() to authenticated;

-- 19) rodízio: roleta de quem entra no time, uma por sala de LoL --------------------------------
--     Quem está de fora entra na fila; a cada partida o BANCO sorteia um (random()), e todo mundo vê a
--     roleta parar no mesmo nome pelo tempo real da tabela. Ninguém escreve direto: só as funções abaixo.
create table if not exists public.rodizio (
  sala         text primary key references public.salas(id) on delete cascade,
  fila         uuid[] not null default '{}',
  rodada       int not null default 1,
  ja_entraram  uuid[] not null default '{}',
  sorteado     uuid,
  sorteado_por uuid,
  girado_em    timestamptz,
  giro         int,
  trocas       int not null default 0,
  no_time      jsonb not null default '{}'::jsonb,
  atualizado   timestamptz not null default now()
);
insert into public.rodizio (sala) select id from public.salas where jogo = 'lol' on conflict (sala) do nothing;
alter table public.rodizio enable row level security;
revoke all on public.rodizio from public, anon, authenticated;
grant select on public.rodizio to authenticated;
drop policy if exists "nanicos veem o rodizio" on public.rodizio;
create policy "nanicos veem o rodizio" on public.rodizio for select to authenticated using (public.eh_nanico());
do $$
begin
  begin alter publication supabase_realtime add table public.rodizio; exception when duplicate_object then null; end;
end $$;

-- confere quem chama e trava a linha da sala (cria a linha se a sala de LoL for nova)
create or replace function public.rodizio_linha(p_sala text) returns public.rodizio
language plpgsql security definer set search_path = public as $$
declare
  r public.rodizio;
begin
  if not public.eh_nanico() then raise exception 'Só nanicos mexem no rodízio.' using errcode = 'P0001'; end if;
  if not exists (select 1 from public.salas where id = p_sala and jogo = 'lol') then
    raise exception 'O rodízio é só nas salas de LoL.' using errcode = 'P0001';
  end if;
  perform public.limitar('rodizio', 30, interval '10 minutes', 'Calma: muitas mudanças no rodízio. Espere um pouco.');
  insert into public.rodizio (sala) values (p_sala) on conflict (sala) do nothing;
  select * into r from public.rodizio where sala = p_sala for update;
  return r;
end $$;
revoke all on function public.rodizio_linha(text) from public, anon, authenticated;

-- candidatos da roleta: quem está na fila e ainda não entrou nesta rodada, em ordem de nome
create or replace function public.rodizio_candidatos(p_fila uuid[], p_ja uuid[]) returns uuid[]
language sql stable security definer set search_path = public as $$
  select coalesce(array_agg(f.id order by lower(f.name), f.id), '{}')
    from public.friends f where f.id = any(p_fila) and not (f.id = any(p_ja));
$$;
revoke all on function public.rodizio_candidatos(uuid[], uuid[]) from public, anon, authenticated;

-- põe (ou tira) alguém da fila; quem está na escalação não entra
create or replace function public.rodizio_fila(p_sala text, p_friend uuid, p_entra boolean) returns void
language plpgsql security definer set search_path = public as $$
declare
  r public.rodizio := public.rodizio_linha(p_sala);
  v_nome text;
begin
  select name into v_nome from public.friends where id = p_friend;
  if v_nome is null then raise exception 'Esse nanico não existe.' using errcode = 'P0001'; end if;
  if p_entra then
    if p_friend = any(r.fila) then return; end if;
    if exists (select 1 from public.game g, jsonb_array_elements(g.players) e
                where g.sala = p_sala and e->>'friendId' = p_friend::text) then
      raise exception '% já está na escalação.', v_nome using errcode = 'P0001';
    end if;
    update public.rodizio set fila = array_append(fila, p_friend), atualizado = now() where sala = p_sala;
  else
    update public.rodizio set fila = array_remove(fila, p_friend), ja_entraram = array_remove(ja_entraram, p_friend),
           sorteado = case when sorteado = p_friend then null else sorteado end,
           sorteado_por = case when sorteado = p_friend then null else sorteado_por end,
           atualizado = now()
     where sala = p_sala;
  end if;
end $$;
revoke all on function public.rodizio_fila(text, uuid, boolean) from public, anon;
grant execute on function public.rodizio_fila(text, uuid, boolean) to authenticated;

-- gira: o sorteio é sempre daqui. Acabaram os candidatos? Começa a rodada seguinte com todo mundo.
create or replace function public.rodizio_girar(p_sala text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  r public.rodizio := public.rodizio_linha(p_sala);
  v_cand uuid[];
  v_i int;
begin
  if r.sorteado is not null then
    raise exception 'Coloque o sorteado no time ou diga que ele não vai jogar.' using errcode = 'P0001';
  end if;
  v_cand := public.rodizio_candidatos(r.fila, r.ja_entraram);
  if cardinality(v_cand) = 0 then
    if cardinality(r.fila) = 0 then raise exception 'A fila está vazia.' using errcode = 'P0001'; end if;
    r.rodada := r.rodada + 1;
    r.ja_entraram := '{}';
    v_cand := public.rodizio_candidatos(r.fila, r.ja_entraram);
    if cardinality(v_cand) = 0 then raise exception 'A fila está vazia.' using errcode = 'P0001'; end if;
  end if;
  v_i := floor(random() * cardinality(v_cand))::int;
  update public.rodizio set rodada = r.rodada, ja_entraram = r.ja_entraram, sorteado = v_cand[v_i + 1],
         sorteado_por = auth.uid(), girado_em = now(), giro = v_i, atualizado = now()
   where sala = p_sala;
  return jsonb_build_object('sorteado', v_cand[v_i + 1], 'giro', v_i, 'rodada', r.rodada);
end $$;
revoke all on function public.rodizio_girar(text) from public, anon;
grant execute on function public.rodizio_girar(text) to authenticated;

-- coloca o sorteado na rota (0 a 4) da escalação; quem saiu vai para a fila
create or replace function public.rodizio_colocar(p_sala text, p_rota int) returns void
language plpgsql security definer set search_path = public as $$
declare
  r public.rodizio := public.rodizio_linha(p_sala);
  v_pl jsonb;
  v_saiu text;
  v_saiu_id uuid;
  v_fila uuid[];
  k int;
begin
  if r.sorteado is null then raise exception 'Gire a roleta antes.' using errcode = 'P0001'; end if;
  if p_rota is null or p_rota < 0 or p_rota > 4 then raise exception 'Rota inválida.' using errcode = 'P0001'; end if;
  select players into v_pl from public.game where sala = p_sala for update;
  if v_pl is null or jsonb_typeof(v_pl) <> 'array' then v_pl := '[]'::jsonb; end if;
  while jsonb_array_length(v_pl) < 5 loop
    v_pl := v_pl || jsonb_build_array(jsonb_build_object('friendId', '', 'champion', ''));
  end loop;
  -- o sorteado não pode ficar em duas rotas
  for k in 0..4 loop
    if v_pl->k->>'friendId' = r.sorteado::text then
      v_pl := jsonb_set(v_pl, array[k::text], jsonb_build_object('friendId', '', 'champion', ''));
    end if;
  end loop;
  v_saiu := v_pl->p_rota->>'friendId';
  v_pl := jsonb_set(v_pl, array[p_rota::text], jsonb_build_object('friendId', r.sorteado::text, 'champion', ''));
  -- passa pelo gatilho escalacao_protecao, como qualquer mudança na escalação
  update public.game set players = v_pl, updated_at = now() where sala = p_sala;
  v_fila := array_remove(r.fila, r.sorteado);
  if v_saiu ~ '^[0-9a-f-]{36}$' then
    select id into v_saiu_id from public.friends where id = v_saiu::uuid;
    if v_saiu_id is not null and not (v_saiu_id = any(v_fila)) then v_fila := array_append(v_fila, v_saiu_id); end if;
  end if;
  update public.rodizio set
         fila = v_fila,
         ja_entraram = case when r.sorteado = any(r.ja_entraram) then r.ja_entraram else array_append(r.ja_entraram, r.sorteado) end,
         trocas = r.trocas + 1,
         no_time = (r.no_time - coalesce(v_saiu, '')) || jsonb_build_object(r.sorteado::text, r.trocas + 1),
         sorteado = null, sorteado_por = null, atualizado = now()
   where sala = p_sala;
end $$;
revoke all on function public.rodizio_colocar(text, int) from public, anon;
grant execute on function public.rodizio_colocar(text, int) to authenticated;

-- o sorteado não vai jogar: sai da fila e libera girar de novo
create or replace function public.rodizio_desistir(p_sala text) returns void
language plpgsql security definer set search_path = public as $$
declare
  r public.rodizio := public.rodizio_linha(p_sala);
begin
  if r.sorteado is null then raise exception 'Ninguém foi sorteado.' using errcode = 'P0001'; end if;
  update public.rodizio set fila = array_remove(fila, r.sorteado), sorteado = null, sorteado_por = null, atualizado = now()
   where sala = p_sala;
end $$;
revoke all on function public.rodizio_desistir(text) from public, anon;
grant execute on function public.rodizio_desistir(text) to authenticated;

-- 20) zoeira: chinelada e torta na cara no Sítio ------------------------------------------------
--     É paga (5 e 25 moedas, que somem da economia), então passa pelo banco e chega a todos pelo
--     tempo real da tabela, nunca por broadcast. O alvo não perde nada.
alter table public.extrato drop constraint if exists extrato_motivo_check;
alter table public.extrato add constraint extrato_motivo_check
  check (motivo in ('inicio', 'diario', 'sequencia', 'online', 'cassino', 'bingo', 'truco', 'aposta', 'loja', 'admin', 'zoeira'));

create table if not exists public.zoeiras (
  id   bigint generated always as identity primary key,
  de   uuid not null references public.friends(id) on delete cascade,
  para uuid not null references public.friends(id) on delete cascade,
  tipo text not null check (tipo in ('chinelo', 'torta', 'revide')),
  em   timestamptz not null default now()
);
create index if not exists zoeiras_busca on public.zoeiras (para, em desc);
create index if not exists zoeiras_de on public.zoeiras (de, em desc);
alter table public.zoeiras enable row level security;
revoke all on public.zoeiras from public, anon, authenticated;
grant select on public.zoeiras to authenticated;
drop policy if exists "nanicos veem a zoeira do dia" on public.zoeiras;
create policy "nanicos veem a zoeira do dia" on public.zoeiras for select to authenticated
  using (public.eh_nanico() and em > now() - interval '24 hours');
do $$
begin
  begin alter publication supabase_realtime add table public.zoeiras; exception when duplicate_object then null; end;
end $$;

-- dá uma chinelada (5), uma torta (25) ou revida de graça (só uma vez, até 30 s depois de levar uma)
create or replace function public.zoar(p_para_friend uuid, p_tipo text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_uid   uuid := auth.uid();
  v_de    uuid;
  v_preco int;
  v_saldo int;
  v_nome  text;
begin
  if not public.eh_nanico() then raise exception 'Só nanicos zoam.' using errcode = 'P0001'; end if;
  select id into v_de from public.friends where user_id = v_uid limit 1;
  select name into v_nome from public.friends where id = p_para_friend;
  if v_nome is null then raise exception 'Esse nanico não existe.' using errcode = 'P0001'; end if;
  if p_para_friend = v_de then raise exception 'Não dá para zoar a si mesmo.' using errcode = 'P0001'; end if;
  if p_tipo not in ('chinelo', 'torta', 'revide') then raise exception 'Zoeira inválida.' using errcode = 'P0001'; end if;
  delete from public.zoeiras where em < now() - interval '30 days';
  if p_tipo = 'revide' then
    -- grátis só se o alvo zoou você nos últimos 30 s e você ainda não revidou depois disso
    if not exists (select 1 from public.zoeiras z
                    where z.de = p_para_friend and z.para = v_de and z.tipo in ('chinelo', 'torta')
                      and z.em > now() - interval '30 seconds'
                      and not exists (select 1 from public.zoeiras r where r.de = v_de and r.para = p_para_friend
                                        and r.tipo = 'revide' and r.em >= z.em)) then
      raise exception 'Só dá para revidar até 30 s depois de levar uma zoeira.' using errcode = 'P0001';
    end if;
    v_preco := 0;
  else
    v_preco := case p_tipo when 'chinelo' then 5 else 25 end;
    perform public.limitar('zoar_10s', 1, interval '10 seconds', 'Calma: espere 10 s entre uma zoeira e outra.');
  end if;
  perform public.limitar('zoar', 6, interval '1 minute', 'Calma: muita zoeira em pouco tempo. Espere um pouco.');
  if (select count(*) from public.zoeiras where de = v_de and para = p_para_friend and em > now() - interval '5 minutes') >= 3 then
    raise exception 'Chega: % já levou 3 em 5 minutos. Dê um tempo.', v_nome using errcode = 'P0001';
  end if;
  if v_preco > 0 then
    v_saldo := public.creditar(v_uid, -v_preco, 'zoeira', p_tipo);
  else
    select saldo into v_saldo from public.carteiras where user_id = v_uid;
  end if;
  insert into public.zoeiras (de, para, tipo) values (v_de, p_para_friend, p_tipo);
  return jsonb_build_object('saldo', coalesce(v_saldo, 0), 'preco', v_preco);
end $$;
revoke all on function public.zoar(uuid, text) from public, anon;
grant execute on function public.zoar(uuid, text) to authenticated;

-- quantas a pessoa deu e levou nos últimos 7 dias (placar da ficha)
create or replace function public.placar_zoeira(p_friend uuid) returns jsonb
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.eh_nanico() then raise exception 'Só nanicos veem a zoeira.' using errcode = 'P0001'; end if;
  return jsonb_build_object(
    'deu', (select count(*) from public.zoeiras where de = p_friend and em > now() - interval '7 days'),
    'levou', (select count(*) from public.zoeiras where para = p_friend and em > now() - interval '7 days'));
end $$;
revoke all on function public.placar_zoeira(uuid) from public, anon;
grant execute on function public.placar_zoeira(uuid) to authenticated;

-- 12) confere: deve listar as 6 proteções, as 4 funções das moedas, as 2 tabelas da ficha, as 4 funções dos atributos, as 4 salas, as 6 funções do cassino, as 2 da presença, as 4 do rodízio e as 2 da zoeira
select tgname::text as item, tgrelid::regclass::text as onde from pg_trigger
 where tgname in ('chat_protecao', 'chat_sala_protecao', 'nanicada_protecao', 'nanicada_remocao', 'escalacao_protecao', 'perfil_protecao')
union all
select proname::text, 'moedas' from pg_proc
 where pronamespace = 'public'::regnamespace and proname in ('creditar', 'minha_carteira', 'bater_ponto', 'pulso')
union all
select tablename::text, 'ficha' from pg_tables
 where schemaname = 'public' and tablename in ('jogos_stats', 'riot_partidas_vistas')
union all
select proname::text, 'atributos' from pg_proc
 where pronamespace = 'public'::regnamespace and proname in ('votar_atributos', 'atributos_de', 'atributos_todos', 'meu_voto')
union all
select id, 'sala' from public.salas
union all
select proname::text, 'cassino' from pg_proc
 where pronamespace = 'public'::regnamespace and proname in ('apostar_roleta', 'apostar_limbo', 'apostar_dado', 'apostar_slot', 'trocar_semente', 'cassino_estado')
union all
select proname::text, 'presenca' from pg_proc
 where pronamespace = 'public'::regnamespace and proname in ('presenca_de', 'presenca_todos')
union all
select proname::text, 'rodizio' from pg_proc
 where pronamespace = 'public'::regnamespace and proname in ('rodizio_fila', 'rodizio_girar', 'rodizio_colocar', 'rodizio_desistir')
union all
select proname::text, 'zoeira' from pg_proc
 where pronamespace = 'public'::regnamespace and proname in ('zoar', 'placar_zoeira')
order by 2, 1;
