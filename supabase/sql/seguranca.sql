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
  motivo  text not null check (motivo in ('inicio', 'diario', 'sequencia', 'online', 'cassino', 'bingo', 'truco', 'aposta', 'loja', 'admin', 'zoeira', 'trofeu', 'churrasco', 'missao')),
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
-- aviso público de "alguém votou no fulano agora" (sem quem nem as notas): o tempo real desta tabela faz a ficha
-- de todo mundo pedir as médias de novo na hora (decisão do João, 02/11/2026)
create table if not exists public.atributos_aviso (
  para uuid primary key references public.friends(id) on delete cascade,
  em   timestamptz not null default now()
);
alter table public.atributos_aviso enable row level security;
revoke all on public.atributos_aviso from public, anon, authenticated;
grant select on public.atributos_aviso to authenticated;
drop policy if exists atributos_aviso_ler on public.atributos_aviso;
create policy atributos_aviso_ler on public.atributos_aviso for select to authenticated using (public.eh_nanico());
do $$ begin
  begin alter publication supabase_realtime add table public.atributos_aviso; exception when duplicate_object then null; end;
end $$;

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
  insert into public.atributos_aviso (para, em) values (p_para, now()) on conflict (para) do update set em = now();
end $$;
revoke all on function public.votar_atributos(uuid, jsonb) from public, anon;
grant execute on function public.votar_atributos(uuid, jsonb) to authenticated;

-- média (desde o 1º voto; antes era só com 3 ou mais) e contagem de cada atributo de um nanico
create or replace function public.atributos_de(p_para uuid) returns jsonb
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.eh_nanico() then raise exception 'Só nanicos veem os atributos.' using errcode = 'P0001'; end if;
  return (
    select jsonb_object_agg(t.atributo, jsonb_build_object('media', t.media, 'votos', t.votos))
      from (select a.atributo, count(v.nota)::int as votos,
                   case when count(v.nota) >= 1 then round(avg(v.nota), 1)::numeric(3, 1) end as media
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
alter table public.cassino_apostas add constraint cassino_apostas_jogo_check check (jogo in ('roleta', 'limbo', 'dado', 'slot', 'aviao', 'penalti', 'blackjack')); -- a lista completa: rodar o arquivo de novo não pode recusar apostas que já existem

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
-- a lista de motivos aparece em todas as vezes que a regra é recriada: motivo novo entra em TODAS (senão rodar o arquivo
-- inteiro de novo falha nas linhas que já existem com o motivo novo)
alter table public.extrato drop constraint if exists extrato_motivo_check;
alter table public.extrato add constraint extrato_motivo_check
  check (motivo in ('inicio', 'diario', 'sequencia', 'online', 'cassino', 'bingo', 'truco', 'aposta', 'loja', 'admin', 'zoeira', 'trofeu', 'churrasco', 'missao', 'bolsa', 'duelo', 'troca', 'mercado'));

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

-- 22) troféus da semana: Feeder, Turista, Carregou o piano, Viciado e Sumido ---------------------
--     Toda segunda a função riot-semana calcula a semana anterior (segunda a domingo, horário de
--     Brasília) com as partidas da Riot e grava o pódio aqui. Só uma pessoa dispara o cálculo
--     (semana_vez) e o pagamento acontece uma vez só (trofeus_pagar confere o extrato).
alter table public.extrato drop constraint if exists extrato_motivo_check;
alter table public.extrato add constraint extrato_motivo_check
  check (motivo in ('inicio', 'diario', 'sequencia', 'online', 'cassino', 'bingo', 'truco', 'aposta', 'loja', 'admin', 'zoeira', 'trofeu', 'churrasco', 'missao', 'bolsa', 'duelo', 'troca', 'mercado'));

create table if not exists public.trofeus_semana (
  semana    date not null,
  trofeu    text not null check (trofeu in ('feeder', 'turista', 'piano', 'viciado', 'sumido')),
  posicao   int not null check (posicao between 1 and 3),
  friend_id uuid not null references public.friends(id) on delete cascade,
  valor     numeric not null,
  partidas  int not null default 0,
  primary key (semana, trofeu, posicao)
);
create table if not exists public.riot_semana_meta (
  semana      date primary key,
  estado      text not null check (estado in ('calculando', 'parcial', 'pronta')),
  comecou_em  timestamptz not null default now(),
  terminou_em timestamptz,
  progresso   jsonb not null default '{}'::jsonb,
  erro        text
);
-- partidas da semana já lidas (só os números dos nanicos, nada de terceiros), para continuar de onde parou
create table if not exists public.riot_semana_partidas (
  semana   date not null,
  match_id text not null,
  dados    jsonb not null,
  primary key (semana, match_id)
);
alter table public.trofeus_semana       enable row level security;
alter table public.riot_semana_meta     enable row level security;
alter table public.riot_semana_partidas enable row level security;
revoke all on public.trofeus_semana, public.riot_semana_meta, public.riot_semana_partidas from public, anon, authenticated;
grant select on public.trofeus_semana to authenticated;
grant select (semana, estado, terminou_em) on public.riot_semana_meta to authenticated;
drop policy if exists "nanicos veem os trofeus" on public.trofeus_semana;
create policy "nanicos veem os trofeus" on public.trofeus_semana for select to authenticated using (public.eh_nanico());
drop policy if exists "nanicos veem a semana" on public.riot_semana_meta;
create policy "nanicos veem a semana" on public.riot_semana_meta for select to authenticated using (public.eh_nanico());

-- a vez de calcular a semana: true para UMA chamada; se travar mais de 10 min "calculando", outra pode pegar
create or replace function public.semana_vez(p_semana date) returns boolean
language plpgsql security definer set search_path = public as $$
declare
  v boolean;
begin
  insert into public.riot_semana_meta (semana, estado) values (p_semana, 'calculando')
  on conflict (semana) do update set estado = 'calculando', comecou_em = now()
   where riot_semana_meta.estado = 'parcial'
      or (riot_semana_meta.estado = 'calculando' and riot_semana_meta.comecou_em < now() - interval '10 minutes')
  returning true into v;
  return coalesce(v, false);
end $$;
revoke all on function public.semana_vez(date) from public, anon, authenticated;

-- paga os troféus da semana (+50 Carregou o piano, +20 Viciado) uma vez só: o ref com a semana evita repetir
create or replace function public.trofeus_pagar(p_semana date) returns int
language plpgsql security definer set search_path = public as $$
declare
  r record;
  v_ref text;
  v_n int := 0;
begin
  for r in select t.trofeu, f.user_id from public.trofeus_semana t join public.friends f on f.id = t.friend_id
            where t.semana = p_semana and t.posicao = 1 and t.trofeu in ('piano', 'viciado') and f.user_id is not null loop
    v_ref := p_semana::text || ':' || r.trofeu;
    if not exists (select 1 from public.extrato where user_id = r.user_id and motivo = 'trofeu' and ref = v_ref) then
      perform public.creditar(r.user_id, case r.trofeu when 'piano' then 50 else 20 end, 'trofeu', v_ref);
      v_n := v_n + 1;
    end if;
  end loop;
  return v_n;
end $$;
revoke all on function public.trofeus_pagar(date) from public, anon, authenticated;

-- hall da fama: quantas vezes cada nanico ficou em 1º em cada troféu ({id do nanico: {troféu: vezes}})
create or replace function public.hall_da_fama() returns jsonb
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.eh_nanico() then raise exception 'Só nanicos veem os troféus.' using errcode = 'P0001'; end if;
  return (select coalesce(jsonb_object_agg(fid, contagem), '{}'::jsonb)
            from (select friend_id::text as fid, jsonb_object_agg(trofeu, n) as contagem
                    from (select friend_id, trofeu, count(*)::int as n from public.trofeus_semana where posicao = 1
                           group by friend_id, trofeu) c
                   group by friend_id) x);
end $$;
revoke all on function public.hall_da_fama() from public, anon;
grant execute on function public.hall_da_fama() to authenticated;

do $$ begin
  if exists (select 1 from pg_roles where rolname = 'service_role') then
    grant all on public.trofeus_semana, public.riot_semana_meta, public.riot_semana_partidas to service_role;
    grant execute on function public.semana_vez(date), public.trofeus_pagar(date) to service_role;
  end if;
end $$;

-- 25) eventos com horário: happy hour (todo dia, 22h à meia-noite) e churrasco de sábado (18h às 23h) ----
--     Não tem tabela de "evento ligado": quem decide é o relógio do banco, na hora de Brasília.
create or replace function public.agora_br() returns timestamp language sql stable as $$
  select (now() at time zone 'America/Sao_Paulo');
$$;

-- 'happy', 'churrasco' ou null (o mesmo que eventoAgora() em src/lib/eventos.ts); no sábado das 22h às 23h vale o churrasco,
-- mas o pulso confere a hora sozinho e paga o happy hour também
create or replace function public.evento_em(p timestamp) returns text language sql immutable as $$
  select case
    when extract(isodow from p) = 6 and extract(hour from p) >= 18 and extract(hour from p) < 23 then 'churrasco'
    when extract(hour from p) >= 22 then 'happy'
    else null end;
$$;

-- minutos de happy hour do dia e as moedas que ele já pagou (o resto dos minutos segue a regra normal)
alter table public.online_diario add column if not exists happy_min   int not null default 0;
alter table public.online_diario add column if not exists happy_ganho int not null default 0;

-- o mesmo pulso da seção 7 (55 a 150 s entre pulsos), agora com o happy hour:
--   fora dele: +1 a cada 6 minutos normais, até 40 por dia;
--   no happy hour: +1 a cada 3 minutos, e o teto do dia sobe até 60 só pelo que o happy hour pagou.
create or replace function public.pulso() returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_uid   uuid := auth.uid();
  v_hoje  date := public.hoje_br();
  v_happy boolean := extract(hour from public.agora_br()) >= 22;   -- todo dia, sábado também (o churrasco termina às 23h)
  v_min   int;
  v_hmin  int;
  v_hgan  int;
  v_ult   timestamptz;
  v_norm  int;
begin
  if not public.eh_nanico() then raise exception 'Só nanicos ganham moedas.' using errcode = 'P0001'; end if;
  perform public.limitar('pulso', 6, interval '1 minute', 'Calma: muitos pulsos seguidos.');
  insert into public.online_diario (user_id, dia) values (v_uid, v_hoje) on conflict (user_id, dia) do nothing;
  select minutos, happy_min, happy_ganho, ultimo_pulso into v_min, v_hmin, v_hgan, v_ult from public.online_diario
   where user_id = v_uid and dia = v_hoje for update;
  if v_ult is null or now() - v_ult > interval '150 seconds' then
    update public.online_diario set ultimo_pulso = now() where user_id = v_uid and dia = v_hoje;
  elsif now() - v_ult >= interval '55 seconds' then
    v_min := v_min + 1;
    if v_happy then v_hmin := v_hmin + 1; end if;
    v_norm := v_min - v_hmin;   -- minutos fora do happy hour
    -- sem teto por dia (decisão do João, 02/11/2026): +1 a cada 6 minutos, e a cada 3 no happy hour
    if v_happy then
      if v_hmin % 3 = 0 then
        v_hgan := v_hgan + 1;
        perform public.creditar(v_uid, 1, 'online', v_hoje::text);
      end if;
    elsif v_norm % 6 = 0 then
      perform public.creditar(v_uid, 1, 'online', v_hoje::text);
    end if;
    update public.online_diario set minutos = v_min, happy_min = v_hmin, happy_ganho = v_hgan, ultimo_pulso = now()
     where user_id = v_uid and dia = v_hoje;
  end if;
  return public.minha_carteira();
end $$;
revoke all on function public.pulso() from public, anon;
grant execute on function public.pulso() to authenticated;

-- espetinho do churrasco: uma vez por sábado, de 10 a 60 moedas sorteadas aqui
create or replace function public.churrasco_pegar() returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_uid   uuid := auth.uid();
  v_agora timestamp := public.agora_br();
  v_dia   text := v_agora::date::text;
  v_valor int;
  v_saldo int;
begin
  if not public.eh_nanico() then raise exception 'Só nanicos pegam espetinho.' using errcode = 'P0001'; end if;
  if public.evento_em(v_agora) is distinct from 'churrasco' then
    raise exception 'A churrasqueira só acende no sábado, das 18h às 23h.' using errcode = 'P0001';
  end if;
  -- uma pessoa por vez: dois cliques ao mesmo tempo não pegam dois espetinhos
  perform pg_advisory_xact_lock(hashtext('churrasco:' || v_uid::text));
  if exists (select 1 from public.extrato where user_id = v_uid and motivo = 'churrasco' and ref = v_dia) then
    raise exception 'Você já pegou seu espetinho. Volte sábado que vem.' using errcode = 'P0001';
  end if;
  v_valor := 10 + floor(random() * 51)::int;
  v_saldo := public.creditar(v_uid, v_valor, 'churrasco', v_dia);
  return jsonb_build_object('valor', v_valor, 'saldo', v_saldo);
end $$;
revoke all on function public.churrasco_pegar() from public, anon;
grant execute on function public.churrasco_pegar() to authenticated;
revoke all on function public.evento_em(timestamp) from public, anon;
grant execute on function public.evento_em(timestamp) to authenticated;

-- 15) loja e mochila: itens do quarto, títulos, molduras, escudo de sequência e consumíveis (fumar, beber) -------
--     O preço vem SEMPRE desta tabela (nunca do navegador); comprar e usar passam por creditar().
create table if not exists public.loja_itens (
  id        text primary key check (id ~ '^[a-z0-9-]{2,30}$'),
  nome      text not null check (char_length(nome) between 2 and 40),
  descricao text not null default '' check (char_length(descricao) <= 140),
  espaco    text not null check (espaco in ('cadeira', 'mesa', 'tapete', 'poster', 'planta', 'parede', 'luz', 'titulo', 'moldura', 'escudo', 'consumivel', 'celular', 'cabeca', 'quarto', 'movel')),
  preco     int not null check (preco between 10 and 5000),
  dados     jsonb not null default '{}'::jsonb check (octet_length(dados::text) <= 500),
  ativo     boolean not null default true,
  ordem     int not null default 0
);
alter table public.loja_itens enable row level security;
revoke all on public.loja_itens from public, anon, authenticated;
grant select on public.loja_itens to authenticated;
drop policy if exists "nanicos leem a loja" on public.loja_itens;
create policy "nanicos leem a loja" on public.loja_itens for select to authenticated using (public.eh_nanico());

-- a vitrine (idempotente: rodar de novo atualiza nome, preço e ordem)
insert into public.loja_itens (id, nome, descricao, espaco, preco, dados, ordem) values
  ('cigarro',        'Cigarrinho',             'Uma tragada no Sítio. Some depois de usar.',                 'consumivel', 15,   '{"anim":"fumar"}', 10),
  ('cerveja',        'Latinha gelada',          'Um gole bem gelado. Some depois de usar.',                   'consumivel', 20,   '{"anim":"beber","cor":"lata"}', 11),
  ('chimarrao',      'Chimarrão',               'Mate amargo, de gaudério. Some depois de usar.',             'consumivel', 25,   '{"anim":"beber","cor":"cuia"}', 12),
  ('energetico',     'Energético',              'Dá a tremedeira de quem vai jogar a noite toda.',            'consumivel', 30,   '{"anim":"tremer","cor":"lata2"}', 13),
  ('caipirinha',     'Caipirinha',              'Bebe e fica meio tonto por uns segundos.',                   'consumivel', 40,   '{"anim":"tonto","cor":"copo"}', 14),
  ('charuto',        'Charuto do patrão',       'Fumaça grossa de quem está rico.',                           'consumivel', 60,   '{"anim":"charuto"}', 15),
  -- 03/11/2026 (loja nova): comidas e bebidas novas, com as animações que já existem
  ('cafe',           'Cafezinho',               'Passado na hora, para aguentar a madrugada.',                'consumivel', 15,   '{"anim":"beber","cor":"xicara"}', 16),
  ('pipoca',         'Pipoca',                  'Para assistir à live de alguém.',                            'consumivel', 20,   '{"anim":"beber","cor":"pipoca"}', 17),
  ('pizza',          'Fatia de pizza',          'Calabresa, a da madrugada depois da ranked.',                'consumivel', 35,   '{"anim":"beber","cor":"pizza"}', 18),
  ('whisky',         'Whisky 12 anos',          'Um gole de quem ganhou no cassino. Deixa tonto.',            'consumivel', 90,   '{"anim":"tonto","cor":"whisky"}', 19),
  ('champanhe',      'Champanhe',               'Para comemorar a vitória. Deixa bem tonto.',                 'consumivel', 150,  '{"anim":"tonto","cor":"champanhe"}', 19),
  ('escudo',         'Escudo de sequência',     'Salva um dia perdido da sequência. É gasto sozinho.',        'escudo',     400,  '{}', 20),
  ('planta-samambaia','Samambaia',              'A planta da vó, no canto do quarto.',                        'planta',     150,  '{"cor":"verde"}', 30),
  ('planta-cacto',   'Cacto',                   'Pouca água, igual a quem joga de suporte.',                  'planta',     180,  '{"cor":"cacto"}', 31),
  ('poster-baron',   'Pôster do Barão',         'Na parede, o bicho roxo do Rift.',                           'poster',     250,  '{"cor":"roxo"}', 40),
  ('poster-sitio',   'Pôster do Sítio',         'A foto do portão do Sítio do Mitz.',                         'poster',     350,  '{"cor":"sitio"}', 41),
  ('tapete-rift',    'Tapete do Rift',          'Verde com as três rotas.',                                   'tapete',     300,  '{"cor":"rift"}', 50),
  ('tapete-pelucia', 'Tapete de pelúcia',       'Fofo e vermelho, de quem tem estilo.',                       'tapete',     450,  '{"cor":"pelucia"}', 51),
  ('parede-oliva',   'Parede verde-oliva',      'Pinta o quarto com o verde do pano do truco.',               'parede',     400,  '{"cor":"oliva"}', 60),
  ('parede-ardosia', 'Parede ardósia',          'Pinta o quarto de cinza-azulado.',                           'parede',     400,  '{"cor":"ardosia"}', 61),
  ('cadeira-gamer',  'Cadeira gamer',           'Encosto alto, preta e vermelha.',                            'cadeira',    600,  '{"cor":"gamer"}', 70),
  ('cadeira-trono',  'Trono dourado',           'Para quem carrega o time nas costas.',                       'cadeira',    1500, '{"cor":"trono"}', 71),
  ('luz-ouro',       'Neon dourado',            'Uma faixa de luz no alto da parede.',                        'luz',        700,  '{"cor":"ouro"}', 80),
  ('luz-vermelha',   'Neon vermelho',           'Luz de lan house às 3 da manhã.',                            'luz',        700,  '{"cor":"vermelho"}', 81),
  ('mesa-rgb',       'PC gamer RGB',            'Monitor duplo e um gabinete que brilha.',                    'mesa',       1200, '{"cor":"rgb"}', 90),
  ('titulo-tilt',    'Título: Rei do tilt',     'Aparece embaixo do seu nome.',                               'titulo',     300,  '{"texto":"Rei do tilt"}', 100),
  ('titulo-alface',  'Título: Mão de alface',   'Aparece embaixo do seu nome.',                               'titulo',     250,  '{"texto":"Mão de alface"}', 101),
  ('titulo-piano',   'Título: Carregador de piano','Aparece embaixo do seu nome.',                            'titulo',     500,  '{"texto":"Carregador de piano"}', 102),
  ('titulo-lenda',   'Título: Lenda do Sítio',  'O título mais caro da loja.',                                'titulo',     2000, '{"texto":"Lenda do Sítio"}', 103),
  ('moldura-ouro',   'Moldura dourada',         'Um aro de ouro em volta do seu rosto.',                      'moldura',    800,  '{"cor":"ouro"}', 110),
  ('moldura-fogo',   'Moldura de fogo',         'Um aro vermelho em volta do seu rosto.',                     'moldura',    1200, '{"cor":"fogo"}', 111)
on conflict (id) do update set nome = excluded.nome, descricao = excluded.descricao, espaco = excluded.espaco,
  preco = excluded.preco, dados = excluded.dados, ordem = excluded.ordem;

create table if not exists public.mochila (
  user_id     uuid not null references auth.users(id) on delete cascade,
  item_id     text not null references public.loja_itens(id) on delete cascade,
  qtd         int not null default 1 check (qtd >= 0),
  equipado    boolean not null default false,
  comprado_em timestamptz not null default now(),
  primary key (user_id, item_id)
);
alter table public.mochila enable row level security;
revoke all on public.mochila from public, anon, authenticated;
grant select on public.mochila to authenticated;
-- todo mundo vê o que está equipado (o quarto, o título e a moldura dos outros); a mochila inteira, só a própria
drop policy if exists "equipados para todos e a mochila para o dono" on public.mochila;
create policy "equipados para todos e a mochila para o dono" on public.mochila for select to authenticated
  using (public.eh_nanico() and (equipado or user_id = auth.uid()));

-- consumíveis usados no Sítio: todo mundo vê o boneco fumando ou bebendo pelo tempo real desta tabela
create table if not exists public.consumos (
  id      bigint generated always as identity primary key,
  de      uuid not null references public.friends(id) on delete cascade,
  item_id text not null references public.loja_itens(id) on delete cascade,
  em      timestamptz not null default now()
);
create index if not exists consumos_em on public.consumos (em);
alter table public.consumos enable row level security;
revoke all on public.consumos from public, anon, authenticated;
grant select on public.consumos to authenticated;
drop policy if exists "nanicos veem os consumos recentes" on public.consumos;
create policy "nanicos veem os consumos recentes" on public.consumos for select to authenticated
  using (public.eh_nanico() and em > now() - interval '1 day');

do $$
begin
  begin alter publication supabase_realtime add table public.consumos; exception when duplicate_object then null; end;
  begin alter publication supabase_realtime add table public.mochila;  exception when duplicate_object then null; end;
end $$;

-- comprar: o preço vem da loja; escudo e consumíveis acumulam (escudo até 3), o resto só se compra uma vez
create or replace function public.comprar(p_item text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_uid   uuid := auth.uid();
  v_it    public.loja_itens;
  v_qtd   int;
  v_saldo int;
begin
  if not public.eh_nanico() then raise exception 'Só nanicos compram na loja.' using errcode = 'P0001'; end if;
  perform public.limitar('loja', 20, interval '1 minute', 'Calma: muitas compras seguidas.');
  select * into v_it from public.loja_itens where id = p_item and ativo;
  if not found then raise exception 'Esse item não está à venda.' using errcode = 'P0001'; end if;
  select qtd into v_qtd from public.mochila where user_id = v_uid and item_id = p_item for update;
  if v_it.espaco not in ('escudo', 'consumivel') and coalesce(v_qtd, 0) > 0 then
    raise exception 'Você já tem esse item. Ele está na sua mochila.' using errcode = 'P0001';
  end if;
  if v_it.espaco = 'escudo' and coalesce(v_qtd, 0) >= 3 then
    raise exception 'Dá para guardar no máximo 3 escudos.' using errcode = 'P0001';
  end if;
  if v_it.espaco = 'consumivel' and coalesce(v_qtd, 0) >= 20 then
    raise exception 'A mochila já tem 20 desse. Use antes de comprar mais.' using errcode = 'P0001';
  end if;
  v_saldo := public.creditar(v_uid, -v_it.preco, 'loja', p_item);   -- falha sem saldo e desfaz tudo
  insert into public.mochila (user_id, item_id, qtd) values (v_uid, p_item, 1)
    on conflict (user_id, item_id) do update set qtd = public.mochila.qtd + 1, comprado_em = now();
  return jsonb_build_object('saldo', v_saldo, 'item', p_item);
end $$;
revoke all on function public.comprar(text) from public, anon;
grant execute on function public.comprar(text) to authenticated;

-- equipar: liga um item da mochila e desliga os outros do mesmo espaço (só os que se equipam)
create or replace function public.equipar(p_item text, p_ligar boolean) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  v_esp text;
begin
  if not public.eh_nanico() then raise exception 'Só nanicos.' using errcode = 'P0001'; end if;
  perform public.limitar('equipar', 30, interval '1 minute', 'Calma: muitas trocas seguidas.');
  select i.espaco into v_esp from public.mochila m join public.loja_itens i on i.id = m.item_id
   where m.user_id = v_uid and m.item_id = p_item and m.qtd > 0;
  if v_esp is null then raise exception 'Esse item não está na sua mochila.' using errcode = 'P0001'; end if;
  if v_esp in ('escudo', 'consumivel') then raise exception 'Esse item não se equipa.' using errcode = 'P0001'; end if;
  if p_ligar then
    update public.mochila m set equipado = false from public.loja_itens i
     where m.user_id = v_uid and i.id = m.item_id and i.espaco = v_esp and m.item_id <> p_item and m.equipado;
  end if;
  update public.mochila set equipado = p_ligar where user_id = v_uid and item_id = p_item;
  return jsonb_build_object('item', p_item, 'equipado', p_ligar);
end $$;
revoke all on function public.equipar(text, boolean) from public, anon;
grant execute on function public.equipar(text, boolean) to authenticated;

-- usar um consumível: gasta 1 da mochila e grava em consumos (o Sítio inteiro vê a animação)
create or replace function public.usar_item(p_item text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  v_fid uuid;
  v_qtd int;
begin
  if not public.eh_nanico() then raise exception 'Só nanicos.' using errcode = 'P0001'; end if;
  select id into v_fid from public.friends where user_id = v_uid limit 1;
  perform public.limitar('usar', 6, interval '1 minute', 'Calma: um de cada vez.');
  select m.qtd into v_qtd from public.mochila m join public.loja_itens i on i.id = m.item_id
   where m.user_id = v_uid and m.item_id = p_item and i.espaco = 'consumivel' for update of m;
  if coalesce(v_qtd, 0) < 1 then raise exception 'Você não tem esse item. Compre na loja.' using errcode = 'P0001'; end if;
  if v_qtd = 1 then delete from public.mochila where user_id = v_uid and item_id = p_item;
  else update public.mochila set qtd = qtd - 1 where user_id = v_uid and item_id = p_item; end if;
  insert into public.consumos (de, item_id) values (v_fid, p_item);
  delete from public.consumos where em < now() - interval '30 days';
  return jsonb_build_object('item', p_item, 'resta', v_qtd - 1);
end $$;
revoke all on function public.usar_item(text) from public, anon;
grant execute on function public.usar_item(text) to authenticated;

-- o quarto de um nanico: os itens equipados (o site também lê direto da mochila, pela RLS)
create or replace function public.quarto_de(p_friend uuid) returns jsonb
language sql stable security definer set search_path = public as $$
  select coalesce(jsonb_agg(jsonb_build_object('item', m.item_id, 'espaco', i.espaco) order by i.ordem), '[]'::jsonb)
    from public.friends f
    join public.mochila m on m.user_id = f.user_id and m.equipado
    join public.loja_itens i on i.id = m.item_id
   where f.id = p_friend and public.eh_nanico();
$$;
revoke all on function public.quarto_de(uuid) from public, anon;
grant execute on function public.quarto_de(uuid) to authenticated;

-- o mesmo bater_ponto da seção 7, agora com o escudo: se faltou ontem mas pegou anteontem e tem escudo,
-- gasta 1 escudo, cria o dia de ontem (valor 0) e a sequência continua
create or replace function public.bater_ponto() returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_uid    uuid := auth.uid();
  v_hoje   date := public.hoje_br();
  v_seq    int;
  v_valor  int;
  v_extra  int := 0;
  v_escudo boolean := false;
  v_ante   int;
begin
  if not public.eh_nanico() then raise exception 'Só nanicos ganham o bônus.' using errcode = 'P0001'; end if;
  perform public.limitar('ponto', 20, interval '1 minute', 'Calma: espere um pouco e recarregue a página.');
  if not exists (select 1 from public.bonus_diario where user_id = v_uid and dia = v_hoje) then
    select seq into v_ante from public.bonus_diario where user_id = v_uid and dia = v_hoje - 2;
    if v_ante is not null
       and not exists (select 1 from public.bonus_diario where user_id = v_uid and dia = v_hoje - 1)
       and exists (select 1 from public.mochila where user_id = v_uid and item_id = 'escudo' and qtd > 0) then
      update public.mochila set qtd = qtd - 1 where user_id = v_uid and item_id = 'escudo';
      delete from public.mochila where user_id = v_uid and item_id = 'escudo' and qtd = 0;
      insert into public.bonus_diario (user_id, dia, seq, valor) values (v_uid, v_hoje - 1, v_ante + 1, 0)
        on conflict (user_id, dia) do nothing;
      v_escudo := true;
    end if;
  end if;
  select seq + 1 into v_seq from public.bonus_diario where user_id = v_uid and dia = v_hoje - 1;
  v_seq := coalesce(v_seq, 1);
  v_valor := round(30 * least(1 + 0.1 * (v_seq - 1), 2));
  insert into public.bonus_diario (user_id, dia, seq, valor) values (v_uid, v_hoje, v_seq, v_valor)
    on conflict (user_id, dia) do nothing;
  if not found then
    return public.minha_carteira() || jsonb_build_object('ganhou', 0, 'bonus_extra', 0, 'escudo_usado', false);
  end if;
  perform public.creditar(v_uid, v_valor, 'diario', v_hoje::text);
  if v_seq = 7 then v_extra := 100; elsif v_seq = 30 then v_extra := 500; end if;
  if v_extra > 0 then perform public.creditar(v_uid, v_extra, 'sequencia', v_seq || ' dias seguidos'); end if;
  return public.minha_carteira() || jsonb_build_object('ganhou', v_valor, 'bonus_extra', v_extra, 'escudo_usado', v_escudo);
end $$;
revoke all on function public.bater_ponto() from public, anon;
grant execute on function public.bater_ponto() to authenticated;

-- 13) truco no servidor: a função truco-mesa embaralha, guarda as mãos e confere cada jogada ----------------
-- truco_mesas: só o que todos podem ver (a mesa pública, sem as cartas de ninguém).
-- truco_estado: a mesa completa, com o baralho e as mãos. Ninguém lê, nem pelo tempo real; só as funções abaixo.
-- truco_maos: as três cartas de cada lugar; cada um lê só a sua (o RLS filtra também o tempo real).
create table if not exists public.truco_mesas (
  id            text primary key check (id ~ '^[a-z0-9]{6,20}$'),
  criada_por    uuid not null references auth.users(id) on delete cascade,
  opcoes        jsonb not null default '{}',
  publico       jsonb not null,
  fase          text not null check (fase in ('espera', 'jogo', 'fim')),
  atualizada_em timestamptz not null default now()
);
alter table public.truco_mesas enable row level security;
revoke all on public.truco_mesas from public, anon, authenticated;
grant select on public.truco_mesas to authenticated;
drop policy if exists truco_mesas_ler on public.truco_mesas;
create policy truco_mesas_ler on public.truco_mesas for select to authenticated using (public.eh_nanico());

create table if not exists public.truco_estado (
  mesa_id text primary key references public.truco_mesas(id) on delete cascade,
  estado  jsonb not null,
  versao  int not null default 0
);
alter table public.truco_estado enable row level security;
revoke all on public.truco_estado from public, anon, authenticated;

create table if not exists public.truco_maos (
  mesa_id text not null references public.truco_mesas(id) on delete cascade,
  lugar   int not null check (lugar between 0 and 3),
  user_id uuid not null references auth.users(id) on delete cascade,
  cartas  jsonb not null default '[]',
  mao_n   int not null default 0,
  primary key (mesa_id, lugar)
);
alter table public.truco_maos enable row level security;
revoke all on public.truco_maos from public, anon, authenticated;
grant select on public.truco_maos to authenticated;
drop policy if exists truco_maos_minha on public.truco_maos;
create policy truco_maos_minha on public.truco_maos for select to authenticated using (user_id = auth.uid());

do $$
begin
  begin alter publication supabase_realtime add table public.truco_mesas; exception when duplicate_object then null; end;
  begin alter publication supabase_realtime add table public.truco_maos;  exception when duplicate_object then null; end;
end $$;

-- até 30 ações a cada 10 s por pessoa (a função chama antes de cada ação; limitar() não serve, ela usa auth.uid())
create or replace function public.truco_vez(p_user uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_n int;
begin
  delete from public.limites where user_id = p_user and acao = 'truco' and at < now() - interval '1 day';
  select count(*) into v_n from public.limites where user_id = p_user and acao = 'truco' and at > now() - interval '10 seconds';
  if v_n >= 30 then raise exception 'Calma: muitas jogadas seguidas.' using errcode = 'P0001'; end if;
  insert into public.limites (user_id, acao) values (p_user, 'truco');
end $$;

-- a mesa completa e a versão (para gravar só se ninguém mexeu no meio)
create or replace function public.truco_carregar(p_mesa text)
returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object('estado', estado, 'versao', versao) from public.truco_estado where mesa_id = p_mesa
$$;

-- grava tudo de uma vez: a mesa completa, a pública e as mãos. p_versao = -1 abre uma mesa nova.
-- Devolve false se alguém gravou antes (a função carrega de novo e tenta outra vez).
create or replace function public.truco_salvar(p_mesa text, p_versao int, p_estado jsonb, p_publico jsonb, p_fase text, p_maos jsonb, p_user uuid, p_opcoes jsonb default '{}')
returns boolean language plpgsql security definer set search_path = public as $$
begin
  if p_versao = -1 then
    -- mesas esquecidas somem; as minhas que não estão em jogo também (uma mesa por pessoa)
    delete from public.truco_mesas where atualizada_em < now() - interval '3 hours';
    delete from public.truco_mesas where criada_por = p_user and fase <> 'jogo';
    if exists (select 1 from public.truco_mesas where criada_por = p_user) then
      raise exception 'Você já tem uma mesa em jogo.' using errcode = 'P0001';
    end if;
    insert into public.truco_mesas (id, criada_por, opcoes, publico, fase) values (p_mesa, p_user, p_opcoes, p_publico, p_fase);
    insert into public.truco_estado (mesa_id, estado, versao) values (p_mesa, p_estado, 0);
  else
    update public.truco_estado set estado = p_estado, versao = versao + 1 where mesa_id = p_mesa and versao = p_versao;
    if not found then return false; end if;
    update public.truco_mesas set publico = p_publico, fase = p_fase, atualizada_em = now() where id = p_mesa;
  end if;
  -- as mãos: só regrava a que mudou (cada mudança vira um aviso do tempo real só para o dono)
  delete from public.truco_maos m where m.mesa_id = p_mesa
     and not exists (select 1 from jsonb_array_elements(p_maos) x where (x->>'lugar')::int = m.lugar and (x->>'user_id')::uuid = m.user_id);
  insert into public.truco_maos (mesa_id, lugar, user_id, cartas, mao_n)
  select p_mesa, (x->>'lugar')::int, (x->>'user_id')::uuid, x->'cartas', (x->>'mao_n')::int from jsonb_array_elements(p_maos) x
  on conflict (mesa_id, lugar) do update set user_id = excluded.user_id, cartas = excluded.cartas, mao_n = excluded.mao_n
   where truco_maos.cartas is distinct from excluded.cartas or truco_maos.mao_n <> excluded.mao_n or truco_maos.user_id <> excluded.user_id;
  return true;
end $$;

create or replace function public.truco_fechar(p_mesa text, p_user uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  delete from public.truco_mesas where id = p_mesa and criada_por = p_user;
  if not found then raise exception 'Só quem abriu fecha a mesa.' using errcode = 'P0001'; end if;
end $$;

-- prêmio: +15 a cada vencedor, só com todos os lugares ocupados por nanicos diferentes, no máximo 3 vitórias pagas
-- por dia (de Brasília) e uma vez só por partida (o ref é "mesa:partida"). Devolve quem recebeu.
create or replace function public.truco_premiar(p_mesa text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_e     jsonb;
  v_m     jsonb;
  v_modo  int;
  v_venc  int;
  v_ref   text;
  v_uid   uuid;
  v_users uuid[] := '{}';
  v_pagos uuid[] := '{}';
  i       int;
begin
  select estado into v_e from public.truco_estado where mesa_id = p_mesa for update;
  v_m := v_e->'M';
  if v_m is null or v_m->>'fase' <> 'fim' or v_m->'vencedor' is null or jsonb_typeof(v_m->'vencedor') <> 'number' then
    return '[]'::jsonb;
  end if;
  v_modo := (v_m->>'modo')::int;
  v_venc := (v_m->>'vencedor')::int;
  for i in 0..v_modo - 1 loop
    v_uid := null;
    select f.user_id into v_uid from public.friends f
     where f.id::text = v_m->'lugares'->i->>'fid' and f.user_id::text = v_m->'lugares'->i->>'key';
    if v_uid is null or v_uid = any(v_users) then return '[]'::jsonb; end if;
    v_users := v_users || v_uid;
  end loop;
  v_ref := p_mesa || ':' || coalesce(v_e->>'partida', '1');
  for i in 0..v_modo - 1 loop
    continue when i % 2 <> v_venc;
    v_uid := v_users[i + 1];
    continue when exists (select 1 from public.extrato where user_id = v_uid and motivo = 'truco' and ref = v_ref);
    continue when (select count(*) from public.extrato where user_id = v_uid and motivo = 'truco' and valor > 0
                    and (em at time zone 'America/Sao_Paulo')::date = public.hoje_br()) >= 3;
    perform public.creditar(v_uid, 15, 'truco', v_ref);
    v_pagos := v_pagos || v_uid;
  end loop;
  return to_jsonb(v_pagos);
end $$;

revoke all on function public.truco_vez(uuid) from public, anon, authenticated;
revoke all on function public.truco_carregar(text) from public, anon, authenticated;
revoke all on function public.truco_salvar(text, int, jsonb, jsonb, text, jsonb, uuid, jsonb) from public, anon, authenticated;
revoke all on function public.truco_fechar(text, uuid) from public, anon, authenticated;
revoke all on function public.truco_premiar(text) from public, anon, authenticated;
grant execute on function public.truco_vez(uuid) to service_role;
grant execute on function public.truco_carregar(text) to service_role;
grant execute on function public.truco_salvar(text, int, jsonb, jsonb, text, jsonb, uuid, jsonb) to service_role;
grant execute on function public.truco_fechar(text, uuid) to service_role;
grant execute on function public.truco_premiar(text) to service_role;

-- 12a) bingo no servidor: cartela sorteada pelo banco, cada nanicada cantada por um e confirmada por outro, prêmio ---
-- bingo_partidas: uma partida aberta por sala de LoL (abre sozinha na primeira cartela; qualquer nanico fecha).
-- bingo_cartelas: a cartela de cada um (25 ids de nanicadas; a 13ª, o meio, é null = LIVRE). Cada um lê só a sua.
-- bingo_cantos: "Aconteceu!" de alguém; vale quando OUTRO nanico com cartela confirma. Todos leem.
-- bingo_premios: quem fechou linha em cada partida e quanto recebeu (+25, até 3 por dia; montada não recebe).
create table if not exists public.bingo_partidas (
  id         bigint generated always as identity primary key,
  sala       text not null references public.salas(id) on delete cascade,
  game_id    bigint,
  aberta_em  timestamptz not null default now(),
  fechada_em timestamptz
);
create unique index if not exists bingo_uma_aberta on public.bingo_partidas (sala) where fechada_em is null;

create table if not exists public.bingo_cartelas (
  id         bigint generated always as identity primary key,
  partida_id bigint not null references public.bingo_partidas(id) on delete cascade,
  user_id    uuid not null references auth.users(id) on delete cascade,
  casas      uuid[] not null check (array_length(casas, 1) = 25),
  origem     text not null check (origem in ('sorteada', 'montada')),
  criada_em  timestamptz not null default now(),
  unique (partida_id, user_id)
);

create table if not exists public.bingo_cantos (
  id             bigint generated always as identity primary key,
  partida_id     bigint not null references public.bingo_partidas(id) on delete cascade,
  phrase_id      uuid not null references public.phrases(id) on delete cascade,
  cantado_por    uuid not null references auth.users(id) on delete cascade,
  cantado_em     timestamptz not null default now(),
  confirmado_por uuid references auth.users(id) on delete set null,
  confirmado_em  timestamptz,
  unique (partida_id, phrase_id)
);

create table if not exists public.bingo_premios (
  partida_id bigint not null references public.bingo_partidas(id) on delete cascade,
  user_id    uuid not null references auth.users(id) on delete cascade,
  linhas     int not null,
  pago       int not null,
  em         timestamptz not null default now(),
  primary key (partida_id, user_id)
);

alter table public.bingo_partidas enable row level security;
alter table public.bingo_cartelas enable row level security;
alter table public.bingo_cantos   enable row level security;
alter table public.bingo_premios  enable row level security;
revoke all on public.bingo_partidas, public.bingo_cartelas, public.bingo_cantos, public.bingo_premios from public, anon, authenticated;
grant select on public.bingo_partidas, public.bingo_cartelas, public.bingo_cantos, public.bingo_premios to authenticated;
drop policy if exists bingo_partidas_ler on public.bingo_partidas;
create policy bingo_partidas_ler on public.bingo_partidas for select to authenticated using (public.eh_nanico());
drop policy if exists bingo_cartelas_minha on public.bingo_cartelas;
create policy bingo_cartelas_minha on public.bingo_cartelas for select to authenticated using (user_id = auth.uid());
drop policy if exists bingo_cantos_ler on public.bingo_cantos;
create policy bingo_cantos_ler on public.bingo_cantos for select to authenticated using (public.eh_nanico());
drop policy if exists bingo_premios_ler on public.bingo_premios;
create policy bingo_premios_ler on public.bingo_premios for select to authenticated using (public.eh_nanico());

do $$
begin
  begin alter publication supabase_realtime add table public.bingo_partidas; exception when duplicate_object then null; end;
  begin alter publication supabase_realtime add table public.bingo_cartelas; exception when duplicate_object then null; end;
  begin alter publication supabase_realtime add table public.bingo_cantos;   exception when duplicate_object then null; end;
  begin alter publication supabase_realtime add table public.bingo_premios;  exception when duplicate_object then null; end;
end $$;

-- quais nanicadas valem para a escalação da sala: a mesma regra de matchPhrase/eligible em src/lib/bingo.ts
-- (conferida com o mesmo exemplo nos dois lados: src/lib/bingo-valem.fixture.json)
--   sem nanico e sem campeão: genérica;
--   "todos": todos os nanicos jogando e todos os campeões na partida;
--   "qualquer" com nanicos e campeões: um desses nanicos jogando com um desses campeões;
--   "qualquer" só com nanicos (ou só com campeões): um deles na partida.
-- Só contam as rotas com nanico (o campeão de uma rota "Random" não entra), e campeão compara sem maiúsculas.
create or replace function public.bingo_valem(p_sala text)
returns table (phrase_id uuid, da_partida boolean)
language sql stable security definer set search_path = public as $$
  with pl as (
    select x->>'friendId' as fid, lower(btrim(coalesce(x->>'champion', ''))) as champ
      from public.game g, jsonb_array_elements(case when jsonb_typeof(g.players) = 'array' then g.players else '[]'::jsonb end) x
     where g.sala = p_sala and coalesce(x->>'friendId', '') <> ''
  ),
  ph as (
    select p.id, coalesce(p.modo, 'qualquer') as modo,
      case when coalesce(array_length(p.friend_ids, 1), 0) > 0
           then coalesce((select array_agg(distinct u::text) from unnest(p.friend_ids) u where u is not null), '{}'::text[])
           when p.friend_id is not null then array[p.friend_id::text]
           else '{}'::text[] end as n,
      coalesce((select array_agg(lower(btrim(c))) from unnest(p.champions) c where btrim(coalesce(c, '')) <> ''), '{}'::text[]) as c
      from public.phrases p
  )
  select ph.id, not (cardinality(ph.n) = 0 and cardinality(ph.c) = 0)
    from ph
   where (cardinality(ph.n) = 0 and cardinality(ph.c) = 0)
      or (ph.modo = 'todos'
          and ph.n <@ coalesce((select array_agg(fid) from pl), '{}'::text[])
          and ph.c <@ coalesce((select array_agg(champ) from pl where champ <> ''), '{}'::text[]))
      or (ph.modo <> 'todos' and cardinality(ph.n) > 0 and cardinality(ph.c) > 0
          and exists (select 1 from pl where pl.fid = any(ph.n) and pl.champ = any(ph.c)))
      or (ph.modo <> 'todos' and cardinality(ph.n) > 0 and cardinality(ph.c) = 0
          and exists (select 1 from pl where pl.fid = any(ph.n)))
      or (ph.modo <> 'todos' and cardinality(ph.n) = 0 and cardinality(ph.c) > 0
          and exists (select 1 from pl where pl.champ <> '' and pl.champ = any(ph.c)))
$$;

-- sorteia 24 nanicadas como sortear() do site (até 16 da partida, o resto genéricas) com gen_random_bytes; o meio é LIVRE
create or replace function public.bingo_sortear(p_sala text)
returns uuid[] language plpgsql volatile security definer set search_path = public as $$
declare
  v_spec uuid[];
  v_gen  uuid[];
  v_pick uuid[];
begin
  select coalesce(array_agg(phrase_id order by extensions.gen_random_bytes(8)), '{}') into v_spec from public.bingo_valem(p_sala) where da_partida;
  select coalesce(array_agg(phrase_id order by extensions.gen_random_bytes(8)), '{}') into v_gen  from public.bingo_valem(p_sala) where not da_partida;
  v_pick := v_spec[1:16];
  v_pick := v_pick || v_gen[1:24 - cardinality(v_pick)];
  if cardinality(v_pick) < 24 then v_pick := v_pick || v_spec[17:16 + 24 - cardinality(v_pick)]; end if;
  if cardinality(v_pick) < 24 then
    raise exception 'Faltam nanicadas para esta escalação: são precisas 24.' using errcode = 'P0001';
  end if;
  select array_agg(x order by extensions.gen_random_bytes(8)) into v_pick from unnest(v_pick) x;
  return v_pick[1:12] || array[null::uuid] || v_pick[13:24];
end $$;

-- a partida aberta da sala (abre se não tiver), guardando o jogo da Riot se alguém da escalação está em partida
create or replace function public.bingo_abrir(p_sala text)
returns bigint language plpgsql security definer set search_path = public as $$
declare
  v_id   bigint;
  v_game bigint;
begin
  if not public.eh_nanico() then raise exception 'Só nanicos jogam o bingo.' using errcode = 'P0001'; end if;
  if not exists (select 1 from public.salas where id = p_sala and jogo = 'lol') then
    raise exception 'O bingo é só nas salas de LoL.' using errcode = 'P0001';
  end if;
  select id into v_id from public.bingo_partidas where sala = p_sala and fechada_em is null;
  if v_id is not null then return v_id; end if;
  select r.game_id into v_game from public.riot_ao_vivo r
   where r.game_id is not null and r.friend_id::text in (
     select x->>'friendId' from public.game g, jsonb_array_elements(case when jsonb_typeof(g.players) = 'array' then g.players else '[]'::jsonb end) x
      where g.sala = p_sala)
   limit 1;
  insert into public.bingo_partidas (sala, game_id) values (p_sala, v_game)
    on conflict (sala) where fechada_em is null do nothing returning id into v_id;
  if v_id is null then select id into v_id from public.bingo_partidas where sala = p_sala and fechada_em is null; end if;
  return v_id;
end $$;

-- grava a minha cartela da partida (trocar só enquanto nenhum canto foi confirmado)
create or replace function public.bingo_gravar(p_sala text, p_casas uuid[], p_origem text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_uid     uuid := auth.uid();
  v_partida bigint;
begin
  perform public.limitar('bingo_cartela', 20, interval '1 minute', 'Calma: cartelas demais em pouco tempo.');
  v_partida := public.bingo_abrir(p_sala);
  if exists (select 1 from public.bingo_cartelas where partida_id = v_partida and user_id = v_uid)
     and exists (select 1 from public.bingo_cantos where partida_id = v_partida and confirmado_em is not null) then
    raise exception 'A partida já começou: sua cartela não muda mais. Feche a partida para jogar outra.' using errcode = 'P0001';
  end if;
  insert into public.bingo_cartelas (partida_id, user_id, casas, origem) values (v_partida, v_uid, p_casas, p_origem)
    on conflict (partida_id, user_id) do update set casas = excluded.casas, origem = excluded.origem, criada_em = now();
  return jsonb_build_object('partida', v_partida, 'casas', to_jsonb(p_casas), 'origem', p_origem);
end $$;

create or replace function public.bingo_nova_cartela(p_sala text)
returns jsonb language plpgsql security definer set search_path = public as $$
begin
  if not public.eh_nanico() then raise exception 'Só nanicos jogam o bingo.' using errcode = 'P0001'; end if;
  return public.bingo_gravar(p_sala, public.bingo_sortear(p_sala), 'sorteada');
end $$;

-- cartela montada à mão: 24 nanicadas diferentes que valem para a escalação (o meio, null, é o LIVRE); não paga
create or replace function public.bingo_montada(p_sala text, p_casas uuid[])
returns jsonb language plpgsql security definer set search_path = public as $$
begin
  if not public.eh_nanico() then raise exception 'Só nanicos jogam o bingo.' using errcode = 'P0001'; end if;
  if p_casas is null or array_length(p_casas, 1) <> 25 or p_casas[13] is not null
     or (select count(distinct x) from unnest(p_casas) x where x is not null) <> 24 then
    raise exception 'A cartela precisa de 24 nanicadas diferentes e o LIVRE no meio.' using errcode = 'P0001';
  end if;
  if exists (select 1 from unnest(p_casas) x where x is not null
              and x not in (select phrase_id from public.bingo_valem(p_sala))) then
    raise exception 'Tem nanicada que não vale para esta escalação.' using errcode = 'P0001';
  end if;
  return public.bingo_gravar(p_sala, p_casas, 'montada');
end $$;

-- "Aconteceu!": quem tem cartela na partida canta uma nanicada que está em alguma cartela dela
create or replace function public.bingo_cantar(p_partida bigint, p_phrase uuid)
returns bigint language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  v_id  bigint;
begin
  if not exists (select 1 from public.bingo_partidas where id = p_partida and fechada_em is null) then
    raise exception 'Essa partida já foi fechada.' using errcode = 'P0001';
  end if;
  if not exists (select 1 from public.bingo_cartelas where partida_id = p_partida and user_id = v_uid) then
    raise exception 'Pegue uma cartela para cantar.' using errcode = 'P0001';
  end if;
  if not exists (select 1 from public.bingo_cartelas where partida_id = p_partida and p_phrase = any(casas)) then
    raise exception 'Essa nanicada não está em nenhuma cartela.' using errcode = 'P0001';
  end if;
  select id into v_id from public.bingo_cantos where partida_id = p_partida and phrase_id = p_phrase;
  if v_id is not null then return v_id; end if;
  perform public.limitar('cantar', 10, interval '1 minute', 'Calma: muitas nanicadas cantadas seguidas.');
  insert into public.bingo_cantos (partida_id, phrase_id, cantado_por) values (p_partida, p_phrase, v_uid)
    on conflict (partida_id, phrase_id) do nothing returning id into v_id;
  if v_id is null then select id into v_id from public.bingo_cantos where partida_id = p_partida and phrase_id = p_phrase; end if;
  return v_id;
end $$;

-- paga quem fechou linha (interna): só cartela sorteada, uma vez por partida, até 3 prêmios por dia (de Brasília)
create or replace function public.bingo_pagar(p_partida bigint)
returns void language plpgsql security definer set search_path = public as $$
declare
  r      record;
  v_conf uuid[];
  v_marc boolean[];
  v_lin  int;
  v_hoje int;
  i      int;
begin
  select coalesce(array_agg(phrase_id), '{}') into v_conf from public.bingo_cantos where partida_id = p_partida and confirmado_em is not null;
  for r in select c.user_id, c.casas from public.bingo_cartelas c
            where c.partida_id = p_partida and c.origem = 'sorteada'
              and not exists (select 1 from public.bingo_premios p where p.partida_id = p_partida and p.user_id = c.user_id) loop
    v_marc := '{}';
    for i in 1..25 loop v_marc := v_marc || (i = 13 or coalesce(r.casas[i] = any(v_conf), false)); end loop;
    -- as 12 linhas (LINES em bingo.ts, aqui contando de 1): 5 linhas, 5 colunas e 2 diagonais
    select count(*) into v_lin from (values
      (array[1,2,3,4,5]), (array[6,7,8,9,10]), (array[11,12,13,14,15]), (array[16,17,18,19,20]), (array[21,22,23,24,25]),
      (array[1,6,11,16,21]), (array[2,7,12,17,22]), (array[3,8,13,18,23]), (array[4,9,14,19,24]), (array[5,10,15,20,25]),
      (array[1,7,13,19,25]), (array[5,9,13,17,21])) l(ix)
     where (select bool_and(v_marc[k]) from unnest(l.ix) k);
    continue when v_lin < 1;
    select count(*) into v_hoje from public.bingo_premios
     where user_id = r.user_id and pago > 0 and (em at time zone 'America/Sao_Paulo')::date = public.hoje_br();
    if v_hoje < 3 then
      perform public.creditar(r.user_id, 25, 'bingo', p_partida::text);
      insert into public.bingo_premios (partida_id, user_id, linhas, pago) values (p_partida, r.user_id, v_lin, 25);
    else
      insert into public.bingo_premios (partida_id, user_id, linhas, pago) values (p_partida, r.user_id, v_lin, 0);
    end if;
  end loop;
end $$;

-- confirma o canto de outro nanico: marca em todas as cartelas e paga quem fechou linha
create or replace function public.bingo_confirmar(p_canto bigint)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  v_c   public.bingo_cantos;
begin
  if not public.eh_nanico() then raise exception 'Só nanicos confirmam.' using errcode = 'P0001'; end if;
  select * into v_c from public.bingo_cantos where id = p_canto for update;
  if v_c.id is null then raise exception 'Esse canto não existe.' using errcode = 'P0001'; end if;
  if v_c.confirmado_em is not null then return; end if;
  if v_c.cantado_por = v_uid then
    raise exception 'Quem cantou não confirma: espere outro nanico.' using errcode = 'P0001';
  end if;
  if not exists (select 1 from public.bingo_partidas where id = v_c.partida_id and fechada_em is null) then
    raise exception 'Essa partida já foi fechada.' using errcode = 'P0001';
  end if;
  if not exists (select 1 from public.bingo_cartelas where partida_id = v_c.partida_id and user_id = v_uid) then
    raise exception 'Pegue uma cartela para confirmar.' using errcode = 'P0001';
  end if;
  update public.bingo_cantos set confirmado_por = v_uid, confirmado_em = now() where id = p_canto;
  perform public.bingo_pagar(v_c.partida_id);
end $$;

-- fecha a partida da sala (qualquer nanico; a próxima cartela abre outra)
create or replace function public.bingo_fechar(p_sala text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.eh_nanico() then raise exception 'Só nanicos jogam o bingo.' using errcode = 'P0001'; end if;
  update public.bingo_partidas set fechada_em = now() where sala = p_sala and fechada_em is null;
end $$;

revoke all on function public.bingo_valem(text) from public, anon, authenticated;
revoke all on function public.bingo_sortear(text) from public, anon, authenticated;
revoke all on function public.bingo_gravar(text, uuid[], text) from public, anon, authenticated;
revoke all on function public.bingo_pagar(bigint) from public, anon, authenticated;
revoke all on function public.bingo_abrir(text) from public, anon;
revoke all on function public.bingo_nova_cartela(text) from public, anon;
revoke all on function public.bingo_montada(text, uuid[]) from public, anon;
revoke all on function public.bingo_cantar(bigint, uuid) from public, anon;
revoke all on function public.bingo_confirmar(bigint) from public, anon;
revoke all on function public.bingo_fechar(text) from public, anon;
grant execute on function public.bingo_abrir(text) to authenticated;
grant execute on function public.bingo_nova_cartela(text) to authenticated;
grant execute on function public.bingo_montada(text, uuid[]) to authenticated;
grant execute on function public.bingo_cantar(bigint, uuid) to authenticated;
grant execute on function public.bingo_confirmar(bigint) to authenticated;
grant execute on function public.bingo_fechar(text) to authenticated;

-- 23) missões do dia: 3 por dia (Brasília), sorteadas para cada um; o progresso é recalculado das tabelas de origem ------
-- Nenhum gatilho e nenhuma contagem vinda do site: minhas_missoes() olha o que aconteceu hoje (chat, nanicadas, zoeira,
-- truco, bingo, roleta, tempo online) e paga na hora em que a missão completa, uma vez só (feita_em + ref no extrato).
-- Missão de fase que ainda não existe fica com fase_ok = false e não é sorteada; o PR da fase liga a missão.
create table if not exists public.missoes_def (
  id      text primary key check (id ~ '^[a-z0-9_]{2,20}$'),
  texto   text not null,
  meta    int not null check (meta between 1 and 600),
  valor   int not null check (valor between 1 and 100),
  fase_ok boolean not null default true,
  ordem   int not null default 0
);
alter table public.missoes_def enable row level security;
revoke all on public.missoes_def from public, anon, authenticated;
grant select on public.missoes_def to authenticated;
drop policy if exists missoes_def_ler on public.missoes_def;
create policy missoes_def_ler on public.missoes_def for select to authenticated using (public.eh_nanico());

insert into public.missoes_def (id, texto, meta, valor, fase_ok, ordem) values
  ('online30',  'Fique 30 minutos no site',          30, 10, true,  1),
  ('chat5',     'Mande 5 mensagens no chat',          5, 10, true,  2),
  ('nanicada',  'Cadastre uma nanicada nova',         1, 15, true,  3),
  ('chinelada', 'Dê uma chinelada em alguém',         1, 15, true,  4),
  ('torta',     'Leve uma torta na cara',             1, 20, true,  5),
  ('truco',     'Ganhe uma partida de truco valendo moedas', 1, 20, true, 6),
  ('bingo',     'Faça um bingo',                      1, 20, true,  7),
  ('roleta',    'Gire a roleta do rodízio',           1, 10, true,  8),
  ('aposta',    'Aposte numa partida ao vivo',        1, 15, false, 9)
on conflict (id) do update set texto = excluded.texto, meta = excluded.meta, valor = excluded.valor, ordem = excluded.ordem;
-- fase_ok não é sobrescrito: quem liga uma missão (o PR da fase dela) faz um update explícito

create table if not exists public.missoes_dia (
  user_id   uuid not null references auth.users(id) on delete cascade,
  dia       date not null,
  missao_id text not null references public.missoes_def(id) on delete cascade,
  progresso int not null default 0,
  feita_em  timestamptz,
  primary key (user_id, dia, missao_id)
);
alter table public.missoes_dia enable row level security;
revoke all on public.missoes_dia from public, anon, authenticated;
grant select on public.missoes_dia to authenticated;
drop policy if exists missoes_dia_minhas on public.missoes_dia;
create policy missoes_dia_minhas on public.missoes_dia for select to authenticated using (user_id = auth.uid());

-- quanto da missão a pessoa já fez hoje, contando direto das tabelas de origem (interna)
create or replace function public.missao_progresso(p_user uuid, p_dia date, p_missao text)
returns int language plpgsql stable security definer set search_path = public as $$
declare
  v_fid uuid;
  v_n   int := 0;
begin
  select id into v_fid from public.friends where user_id = p_user limit 1;
  if p_missao = 'online30' then
    select coalesce(minutos, 0) into v_n from public.online_diario where user_id = p_user and dia = p_dia;
  elsif p_missao = 'chat5' then
    select count(*) into v_n from public.chat_messages
     where user_id = p_user and (created_at at time zone 'America/Sao_Paulo')::date = p_dia;
  elsif p_missao = 'nanicada' then
    select count(*) into v_n from public.phrases
     where created_by = p_user and (created_at at time zone 'America/Sao_Paulo')::date = p_dia;
  elsif p_missao = 'chinelada' then
    select count(*) into v_n from public.zoeiras
     where de = v_fid and tipo = 'chinelo' and (em at time zone 'America/Sao_Paulo')::date = p_dia;
  elsif p_missao = 'torta' then
    select count(*) into v_n from public.zoeiras
     where para = v_fid and tipo = 'torta' and (em at time zone 'America/Sao_Paulo')::date = p_dia;
  elsif p_missao = 'truco' then
    select count(*) into v_n from public.extrato
     where user_id = p_user and motivo = 'truco' and valor > 0 and (em at time zone 'America/Sao_Paulo')::date = p_dia;
  elsif p_missao = 'bingo' then
    select count(*) into v_n from public.bingo_premios
     where user_id = p_user and linhas > 0 and (em at time zone 'America/Sao_Paulo')::date = p_dia;
  elsif p_missao = 'roleta' then
    select count(*) into v_n from public.rodizio
     where sorteado_por = p_user and (girado_em at time zone 'America/Sao_Paulo')::date = p_dia;
  elsif p_missao = 'aposta' then
    select count(*) into v_n from public.apostas
     where user_id = p_user and (em at time zone 'America/Sao_Paulo')::date = p_dia;
  end if;
  return coalesce(v_n, 0);
end $$;

-- as minhas 3 missões de hoje (sorteia se ainda não tem), com o progresso recalculado; paga o que acabou de completar
create or replace function public.minhas_missoes()
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_uid  uuid := auth.uid();
  v_dia  date := public.hoje_br();
  r      record;
  v_prog int;
  v_ganhou int := 0;
  v_out  jsonb := '[]'::jsonb;
  v_bonus boolean;
begin
  if v_uid is null or not public.eh_nanico() then return jsonb_build_object('missoes', '[]'::jsonb); end if;
  -- uma chamada por vez para cada pessoa (duas abas não sorteiam nem pagam duas vezes)
  perform pg_advisory_xact_lock(hashtext('missoes:' || v_uid::text));
  if not exists (select 1 from public.missoes_dia where user_id = v_uid and dia = v_dia) then
    insert into public.missoes_dia (user_id, dia, missao_id)
    select v_uid, v_dia, id from public.missoes_def where fase_ok order by random() limit 3;
  end if;
  for r in select d.missao_id, d.feita_em, m.texto, m.meta, m.valor, m.ordem
             from public.missoes_dia d join public.missoes_def m on m.id = d.missao_id
            where d.user_id = v_uid and d.dia = v_dia order by m.ordem loop
    v_prog := least(r.meta, public.missao_progresso(v_uid, v_dia, r.missao_id));
    if r.feita_em is not null then v_prog := r.meta; end if;
    update public.missoes_dia set progresso = v_prog where user_id = v_uid and dia = v_dia and missao_id = r.missao_id and progresso <> v_prog;
    if r.feita_em is null and v_prog >= r.meta then
      update public.missoes_dia set feita_em = now() where user_id = v_uid and dia = v_dia and missao_id = r.missao_id;
      perform public.creditar(v_uid, r.valor, 'missao', v_dia || ':' || r.missao_id);
      v_ganhou := v_ganhou + r.valor;
      r.feita_em := now();
    end if;
    v_out := v_out || jsonb_build_object('id', r.missao_id, 'texto', r.texto, 'meta', r.meta, 'valor', r.valor,
                                         'progresso', v_prog, 'feita', r.feita_em is not null);
  end loop;
  v_bonus := exists (select 1 from public.extrato where user_id = v_uid and motivo = 'missao' and ref = v_dia || ':bonus');
  if not v_bonus and jsonb_array_length(v_out) = 3
     and not exists (select 1 from public.missoes_dia where user_id = v_uid and dia = v_dia and feita_em is null) then
    perform public.creditar(v_uid, 25, 'missao', v_dia || ':bonus');
    v_ganhou := v_ganhou + 25;
    v_bonus := true;
  end if;
  return jsonb_build_object('dia', v_dia, 'missoes', v_out, 'bonus', 25, 'bonus_pago', v_bonus, 'ganhou', v_ganhou);
end $$;

revoke all on function public.missao_progresso(uuid, date, text) from public, anon, authenticated;
revoke all on function public.minhas_missoes() from public, anon;
grant execute on function public.minhas_missoes() to authenticated;

-- 16) mídias e links: galeria de prints (bucket privado), vídeos por link, links do perfil e mural do grupo -------------
-- Bucket "midias" PRIVADO (até 5 MB, só imagem): nanicos baixam, cada um sobe e apaga só na própria pasta (<uid>/...).
-- Vídeo não vai para o bucket (o plano grátis tem 1 GB): entra como link do YouTube, Medal ou clipe da Twitch.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('midias', 'midias', false, 5242880, array['image/webp', 'image/png', 'image/jpeg', 'image/gif'])
on conflict (id) do update set public = false, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists midias_ler on storage.objects;
create policy midias_ler on storage.objects for select to authenticated
  using (bucket_id = 'midias' and public.eh_nanico());
drop policy if exists midias_subir on storage.objects;
create policy midias_subir on storage.objects for insert to authenticated
  with check (bucket_id = 'midias' and public.eh_nanico() and (storage.foldername(name))[1] = auth.uid()::text);
drop policy if exists midias_apagar on storage.objects;
create policy midias_apagar on storage.objects for delete to authenticated
  using (bucket_id = 'midias' and (storage.foldername(name))[1] = auth.uid()::text);

-- a galeria: ou um arquivo do bucket (caminho), ou um link de vídeo; legenda curta e de qual sala veio
create table if not exists public.midias (
  id      bigint generated always as identity primary key,
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  caminho text unique check (caminho ~ '^[0-9a-f-]{36}/[a-z0-9-]{6,40}\.(webp|gif|png|jpg)$'),
  link    text check (char_length(link) <= 300 and link ~ '^https://(((www|m)\.)?youtube\.com/(watch\?v=|shorts/)[A-Za-z0-9_-]{6,20}|youtu\.be/[A-Za-z0-9_-]{6,20}|(www\.)?medal\.tv/[A-Za-z0-9/_-]{3,200}|clips\.twitch\.tv/[A-Za-z0-9_-]{3,100}|(www\.)?twitch\.tv/[A-Za-z0-9_]{3,25}/clip/[A-Za-z0-9_-]{3,100})([?&#][^[:space:]<>"]*)?$'),
  legenda text not null default '' check (char_length(legenda) <= 140),
  sala    text references public.salas(id) on delete set null,
  em      timestamptz not null default now(),
  constraint midia_arquivo_ou_link check ((caminho is null) <> (link is null))
);
create index if not exists midias_em on public.midias (em desc);
alter table public.midias enable row level security;
revoke all on public.midias from public, anon, authenticated;
grant select, delete on public.midias to authenticated;
grant insert (caminho, link, legenda, sala) on public.midias to authenticated;
drop policy if exists midias_tabela_ler on public.midias;
create policy midias_tabela_ler on public.midias for select to authenticated using (public.eh_nanico());
drop policy if exists midias_tabela_criar on public.midias;
create policy midias_tabela_criar on public.midias for insert to authenticated with check (public.eh_nanico() and user_id = auth.uid());
drop policy if exists midias_tabela_apagar on public.midias;
create policy midias_tabela_apagar on public.midias for delete to authenticated using (user_id = auth.uid());

create or replace function public.midias_protecao() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  new.user_id := auth.uid();
  new.em := now();
  new.legenda := left(btrim(regexp_replace(coalesce(new.legenda, ''), '[\x00-\x1F\x7F]', ' ', 'g')), 140);
  if new.caminho is not null then
    if split_part(new.caminho, '/', 1) <> new.user_id::text then
      raise exception 'Envie na sua própria pasta.' using errcode = 'P0001';
    end if;
    if not exists (select 1 from storage.objects where bucket_id = 'midias' and name = new.caminho) then
      raise exception 'O arquivo não chegou. Envie de novo.' using errcode = 'P0001';
    end if;
  end if;
  perform public.limitar('midia', 10, interval '1 hour', 'Calma: no máximo 10 mídias por hora.');
  if (select count(*) from public.midias where user_id = new.user_id) >= 60 then
    raise exception 'Você já tem 60 mídias. Apague alguma para mandar outra.' using errcode = 'P0001';
  end if;
  return new;
end $$;
drop trigger if exists midias_protecao on public.midias;
create trigger midias_protecao before insert on public.midias for each row execute function public.midias_protecao();

-- links do perfil (além de op.gg e Steam): um por tipo, cada um só os próprios; o formato de cada site é conferido
create table if not exists public.perfil_links (
  friend_id uuid not null references public.friends(id) on delete cascade,
  tipo      text not null check (tipo in ('twitch', 'youtube', 'instagram', 'tiktok', 'x', 'faceit', 'leetify')),
  url       text not null check (char_length(url) <= 200),
  primary key (friend_id, tipo),
  constraint perfil_link_formato check (
       (tipo = 'twitch'    and url ~ '^https://(www\.)?twitch\.tv/[A-Za-z0-9_]{3,25}/?$')
    or (tipo = 'youtube'   and url ~ '^https://(www\.)?youtube\.com/(@[A-Za-z0-9._-]{3,30}|channel/[A-Za-z0-9_-]{10,40}|c/[A-Za-z0-9._-]{2,60})/?$')
    or (tipo = 'instagram' and url ~ '^https://(www\.)?instagram\.com/[A-Za-z0-9._]{1,30}/?$')
    or (tipo = 'tiktok'    and url ~ '^https://(www\.)?tiktok\.com/@[A-Za-z0-9._]{2,24}/?$')
    or (tipo = 'x'         and url ~ '^https://(www\.)?(x|twitter)\.com/[A-Za-z0-9_]{1,15}/?$')
    or (tipo = 'faceit'    and url ~ '^https://(www\.)?faceit\.com/[a-z]{2}(-[a-z]{2})?/players/[A-Za-z0-9_-]{2,30}/?$')
    or (tipo = 'leetify'   and url ~ '^https://(www\.)?leetify\.com/app/profile/[0-9]{17}/?$'))
);
alter table public.perfil_links enable row level security;
revoke all on public.perfil_links from public, anon, authenticated;
grant select, insert, update, delete on public.perfil_links to authenticated;
drop policy if exists perfil_links_ler on public.perfil_links;
create policy perfil_links_ler on public.perfil_links for select to authenticated using (public.eh_nanico());
drop policy if exists perfil_links_meus on public.perfil_links;
create policy perfil_links_meus on public.perfil_links for all to authenticated
  using (friend_id in (select id from public.friends where user_id = auth.uid()))
  with check (friend_id in (select id from public.friends where user_id = auth.uid()));
create or replace function public.perfil_links_protecao() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  perform public.limitar('perfil_link', 40, interval '1 hour', 'Calma: muitas mudanças nos links. Tente daqui a pouco.');
  return new;
end $$;
drop trigger if exists perfil_links_protecao on public.perfil_links;
create trigger perfil_links_protecao before insert or update on public.perfil_links for each row execute function public.perfil_links_protecao();

-- mural de links do grupo (builds, vídeos, jogos): só https, autor sempre quem está logado, o autor apaga
create table if not exists public.mural_links (
  id      bigint generated always as identity primary key,
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  url     text not null check (char_length(url) <= 300 and url ~ '^https://[A-Za-z0-9.-]+\.[A-Za-z]{2,}(:[0-9]{2,5})?(/[^[:space:]<>"]*)?$'),
  titulo  text not null default '' check (char_length(titulo) <= 80),
  em      timestamptz not null default now()
);
create index if not exists mural_links_em on public.mural_links (em desc);
alter table public.mural_links enable row level security;
revoke all on public.mural_links from public, anon, authenticated;
grant select, delete on public.mural_links to authenticated;
grant insert (url, titulo) on public.mural_links to authenticated;
drop policy if exists mural_ler on public.mural_links;
create policy mural_ler on public.mural_links for select to authenticated using (public.eh_nanico());
drop policy if exists mural_criar on public.mural_links;
create policy mural_criar on public.mural_links for insert to authenticated with check (public.eh_nanico() and user_id = auth.uid());
drop policy if exists mural_apagar on public.mural_links;
create policy mural_apagar on public.mural_links for delete to authenticated using (user_id = auth.uid());
create or replace function public.mural_protecao() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  new.user_id := auth.uid();
  new.em := now();
  new.titulo := left(btrim(regexp_replace(coalesce(new.titulo, ''), '[\x00-\x1F\x7F]', ' ', 'g')), 80);
  perform public.limitar('mural', 10, interval '1 hour', 'Calma: no máximo 10 links por hora no mural.');
  return new;
end $$;
drop trigger if exists mural_protecao on public.mural_links;
create trigger mural_protecao before insert on public.mural_links for each row execute function public.mural_protecao();

revoke all on function public.midias_protecao() from public, anon, authenticated;
revoke all on function public.perfil_links_protecao() from public, anon, authenticated;
revoke all on function public.mural_protecao() from public, anon, authenticated;

do $$
begin
  begin alter publication supabase_realtime add table public.midias;      exception when duplicate_object then null; end;
  begin alter publication supabase_realtime add table public.mural_links; exception when duplicate_object then null; end;
  begin alter publication supabase_realtime add table public.perfil_links; exception when duplicate_object then null; end;
end $$;

-- 18) celular e rede nanica: o item "Celular" (3.000 moedas, a meta grande) abre a rede social do grupo ----------------
-- Só quem tem o celular na mochila lê, posta, curte e comenta, e quem garante é o RLS (tem_item), não o ícone escondido.
-- Imagem da postagem vai para o bucket "midias", na pasta rede/<uid>/. Postar e curtir não dão moedas.
alter table public.loja_itens drop constraint if exists loja_itens_espaco_check;
alter table public.loja_itens add constraint loja_itens_espaco_check
  check (espaco in ('cadeira', 'mesa', 'tapete', 'poster', 'planta', 'parede', 'luz', 'titulo', 'moldura', 'escudo', 'consumivel', 'celular', 'cabeca', 'quarto', 'movel', 'efeito', 'chave'));
insert into public.loja_itens (id, nome, descricao, espaco, preco, dados, ordem) values
  ('celular', 'Celular', 'Abre a rede social nanica: poste, curta e comente com o grupo.', 'celular', 3000, '{}', 0)
on conflict (id) do update set nome = excluded.nome, descricao = excluded.descricao, espaco = excluded.espaco,
  preco = excluded.preco, dados = excluded.dados, ordem = excluded.ordem;

-- quem está logado tem esse item na mochila?
create or replace function public.tem_item(p_item text) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.mochila where user_id = auth.uid() and item_id = p_item and qtd > 0);
$$;
revoke all on function public.tem_item(text) from public, anon;
grant execute on function public.tem_item(text) to authenticated;

create table if not exists public.rede_posts (
  id      bigint generated always as identity primary key,
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  texto   text not null check (char_length(texto) between 1 and 500),
  midia   text check (midia ~ '^rede/[0-9a-f-]{36}/[a-z0-9-]{6,40}\.(webp|gif)$'),
  em      timestamptz not null default now()
);
create index if not exists rede_posts_em on public.rede_posts (em desc);
create table if not exists public.rede_curtidas (
  post_id bigint not null references public.rede_posts(id) on delete cascade,
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  em      timestamptz not null default now(),
  primary key (post_id, user_id)
);
create table if not exists public.rede_comentarios (
  id      bigint generated always as identity primary key,
  post_id bigint not null references public.rede_posts(id) on delete cascade,
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  texto   text not null check (char_length(texto) between 1 and 280),
  em      timestamptz not null default now()
);
create index if not exists rede_comentarios_post on public.rede_comentarios (post_id, em);

alter table public.rede_posts       enable row level security;
alter table public.rede_curtidas    enable row level security;
alter table public.rede_comentarios enable row level security;
revoke all on public.rede_posts, public.rede_curtidas, public.rede_comentarios from public, anon, authenticated;
grant select, delete on public.rede_posts, public.rede_curtidas, public.rede_comentarios to authenticated;
grant insert (texto, midia) on public.rede_posts to authenticated;
grant insert (post_id) on public.rede_curtidas to authenticated;
grant insert (post_id, texto) on public.rede_comentarios to authenticated;

drop policy if exists rede_posts_ler on public.rede_posts;
create policy rede_posts_ler on public.rede_posts for select to authenticated using (public.eh_nanico() and public.tem_item('celular'));
drop policy if exists rede_posts_criar on public.rede_posts;
create policy rede_posts_criar on public.rede_posts for insert to authenticated with check (user_id = auth.uid() and public.tem_item('celular'));
drop policy if exists rede_posts_apagar on public.rede_posts;
create policy rede_posts_apagar on public.rede_posts for delete to authenticated using (user_id = auth.uid());

drop policy if exists rede_curtidas_ler on public.rede_curtidas;
create policy rede_curtidas_ler on public.rede_curtidas for select to authenticated using (public.eh_nanico() and public.tem_item('celular'));
drop policy if exists rede_curtidas_criar on public.rede_curtidas;
create policy rede_curtidas_criar on public.rede_curtidas for insert to authenticated with check (user_id = auth.uid() and public.tem_item('celular'));
drop policy if exists rede_curtidas_apagar on public.rede_curtidas;
create policy rede_curtidas_apagar on public.rede_curtidas for delete to authenticated using (user_id = auth.uid());

drop policy if exists rede_comentarios_ler on public.rede_comentarios;
create policy rede_comentarios_ler on public.rede_comentarios for select to authenticated using (public.eh_nanico() and public.tem_item('celular'));
drop policy if exists rede_comentarios_criar on public.rede_comentarios;
create policy rede_comentarios_criar on public.rede_comentarios for insert to authenticated with check (user_id = auth.uid() and public.tem_item('celular'));
drop policy if exists rede_comentarios_apagar on public.rede_comentarios;
create policy rede_comentarios_apagar on public.rede_comentarios for delete to authenticated using (user_id = auth.uid());

-- autor sempre quem está logado, texto limpo (mantém as quebras de linha), limites por hora e imagem na própria pasta
create or replace function public.rede_protecao() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  new.user_id := auth.uid();
  new.em := now();
  if tg_table_name = 'rede_curtidas' then
    perform public.limitar('rede_curtida', 120, interval '1 hour', 'Calma: curtidas demais em pouco tempo.');
    return new;
  end if;
  new.texto := btrim(regexp_replace(coalesce(new.texto, ''), '[\x00-\x09\x0B-\x1F\x7F]', ' ', 'g'));
  if char_length(new.texto) = 0 then raise exception 'Escreva alguma coisa.' using errcode = 'P0001'; end if;
  if tg_table_name = 'rede_posts' then
    if new.midia is not null then
      if split_part(new.midia, '/', 2) <> new.user_id::text then
        raise exception 'A imagem tem que estar na sua pasta.' using errcode = 'P0001';
      end if;
      if not exists (select 1 from storage.objects where bucket_id = 'midias' and name = new.midia) then
        raise exception 'A imagem não chegou. Tente de novo.' using errcode = 'P0001';
      end if;
    end if;
    perform public.limitar('rede_post', 10, interval '1 hour', 'Calma: no máximo 10 postagens por hora.');
  else
    perform public.limitar('rede_comentario', 40, interval '1 hour', 'Calma: no máximo 40 comentários por hora.');
  end if;
  return new;
end $$;
revoke all on function public.rede_protecao() from public, anon, authenticated;
drop trigger if exists rede_protecao on public.rede_posts;
create trigger rede_protecao before insert on public.rede_posts for each row execute function public.rede_protecao();
drop trigger if exists rede_protecao on public.rede_curtidas;
create trigger rede_protecao before insert on public.rede_curtidas for each row execute function public.rede_protecao();
drop trigger if exists rede_protecao on public.rede_comentarios;
create trigger rede_protecao before insert on public.rede_comentarios for each row execute function public.rede_protecao();

-- a pasta rede/<uid>/ do bucket midias: sobe e apaga só quem tem o celular, na própria pasta (refaz as políticas da seção 16)
drop policy if exists midias_subir on storage.objects;
create policy midias_subir on storage.objects for insert to authenticated
  with check (bucket_id = 'midias' and public.eh_nanico() and (
    (storage.foldername(name))[1] = auth.uid()::text
    or ((storage.foldername(name))[1] = 'rede' and (storage.foldername(name))[2] = auth.uid()::text and public.tem_item('celular'))));
drop policy if exists midias_apagar on storage.objects;
create policy midias_apagar on storage.objects for delete to authenticated
  using (bucket_id = 'midias' and (
    (storage.foldername(name))[1] = auth.uid()::text
    or ((storage.foldername(name))[1] = 'rede' and (storage.foldername(name))[2] = auth.uid()::text)));

do $$
begin
  begin alter publication supabase_realtime add table public.rede_posts;       exception when duplicate_object then null; end;
  begin alter publication supabase_realtime add table public.rede_curtidas;    exception when duplicate_object then null; end;
  begin alter publication supabase_realtime add table public.rede_comentarios; exception when duplicate_object then null; end;
end $$;

-- 14) apostas na partida ao vivo: nanico contra nanico, no time azul (100) ou vermelho (200) -----------------------
-- A função riot-ao-vivo abre o mercado quando vê a partida (fecha 5 min depois do início) e, quando a partida some,
-- pergunta à Riot quem venceu e chama apostas_liquidar. O bolo dos dois lados vai para quem acertou, proporcional à
-- aposta (pari-mútuo), e a casa leva 5%. Remake, partida sem resultado ou ninguém do outro lado devolve tudo.
-- Quem está jogando só aposta no próprio time. Ninguém escreve direto nas tabelas: só apostar_partida().
create table if not exists public.apostas_mercados (
  game_id    bigint primary key check (game_id > 0),
  plataforma text not null default '' check (plataforma ~ '^[A-Za-z0-9]{0,8}$'),
  -- nanicos na partida (friend id → time), para quem joga só apostar no próprio lado
  nanicos    jsonb not null default '{}'::jsonb,
  aberto_em  timestamptz not null default now(),
  fecha_em   timestamptz not null,
  estado     text not null default 'aberto' check (estado in ('aberto', 'fechado', 'pago', 'devolvido')),
  vencedor   int check (vencedor in (100, 200)),
  fim        text check (fim in ('remake', 'sem_contra', 'sem_resultado')),
  bolo_100   int not null default 0 check (bolo_100 >= 0),
  bolo_200   int not null default 0 check (bolo_200 >= 0),
  casa       int not null default 0 check (casa >= 0),
  liquidado_em timestamptz
);
create table if not exists public.apostas (
  id      bigint generated always as identity primary key,
  game_id bigint not null references public.apostas_mercados(game_id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  lado    int not null check (lado in (100, 200)),
  valor   int not null check (valor between 5 and 100),
  pago    int check (pago >= 0),
  em      timestamptz not null default now(),
  unique (game_id, user_id)
);
create index if not exists apostas_user on public.apostas (user_id, em desc);
alter table public.apostas_mercados enable row level security;
alter table public.apostas          enable row level security;
revoke all on public.apostas_mercados, public.apostas from public, anon, authenticated;
grant select on public.apostas_mercados, public.apostas to authenticated;
drop policy if exists apostas_mercados_ler on public.apostas_mercados;
create policy apostas_mercados_ler on public.apostas_mercados for select to authenticated using (public.eh_nanico());
drop policy if exists apostas_minhas on public.apostas;
create policy apostas_minhas on public.apostas for select to authenticated using (user_id = auth.uid());

-- abre o mercado da partida (ou atualiza quem está nela e o início). Só a função riot-ao-vivo chama.
create or replace function public.apostas_abrir(p_game bigint, p_plataforma text, p_inicio_ms bigint, p_nanicos jsonb)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_nan jsonb := '{}'::jsonb;
  k text;
begin
  if p_game is null or p_game <= 0 then return; end if;
  -- só friend ids conhecidos e times 100/200
  for k in select jsonb_object_keys(case when jsonb_typeof(p_nanicos) = 'object' then p_nanicos else '{}'::jsonb end) loop
    if exists (select 1 from public.friends where id::text = k) and (p_nanicos->>k) in ('100', '200') then
      v_nan := v_nan || jsonb_build_object(k, (p_nanicos->>k)::int);
    end if;
  end loop;
  insert into public.apostas_mercados (game_id, plataforma, nanicos, fecha_em)
  values (p_game, left(coalesce(p_plataforma, ''), 8), v_nan,
          case when p_inicio_ms > 0 then to_timestamp(p_inicio_ms / 1000.0) else now() end + interval '5 minutes')
  on conflict (game_id) do update
     set nanicos  = apostas_mercados.nanicos || excluded.nanicos,
         -- na tela de carregamento a Riot ainda não dá o início: acerta o prazo quando ele aparece
         fecha_em = case when p_inicio_ms > 0 then to_timestamp(p_inicio_ms / 1000.0) + interval '5 minutes' else apostas_mercados.fecha_em end
   where apostas_mercados.estado = 'aberto';
end $$;

-- apostar num lado da partida: 5 a 100 moedas, uma aposta por partida, só até 5 min depois do início
create or replace function public.apostar_partida(p_game bigint, p_lado int, p_valor int)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_uid  uuid := auth.uid();
  v_fid  uuid;
  m      public.apostas_mercados%rowtype;
  v_meu  int;
  v_saldo int;
begin
  if not public.eh_nanico() then raise exception 'Só nanicos apostam.' using errcode = 'P0001'; end if;
  if p_lado not in (100, 200) then raise exception 'Escolha o time azul ou o vermelho.' using errcode = 'P0001'; end if;
  if p_valor is null or p_valor < 5 or p_valor > 100 then raise exception 'Aposte de 5 a 100 moedas.' using errcode = 'P0001'; end if;
  select * into m from public.apostas_mercados where game_id = p_game for update;
  if not found then raise exception 'Essa partida não tem apostas.' using errcode = 'P0001'; end if;
  if m.estado <> 'aberto' or now() >= m.fecha_em then
    raise exception 'As apostas desta partida já fecharam.' using errcode = 'P0001';
  end if;
  if exists (select 1 from public.apostas where game_id = p_game and user_id = v_uid) then
    raise exception 'Você já apostou nesta partida.' using errcode = 'P0001';
  end if;
  -- quem está jogando só aposta no próprio time (pelo mercado ou pelo que a Riot mostrou agora)
  select id into v_fid from public.friends where user_id = v_uid limit 1;
  v_meu := (m.nanicos->>v_fid::text)::int;
  if v_meu is null then
    select (p->>'time')::int into v_meu from public.riot_ao_vivo r, jsonb_array_elements(r.jogo->'participantes') p
     where r.game_id = p_game and p->>'fid' = v_fid::text limit 1;
  end if;
  if v_meu is not null and v_meu <> p_lado then
    raise exception 'Você está nessa partida: só pode apostar no seu time.' using errcode = 'P0001';
  end if;
  v_saldo := public.creditar(v_uid, -p_valor, 'aposta', p_game::text);
  insert into public.apostas (game_id, user_id, lado, valor) values (p_game, v_uid, p_lado, p_valor);
  update public.apostas_mercados
     set bolo_100 = bolo_100 + case when p_lado = 100 then p_valor else 0 end,
         bolo_200 = bolo_200 + case when p_lado = 200 then p_valor else 0 end
   where game_id = p_game returning * into m;
  return jsonb_build_object('saldo', v_saldo, 'bolo_100', m.bolo_100, 'bolo_200', m.bolo_200);
end $$;

-- paga a partida (interna: só a função riot-ao-vivo). Remake, sem resultado ou um lado vazio devolve tudo.
-- Cada acertador recebe floor((total − casa) × aposta / bolo do vencedor); o que sobra do arredondamento fica na casa.
-- Rodar de novo não paga de novo: o mercado já está 'pago' ou 'devolvido'.
create or replace function public.apostas_liquidar(p_game bigint, p_vencedor int, p_remake boolean, p_fim text default null)
returns text language plpgsql security definer set search_path = public as $$
declare
  m       public.apostas_mercados%rowtype;
  a       record;
  v_total int;
  v_casa  int;
  v_bolo  int;
  v_pago  int;
  v_soma  int := 0;
begin
  select * into m from public.apostas_mercados where game_id = p_game for update;
  if not found then return 'sem_mercado'; end if;
  if m.estado in ('pago', 'devolvido') then return m.estado; end if;
  v_total := m.bolo_100 + m.bolo_200;
  if coalesce(p_remake, false) or p_vencedor is null or p_vencedor not in (100, 200) or m.bolo_100 = 0 or m.bolo_200 = 0 then
    for a in select id, user_id, valor from public.apostas where game_id = p_game order by id loop
      perform public.creditar(a.user_id, a.valor, 'aposta', p_game || ':devolvida');
      update public.apostas set pago = a.valor where id = a.id;
    end loop;
    update public.apostas_mercados
       set estado = 'devolvido', liquidado_em = now(), vencedor = case when p_vencedor in (100, 200) and not coalesce(p_remake, false) then p_vencedor end,
           fim = case when coalesce(p_remake, false) then coalesce(p_fim, 'remake')
                      when p_vencedor is null or p_vencedor not in (100, 200) then 'sem_resultado'
                      else 'sem_contra' end
     where game_id = p_game;
    return 'devolvido';
  end if;
  v_casa := floor(v_total * 0.05);
  v_bolo := case when p_vencedor = 100 then m.bolo_100 else m.bolo_200 end;
  for a in select id, user_id, lado, valor from public.apostas where game_id = p_game order by id loop
    if a.lado = p_vencedor then
      v_pago := floor((v_total - v_casa)::numeric * a.valor / v_bolo);
      if v_pago > 0 then perform public.creditar(a.user_id, v_pago, 'aposta', p_game || ':premio'); end if;
    else
      v_pago := 0;
    end if;
    v_soma := v_soma + v_pago;
    update public.apostas set pago = v_pago where id = a.id;
  end loop;
  update public.apostas_mercados set estado = 'pago', vencedor = p_vencedor, casa = v_total - v_soma, liquidado_em = now()
   where game_id = p_game;
  return 'pago';
end $$;

revoke all on function public.apostas_abrir(bigint, text, bigint, jsonb) from public, anon, authenticated;
revoke all on function public.apostas_liquidar(bigint, int, boolean, text) from public, anon, authenticated;
revoke all on function public.apostar_partida(bigint, int, int) from public, anon;
grant execute on function public.apostar_partida(bigint, int, int) to authenticated;
do $$ begin
  if exists (select 1 from pg_roles where rolname = 'service_role') then
    grant all on public.apostas_mercados, public.apostas to service_role;
    grant execute on function public.apostas_abrir(bigint, text, bigint, jsonb) to service_role;
    grant execute on function public.apostas_liquidar(bigint, int, boolean, text) to service_role;
  end if;
end $$;

-- a missão "Aposte numa partida ao vivo" passa a valer
update public.missoes_def set fase_ok = true where id = 'aposta' and not fase_ok;

do $$
begin
  begin alter publication supabase_realtime add table public.apostas_mercados; exception when duplicate_object then null; end;
  begin alter publication supabase_realtime add table public.apostas;          exception when duplicate_object then null; end;
end $$;

-- 27) op.gg de smurf: um segundo link no perfil (a partida ao vivo procura nas duas contas) --------------------------
alter table public.friends add column if not exists opgg_smurf text;
alter table public.friends drop constraint if exists friends_opgg_smurf_valido;
alter table public.friends add constraint friends_opgg_smurf_valido check (
  opgg_smurf is null or (char_length(opgg_smurf) <= 300 and opgg_smurf ~* '^https://([a-z0-9-]+\.)?op\.gg(/[^\s<>"'']*)?$'));
grant update (opgg_smurf) on public.friends to authenticated;

-- a mesma proteção do perfil (4b e 8), agora deixando passar o op.gg, o op.gg de smurf e a Steam
create or replace function public.perfil_protecao() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then return new; end if;   -- admin pelo SQL Editor
  -- pelo site só mudam os op.gg e a Steam; o resto continua como estava
  new.id := old.id; new.name := old.name; new.photo := old.photo; new.user_id := old.user_id;
  new.username := old.username; new.created_at := old.created_at;
  new.opgg := nullif(btrim(new.opgg), '');
  new.opgg_smurf := nullif(btrim(new.opgg_smurf), '');
  new.steam := nullif(btrim(new.steam), '');
  perform public.limitar('perfil', 10, interval '10 minutes', 'Calma: muitas mudanças no perfil. Espere uns minutos.');
  return new;
end $$;
revoke all on function public.perfil_protecao() from public, anon, authenticated;

-- a conta Riot do smurf fica na mesma linha da principal (só a função riot-ao-vivo usa)
alter table public.riot_contas add column if not exists riot_id_smurf text;
alter table public.riot_contas add column if not exists puuid_smurf text;
alter table public.riot_contas add column if not exists atualizado_smurf timestamptz;

-- 27) respeitos e emblemas: 3 respeitos por dia para dar, e emblemas conquistados, calculados pelo banco -----------------
-- Respeito: cada nanico dá até 3 por dia (Brasília), no máximo 1 para a mesma pessoa no dia, nunca para si mesmo.
-- É público (todo mundo vê quem deu para quem) e chega pelo tempo real. Não dá moedas.
create table if not exists public.respeitos (
  id   bigint generated always as identity primary key,
  de   uuid not null references public.friends(id) on delete cascade,
  para uuid not null references public.friends(id) on delete cascade,
  dia  date not null,
  em   timestamptz not null default now(),
  unique (de, para, dia),
  check (de <> para)
);
create index if not exists respeitos_para on public.respeitos (para);
create index if not exists respeitos_de_dia on public.respeitos (de, dia);
alter table public.respeitos enable row level security;
revoke all on public.respeitos from public, anon, authenticated;
grant select on public.respeitos to authenticated;
drop policy if exists respeitos_ler on public.respeitos;
create policy respeitos_ler on public.respeitos for select to authenticated using (public.eh_nanico());

create or replace function public.dar_respeito(p_para uuid) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_fid  uuid;
  v_hoje date := public.hoje_br();
  v_nome text;
  v_n    int;
begin
  select id into v_fid from public.friends where user_id = auth.uid() limit 1;
  if v_fid is null then raise exception 'Só nanicos dão respeito.' using errcode = 'P0001'; end if;
  select name into v_nome from public.friends where id = p_para;
  if v_nome is null then raise exception 'Nanico não encontrado.' using errcode = 'P0001'; end if;
  if p_para = v_fid then raise exception 'Respeito é para os outros.' using errcode = 'P0001'; end if;
  perform pg_advisory_xact_lock(hashtext('respeito:' || v_fid::text));
  select count(*) into v_n from public.respeitos where de = v_fid and dia = v_hoje;
  if v_n >= 3 then raise exception 'Você já deu os 3 respeitos de hoje. Amanhã tem mais.' using errcode = 'P0001'; end if;
  insert into public.respeitos (de, para, dia) values (v_fid, p_para, v_hoje) on conflict (de, para, dia) do nothing;
  if not found then raise exception 'Você já deu respeito para o % hoje.', v_nome using errcode = 'P0001'; end if;
  return jsonb_build_object('restantes', 2 - v_n, 'recebidos', (select count(*) from public.respeitos where para = p_para));
end $$;
revoke all on function public.dar_respeito(uuid) from public, anon;
grant execute on function public.dar_respeito(uuid) to authenticated;

-- quantos respeitos ainda posso dar hoje
create or replace function public.meus_respeitos() returns int
language sql stable security definer set search_path = public as $$
  select greatest(0, 3 - count(*))::int from public.respeitos r join public.friends f on f.id = r.de
   where f.user_id = auth.uid() and r.dia = public.hoje_br();
$$;
revoke all on function public.meus_respeitos() from public, anon;
grant execute on function public.meus_respeitos() to authenticated;

-- tempo de tela compartilhada e de chapéu/coroa na cabeça, contados pelo pulso (um minuto por vez, como o tempo online)
alter table public.online_diario add column if not exists tela_min int not null default 0;
alter table public.online_diario add column if not exists chapeu_min int not null default 0;

-- o pulso agora recebe se a pessoa está transmitindo a tela (só conta minuto para o emblema; não dá moedas)
-- e confere no banco se ela está com chapéu ou coroa (mais rico agora, ou 1º do Feeder/Carregou o piano da última semana)
drop function if exists public.pulso();
create or replace function public.pulso(p_tela boolean default false) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_uid   uuid := auth.uid();
  v_hoje  date := public.hoje_br();
  v_happy boolean := extract(hour from public.agora_br()) >= 22;   -- todo dia, sábado também (o churrasco termina às 23h)
  v_min   int;
  v_hmin  int;
  v_hgan  int;
  v_ult   timestamptz;
  v_norm  int;
  v_fid   uuid;
  v_chapeu boolean;
begin
  if not public.eh_nanico() then raise exception 'Só nanicos ganham moedas.' using errcode = 'P0001'; end if;
  perform public.limitar('pulso', 6, interval '1 minute', 'Calma: muitos pulsos seguidos.');
  insert into public.online_diario (user_id, dia) values (v_uid, v_hoje) on conflict (user_id, dia) do nothing;
  select minutos, happy_min, happy_ganho, ultimo_pulso into v_min, v_hmin, v_hgan, v_ult from public.online_diario
   where user_id = v_uid and dia = v_hoje for update;
  if v_ult is null or now() - v_ult > interval '150 seconds' then
    update public.online_diario set ultimo_pulso = now() where user_id = v_uid and dia = v_hoje;
  elsif now() - v_ult >= interval '55 seconds' then
    v_min := v_min + 1;
    if v_happy then v_hmin := v_hmin + 1; end if;
    v_norm := v_min - v_hmin;   -- minutos fora do happy hour
    -- sem teto por dia (decisão do João, 02/11/2026): +1 a cada 6 minutos, e a cada 3 no happy hour
    if v_happy then
      if v_hmin % 3 = 0 then
        v_hgan := v_hgan + 1;
        perform public.creditar(v_uid, 1, 'online', v_hoje::text);
      end if;
    elsif v_norm % 6 = 0 then
      perform public.creditar(v_uid, 1, 'online', v_hoje::text);
    end if;
    select id into v_fid from public.friends where user_id = v_uid limit 1;
    v_chapeu := (select user_id from public.carteiras order by saldo desc limit 1) = v_uid
      or exists (select 1 from public.trofeus_semana t
                  where t.semana = (select max(semana) from public.trofeus_semana)
                    and t.trofeu in ('feeder', 'piano') and t.posicao = 1 and t.friend_id = v_fid);
    update public.online_diario
       set minutos = v_min, happy_min = v_hmin, happy_ganho = v_hgan, ultimo_pulso = now(),
           tela_min = tela_min + case when coalesce(p_tela, false) then 1 else 0 end,
           chapeu_min = chapeu_min + case when v_chapeu then 1 else 0 end
     where user_id = v_uid and dia = v_hoje;
  end if;
  return public.minha_carteira();
end $$;
revoke all on function public.pulso(boolean) from public, anon;
grant execute on function public.pulso(boolean) to authenticated;

-- emblemas de um nanico: [{id, nivel 1–3, valor}] só dos que já conquistou. Tudo contado aqui, nada vem do site.
-- Cada emblema tem 3 níveis (bronze, prata e ouro); os números ficam espelhados em src/features/emblemas/emblemas.ts.
create or replace function public.emblemas_de(p_para uuid) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  v_uid  uuid;
  v_out  jsonb := '[]'::jsonb;
  r      record;
  v_tier text;
begin
  if not public.eh_nanico() then raise exception 'Só nanicos veem os emblemas.' using errcode = 'P0001'; end if;
  select user_id into v_uid from public.friends where id = p_para;
  select upper(coalesce(dados->>'tier', '')) into v_tier from public.jogos_stats where friend_id = p_para and fonte = 'lol';
  for r in
    select * from (values
      ('online',    (select coalesce(sum(minutos), 0) / 60 from public.online_diario where user_id = v_uid), 10, 50, 200),
      ('sequencia', (select coalesce(max(seq), 0) from public.bonus_diario where user_id = v_uid), 7, 30, 100),
      ('tela',      (select coalesce(sum(tela_min), 0) / 60 from public.online_diario where user_id = v_uid), 1, 10, 50),
      ('coroa',     (select coalesce(sum(chapeu_min), 0) / 60 from public.online_diario where user_id = v_uid), 1, 24, 100),
      ('respeito',  (select count(*)::int from public.respeitos where para = p_para), 10, 50, 200),
      ('elo',       case when v_tier in ('GOLD') then 1 when v_tier in ('PLATINUM', 'EMERALD') then 2
                         when v_tier in ('DIAMOND', 'MASTER', 'GRANDMASTER', 'CHALLENGER') then 3 else 0 end, 1, 2, 3),
      ('cs',        (select coalesce((dados->>'cs2_horas')::int, 0) from public.jogos_stats where friend_id = p_para and fonte = 'steam'), 100, 500, 1000),
      ('trofeu',    (select count(*)::int from public.trofeus_semana where friend_id = p_para and posicao = 1 and trofeu <> 'feeder'), 1, 5, 20),
      ('truco',     (select count(*)::int from public.extrato where user_id = v_uid and motivo = 'truco' and valor > 0), 5, 25, 100),
      ('bingo',     (select count(*)::int from public.bingo_premios where user_id = v_uid and linhas > 0), 1, 10, 50),
      ('cassino',   (select count(*)::int from public.cassino_apostas where user_id = v_uid), 50, 500, 2000),
      ('cronista',  (select count(*)::int from public.phrases where created_by = v_uid), 5, 25, 100)
    ) as e(id, valor, n1, n2, n3)
  loop
    if coalesce(r.valor, 0) >= r.n1 then
      v_out := v_out || jsonb_build_object('id', r.id, 'valor', r.valor,
                                           'nivel', case when r.valor >= r.n3 then 3 when r.valor >= r.n2 then 2 else 1 end);
    end if;
  end loop;
  return v_out;
end $$;
revoke all on function public.emblemas_de(uuid) from public, anon;
grant execute on function public.emblemas_de(uuid) to authenticated;

do $$
begin
  begin alter publication supabase_realtime add table public.respeitos; exception when duplicate_object then null; end;
end $$;

-- 28) roleta de mesa: várias fichas na mesma rodada (número, cor, par/ímpar, metade, dúzia e coluna) ------------------
-- Um sorteio só (cassino_numero, o mesmo motor justo), todas as fichas pagas de uma vez. Cada ficha de 5 a 100, até 30
-- fichas e 1.000 moedas por rodada. Dúzia e coluna pagam 2 para 1 (3× com a aposta); número 36×; o resto 2×.
-- Fica guardada como uma aposta 'roleta' com escolha {fichas: [...]}, então a conferência continua igual (resultado.casa).
alter table public.cassino_apostas drop constraint if exists cassino_apostas_aposta_check;
alter table public.cassino_apostas add constraint cassino_apostas_aposta_check check (aposta >= 5); -- sem teto desde a seção 64 (apostas até o saldo): rodar o arquivo de novo não pode recusar as apostas grandes que já existem

create or replace function public.apostar_roleta_mesa(p_fichas jsonb) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_uid   uuid := auth.uid();
  v_verm  int[] := array[1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36];
  f       jsonb;
  v_tipo  text;
  v_valor int;
  v_ap    int;
  v_total int := 0;
  r       record;
  v_casa  int;
  v_cor   text;
  v_ganha boolean;
  v_pg    int;
  v_paga  int := 0;
  v_saldo int;
  v_lista jsonb := '[]'::jsonb;
  v_escolha jsonb := '[]'::jsonb;
begin
  if not public.eh_nanico() then raise exception 'Só nanicos jogam.' using errcode = 'P0001'; end if;
  if p_fichas is null or jsonb_typeof(p_fichas) <> 'array' or jsonb_array_length(p_fichas) = 0 then
    raise exception 'Ponha pelo menos uma ficha na mesa.' using errcode = 'P0001';
  end if;
  if jsonb_array_length(p_fichas) > 30 then raise exception 'No máximo 30 fichas por rodada.' using errcode = 'P0001'; end if;
  -- confere cada ficha antes de cobrar
  for f in select * from jsonb_array_elements(p_fichas) loop
    v_tipo := f->>'tipo';
    if jsonb_typeof(f->'valor') <> 'number' or jsonb_typeof(f->'aposta') <> 'number' then
      raise exception 'Aposta inválida.' using errcode = 'P0001';
    end if;
    v_valor := (f->>'valor')::int;
    v_ap := (f->>'aposta')::int;
    if v_ap not between 5 and 100 then raise exception 'Cada ficha vai de 5 a 100 moedas.' using errcode = 'P0001'; end if;
    if v_tipo is null or v_tipo not in ('numero', 'cor', 'paridade', 'metade', 'duzia', 'coluna')
       or (v_tipo = 'numero' and v_valor not between 0 and 36)
       or (v_tipo in ('cor', 'paridade', 'metade') and v_valor not in (0, 1))
       or (v_tipo in ('duzia', 'coluna') and v_valor not in (0, 1, 2)) then
      raise exception 'Aposta inválida.' using errcode = 'P0001';
    end if;
    v_total := v_total + v_ap;
  end loop;
  if v_total > 1000 then raise exception 'No máximo 1.000 moedas por rodada.' using errcode = 'P0001'; end if;
  perform public.limitar('cassino', 30, interval '1 minute', 'Calma: muitas apostas seguidas. Espere um pouco.');
  perform public.creditar(v_uid, -v_total, 'cassino', 'roleta');
  select * into r from public.cassino_numero(v_uid);
  v_casa := floor(r.u * 37)::int;
  v_cor := case when v_casa = 0 then 'verde' when v_casa = any (v_verm) then 'vermelho' else 'preto' end;
  for f in select * from jsonb_array_elements(p_fichas) loop
    v_tipo := f->>'tipo';
    v_valor := (f->>'valor')::int;
    v_ap := (f->>'aposta')::int;
    v_ganha := case v_tipo
      when 'numero'   then v_casa = v_valor
      when 'cor'      then v_casa <> 0 and (v_cor = 'vermelho') = (v_valor = 0)
      when 'paridade' then v_casa <> 0 and v_casa % 2 = v_valor
      when 'metade'   then v_casa <> 0 and (v_casa <= 18) = (v_valor = 0)
      when 'duzia'    then v_casa <> 0 and (v_casa - 1) / 12 = v_valor
      when 'coluna'   then v_casa <> 0 and (v_casa - 1) % 3 = v_valor
    end;
    v_pg := case when not v_ganha then 0 when v_tipo = 'numero' then v_ap * 36 when v_tipo in ('duzia', 'coluna') then v_ap * 3 else v_ap * 2 end;
    v_paga := v_paga + v_pg;
    v_lista := v_lista || jsonb_build_object('tipo', v_tipo, 'valor', v_valor, 'aposta', v_ap, 'pagou', v_pg);
    v_escolha := v_escolha || jsonb_build_object('tipo', v_tipo, 'valor', v_valor, 'aposta', v_ap);
  end loop;
  if v_paga > 0 then v_saldo := public.creditar(v_uid, v_paga, 'cassino', 'roleta');
  else select saldo into v_saldo from public.carteiras where user_id = v_uid; end if;
  insert into public.cassino_apostas (user_id, jogo, aposta, escolha, resultado, pagou, hash, nonce)
    values (v_uid, 'roleta', v_total, jsonb_build_object('fichas', v_escolha),
            jsonb_build_object('casa', v_casa, 'cor', v_cor), v_paga, r.hash, r.nonce);
  return jsonb_build_object('casa', v_casa, 'cor', v_cor, 'pagou', v_paga, 'saldo', v_saldo, 'fichas', v_lista,
                            'hash', r.hash, 'nonce', r.nonce);
end $$;
revoke all on function public.apostar_roleta_mesa(jsonb) from public, anon;
grant execute on function public.apostar_roleta_mesa(jsonb) to authenticated;

-- 29) aviãozinho (crash): o multiplicador sobe até o avião ir embora; saque antes e ganhe aposta × multiplicador ---------
-- O ponto em que o avião vai embora é o do limbo: max(1, floor(0,97 / (1 − u) × 100) / 100), com u do cassino_numero
-- (mesmo motor justo, casa leva 3%). Ele fica SÓ no banco até o voo acabar (ninguém lê aviao_voos direto), e o saque é
-- conferido pelo relógio do banco: multiplicador = floor(e^(0,07 × segundos) × 100) / 100 desde a decolagem.
-- Saque automático em X×: vale se X ≤ ponto de queda (igual ao limbo). Cada um voa sozinho; a mesa só mostra os voos.
alter table public.cassino_apostas drop constraint if exists cassino_apostas_jogo_check;
alter table public.cassino_apostas add constraint cassino_apostas_jogo_check check (jogo in ('roleta', 'limbo', 'dado', 'slot', 'aviao', 'penalti', 'blackjack')); -- a lista completa: rodar o arquivo de novo não pode recusar apostas que já existem

create table if not exists public.aviao_voos (
  id      bigint generated always as identity primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  aposta  int not null check (aposta between 5 and 100),
  auto    numeric check (auto is null or auto between 1.01 and 1000),
  crash   numeric not null,
  hash    text not null,
  nonce   int not null,
  inicio  timestamptz not null default clock_timestamp(),
  estado  text not null default 'voando' check (estado in ('voando', 'sacou', 'caiu')),
  sacou   numeric,
  pagou   int not null default 0,
  fim     timestamptz
);
create index if not exists aviao_voos_meus on public.aviao_voos (user_id, estado);
create index if not exists aviao_voos_inicio on public.aviao_voos (inicio desc);
alter table public.aviao_voos enable row level security;
revoke all on public.aviao_voos from public, anon, authenticated;

-- o multiplicador do voo num instante (o mesmo do site, em aviao.ts)
create or replace function public.aviao_mult(p_inicio timestamptz, p_agora timestamptz) returns numeric
language sql immutable as $$
  select floor(exp(0.07 * least(600, greatest(0, extract(epoch from (p_agora - p_inicio))))) * 100) / 100;
$$;

-- decide o voo agora: saque automático, saque na mão (p_manual) ou queda; senão, continua voando. Paga e guarda.
create or replace function public.aviao_fechar(p_id bigint, p_manual boolean) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v      public.aviao_voos;
  v_m    numeric;
  v_sac  numeric;
  v_pg   int := 0;
  v_est  text;
  v_sal  int;
begin
  select * into v from public.aviao_voos where id = p_id for update;
  if v.estado <> 'voando' then
    select saldo into v_sal from public.carteiras where user_id = v.user_id;
    return jsonb_build_object('id', v.id, 'estado', v.estado, 'mult', coalesce(v.sacou, v.crash), 'sacou', v.sacou,
                              'crash', v.crash, 'pagou', v.pagou, 'saldo', v_sal);
  end if;
  v_m := public.aviao_mult(v.inicio, clock_timestamp());
  if v.auto is not null and v.auto <= v.crash and v.auto <= v_m then
    v_sac := v.auto;
  elsif p_manual and v_m < v.crash then
    v_sac := greatest(1, v_m);
  elsif v_m >= v.crash then
    v_sac := null;
  else
    return jsonb_build_object('id', v.id, 'estado', 'voando', 'mult', v_m);
  end if;
  v_est := case when v_sac is null then 'caiu' else 'sacou' end;
  if v_sac is not null then v_pg := floor(v.aposta * v_sac)::int; end if;
  update public.aviao_voos set estado = v_est, sacou = v_sac, pagou = v_pg, fim = clock_timestamp() where id = v.id;
  if v_pg > 0 then v_sal := public.creditar(v.user_id, v_pg, 'cassino', 'aviao');
  else select saldo into v_sal from public.carteiras where user_id = v.user_id; end if;
  insert into public.cassino_apostas (user_id, jogo, aposta, escolha, resultado, pagou, hash, nonce)
    values (v.user_id, 'aviao', v.aposta, jsonb_build_object('auto', v.auto, 'sacou', v_sac),
            jsonb_build_object('valor', v.crash), v_pg, v.hash, v.nonce);
  return jsonb_build_object('id', v.id, 'estado', v_est, 'mult', coalesce(v_sac, v.crash), 'sacou', v_sac,
                            'crash', v.crash, 'pagou', v_pg, 'saldo', v_sal);
end $$;
revoke all on function public.aviao_fechar(bigint, boolean) from public, anon, authenticated;

-- decolar: cobra a aposta e sorteia o ponto de queda (que só sai daqui no fim do voo)
create or replace function public.aviao_decolar(p_aposta int, p_auto numeric default null) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_uid  uuid := auth.uid();
  r      record;
  v      record;
  v_id   bigint;
  v_sal  int;
  v_ini  timestamptz;
begin
  if not public.eh_nanico() then raise exception 'Só nanicos jogam.' using errcode = 'P0001'; end if;
  if p_aposta is null or p_aposta not between 5 and 100 then raise exception 'A aposta vai de 5 a 100 moedas.' using errcode = 'P0001'; end if;
  if p_auto is not null and (p_auto < 1.01 or p_auto > 1000 or round(p_auto, 2) <> p_auto) then
    raise exception 'O saque automático vai de 1,01× a 1.000×, com até 2 casas depois da vírgula.' using errcode = 'P0001';
  end if;
  -- voo antigo meu que ficou no ar (fechou a aba): fecha agora; se ainda estiver voando, espera
  for v in select id from public.aviao_voos where user_id = v_uid and estado = 'voando' loop
    if (public.aviao_fechar(v.id, false))->>'estado' = 'voando' then
      raise exception 'Seu avião ainda está no ar.' using errcode = 'P0001';
    end if;
  end loop;
  perform public.limitar('cassino', 30, interval '1 minute', 'Calma: muitas apostas seguidas. Espere um pouco.');
  v_sal := public.creditar(v_uid, -p_aposta, 'cassino', 'aviao');
  select * into r from public.cassino_numero(v_uid);
  insert into public.aviao_voos (user_id, aposta, auto, crash, hash, nonce)
    values (v_uid, p_aposta, p_auto, greatest(1, floor((0.97 / (1 - r.u)) * 100) / 100), r.hash, r.nonce)
    returning id, inicio into v_id, v_ini;
  return jsonb_build_object('id', v_id, 'saldo', v_sal, 'hash', r.hash, 'nonce', r.nonce, 'inicio', v_ini);
end $$;
revoke all on function public.aviao_decolar(int, numeric) from public, anon;
grant execute on function public.aviao_decolar(int, numeric) to authenticated;

-- como está o meu voo (o site pergunta algumas vezes por segundo); o ponto de queda só aparece quando acaba
create or replace function public.aviao_ver(p_id bigint) returns jsonb
language plpgsql security definer set search_path = public as $$
begin
  if not exists (select 1 from public.aviao_voos where id = p_id and user_id = auth.uid()) then
    raise exception 'Voo não encontrado.' using errcode = 'P0001';
  end if;
  perform public.limitar('aviao_ver', 900, interval '1 minute', 'Calma: perguntas demais.');
  return public.aviao_fechar(p_id, false);
end $$;
revoke all on function public.aviao_ver(bigint) from public, anon;
grant execute on function public.aviao_ver(bigint) to authenticated;

-- sacar agora: vale o multiplicador do relógio do banco, se o avião ainda não foi embora
create or replace function public.aviao_sacar(p_id bigint) returns jsonb
language plpgsql security definer set search_path = public as $$
begin
  if not exists (select 1 from public.aviao_voos where id = p_id and user_id = auth.uid()) then
    raise exception 'Voo não encontrado.' using errcode = 'P0001';
  end if;
  return public.aviao_fechar(p_id, true);
end $$;
revoke all on function public.aviao_sacar(bigint) from public, anon;
grant execute on function public.aviao_sacar(bigint) to authenticated;

-- "na mesa agora": os voos dos últimos 3 minutos de todo mundo (o ponto de queda só dos que já acabaram)
create or replace function public.aviao_mesa() returns jsonb
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.eh_nanico() then raise exception 'Só nanicos jogam.' using errcode = 'P0001'; end if;
  return coalesce((select jsonb_agg(x order by x.inicio desc) from (
    select v.id, f.name as nome, v.aposta, v.estado, v.sacou, v.pagou, v.inicio,
           case when v.estado <> 'voando' then v.crash end as crash,
           case when v.estado = 'voando' and v.auto is not null then v.auto end as alvo
      from public.aviao_voos v left join public.friends f on f.user_id = v.user_id
     where v.inicio > now() - interval '3 minutes'
     order by v.inicio desc limit 12) x), '[]'::jsonb);
end $$;
revoke all on function public.aviao_mesa() from public, anon;
grant execute on function public.aviao_mesa() to authenticated;

-- 30) CS pelo Leetify: a função ficha-jogos guarda o Premier e o nível da GC na fonte 'cs' de jogos_stats -----------
--   cs: {premier, gc, gc_em} (a GC é o nível da partida mais recente na Gamers Club)
alter table public.jogos_stats drop constraint if exists jogos_stats_fonte_check;
alter table public.jogos_stats add constraint jogos_stats_fonte_check check (fonte in ('lol', 'steam', 'cs'));

-- 32) mesas ao vivo: roleta e aviãozinho em rodadas para todo mundo junto, como num cassino online -----------------------
--   A mesa fica parada até alguém apostar. A primeira aposta abre a rodada com um tempo de apostas (roleta 15 s,
--   aviãozinho 8 s) e quem chegar nesse tempo entra na mesma rodada. Quando o tempo acaba, o banco sorteia
--   UMA vez para todos e cada um recebe pelo que apostou. Ninguém lê as tabelas direto: só pelas funções abaixo.
--   Justo: cada rodada nasce com um segredo aleatório; o sha256 dele (hash) aparece antes de apostar e o segredo é
--   revelado quando a rodada acaba. u = primeiros 52 bits de HMAC-SHA256(segredo, "jogo:id") (a mesma conta do motor).
--   Sem servidor rodando o relógio: quem chama mesa_estado (o site pergunta algumas vezes por segundo) ou aposta faz a
--   mesa andar (sortear e pagar), com uma trava por jogo. Os pagamentos saem com creditar() e viram cassino_apostas.
--   Os jogos antigos (apostar_roleta_mesa, aviao_decolar, apostar_dado) continuam no banco, fora da tela.
alter table public.cassino_apostas drop constraint if exists cassino_apostas_jogo_check;
alter table public.cassino_apostas add constraint cassino_apostas_jogo_check
  check (jogo in ('roleta', 'limbo', 'dado', 'slot', 'aviao', 'penalti', 'blackjack'));

create table if not exists public.mesa_rodadas (
  id        bigint generated always as identity primary key,
  jogo      text not null check (jogo in ('roleta', 'aviao')),
  abre_em   timestamptz not null default clock_timestamp(),
  fecha_em  timestamptz not null,
  segredo   bytea not null,
  hash      text not null,
  resultado jsonb,
  -- quando a rodada termina para a tela (roleta: fim do giro; aviãozinho: o avião vai embora; pênalti: fim do chute)
  fim_em    timestamptz,
  liquidada boolean not null default false
);
create index if not exists mesa_rodadas_jogo on public.mesa_rodadas (jogo, id desc);
create table if not exists public.mesa_apostas (
  id        bigint generated always as identity primary key,
  rodada_id bigint not null references public.mesa_rodadas(id) on delete cascade,
  user_id   uuid not null references auth.users(id) on delete cascade,
  aposta    int not null check (aposta between 5 and 1000),
  escolha   jsonb not null,
  estado    text not null default 'aberta' check (estado in ('aberta', 'ganhou', 'perdeu', 'sacou')),
  sacou     numeric,
  pagou     int not null default 0,
  em        timestamptz not null default clock_timestamp(),
  unique (rodada_id, user_id)
);
alter table public.mesa_rodadas   enable row level security;
alter table public.mesa_apostas   enable row level security;
revoke all on public.mesa_rodadas, public.mesa_apostas from public, anon, authenticated;

-- tempos de cada mesa (segundos): apostas e quanto tempo depois do fechamento a tela ainda mostra o resultado
create or replace function public.mesa_janela(p_jogo text) returns interval
language sql immutable as $$
  select case p_jogo when 'roleta' then interval '15 seconds' else interval '8 seconds' end;
$$;

-- número da rodada (0 a 1), igual ao motor do cassino, a partir do segredo dela
create or replace function public.mesa_u(p_segredo bytea, p_jogo text, p_id bigint) returns numeric
language sql immutable set search_path = public, extensions as $$
  select ('x' || lpad(substr(encode(extensions.hmac(convert_to(p_jogo || ':' || p_id, 'UTF8'), p_segredo, 'sha256'), 'hex'), 1, 13), 16, '0'))::bit(64)::bigint / 4503599627370496.0;
$$;
revoke all on function public.mesa_u(bytea, text, bigint) from public, anon, authenticated;

-- abre uma rodada nova (com o segredo e o hash)
create or replace function public.mesa_abrir(p_jogo text) returns public.mesa_rodadas
language plpgsql security definer set search_path = public, extensions as $$
declare
  v_s bytea := extensions.gen_random_bytes(32);
  r   public.mesa_rodadas;
begin
  insert into public.mesa_rodadas (jogo, fecha_em, segredo, hash)
    values (p_jogo, clock_timestamp() + public.mesa_janela(p_jogo), v_s, encode(extensions.digest(v_s, 'sha256'), 'hex'))
    returning * into r;
  return r;
end $$;
revoke all on function public.mesa_abrir(text) from public, anon, authenticated;

-- guarda a aposta paga na história de cada um (aparece em "Minhas apostas" e no feed)
create or replace function public.mesa_registrar(p_user uuid, p_jogo text, p_aposta int, p_escolha jsonb, p_resultado jsonb,
  p_pagou int, p_rodada public.mesa_rodadas) returns void
language sql security definer set search_path = public as $$
  insert into public.cassino_apostas (user_id, jogo, aposta, escolha, resultado, pagou, hash, nonce)
  values (p_user, p_jogo, p_aposta, p_escolha || jsonb_build_object('rodada', p_rodada.id), p_resultado, p_pagou, p_rodada.hash, p_rodada.id::int);
$$;
revoke all on function public.mesa_registrar(uuid, text, int, jsonb, jsonb, int, public.mesa_rodadas) from public, anon, authenticated;

-- roleta: quanto uma lista de fichas paga numa casa (a mesma tabela da roleta de mesa)
create or replace function public.roleta_paga(p_fichas jsonb, p_casa int) returns int
language plpgsql immutable as $$
declare
  v_verm int[] := array[1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36];
  f jsonb; v_tipo text; v_valor int; v_ap int; v_g boolean; v_cor text; v_total int := 0;
begin
  v_cor := case when p_casa = 0 then 'verde' when p_casa = any (v_verm) then 'vermelho' else 'preto' end;
  for f in select * from jsonb_array_elements(p_fichas) loop
    v_tipo := f->>'tipo'; v_valor := (f->>'valor')::int; v_ap := (f->>'aposta')::int;
    v_g := case v_tipo
      when 'numero'   then p_casa = v_valor
      when 'cor'      then p_casa <> 0 and (v_cor = 'vermelho') = (v_valor = 0)
      when 'paridade' then p_casa <> 0 and p_casa % 2 = v_valor
      when 'metade'   then p_casa <> 0 and (p_casa <= 18) = (v_valor = 0)
      when 'duzia'    then p_casa <> 0 and (p_casa - 1) / 12 = v_valor
      when 'coluna'   then p_casa <> 0 and (p_casa - 1) % 3 = v_valor
      else false end;
    if v_g then v_total := v_total + case when v_tipo = 'numero' then v_ap * 36 when v_tipo in ('duzia', 'coluna') then v_ap * 3 else v_ap * 2 end; end if;
  end loop;
  return v_total;
end $$;

-- paga uma rodada que já acabou (uma vez só: `liquidada`)
create or replace function public.mesa_liquidar(p_id bigint) returns void
language plpgsql security definer set search_path = public as $$
declare
  r      public.mesa_rodadas;
  a      record;
  v_pg   int;
  v_casa int;
  v_cr   numeric;
begin
  select * into r from public.mesa_rodadas where id = p_id for update;
  if r.liquidada or r.resultado is null or clock_timestamp() < r.fim_em then return; end if;
  if r.jogo = 'roleta' then
    v_casa := (r.resultado->>'casa')::int;
    for a in select * from public.mesa_apostas where rodada_id = r.id and estado = 'aberta' loop
      v_pg := public.roleta_paga(a.escolha->'fichas', v_casa);
      update public.mesa_apostas set estado = case when v_pg > 0 then 'ganhou' else 'perdeu' end, pagou = v_pg where id = a.id;
      if v_pg > 0 then perform public.creditar(a.user_id, v_pg, 'cassino', 'roleta'); end if;
      perform public.mesa_registrar(a.user_id, 'roleta', a.aposta, a.escolha, r.resultado, v_pg, r);
    end loop;
  elsif r.jogo = 'aviao' then
    v_cr := (r.resultado->>'crash')::numeric;
    for a in select * from public.mesa_apostas where rodada_id = r.id and estado = 'aberta' loop
      -- saque automático que valeu (o alvo chegou antes do avião ir embora)
      if (a.escolha->>'auto') is not null and (a.escolha->>'auto')::numeric <= v_cr then
        v_pg := floor(a.aposta * (a.escolha->>'auto')::numeric)::int;
        update public.mesa_apostas set estado = 'sacou', sacou = (a.escolha->>'auto')::numeric, pagou = v_pg where id = a.id;
        perform public.creditar(a.user_id, v_pg, 'cassino', 'aviao');
        perform public.mesa_registrar(a.user_id, 'aviao', a.aposta, a.escolha || jsonb_build_object('sacou', (a.escolha->>'auto')::numeric), jsonb_build_object('valor', v_cr), v_pg, r);
      else
        update public.mesa_apostas set estado = 'perdeu' where id = a.id;
        perform public.mesa_registrar(a.user_id, 'aviao', a.aposta, a.escolha, jsonb_build_object('valor', v_cr), 0, r);
      end if;
    end loop;
  end if;
  update public.mesa_rodadas set liquidada = true where id = r.id;
end $$;
revoke all on function public.mesa_liquidar(bigint) from public, anon, authenticated;

-- faz a mesa andar: sorteia a rodada que fechou e paga a que acabou. Devolve a rodada atual (a última). Uma trava por jogo para duas pessoas não andarem juntas.
create or replace function public.mesa_avancar(p_jogo text) returns public.mesa_rodadas
language plpgsql security definer set search_path = public as $$
declare
  r    public.mesa_rodadas;
  v_u  numeric;
  v_cr numeric;
  v_c  int;
begin
  perform pg_advisory_xact_lock(hashtext('mesa:' || p_jogo));
  select * into r from public.mesa_rodadas where jogo = p_jogo order by id desc limit 1;
  if not found then return null; end if;
  if r.resultado is null and clock_timestamp() >= r.fecha_em then
    v_u := public.mesa_u(r.segredo, r.jogo, r.id);
    if r.jogo = 'roleta' then
      v_c := floor(v_u * 37)::int;
      update public.mesa_rodadas set resultado = jsonb_build_object('casa', v_c, 'cor',
          case when v_c = 0 then 'verde' when v_c = any (array[1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36]) then 'vermelho' else 'preto' end),
        fim_em = r.fecha_em + interval '9 seconds' where id = r.id returning * into r;
    else
      v_cr := greatest(1, floor((0.97 / (1 - v_u)) * 100) / 100);
      -- o avião decola no fechamento; vai embora quando o multiplicador chega no ponto de queda
      update public.mesa_rodadas set resultado = jsonb_build_object('crash', v_cr),
        fim_em = r.fecha_em + make_interval(secs => ln(v_cr) / 0.07) where id = r.id returning * into r;
    end if;
  end if;
  if not r.liquidada and r.resultado is not null and clock_timestamp() >= r.fim_em then
    perform public.mesa_liquidar(r.id);
    select * into r from public.mesa_rodadas where id = r.id;
  end if;
  return r;
end $$;
revoke all on function public.mesa_avancar(text) from public, anon, authenticated;

-- só para ler o estado (o site pergunta várias vezes por segundo): olha a rodada sem a trava e só chama mesa_avancar
-- (que trava) quando há algo a fazer, sortear ou pagar. As apostas continuam passando pela trava de mesa_avancar.
-- Sem isso, cada consulta entrava na fila da trava e as apostas esperavam atrás delas (03/11/2026).
create or replace function public.mesa_olhar(p_jogo text) returns public.mesa_rodadas
language plpgsql security definer set search_path = public as $$
declare
  r public.mesa_rodadas;
begin
  select * into r from public.mesa_rodadas where jogo = p_jogo order by id desc limit 1;
  if not found then return null; end if;
  if (r.resultado is null and clock_timestamp() >= r.fecha_em) or (not r.liquidada and r.resultado is not null and clock_timestamp() >= r.fim_em) then
    return public.mesa_avancar(p_jogo);
  end if;
  return r;
end $$;
revoke all on function public.mesa_olhar(text) from public, anon, authenticated;

-- a rodada aberta para apostar agora (abre uma se a mesa estiver parada); erro se estiver no meio do jogo
create or replace function public.mesa_para_apostar(p_jogo text) returns public.mesa_rodadas
language plpgsql security definer set search_path = public as $$
declare
  r public.mesa_rodadas;
begin
  r := public.mesa_avancar(p_jogo);
  if r.id is not null and clock_timestamp() < r.fecha_em then return r; end if;
  if r.id is not null and (not r.liquidada or clock_timestamp() < r.fim_em + interval '2 seconds') then
    raise exception '%', case p_jogo when 'roleta' then 'A roleta está girando. Aposte na próxima rodada.'
      else 'O avião está no ar. Aposte no próximo voo.' end
      using errcode = 'P0001';
  end if;
  return public.mesa_abrir(p_jogo);
end $$;
revoke all on function public.mesa_para_apostar(text) from public, anon, authenticated;

-- roleta ao vivo: põe fichas na rodada aberta (pode chamar mais de uma vez; até 30 fichas e 1.000 por rodada)
create or replace function public.mesa_apostar_roleta(p_fichas jsonb) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  r     public.mesa_rodadas;
  f     jsonb;
  v_tipo text; v_valor int; v_ap int;
  v_total int := 0;
  v_ant  public.mesa_apostas;
  v_sal  int;
begin
  if not public.eh_nanico() then raise exception 'Só nanicos jogam.' using errcode = 'P0001'; end if;
  if p_fichas is null or jsonb_typeof(p_fichas) <> 'array' or jsonb_array_length(p_fichas) = 0 then
    raise exception 'Ponha pelo menos uma ficha na mesa.' using errcode = 'P0001';
  end if;
  for f in select * from jsonb_array_elements(p_fichas) loop
    v_tipo := f->>'tipo';
    if jsonb_typeof(f->'valor') <> 'number' or jsonb_typeof(f->'aposta') <> 'number' then raise exception 'Aposta inválida.' using errcode = 'P0001'; end if;
    v_valor := (f->>'valor')::int; v_ap := (f->>'aposta')::int;
    if v_ap not between 5 and 100 then raise exception 'Cada ficha vai de 5 a 100 moedas.' using errcode = 'P0001'; end if;
    if v_tipo is null or v_tipo not in ('numero', 'cor', 'paridade', 'metade', 'duzia', 'coluna')
       or (v_tipo = 'numero' and v_valor not between 0 and 36)
       or (v_tipo in ('cor', 'paridade', 'metade') and v_valor not in (0, 1))
       or (v_tipo in ('duzia', 'coluna') and v_valor not in (0, 1, 2)) then
      raise exception 'Aposta inválida.' using errcode = 'P0001';
    end if;
    v_total := v_total + v_ap;
  end loop;
  perform public.limitar('cassino', 30, interval '1 minute', 'Calma: muitas apostas seguidas. Espere um pouco.');
  r := public.mesa_para_apostar('roleta');
  select * into v_ant from public.mesa_apostas where rodada_id = r.id and user_id = v_uid for update;
  if found then
    if jsonb_array_length(v_ant.escolha->'fichas') + jsonb_array_length(p_fichas) > 30 then raise exception 'No máximo 30 fichas por rodada.' using errcode = 'P0001'; end if;
    if v_ant.aposta + v_total > 1000 then raise exception 'No máximo 1.000 moedas por rodada.' using errcode = 'P0001'; end if;
  elsif jsonb_array_length(p_fichas) > 30 then raise exception 'No máximo 30 fichas por rodada.' using errcode = 'P0001';
  elsif v_total > 1000 then raise exception 'No máximo 1.000 moedas por rodada.' using errcode = 'P0001';
  end if;
  v_sal := public.creditar(v_uid, -v_total, 'cassino', 'roleta');
  if v_ant.id is not null then
    update public.mesa_apostas set aposta = aposta + v_total, escolha = jsonb_build_object('fichas', (escolha->'fichas') || p_fichas) where id = v_ant.id;
  else
    insert into public.mesa_apostas (rodada_id, user_id, aposta, escolha) values (r.id, v_uid, v_total, jsonb_build_object('fichas', p_fichas));
  end if;
  return jsonb_build_object('rodada', r.id, 'saldo', v_sal);
end $$;
revoke all on function public.mesa_apostar_roleta(jsonb) from public, anon;
grant execute on function public.mesa_apostar_roleta(jsonb) to authenticated;

-- aviãozinho ao vivo: entra no próximo voo (uma aposta por voo), com saque automático opcional
create or replace function public.mesa_apostar_aviao(p_aposta int, p_auto numeric default null) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  r     public.mesa_rodadas;
  v_sal int;
begin
  if not public.eh_nanico() then raise exception 'Só nanicos jogam.' using errcode = 'P0001'; end if;
  if p_aposta is null or p_aposta not between 5 and 100 then raise exception 'A aposta vai de 5 a 100 moedas.' using errcode = 'P0001'; end if;
  if p_auto is not null and (p_auto < 1.01 or p_auto > 1000 or round(p_auto, 2) <> p_auto) then
    raise exception 'O saque automático vai de 1,01× a 1.000×, com até 2 casas depois da vírgula.' using errcode = 'P0001';
  end if;
  perform public.limitar('cassino', 30, interval '1 minute', 'Calma: muitas apostas seguidas. Espere um pouco.');
  r := public.mesa_para_apostar('aviao');
  if exists (select 1 from public.mesa_apostas where rodada_id = r.id and user_id = v_uid) then
    raise exception 'Você já está neste voo.' using errcode = 'P0001';
  end if;
  v_sal := public.creditar(v_uid, -p_aposta, 'cassino', 'aviao');
  insert into public.mesa_apostas (rodada_id, user_id, aposta, escolha) values (r.id, v_uid, p_aposta, jsonb_build_object('auto', p_auto));
  return jsonb_build_object('rodada', r.id, 'saldo', v_sal);
end $$;
revoke all on function public.mesa_apostar_aviao(int, numeric) from public, anon;
grant execute on function public.mesa_apostar_aviao(int, numeric) to authenticated;

-- aviãozinho ao vivo: sacar agora (vale o relógio do banco; o automático, se já passou do alvo)
create or replace function public.mesa_sacar_aviao() returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  r     public.mesa_rodadas;
  a     public.mesa_apostas;
  v_m   numeric;
  v_sac numeric;
  v_pg  int;
  v_sal int;
begin
  if not public.eh_nanico() then raise exception 'Só nanicos jogam.' using errcode = 'P0001'; end if;
  r := public.mesa_avancar('aviao');
  select * into a from public.mesa_apostas where rodada_id = r.id and user_id = v_uid for update;
  if not found then raise exception 'Você não está neste voo.' using errcode = 'P0001'; end if;
  if a.estado <> 'aberta' then
    select saldo into v_sal from public.carteiras where user_id = v_uid;
    return jsonb_build_object('estado', a.estado, 'sacou', a.sacou, 'pagou', a.pagou, 'saldo', v_sal);
  end if;
  if clock_timestamp() < r.fecha_em then raise exception 'O avião ainda não decolou.' using errcode = 'P0001'; end if;
  v_m := public.aviao_mult(r.fecha_em, clock_timestamp());
  if clock_timestamp() >= r.fim_em or v_m >= (r.resultado->>'crash')::numeric then
    raise exception 'O avião já foi embora.' using errcode = 'P0001';
  end if;
  v_sac := case when (a.escolha->>'auto') is not null and (a.escolha->>'auto')::numeric <= v_m then (a.escolha->>'auto')::numeric else greatest(1, v_m) end;
  v_pg := floor(a.aposta * v_sac)::int;
  update public.mesa_apostas set estado = 'sacou', sacou = v_sac, pagou = v_pg where id = a.id;
  v_sal := public.creditar(v_uid, v_pg, 'cassino', 'aviao');
  perform public.mesa_registrar(v_uid, 'aviao', a.aposta, a.escolha || jsonb_build_object('sacou', v_sac), jsonb_build_object('valor', (r.resultado->>'crash')::numeric), v_pg, r);
  return jsonb_build_object('estado', 'sacou', 'sacou', v_sac, 'pagou', v_pg, 'saldo', v_sal);
end $$;
revoke all on function public.mesa_sacar_aviao() from public, anon;
grant execute on function public.mesa_sacar_aviao() to authenticated;

-- o que a tela mostra: a rodada (fase, tempos e o relógio do banco), quem está nela e as últimas rodadas.
-- O resultado só sai quando pode: a roleta no fechamento, o aviãozinho quando ele vai embora.
create or replace function public.mesa_estado(p_jogo text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_uid  uuid := auth.uid();
  r      public.mesa_rodadas;
  v_ag   timestamptz;
  v_fase text;
  v_res  jsonb;
  v_gente jsonb;
  v_meu  jsonb;
begin
  if not public.eh_nanico() then raise exception 'Só nanicos jogam.' using errcode = 'P0001'; end if;
  if p_jogo is null or p_jogo not in ('roleta', 'aviao') then raise exception 'Mesa inválida.' using errcode = 'P0001'; end if;
  r := public.mesa_olhar(p_jogo);
  v_ag := clock_timestamp();
  if r.id is null then
    v_fase := 'parada';
  elsif v_ag < r.fecha_em then v_fase := 'apostas';
  elsif r.fim_em is null or v_ag < r.fim_em then v_fase := 'jogo';
  elsif v_ag < r.fim_em + interval '4 seconds' then v_fase := 'resultado';
  else v_fase := 'parada';
  end if;
  v_res := case when r.id is null or r.resultado is null then null
                when p_jogo = 'aviao' and v_ag < r.fim_em then null
                else r.resultado end;
    v_gente := coalesce((select jsonb_agg(jsonb_build_object('nome', f.name, 'eu', a.user_id = v_uid, 'aposta', a.aposta, 'estado', a.estado,
        'sacou', a.sacou, 'pagou', a.pagou,
        'fichas', case when p_jogo = 'roleta' then jsonb_array_length(a.escolha->'fichas') end) order by a.em)
      from public.mesa_apostas a left join public.friends f on f.user_id = a.user_id where a.rodada_id = r.id), '[]'::jsonb);
    v_meu := (select jsonb_build_object('aposta', a.aposta, 'escolha', a.escolha, 'estado', a.estado, 'sacou', a.sacou, 'pagou', a.pagou)
      from public.mesa_apostas a where a.rodada_id = r.id and a.user_id = v_uid);
  return jsonb_build_object(
    'jogo', p_jogo, 'fase', v_fase, 'agora', v_ag,
    'rodada', case when r.id is null then null else jsonb_build_object('id', r.id, 'hash', r.hash, 'abre_em', r.abre_em,
      'fecha_em', r.fecha_em, 'resultado', v_res, 'fim_em', case when v_res is null then null else r.fim_em end,
      'segredo', case when r.liquidada then encode(r.segredo, 'hex') end) end,
    'gente', v_gente, 'meu', v_meu,
    'ultimos', coalesce((select jsonb_agg(x.resultado order by x.id desc) from (
       select id, resultado from public.mesa_rodadas where jogo = p_jogo and liquidada order by id desc limit 15) x), '[]'::jsonb));
end $$;
revoke all on function public.mesa_estado(text) from public, anon;
grant execute on function public.mesa_estado(text) to authenticated;

-- 32b) pênalti (no lugar do maior ou menor): cada um joga a sua disputa, contra o goleiro da casa ------------------------
--   Aposta uma vez (5 a 100) e chuta: o goleiro pula numa das 3 colunas, sorteada pelo mesmo motor justo de cada um
--   (cassino_numero: coluna = floor(u × 3)). Gol nas outras duas colunas: o multiplicador sobe, 0,97 ÷ (2/3)^gols
--   (1,45× no 1º, 7,36× no 5º, que paga sozinho; a casa leva 3% uma vez só). Pode sacar depois de cada gol.
--   Ao terminar (defesa, saque ou 5 gols) vira uma aposta 'penalti' com o hash e o nonce do último chute (conferível).
create table if not exists public.penalti_jogos (
  id          bigint generated always as identity primary key,
  user_id     uuid not null references auth.users(id) on delete cascade,
  aposta      int not null check (aposta between 5 and 100),
  gols        int not null default 0 check (gols between 0 and 5),
  estado      text not null default 'ativa' check (estado in ('ativa', 'sacou', 'perdeu', 'completa')),
  pagou       int not null default 0,
  ult_hash    text,
  ult_nonce   int,
  ult_coluna  int,
  em          timestamptz not null default now()
);
create unique index if not exists penalti_jogos_um_ativo on public.penalti_jogos (user_id) where estado = 'ativa';
alter table public.penalti_jogos enable row level security;
revoke all on public.penalti_jogos from public, anon, authenticated;

-- o multiplicador depois de g gols
create or replace function public.penalti_mult(p_gols int) returns numeric
language sql immutable as $$
  select case when p_gols <= 0 then 1 else floor(0.97 / power(2.0 / 3.0, p_gols) * 100) / 100 end;
$$;

-- fecha a disputa: paga (se for o caso) e guarda na história
create or replace function public.penalti_fechar(p_id bigint, p_estado text) returns int
language plpgsql security definer set search_path = public as $$
declare
  j    public.penalti_jogos;
  v_pg int := 0;
  v_sal int;
begin
  select * into j from public.penalti_jogos where id = p_id for update;
  if p_estado in ('sacou', 'completa') then v_pg := floor(j.aposta * public.penalti_mult(j.gols))::int; end if;
  update public.penalti_jogos set estado = p_estado, pagou = v_pg where id = j.id;
  if v_pg > 0 then v_sal := public.creditar(j.user_id, v_pg, 'cassino', 'penalti');
  else select saldo into v_sal from public.carteiras where user_id = j.user_id; end if;
  insert into public.cassino_apostas (user_id, jogo, aposta, escolha, resultado, pagou, hash, nonce)
    values (j.user_id, 'penalti', j.aposta, jsonb_build_object('gols', j.gols, 'fim', p_estado),
            jsonb_build_object('coluna', j.ult_coluna, 'valor', case when v_pg > 0 then public.penalti_mult(j.gols) else 0 end),
            v_pg, coalesce(j.ult_hash, ''), coalesce(j.ult_nonce, 0));
  return v_sal;
end $$;
revoke all on function public.penalti_fechar(bigint, text) from public, anon, authenticated;

-- começa uma disputa (cobra a aposta)
create or replace function public.penalti_comecar(p_aposta int) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  v_id  bigint;
  v_sal int;
begin
  if not public.eh_nanico() then raise exception 'Só nanicos jogam.' using errcode = 'P0001'; end if;
  if p_aposta is null or p_aposta not between 5 and 100 then raise exception 'A aposta vai de 5 a 100 moedas.' using errcode = 'P0001'; end if;
  if exists (select 1 from public.penalti_jogos where user_id = v_uid and estado = 'ativa') then
    raise exception 'Você já está numa disputa: chute ou saque.' using errcode = 'P0001';
  end if;
  perform public.limitar('cassino', 30, interval '1 minute', 'Calma: muitas apostas seguidas. Espere um pouco.');
  v_sal := public.creditar(v_uid, -p_aposta, 'cassino', 'penalti');
  insert into public.penalti_jogos (user_id, aposta) values (v_uid, p_aposta) returning id into v_id;
  return jsonb_build_object('id', v_id, 'gols', 0, 'saldo', v_sal);
end $$;
revoke all on function public.penalti_comecar(int) from public, anon;
grant execute on function public.penalti_comecar(int) to authenticated;

-- chuta num canto (0–2 em cima, 3–5 embaixo; esquerda, meio, direita): o banco sorteia o pulo do goleiro na hora
create or replace function public.penalti_chutar(p_zona int) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  j     public.penalti_jogos;
  r     record;
  v_col int;
  v_gol boolean;
  v_sal int;
  v_est text := 'ativa';
begin
  if not public.eh_nanico() then raise exception 'Só nanicos jogam.' using errcode = 'P0001'; end if;
  if p_zona is null or p_zona not between 0 and 5 then raise exception 'Escolha um canto do gol.' using errcode = 'P0001'; end if;
  select * into j from public.penalti_jogos where user_id = v_uid and estado = 'ativa' for update;
  if not found then raise exception 'Aposte para começar a disputa.' using errcode = 'P0001'; end if;
  perform public.limitar('penalti_chute', 40, interval '1 minute', 'Calma: muitos chutes seguidos.');
  select * into r from public.cassino_numero(v_uid);
  v_col := floor(r.u * 3)::int;
  v_gol := p_zona % 3 <> v_col;
  update public.penalti_jogos set gols = gols + case when v_gol then 1 else 0 end, ult_hash = r.hash, ult_nonce = r.nonce, ult_coluna = v_col
   where id = j.id returning * into j;
  if not v_gol then v_est := 'perdeu'; v_sal := public.penalti_fechar(j.id, 'perdeu');
  elsif j.gols >= 5 then v_est := 'completa'; v_sal := public.penalti_fechar(j.id, 'completa');
  else select saldo into v_sal from public.carteiras where user_id = v_uid; end if;
  select * into j from public.penalti_jogos where id = j.id;
  return jsonb_build_object('gol', v_gol, 'coluna', v_col, 'alto', floor(r.u * 6)::int % 2 = 1, 'gols', j.gols, 'estado', v_est,
    'mult', public.penalti_mult(j.gols), 'pagou', j.pagou, 'saldo', v_sal, 'hash', r.hash, 'nonce', r.nonce);
end $$;
revoke all on function public.penalti_chutar(int) from public, anon;
grant execute on function public.penalti_chutar(int) to authenticated;

-- sai com o multiplicador atual (precisa de pelo menos um gol)
create or replace function public.penalti_sacar() returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  j     public.penalti_jogos;
  v_sal int;
begin
  if not public.eh_nanico() then raise exception 'Só nanicos jogam.' using errcode = 'P0001'; end if;
  select * into j from public.penalti_jogos where user_id = v_uid and estado = 'ativa' for update;
  if not found then raise exception 'Você não está numa disputa.' using errcode = 'P0001'; end if;
  if j.gols = 0 then raise exception 'Faça pelo menos um gol para sacar.' using errcode = 'P0001'; end if;
  v_sal := public.penalti_fechar(j.id, 'sacou');
  return jsonb_build_object('pagou', floor(j.aposta * public.penalti_mult(j.gols))::int, 'mult', public.penalti_mult(j.gols), 'saldo', v_sal);
end $$;
revoke all on function public.penalti_sacar() from public, anon;
grant execute on function public.penalti_sacar() to authenticated;

-- a disputa que está aberta (para voltar a ela depois de recarregar a página)
create or replace function public.penalti_estado() returns jsonb
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.eh_nanico() then raise exception 'Só nanicos jogam.' using errcode = 'P0001'; end if;
  return (select jsonb_build_object('id', id, 'aposta', aposta, 'gols', gols, 'mult', public.penalti_mult(gols))
            from public.penalti_jogos where user_id = auth.uid() and estado = 'ativa');
end $$;
revoke all on function public.penalti_estado() from public, anon;
grant execute on function public.penalti_estado() to authenticated;

-- 33) jackpot do caça-níquel: 1% de cada giro de qualquer nanico vai para um prêmio do grupo; três bolas levam tudo -----
--   Começa em 500. Quem tirar 3 bolas (o prêmio máximo da tabela) ganha o 1.000× de sempre e mais o jackpot, que volta
--   para 500. Todo mundo vê o valor subir pelo tempo real da tabela (só leitura) e o aviso de quem ganhou.
create table if not exists public.cassino_jackpot (
  id          int primary key default 1 check (id = 1),
  valor       numeric not null default 500,
  ganhador    text,
  ganhou      int,
  ganhou_em   timestamptz,
  atualizado  timestamptz not null default now()
);
insert into public.cassino_jackpot (id) values (1) on conflict (id) do nothing;
alter table public.cassino_jackpot enable row level security;
revoke all on public.cassino_jackpot from public, anon, authenticated;
grant select on public.cassino_jackpot to authenticated;
drop policy if exists "nanicos veem o jackpot" on public.cassino_jackpot;
create policy "nanicos veem o jackpot" on public.cassino_jackpot for select to authenticated using (public.eh_nanico());
do $$
begin
  begin alter publication supabase_realtime add table public.cassino_jackpot; exception when duplicate_object then null; end;
end $$;

-- o caça-níquel de sempre (11b), agora alimentando e pagando o jackpot
create or replace function public.apostar_slot(p_aposta int) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  r1 record; r2 record; r3 record;
  s1 text; s2 text; s3 text;
  v_pg  int := 0;
  v_jp  int := 0;
  v_sal int;
  v_pote numeric;
begin
  if not public.eh_nanico() then raise exception 'Só nanicos jogam.' using errcode = 'P0001'; end if;
  if p_aposta is null or p_aposta not between 5 and 100 then raise exception 'A aposta vai de 5 a 100 moedas.' using errcode = 'P0001'; end if;
  perform public.limitar('cassino', 30, interval '1 minute', 'Calma: muitas apostas seguidas. Espere um pouco.');
  perform public.creditar(v_uid, -p_aposta, 'cassino', 'slot');
  update public.cassino_jackpot set valor = valor + p_aposta * 0.01, atualizado = now() where id = 1 returning valor into v_pote;
  select * into r1 from public.cassino_numero(v_uid);
  select * into r2 from public.cassino_numero(v_uid);
  select * into r3 from public.cassino_numero(v_uid);
  s1 := public.cassino_simbolo(r1.u); s2 := public.cassino_simbolo(r2.u); s3 := public.cassino_simbolo(r3.u);
  v_pg := floor(p_aposta * public.cassino_slot_mult(s1, s2, s3))::int;
  if s1 = 'bola' and s2 = 'bola' and s3 = 'bola' then
    v_jp := floor(v_pote)::int;
    update public.cassino_jackpot set valor = 500, ganhador = (select name from public.friends where user_id = v_uid),
      ganhou = v_jp, ganhou_em = now(), atualizado = now() where id = 1;
    v_pg := v_pg + v_jp;
  end if;
  if v_pg > 0 then v_sal := public.creditar(v_uid, v_pg, 'cassino', 'slot');
  else select saldo into v_sal from public.carteiras where user_id = v_uid; end if;
  insert into public.cassino_apostas (user_id, jogo, aposta, escolha, resultado, pagou, hash, nonce)
    values (v_uid, 'slot', p_aposta, '{}'::jsonb, jsonb_build_object('simbolos', jsonb_build_array(s1, s2, s3), 'jackpot', v_jp), v_pg, r1.hash, r1.nonce);
  return jsonb_build_object('simbolos', jsonb_build_array(s1, s2, s3), 'pagou', v_pg, 'jackpot', v_jp, 'saldo', v_sal, 'hash', r1.hash, 'nonce', r1.nonce);
end $$;
revoke all on function public.apostar_slot(int) from public, anon;
grant execute on function public.apostar_slot(int) to authenticated;

-- 34) InstaNanico: stories de 24 h na rede nanica (só quem tem o Celular), e postagem só com foto -------------------------
--   Story: foto (na pasta rede/<uid>/ do bucket midias, como as postagens) ou só texto sobre uma cor de fundo, com uma
--   legenda curta. Some sozinho depois de 24 h (o RLS só mostra aos outros as das últimas 24 h; o dono ainda vê as
--   vencidas, para o site apagar a foto e a linha juntas quando ele posta o próximo story). Quem viu fica em rede_stories_vistos: cada um grava só o próprio "vi" e o dono do story lê quem viu.
--   Postagem: agora pode ir só com a foto (legenda vazia); sem foto, o texto continua obrigatório.
update public.loja_itens set descricao = 'Um iPhone com o InstaNanico: stories, fotos, curtidas e comentários com o grupo.' where id = 'celular';
alter table public.rede_posts drop constraint if exists rede_posts_texto_check;
alter table public.rede_posts add constraint rede_posts_texto_check check (char_length(texto) <= 500);
alter table public.rede_posts alter column texto set default '';

create table if not exists public.rede_stories (
  id      bigint generated always as identity primary key,
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  midia   text check (midia ~ '^rede/[0-9a-f-]{36}/[a-z0-9-]{6,40}\.(webp|gif)$'),
  texto   text not null default '' check (char_length(texto) <= 120),
  fundo   text not null default 'roxo' check (fundo in ('roxo', 'laranja', 'verde', 'azul', 'preto')),
  em      timestamptz not null default now(),
  check (midia is not null or char_length(texto) > 0)
);
create index if not exists rede_stories_em on public.rede_stories (em desc);
create table if not exists public.rede_stories_vistos (
  story_id bigint not null references public.rede_stories(id) on delete cascade,
  user_id  uuid not null default auth.uid() references auth.users(id) on delete cascade,
  em       timestamptz not null default now(),
  primary key (story_id, user_id)
);
alter table public.rede_stories        enable row level security;
alter table public.rede_stories_vistos enable row level security;
revoke all on public.rede_stories, public.rede_stories_vistos from public, anon, authenticated;
grant select, delete on public.rede_stories to authenticated;
grant insert (midia, texto, fundo) on public.rede_stories to authenticated;
grant select on public.rede_stories_vistos to authenticated;
grant insert (story_id) on public.rede_stories_vistos to authenticated;

drop policy if exists rede_stories_ler on public.rede_stories;
create policy rede_stories_ler on public.rede_stories for select to authenticated
  using (public.eh_nanico() and public.tem_item('celular') and (em > now() - interval '24 hours' or user_id = auth.uid()));
drop policy if exists rede_stories_criar on public.rede_stories;
create policy rede_stories_criar on public.rede_stories for insert to authenticated with check (user_id = auth.uid() and public.tem_item('celular'));
drop policy if exists rede_stories_apagar on public.rede_stories;
create policy rede_stories_apagar on public.rede_stories for delete to authenticated using (user_id = auth.uid());

drop policy if exists rede_vistos_ler on public.rede_stories_vistos;
create policy rede_vistos_ler on public.rede_stories_vistos for select to authenticated
  using (user_id = auth.uid() or exists (select 1 from public.rede_stories s where s.id = story_id and s.user_id = auth.uid()));
drop policy if exists rede_vistos_criar on public.rede_stories_vistos;
create policy rede_vistos_criar on public.rede_stories_vistos for insert to authenticated
  with check (user_id = auth.uid() and public.tem_item('celular'));

-- a proteção da rede (seção 18) passa a cuidar dos stories e da postagem só com foto
create or replace function public.rede_protecao() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  new.user_id := auth.uid();
  new.em := now();
  if tg_table_name = 'rede_curtidas' then
    perform public.limitar('rede_curtida', 120, interval '1 hour', 'Calma: curtidas demais em pouco tempo.');
    return new;
  end if;
  if tg_table_name = 'rede_stories_vistos' then
    if not exists (select 1 from public.rede_stories where id = new.story_id and em > now() - interval '24 hours') then
      raise exception 'Esse story já sumiu.' using errcode = 'P0001';
    end if;
    return new;
  end if;
  new.texto := btrim(regexp_replace(coalesce(new.texto, ''), '[\x00-\x09\x0B-\x1F\x7F]', ' ', 'g'));
  if tg_table_name in ('rede_posts', 'rede_stories') then
    if char_length(new.texto) = 0 and new.midia is null then
      raise exception '%', case when tg_table_name = 'rede_posts' then 'Escreva alguma coisa ou escolha uma foto.' else 'Escolha uma foto ou escreva o texto do story.' end using errcode = 'P0001';
    end if;
    if new.midia is not null then
      if split_part(new.midia, '/', 2) <> new.user_id::text then
        raise exception 'A imagem tem que estar na sua pasta.' using errcode = 'P0001';
      end if;
      if not exists (select 1 from storage.objects where bucket_id = 'midias' and name = new.midia) then
        raise exception 'A imagem não chegou. Tente de novo.' using errcode = 'P0001';
      end if;
    end if;
    if tg_table_name = 'rede_posts' then
      perform public.limitar('rede_post', 10, interval '1 hour', 'Calma: no máximo 10 postagens por hora.');
    else
      perform public.limitar('rede_story', 20, interval '1 hour', 'Calma: no máximo 20 stories por hora.');
    end if;
  else
    if char_length(new.texto) = 0 then raise exception 'Escreva alguma coisa.' using errcode = 'P0001'; end if;
    perform public.limitar('rede_comentario', 40, interval '1 hour', 'Calma: no máximo 40 comentários por hora.');
  end if;
  return new;
end $$;
revoke all on function public.rede_protecao() from public, anon, authenticated;
drop trigger if exists rede_protecao on public.rede_stories;
create trigger rede_protecao before insert on public.rede_stories for each row execute function public.rede_protecao();
drop trigger if exists rede_protecao on public.rede_stories_vistos;
create trigger rede_protecao before insert on public.rede_stories_vistos for each row execute function public.rede_protecao();

do $$
begin
  begin alter publication supabase_realtime add table public.rede_stories; exception when duplicate_object then null; end;
end $$;

-- 35) InstaNanico Direct: mensagens entre os nanicos (só quem tem o Celular manda e lê) -----------------------------------
--   Cada um lê só as mensagens em que é remetente ou destinatário, e só com o Celular (tem_item). O remetente é sempre
--   quem está logado; o destinatário tem que ser outro nanico. A mensagem pode responder a um story (story_id) ou mandar
--   uma publicação (post_id). Quem recebe marca como lida (lida_em) por marcar_lidas(de). Limite: 30 por minuto.
create table if not exists public.rede_mensagens (
  id       bigint generated always as identity primary key,
  de       uuid not null default auth.uid() references auth.users(id) on delete cascade,
  para     uuid not null references auth.users(id) on delete cascade,
  texto    text not null default '' check (char_length(texto) <= 1000),
  story_id bigint references public.rede_stories(id) on delete set null,
  post_id  bigint references public.rede_posts(id) on delete set null,
  em       timestamptz not null default now(),
  lida_em  timestamptz,
  check (de <> para)
);
create index if not exists rede_mensagens_para on public.rede_mensagens (para, em desc);
create index if not exists rede_mensagens_de on public.rede_mensagens (de, em desc);
alter table public.rede_mensagens enable row level security;
revoke all on public.rede_mensagens from public, anon, authenticated;
grant select on public.rede_mensagens to authenticated;
grant insert (para, texto, story_id, post_id) on public.rede_mensagens to authenticated;

drop policy if exists rede_mensagens_ler on public.rede_mensagens;
create policy rede_mensagens_ler on public.rede_mensagens for select to authenticated
  using ((de = auth.uid() or para = auth.uid()) and public.eh_nanico() and public.tem_item('celular'));
drop policy if exists rede_mensagens_criar on public.rede_mensagens;
create policy rede_mensagens_criar on public.rede_mensagens for insert to authenticated
  with check (de = auth.uid() and public.eh_nanico() and public.tem_item('celular'));

create or replace function public.rede_mensagem_protecao() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  new.de := auth.uid();
  new.em := now();
  new.lida_em := null;
  new.texto := btrim(regexp_replace(coalesce(new.texto, ''), '[\x00-\x09\x0B-\x1F\x7F]', ' ', 'g'));
  if char_length(new.texto) = 0 and new.post_id is null then
    raise exception 'Escreva a mensagem.' using errcode = 'P0001';
  end if;
  if new.para = new.de then raise exception 'Escolha outro nanico.' using errcode = 'P0001'; end if;
  if not exists (select 1 from public.friends where user_id = new.para) then
    raise exception 'Esse nanico não existe.' using errcode = 'P0001';
  end if;
  perform public.limitar('rede_mensagem', 30, interval '1 minute', 'Calma: mensagens demais em pouco tempo.');
  return new;
end $$;
revoke all on function public.rede_mensagem_protecao() from public, anon, authenticated;
drop trigger if exists rede_mensagem_protecao on public.rede_mensagens;
create trigger rede_mensagem_protecao before insert on public.rede_mensagens for each row execute function public.rede_mensagem_protecao();

-- marca como lidas as mensagens que alguém me mandou
create or replace function public.marcar_lidas(p_de uuid) returns int
language plpgsql security definer set search_path = public as $$
declare
  n int;
begin
  if not public.eh_nanico() or not public.tem_item('celular') then return 0; end if;
  update public.rede_mensagens set lida_em = now() where para = auth.uid() and de = p_de and lida_em is null;
  get diagnostics n = row_count;
  return n;
end $$;
revoke all on function public.marcar_lidas(uuid) from public, anon;
grant execute on function public.marcar_lidas(uuid) to authenticated;

do $$
begin
  begin alter publication supabase_realtime add table public.rede_mensagens; exception when duplicate_object then null; end;
end $$;

-- 36) Bolsa Cassino: quem está com menos de 100 moedas ganha 5.000, uma vez por dia de Brasília --------------------------
--     O site chama pedir_bolsa() ao entrar e depois de cada pulso com o saldo abaixo de 100; quem decide é o banco
--     (saldo de agora e o extrato do dia). O ref é a data, então chamar de novo no mesmo dia não paga.
alter table public.extrato drop constraint if exists extrato_motivo_check;
alter table public.extrato add constraint extrato_motivo_check
  check (motivo in ('inicio', 'diario', 'sequencia', 'online', 'cassino', 'bingo', 'truco', 'aposta', 'loja', 'admin', 'zoeira', 'trofeu', 'churrasco', 'missao', 'bolsa', 'duelo', 'troca', 'mercado'));

-- a bolsa de 03/11/2026 do Abreutz foi paga à mão como 'admin' antes desta seção; vira 'bolsa' para contar como do dia
update public.extrato set motivo = 'bolsa', ref = '2026-11-03' where motivo = 'admin' and ref = 'bolsa:2026-11-03';

create or replace function public.pedir_bolsa() returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_uid   uuid := auth.uid();
  v_hoje  text := public.hoje_br()::text;
  v_saldo int;
begin
  if not public.eh_nanico() then raise exception 'Só nanicos ganham a bolsa.' using errcode = 'P0001'; end if;
  -- duas abas pedindo juntas: a segunda espera e já encontra a bolsa no extrato
  perform pg_advisory_xact_lock(hashtext('bolsa:' || v_uid::text));
  select saldo into v_saldo from public.carteiras where user_id = v_uid;
  if v_saldo is null or v_saldo >= 100
     or exists (select 1 from public.extrato where user_id = v_uid and motivo = 'bolsa' and ref = v_hoje) then
    return jsonb_build_object('ganhou', 0, 'saldo', coalesce(v_saldo, 0));
  end if;
  v_saldo := public.creditar(v_uid, 5000, 'bolsa', v_hoje);
  return jsonb_build_object('ganhou', 5000, 'saldo', v_saldo);
end $$;
revoke all on function public.pedir_bolsa() from public, anon;
grant execute on function public.pedir_bolsa() to authenticated;

-- 37) emblemas novos (03/11/2026, pedido do João): missões, cassino, eventos, bolsa e coleção ----------------------------
--     Substitui a emblemas_de da seção 27 com os 12 de antes e mais 10, tudo contado das tabelas que já existem.
--     As metas estão espelhadas em src/features/emblemas/emblemas.ts (só para mostrar o progresso).
create or replace function public.emblemas_de(p_para uuid) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  v_uid  uuid;
  v_out  jsonb := '[]'::jsonb;
  r      record;
  v_tier text;
begin
  if not public.eh_nanico() then raise exception 'Só nanicos veem os emblemas.' using errcode = 'P0001'; end if;
  select user_id into v_uid from public.friends where id = p_para;
  select upper(coalesce(dados->>'tier', '')) into v_tier from public.jogos_stats where friend_id = p_para and fonte = 'lol';
  for r in
    select * from (values
      ('online',     (select coalesce(sum(minutos), 0) / 60 from public.online_diario where user_id = v_uid), 10, 50, 200),
      ('sequencia',  (select coalesce(max(seq), 0) from public.bonus_diario where user_id = v_uid), 7, 30, 100),
      ('tela',       (select coalesce(sum(tela_min), 0) / 60 from public.online_diario where user_id = v_uid), 1, 10, 50),
      ('coroa',      (select coalesce(sum(chapeu_min), 0) / 60 from public.online_diario where user_id = v_uid), 1, 24, 100),
      ('respeito',   (select count(*)::int from public.respeitos where para = p_para), 10, 50, 200),
      ('elo',        case when v_tier in ('GOLD') then 1 when v_tier in ('PLATINUM', 'EMERALD') then 2
                          when v_tier in ('DIAMOND', 'MASTER', 'GRANDMASTER', 'CHALLENGER') then 3 else 0 end, 1, 2, 3),
      ('cs',         (select coalesce((dados->>'cs2_horas')::int, 0) from public.jogos_stats where friend_id = p_para and fonte = 'steam'), 100, 500, 1000),
      ('trofeu',     (select count(*)::int from public.trofeus_semana where friend_id = p_para and posicao = 1 and trofeu <> 'feeder'), 1, 5, 20),
      ('truco',      (select count(*)::int from public.extrato where user_id = v_uid and motivo = 'truco' and valor > 0), 5, 25, 100),
      ('bingo',      (select count(*)::int from public.bingo_premios where user_id = v_uid and linhas > 0), 1, 10, 50),
      ('cassino',    (select count(*)::int from public.cassino_apostas where user_id = v_uid), 50, 500, 2000),
      ('cronista',   (select count(*)::int from public.phrases where created_by = v_uid), 5, 25, 100),
      -- missões feitas e dias com as 3 (o bônus do dia tem o ref 'dia:bonus')
      ('missao',     (select count(*)::int from public.missoes_dia where user_id = v_uid and feita_em is not null), 10, 50, 200),
      ('perfeito',   (select count(*)::int from public.extrato where user_id = v_uid and motivo = 'missao' and ref like '%:bonus'), 3, 15, 60),
      -- cassino: apostas que pagaram, o maior prêmio de uma aposta só, voos sacados e gols no pênalti
      ('mao',        (select count(*)::int from public.cassino_apostas where user_id = v_uid and pagou > 0), 25, 250, 1000),
      ('tubarao',    (select coalesce(max(pagou), 0) from public.cassino_apostas where user_id = v_uid), 500, 2500, 10000),
      ('aviao',      (select count(*)::int from public.cassino_apostas where user_id = v_uid and jogo = 'aviao' and pagou > 0), 10, 100, 500),
      ('artilheiro', (select coalesce(sum(gols), 0)::int from public.penalti_jogos where user_id = v_uid), 20, 150, 600),
      -- eventos: horas de happy hour e espetinhos pegos no churrasco de sábado
      ('coruja',     (select coalesce(sum(happy_min), 0) / 60 from public.online_diario where user_id = v_uid), 1, 10, 50),
      ('churrasco',  (select count(*)::int from public.extrato where user_id = v_uid and motivo = 'churrasco'), 1, 5, 20),
      -- Bolsas Cassino recebidas (seção 36) e itens diferentes na mochila
      ('fenix',      (select count(*)::int from public.extrato where user_id = v_uid and motivo = 'bolsa'), 1, 5, 15),
      ('colecao',    (select count(*)::int from public.mochila where user_id = v_uid), 5, 12, 20)
    ) as e(id, valor, n1, n2, n3)
  loop
    if coalesce(r.valor, 0) >= r.n1 then
      v_out := v_out || jsonb_build_object('id', r.id, 'valor', r.valor,
                                           'nivel', case when r.valor >= r.n3 then 3 when r.valor >= r.n2 then 2 else 1 end);
    end if;
  end loop;
  return v_out;
end $$;
revoke all on function public.emblemas_de(uuid) from public, anon;
grant execute on function public.emblemas_de(uuid) to authenticated;

-- 38) acessórios na cabeça do boneco: boné, óculos, headset e cartola (espaço 'cabeca') -----------------------------------
--     Equipa como os itens do quarto (um por espaço, pela equipar() da seção 15) e aparece no boneco do K-FOFO e no
--     quarto da ficha; o desenho é do site (features/loja/Acessorio.tsx). Os enfeites dos troféus têm prioridade
--     sobre o que vai no alto da cabeça (só os óculos ficam junto).
alter table public.loja_itens drop constraint if exists loja_itens_espaco_check;
alter table public.loja_itens add constraint loja_itens_espaco_check
  check (espaco in ('cadeira', 'mesa', 'tapete', 'poster', 'planta', 'parede', 'luz', 'titulo', 'moldura', 'escudo', 'consumivel', 'celular', 'cabeca', 'quarto', 'movel', 'efeito', 'chave'));

insert into public.loja_itens (id, nome, descricao, espaco, preco, dados, ordem) values
  ('bone',     'Boné de aba reta',   'O boné de quem joga de top.',               'cabeca', 300,  '{"cor":"bone"}', 120),
  ('oculos',   'Óculos escuros',     'Ninguém percebe que você está tiltado.',    'cabeca', 500,  '{"cor":"oculos"}', 121),
  ('headset',  'Headset gamer',      'Para ouvir os passos no CS.',               'cabeca', 800,  '{"cor":"headset"}', 122),
  ('cartola',  'Cartola do magnata', 'Para quem é dono do cassino.',              'cabeca', 1800, '{"cor":"cartola"}', 123)
on conflict (id) do update set nome = excluded.nome, descricao = excluded.descricao, espaco = excluded.espaco,
  preco = excluded.preco, dados = excluded.dados, ordem = excluded.ordem;

-- 39) amigos dos nanicos (fase 30, 03/11/2026): o Lightzin é o primeiro -------------------------------------------------
--     O amigo ganha uma linha em friends com tipo = 'amigo' (os 14 ficam 'nanico'; quem sai vira 'inativo'). Assim tudo
--     o que usa o friend id (boneco, presença, truco, zoeira, respeitos, ficha, mochila) funciona sem tabela paralela.
--     eh_nanico() passa a exigir tipo = 'nanico' (o padrão fica fechado) e eh_membro() aceita nanico e amigo. Onde o
--     amigo entra, a troca é feita uma por uma, pelas listas abaixo, sobre a definição que já está no banco.
alter table public.friends add column if not exists tipo text not null default 'nanico';
alter table public.friends drop constraint if exists friends_tipo_check;
alter table public.friends add constraint friends_tipo_check check (tipo in ('nanico', 'amigo', 'inativo'));
alter table public.friends add column if not exists convidado_por uuid references public.friends(id);
-- o Lightzin foi criado como nanico provisório (criar_login_nanico) antes desta seção
update public.friends set tipo = 'amigo' where name = 'Lightzin' and tipo = 'nanico';

create or replace function public.eh_nanico() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.friends where user_id = auth.uid() and tipo = 'nanico');
$$;
revoke all on function public.eh_nanico() from public, anon;
grant execute on function public.eh_nanico() to authenticated;

create or replace function public.eh_membro() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.friends where user_id = auth.uid() and tipo in ('nanico', 'amigo'));
$$;
revoke all on function public.eh_membro() from public, anon;
grant execute on function public.eh_membro() to authenticated;

-- onde o amigo entra: funções (moedas, cassino, loja, zoeira, presença, emblemas, rede, missões, atributos só para ver)
-- e políticas (ler friends, salas, chat, tempo real, mídias, rede, loja, truco; ler phrases e game para o Ao vivo).
-- Continuam eh_nanico(): escrever nanicadas, escalação, rodízio (rodizio_linha), bingo, votar e apostas do LoL.
do $$
declare
  v_fn   text;
  v_def  text;
  v_novo text;
  p      record;
  v_q    text;
  v_c    text;
begin
  foreach v_fn in array array[
    'minha_carteira', 'bater_ponto', 'pulso', 'pedir_bolsa', 'churrasco_pegar',
    'cassino_estado', 'trocar_semente', 'apostar_roleta', 'cassino_feed', 'apostar_limbo', 'apostar_dado', 'apostar_slot',
    'apostar_roleta_mesa', 'aviao_decolar', 'aviao_mesa', 'mesa_apostar_roleta', 'mesa_apostar_aviao', 'mesa_sacar_aviao',
    'mesa_estado', 'penalti_comecar', 'penalti_chutar', 'penalti_sacar', 'penalti_estado',
    'comprar', 'equipar', 'usar_item', 'quarto_de',
    'zoar', 'placar_zoeira', 'presenca_de', 'presenca_todos', 'emblemas_de', 'hall_da_fama', 'marcar_lidas',
    'minhas_missoes', 'atributos_de', 'atributos_todos'] loop
    for v_def in select pg_get_functiondef(oid) from pg_proc where pronamespace = 'public'::regnamespace and proname = v_fn loop
      v_novo := replace(v_def, 'eh_nanico()', 'eh_membro()');
      -- missões: o amigo não sorteia as de nanicada, bingo, roleta do rodízio e aposta no LoL
      v_novo := replace(v_novo, 'where fase_ok order by random()',
        'where fase_ok and (public.eh_nanico() or id not in (''nanicada'', ''bingo'', ''roleta'', ''aposta'')) order by random()');
      -- atributos: a lista de todos é só dos 14
      v_novo := replace(v_novo, 'public.atributos_de(f.id)), ''{}''::jsonb) from public.friends f)',
        'public.atributos_de(f.id)), ''{}''::jsonb) from public.friends f where f.tipo = ''nanico'')');
      if v_novo <> v_def then execute v_novo; end if;
    end loop;
  end loop;

  -- ninguém vota em amigo, e o perfil não muda o tipo nem quem convidou
  for v_def in select pg_get_functiondef(oid) from pg_proc
                where pronamespace = 'public'::regnamespace and proname in ('votar_atributos', 'perfil_protecao') loop
    v_novo := replace(v_def, 'select name into v_nome from public.friends where id = p_para;',
                             'select name into v_nome from public.friends where id = p_para and tipo = ''nanico'';');
    if position('new.tipo := old.tipo' in v_novo) = 0 then
      v_novo := replace(v_novo, 'new.username := old.username;',
                                'new.username := old.username; new.tipo := old.tipo; new.convidado_por := old.convidado_por;');
    end if;
    if v_novo <> v_def then execute v_novo; end if;
  end loop;

  for p in select schemaname, tablename, policyname, qual, with_check from pg_policies
            where (schemaname || '.' || tablename || ' :: ' || policyname) in (
              'public.friends :: nanicos leem', 'public.salas :: nanicos veem as salas',
              'public.chat_messages :: nanicos leem o chat', 'public.chat_messages :: nanicos escrevem no chat',
              'realtime.messages :: nanicos entram na sala', 'realtime.messages :: nanicos falam na sala',
              'public.phrases :: nanicos leem', 'public.game :: nanicos leem', 'public.rodizio :: nanicos veem o rodizio',
              'public.carteiras :: nanicos veem as carteiras', 'public.jogos_stats :: nanicos leem os numeros',
              'public.cassino_rolos :: nanicos veem os rolos', 'public.cassino_pagamentos :: nanicos veem os pagamentos',
              'public.cassino_jackpot :: nanicos veem o jackpot', 'public.zoeiras :: nanicos veem a zoeira do dia',
              'public.trofeus_semana :: nanicos veem os trofeus', 'public.riot_semana_meta :: nanicos veem a semana',
              'public.loja_itens :: nanicos leem a loja', 'public.mochila :: equipados para todos e a mochila para o dono',
              'public.consumos :: nanicos veem os consumos recentes', 'public.truco_mesas :: truco_mesas_ler',
              'public.missoes_def :: missoes_def_ler', 'storage.objects :: midias_ler', 'storage.objects :: midias_subir',
              'public.midias :: midias_tabela_ler', 'public.midias :: midias_tabela_criar', 'public.perfil_links :: perfil_links_ler',
              'public.mural_links :: mural_ler', 'public.mural_links :: mural_criar', 'public.rede_posts :: rede_posts_ler',
              'public.rede_curtidas :: rede_curtidas_ler', 'public.rede_comentarios :: rede_comentarios_ler',
              'public.rede_stories :: rede_stories_ler', 'public.rede_mensagens :: rede_mensagens_ler',
              'public.rede_mensagens :: rede_mensagens_criar', 'public.respeitos :: respeitos_ler') loop
    v_q := replace(p.qual, 'eh_nanico()', 'eh_membro()');
    v_c := replace(p.with_check, 'eh_nanico()', 'eh_membro()');
    if v_q is distinct from p.qual then
      execute format('alter policy %I on %I.%I using (%s)', p.policyname, p.schemaname, p.tablename, v_q);
    end if;
    if v_c is distinct from p.with_check then
      execute format('alter policy %I on %I.%I with check (%s)', p.policyname, p.schemaname, p.tablename, v_c);
    end if;
  end loop;
end $$;

-- cria o login de um amigo (só o admin, no SQL Editor). Uso:
--   select public.criar_login_amigo('Fulano', 'fulano', 'senha123', (select id from friends where name = 'Felippe'));
create or replace function public.criar_login_amigo(p_nome text, p_usuario text, p_senha text, p_convidou uuid)
returns text language plpgsql security definer set search_path = public, auth, extensions as $$
declare
  v_nome text := btrim(p_nome);
begin
  if v_nome is null or char_length(v_nome) not between 2 and 30 then raise exception 'Nome inválido'; end if;
  if p_convidou is null or not exists (select 1 from public.friends where id = p_convidou and tipo = 'nanico') then
    raise exception 'Quem convidou precisa ser um dos nanicos';
  end if;
  if not exists (select 1 from public.friends where lower(name) = lower(v_nome)) then
    insert into public.friends (name, tipo, convidado_por) values (v_nome, 'amigo', p_convidou);
  else
    update public.friends set tipo = 'amigo', convidado_por = p_convidou
     where lower(name) = lower(v_nome) and user_id is null;
  end if;
  -- o resto (usuário, senha, e-mail interno, troca de senha no primeiro acesso) é o mesmo dos nanicos
  return public.criar_login_nanico(v_nome, p_usuario, p_senha);
end $$;
revoke all on function public.criar_login_amigo(text, text, text, uuid) from public, anon, authenticated;

-- tira o acesso de um amigo sem apagar nada (moedas, mochila e histórico ficam). Uso: select public.desativar_amigo('fulano');
create or replace function public.desativar_amigo(p_usuario text) returns text
language plpgsql security definer set search_path = public as $$
begin
  update public.friends set tipo = 'inativo' where username = lower(btrim(p_usuario)) and tipo = 'amigo';
  if not found then raise exception 'Amigo "%" não encontrado', p_usuario; end if;
  return 'amigo desativado: ' || p_usuario;
end $$;
revoke all on function public.desativar_amigo(text) from public, anon, authenticated;

-- 40) truco valendo moedas e apostas no truco (fase 31, 03/11/2026) ----------------------------------------------------
--     Quem abre a mesa escolhe quanto vale (0, 10, 25, 50 ou 100 por jogador; mora em opcoes.valor e no estado da
--     função). A entrada é cobrada DENTRO do truco_salvar que começa a partida: sem saldo, nada é gravado e ninguém
--     paga; gravar de novo não cobra de novo (o bolo é um por mesa e partida). Quem ganha leva o bolo, sem taxa.
--     Mesa de 0 continua com o +15 (até 3 por dia). Mesa fechada ou esquecida devolve as entradas e as apostas.
--     As apostas na partida (bolo dividido, 5% da casa) ficam em tabelas próprias, separadas das do LoL.
create table if not exists public.truco_bolos (
  mesa      text not null,
  partida   int not null,
  valor     int not null check (valor in (10, 25, 50, 100)),
  jogadores jsonb not null,
  estado    text not null default 'cobrado' check (estado in ('cobrado', 'pago', 'devolvido')),
  criado_em timestamptz not null default now(),
  primary key (mesa, partida)
);
alter table public.truco_bolos enable row level security;
revoke all on public.truco_bolos from public, anon, authenticated;

create table if not exists public.truco_mercados (
  mesa      text not null,
  partida   int not null,
  times     jsonb not null,
  estado    text not null default 'aberto' check (estado in ('aberto', 'fechado', 'pago', 'devolvido')),
  vencedor  int check (vencedor in (0, 1)),
  bolo_0    int not null default 0,
  bolo_1    int not null default 0,
  casa      int not null default 0,
  criado_em timestamptz not null default now(),
  primary key (mesa, partida)
);
alter table public.truco_mercados enable row level security;
revoke all on public.truco_mercados from public, anon, authenticated;
grant select on public.truco_mercados to authenticated;
drop policy if exists truco_mercados_ler on public.truco_mercados;
create policy truco_mercados_ler on public.truco_mercados for select to authenticated using (public.eh_membro());

create table if not exists public.truco_apostas (
  id      bigserial primary key,
  mesa    text not null,
  partida int not null,
  user_id uuid not null references auth.users(id) on delete cascade,
  lado    int not null check (lado in (0, 1)),
  valor   int not null check (valor between 5 and 100),
  pago    int not null default 0,
  em      timestamptz not null default now(),
  unique (mesa, partida, user_id)
);
alter table public.truco_apostas enable row level security;
revoke all on public.truco_apostas from public, anon, authenticated;
grant select on public.truco_apostas to authenticated;
drop policy if exists truco_apostas_ler on public.truco_apostas;
create policy truco_apostas_ler on public.truco_apostas for select to authenticated using (user_id = auth.uid());

do $$
begin
  begin alter publication supabase_realtime add table public.truco_mercados; exception when duplicate_object then null; end;
  begin alter publication supabase_realtime add table public.truco_apostas; exception when duplicate_object then null; end;
end $$;

-- cobra a entrada de cada jogador (jogadores = lugar → user_id). Uma vez só por mesa e partida.
create or replace function public.truco_cobrar(p_mesa text, p_partida int, p_valor int, p_jogadores jsonb)
returns void language plpgsql security definer set search_path = public as $$
declare
  j      record;
  v_nome text;
begin
  if coalesce(p_valor, 0) = 0 then return; end if;
  if p_valor not in (10, 25, 50, 100) then raise exception 'Valor de mesa inválido.' using errcode = 'P0001'; end if;
  insert into public.truco_bolos (mesa, partida, valor, jogadores) values (p_mesa, p_partida, p_valor, p_jogadores)
  on conflict (mesa, partida) do nothing;
  if not found then return; end if;
  for j in select value::uuid as uid from jsonb_each_text(p_jogadores) loop
    if coalesce((select saldo from public.carteiras where user_id = j.uid), 0) < p_valor then
      select name into v_nome from public.friends where user_id = j.uid;
      raise exception '% está sem moedas para esta mesa.', coalesce(v_nome, 'Alguém') using errcode = 'P0001';
    end if;
    perform public.creditar(j.uid, -p_valor, 'truco', p_mesa || ':' || p_partida || ':entrada');
  end loop;
end $$;

-- devolve as entradas e as apostas que ainda não foram pagas (mesa fechada ou esquecida)
create or replace function public.truco_devolver(p_mesa text)
returns void language plpgsql security definer set search_path = public as $$
declare
  b record;
  j record;
  a record;
  m record;
begin
  for b in select * from public.truco_bolos where mesa = p_mesa and estado = 'cobrado' for update loop
    for j in select value::uuid as uid from jsonb_each_text(b.jogadores) loop
      perform public.creditar(j.uid, b.valor, 'truco', p_mesa || ':' || b.partida || ':devolvida');
    end loop;
    update public.truco_bolos set estado = 'devolvido' where mesa = b.mesa and partida = b.partida;
  end loop;
  for m in select * from public.truco_mercados where mesa = p_mesa and estado in ('aberto', 'fechado') for update loop
    for a in select id, user_id, valor from public.truco_apostas where mesa = m.mesa and partida = m.partida loop
      perform public.creditar(a.user_id, a.valor, 'aposta', 'truco:' || p_mesa || ':' || m.partida || ':devolvida');
      update public.truco_apostas set pago = a.valor where id = a.id;
    end loop;
    update public.truco_mercados set estado = 'devolvido' where mesa = m.mesa and partida = m.partida;
  end loop;
end $$;

-- truco_salvar ganha p_cobrar ({partida, valor, jogadores}): a cobrança e a gravação são uma coisa só
drop function if exists public.truco_salvar(text, int, jsonb, jsonb, text, jsonb, uuid, jsonb);
create or replace function public.truco_salvar(p_mesa text, p_versao int, p_estado jsonb, p_publico jsonb, p_fase text, p_maos jsonb, p_user uuid, p_opcoes jsonb default '{}', p_cobrar jsonb default null)
returns boolean language plpgsql security definer set search_path = public as $$
declare
  v_velha text;
begin
  if p_versao = -1 then
    -- mesas esquecidas somem (devolvendo o que estava valendo); as minhas que não estão em jogo também
    for v_velha in select id from public.truco_mesas where atualizada_em < now() - interval '3 hours'
                    or (criada_por = p_user and fase <> 'jogo') loop
      perform public.truco_devolver(v_velha);
      delete from public.truco_mesas where id = v_velha;
    end loop;
    if exists (select 1 from public.truco_mesas where criada_por = p_user) then
      raise exception 'Você já tem uma mesa em jogo.' using errcode = 'P0001';
    end if;
    insert into public.truco_mesas (id, criada_por, opcoes, publico, fase) values (p_mesa, p_user, p_opcoes, p_publico, p_fase);
    insert into public.truco_estado (mesa_id, estado, versao) values (p_mesa, p_estado, 0);
  else
    update public.truco_estado set estado = p_estado, versao = versao + 1 where mesa_id = p_mesa and versao = p_versao;
    if not found then return false; end if;
    update public.truco_mesas set publico = p_publico, fase = p_fase, atualizada_em = now() where id = p_mesa;
    -- começo de partida valendo: sem saldo de alguém, o erro desfaz a gravação inteira
    if p_cobrar is not null then
      perform public.truco_cobrar(p_mesa, (p_cobrar->>'partida')::int, coalesce((p_cobrar->>'valor')::int, 0), p_cobrar->'jogadores');
    end if;
  end if;
  delete from public.truco_maos m where m.mesa_id = p_mesa
     and not exists (select 1 from jsonb_array_elements(p_maos) x where (x->>'lugar')::int = m.lugar and (x->>'user_id')::uuid = m.user_id);
  insert into public.truco_maos (mesa_id, lugar, user_id, cartas, mao_n)
  select p_mesa, (x->>'lugar')::int, (x->>'user_id')::uuid, x->'cartas', (x->>'mao_n')::int from jsonb_array_elements(p_maos) x
  on conflict (mesa_id, lugar) do update set user_id = excluded.user_id, cartas = excluded.cartas, mao_n = excluded.mao_n
   where truco_maos.cartas is distinct from excluded.cartas or truco_maos.mao_n <> excluded.mao_n or truco_maos.user_id <> excluded.user_id;
  return true;
end $$;

create or replace function public.truco_fechar(p_mesa text, p_user uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not exists (select 1 from public.truco_mesas where id = p_mesa and criada_por = p_user) then
    raise exception 'Só quem abriu fecha a mesa.' using errcode = 'P0001';
  end if;
  perform public.truco_devolver(p_mesa);
  delete from public.truco_mesas where id = p_mesa;
end $$;

-- prêmio: mesa valendo paga o bolo (2× o valor a cada vencedor); mesa de 0, o +15 de antes (até 3 por dia)
create or replace function public.truco_premiar(p_mesa text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_e     jsonb;
  v_m     jsonb;
  v_modo  int;
  v_venc  int;
  v_part  int;
  v_ref   text;
  v_uid   uuid;
  v_users uuid[] := '{}';
  v_pagos uuid[] := '{}';
  b       public.truco_bolos%rowtype;
  i       int;
begin
  select estado into v_e from public.truco_estado where mesa_id = p_mesa for update;
  v_m := v_e->'M';
  if v_m is null or v_m->>'fase' <> 'fim' or v_m->'vencedor' is null or jsonb_typeof(v_m->'vencedor') <> 'number' then
    return '[]'::jsonb;
  end if;
  v_modo := (v_m->>'modo')::int;
  v_venc := (v_m->>'vencedor')::int;
  v_part := coalesce((v_e->>'partida')::int, 1);
  for i in 0..v_modo - 1 loop
    v_uid := null;
    select f.user_id into v_uid from public.friends f
     where f.id::text = v_m->'lugares'->i->>'fid' and f.user_id::text = v_m->'lugares'->i->>'key';
    if v_uid is null or v_uid = any(v_users) then return '[]'::jsonb; end if;
    v_users := v_users || v_uid;
  end loop;
  select * into b from public.truco_bolos where mesa = p_mesa and partida = v_part for update;
  if found then
    if b.estado <> 'cobrado' then return '[]'::jsonb; end if;
    for i in 0..v_modo - 1 loop
      continue when i % 2 <> v_venc;
      perform public.creditar(v_users[i + 1], b.valor * 2, 'truco', p_mesa || ':' || v_part || ':premio');
      v_pagos := v_pagos || v_users[i + 1];
    end loop;
    update public.truco_bolos set estado = 'pago' where mesa = p_mesa and partida = v_part;
    return to_jsonb(v_pagos);
  end if;
  v_ref := p_mesa || ':' || v_part;
  for i in 0..v_modo - 1 loop
    continue when i % 2 <> v_venc;
    v_uid := v_users[i + 1];
    continue when exists (select 1 from public.extrato where user_id = v_uid and motivo = 'truco' and ref = v_ref);
    continue when (select count(*) from public.extrato where user_id = v_uid and motivo = 'truco' and valor > 0
                    and coalesce(ref, '') not like '%:devolvida' and coalesce(ref, '') not like '%:premio'
                    and (em at time zone 'America/Sao_Paulo')::date = public.hoje_br()) >= 3;
    perform public.creditar(v_uid, 15, 'truco', v_ref);
    v_pagos := v_pagos || v_uid;
  end loop;
  return to_jsonb(v_pagos);
end $$;

-- mercado de apostas da partida (times = friend id → 0 ou 1)
create or replace function public.truco_mercado_abrir(p_mesa text, p_partida int, p_times jsonb)
returns void language sql security definer set search_path = public as $$
  insert into public.truco_mercados (mesa, partida, times) values (p_mesa, p_partida, p_times) on conflict (mesa, partida) do nothing;
$$;

create or replace function public.truco_mercado_fechar(p_mesa text, p_partida int)
returns void language sql security definer set search_path = public as $$
  update public.truco_mercados set estado = 'fechado' where mesa = p_mesa and partida = p_partida and estado = 'aberto';
$$;

-- a mesma conta do apostas_liquidar do LoL: 5% da casa; um lado vazio (ou sem vencedor) devolve tudo
create or replace function public.truco_mercado_liquidar(p_mesa text, p_partida int, p_vencedor int)
returns text language plpgsql security definer set search_path = public as $$
declare
  m       public.truco_mercados%rowtype;
  a       record;
  v_total int;
  v_casa  int;
  v_bolo  int;
  v_pago  int;
  v_soma  int := 0;
  v_ref   text := 'truco:' || p_mesa || ':' || p_partida;
begin
  select * into m from public.truco_mercados where mesa = p_mesa and partida = p_partida for update;
  if not found then return 'sem_mercado'; end if;
  if m.estado in ('pago', 'devolvido') then return m.estado; end if;
  v_total := m.bolo_0 + m.bolo_1;
  if p_vencedor is null or p_vencedor not in (0, 1) or m.bolo_0 = 0 or m.bolo_1 = 0 then
    for a in select id, user_id, valor from public.truco_apostas where mesa = p_mesa and partida = p_partida order by id loop
      perform public.creditar(a.user_id, a.valor, 'aposta', v_ref || ':devolvida');
      update public.truco_apostas set pago = a.valor where id = a.id;
    end loop;
    update public.truco_mercados set estado = 'devolvido', vencedor = case when p_vencedor in (0, 1) then p_vencedor end
     where mesa = p_mesa and partida = p_partida;
    return 'devolvido';
  end if;
  v_casa := floor(v_total * 0.05);
  v_bolo := case when p_vencedor = 0 then m.bolo_0 else m.bolo_1 end;
  for a in select id, user_id, lado, valor from public.truco_apostas where mesa = p_mesa and partida = p_partida order by id loop
    if a.lado = p_vencedor then
      v_pago := floor((v_total - v_casa)::numeric * a.valor / v_bolo);
      if v_pago > 0 then perform public.creditar(a.user_id, v_pago, 'aposta', v_ref || ':premio'); end if;
    else
      v_pago := 0;
    end if;
    v_soma := v_soma + v_pago;
    update public.truco_apostas set pago = v_pago where id = a.id;
  end loop;
  update public.truco_mercados set estado = 'pago', vencedor = p_vencedor, casa = v_total - v_soma
   where mesa = p_mesa and partida = p_partida;
  return 'pago';
end $$;

-- apostar numa partida de truco: membros; quem joga só aposta no próprio time; uma por pessoa
create or replace function public.apostar_truco(p_mesa text, p_partida int, p_lado int, p_valor int)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  v_fid uuid;
  m     public.truco_mercados%rowtype;
  v_sal int;
begin
  if not public.eh_membro() then raise exception 'Só membros apostam.' using errcode = 'P0001'; end if;
  perform public.limitar('apostar_truco', 10, interval '1 minute', 'Calma: muitas apostas seguidas.');
  if p_lado is null or p_lado not in (0, 1) then raise exception 'Escolha um lado.' using errcode = 'P0001'; end if;
  if p_valor is null or p_valor < 5 or p_valor > 100 then raise exception 'A aposta vai de 5 a 100 moedas.' using errcode = 'P0001'; end if;
  select * into m from public.truco_mercados where mesa = p_mesa and partida = p_partida for update;
  if not found or m.estado <> 'aberto' then raise exception 'As apostas desta partida já fecharam.' using errcode = 'P0001'; end if;
  select id into v_fid from public.friends where user_id = v_uid limit 1;
  if m.times ? v_fid::text and (m.times->>v_fid::text)::int <> p_lado then
    raise exception 'Quem está jogando só aposta no próprio time.' using errcode = 'P0001';
  end if;
  if exists (select 1 from public.truco_apostas where mesa = p_mesa and partida = p_partida and user_id = v_uid) then
    raise exception 'Você já apostou nesta partida.' using errcode = 'P0001';
  end if;
  v_sal := public.creditar(v_uid, -p_valor, 'aposta', 'truco:' || p_mesa || ':' || p_partida);
  insert into public.truco_apostas (mesa, partida, user_id, lado, valor) values (p_mesa, p_partida, v_uid, p_lado, p_valor);
  if p_lado = 0 then update public.truco_mercados set bolo_0 = bolo_0 + p_valor where mesa = p_mesa and partida = p_partida;
  else update public.truco_mercados set bolo_1 = bolo_1 + p_valor where mesa = p_mesa and partida = p_partida; end if;
  return jsonb_build_object('saldo', v_sal);
end $$;

revoke all on function public.truco_cobrar(text, int, int, jsonb) from public, anon, authenticated;
revoke all on function public.truco_devolver(text) from public, anon, authenticated;
revoke all on function public.truco_salvar(text, int, jsonb, jsonb, text, jsonb, uuid, jsonb, jsonb) from public, anon, authenticated;
revoke all on function public.truco_fechar(text, uuid) from public, anon, authenticated;
revoke all on function public.truco_premiar(text) from public, anon, authenticated;
revoke all on function public.truco_mercado_abrir(text, int, jsonb) from public, anon, authenticated;
revoke all on function public.truco_mercado_fechar(text, int) from public, anon, authenticated;
revoke all on function public.truco_mercado_liquidar(text, int, int) from public, anon, authenticated;
grant execute on function public.truco_salvar(text, int, jsonb, jsonb, text, jsonb, uuid, jsonb, jsonb) to service_role;
grant execute on function public.truco_fechar(text, uuid) to service_role;
grant execute on function public.truco_premiar(text) to service_role;
grant execute on function public.truco_mercado_abrir(text, int, jsonb) to service_role;
grant execute on function public.truco_mercado_fechar(text, int) to service_role;
grant execute on function public.truco_mercado_liquidar(text, int, int) to service_role;
revoke all on function public.apostar_truco(text, int, int, int) from public, anon;
grant execute on function public.apostar_truco(text, int, int, int) to authenticated;

-- devoluções não contam como vitória no emblema Truqueiro nem na missão do truco
do $$
declare v_def text; v_novo text;
begin
  for v_def in select pg_get_functiondef(oid) from pg_proc
                where pronamespace = 'public'::regnamespace and proname in ('emblemas_de', 'missao_progresso') loop
    if position(':devolvida' in v_def) = 0 then
      v_novo := replace(v_def, 'motivo = ''truco'' and valor > 0', 'motivo = ''truco'' and valor > 0 and coalesce(ref, '''') not like ''%:devolvida''');
      if v_novo <> v_def then execute v_novo; end if;
    end if;
  end loop;
end $$;

-- 41) emblemas de elo e da GC (fase 33, 03/11/2026) -----------------------------------------------------------------------
--     Substitui a emblemas_de da seção 37 (já com eh_membro da 39 e sem as devoluções do truco da 40):
--     elo: aparece com qualquer tier; o valor é o tier (1 = Ferro … 10 = Desafiante), o desenho é o brasão oficial e o
--          nível só ordena (Ferro a Prata = 1, Ouro a Esmeralda = 2, Diamante para cima = 3). O tier é o mais alto entre
--          a solo/duo e a flex, que a ficha-jogos já guarda nos campos de cima de jogos_stats.
--     gc:  o nível da Gamers Club (jogos_stats fonte 'cs', dados->>'gc'); nível 1 de 1 a 7, 2 de 8 a 14, 3 de 15 a 20.
create or replace function public.emblemas_de(p_para uuid) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  v_uid  uuid;
  v_out  jsonb := '[]'::jsonb;
  r      record;
  v_tier text;
  v_gc   text;
begin
  if not public.eh_membro() then raise exception 'Só nanicos veem os emblemas.' using errcode = 'P0001'; end if;
  select user_id into v_uid from public.friends where id = p_para;
  select upper(coalesce(dados->>'tier', '')) into v_tier from public.jogos_stats where friend_id = p_para and fonte = 'lol';
  select dados->>'gc' into v_gc from public.jogos_stats where friend_id = p_para and fonte = 'cs';
  for r in
    select * from (values
      ('online',     (select coalesce(sum(minutos), 0) / 60 from public.online_diario where user_id = v_uid), 10, 50, 200),
      ('sequencia',  (select coalesce(max(seq), 0) from public.bonus_diario where user_id = v_uid), 7, 30, 100),
      ('tela',       (select coalesce(sum(tela_min), 0) / 60 from public.online_diario where user_id = v_uid), 1, 10, 50),
      ('coroa',      (select coalesce(sum(chapeu_min), 0) / 60 from public.online_diario where user_id = v_uid), 1, 24, 100),
      ('respeito',   (select count(*)::int from public.respeitos where para = p_para), 10, 50, 200),
      ('elo',        coalesce(array_position(array['IRON', 'BRONZE', 'SILVER', 'GOLD', 'PLATINUM', 'EMERALD', 'DIAMOND', 'MASTER', 'GRANDMASTER', 'CHALLENGER'], v_tier), 0), 1, 4, 7),
      ('cs',         (select coalesce((dados->>'cs2_horas')::int, 0) from public.jogos_stats where friend_id = p_para and fonte = 'steam'), 100, 500, 1000),
      ('trofeu',     (select count(*)::int from public.trofeus_semana where friend_id = p_para and posicao = 1 and trofeu <> 'feeder'), 1, 5, 20),
      ('truco',      (select count(*)::int from public.extrato where user_id = v_uid and motivo = 'truco' and valor > 0 and coalesce(ref, '') not like '%:devolvida'), 5, 25, 100),
      ('bingo',      (select count(*)::int from public.bingo_premios where user_id = v_uid and linhas > 0), 1, 10, 50),
      ('cassino',    (select count(*)::int from public.cassino_apostas where user_id = v_uid), 50, 500, 2000),
      ('cronista',   (select count(*)::int from public.phrases where created_by = v_uid), 5, 25, 100),
      ('missao',     (select count(*)::int from public.missoes_dia where user_id = v_uid and feita_em is not null), 10, 50, 200),
      ('perfeito',   (select count(*)::int from public.extrato where user_id = v_uid and motivo = 'missao' and ref like '%:bonus'), 3, 15, 60),
      ('mao',        (select count(*)::int from public.cassino_apostas where user_id = v_uid and pagou > 0), 25, 250, 1000),
      ('tubarao',    (select coalesce(max(pagou), 0) from public.cassino_apostas where user_id = v_uid), 500, 2500, 10000),
      ('aviao',      (select count(*)::int from public.cassino_apostas where user_id = v_uid and jogo = 'aviao' and pagou > 0), 10, 100, 500),
      ('artilheiro', (select coalesce(sum(gols), 0)::int from public.penalti_jogos where user_id = v_uid), 20, 150, 600),
      ('coruja',     (select coalesce(sum(happy_min), 0) / 60 from public.online_diario where user_id = v_uid), 1, 10, 50),
      ('churrasco',  (select count(*)::int from public.extrato where user_id = v_uid and motivo = 'churrasco'), 1, 5, 20),
      ('fenix',      (select count(*)::int from public.extrato where user_id = v_uid and motivo = 'bolsa'), 1, 5, 15),
      ('colecao',    (select count(*)::int from public.mochila where user_id = v_uid), 5, 12, 20),
      ('gc',         case when v_gc ~ '^[0-9]{1,2}$' and v_gc::int between 1 and 20 then v_gc::int else 0 end, 1, 8, 15)
    ) as e(id, valor, n1, n2, n3)
  loop
    if coalesce(r.valor, 0) >= r.n1 then
      v_out := v_out || jsonb_build_object('id', r.id, 'valor', r.valor,
                                           'nivel', case when r.valor >= r.n3 then 3 when r.valor >= r.n2 then 2 else 1 end);
    end if;
  end loop;
  return v_out;
end $$;
revoke all on function public.emblemas_de(uuid) from public, anon;
grant execute on function public.emblemas_de(uuid) to authenticated;

-- 42) quarto próprio, parte 1 (fase 34, 03/11/2026): comprar o quarto e os móveis, e arrumar ------------------------------
--     Três tamanhos de quarto na loja (6×6, 9×9 e 12×12); comprar um maior cobra só a diferença e o mesmo quarto cresce.
--     Móveis (espaço 'movel', e os 7 itens de piso antigos) guardam o piso em dados {w, d} e podem ser comprados até 4
--     vezes. A posição fica em quarto_moveis e só muda pelas RPCs; "cabe" é uma regra só (quarto_cabe), espelhada em
--     src/features/quarto/quarto.ts e conferida pelos dois lados com quarto-cabe.fixture.json.
alter table public.loja_itens drop constraint if exists loja_itens_preco_check;
alter table public.loja_itens add constraint loja_itens_preco_check check (preco between 10 and 10000);
alter table public.loja_itens drop constraint if exists loja_itens_espaco_check;
alter table public.loja_itens add constraint loja_itens_espaco_check
  check (espaco in ('cadeira', 'mesa', 'tapete', 'poster', 'planta', 'parede', 'luz', 'titulo', 'moldura', 'escudo', 'consumivel', 'celular', 'cabeca', 'quarto', 'movel', 'efeito', 'chave'));

insert into public.loja_itens (id, nome, descricao, espaco, preco, dados, ordem) values
  ('quarto-pequeno',     'Quarto pequeno',      'Um quarto só seu, 6×6. Arrume do seu jeito.',          'quarto', 1000, '{"tamanho":6}', 190),
  ('quarto-medio',       'Quarto médio',        'Um quarto de 9×9. Quem já tem um menor paga a diferença.', 'quarto', 3000, '{"tamanho":9}', 191),
  ('quarto-grande',      'Quarto grande',       'Um quarto de 12×12. Quem já tem um menor paga a diferença.', 'quarto', 8000, '{"tamanho":12}', 192),
  ('movel-cama',         'Cama de solteiro',    'Para o cochilo entre uma ranked e outra.',              'movel', 600,  '{"w":1,"d":2,"desenho":"cama"}', 200),
  ('movel-cama-casal',   'Cama de casal',       'Espaçosa, com dois travesseiros.',                       'movel', 1400, '{"w":2,"d":2,"desenho":"cama-casal"}', 201),
  ('movel-sofa',         'Sofá',                'Dois lugares, para assistir a live de alguém.',          'movel', 900,  '{"w":2,"d":1,"desenho":"sofa"}', 202),
  ('movel-poltrona',     'Poltrona',            'Uma poltrona fofa.',                                     'movel', 450,  '{"w":1,"d":1,"desenho":"poltrona"}', 203),
  ('movel-pc',           'Setup gamer',         'Mesa, PC e dois monitores.',                             'movel', 2500, '{"w":2,"d":1,"desenho":"pc"}', 204),
  ('movel-tv',           'TV com rack',         'Uma TV grande em cima do rack.',                         'movel', 1200, '{"w":2,"d":1,"desenho":"tv"}', 205),
  ('movel-estante',      'Estante com troféus', 'Para guardar os troféus da semana.',                     'movel', 500,  '{"w":1,"d":1,"desenho":"estante"}', 206),
  ('movel-frigobar',     'Frigobar',            'A latinha sempre gelada.',                               'movel', 700,  '{"w":1,"d":1,"desenho":"frigobar"}', 207),
  ('movel-mesinha',      'Mesa de centro',      'Para apoiar a pipoca.',                                  'movel', 250,  '{"w":1,"d":1,"desenho":"mesinha"}', 208),
  ('movel-puff',         'Puff',                'Redondo e macio.',                                       'movel', 150,  '{"w":1,"d":1,"desenho":"puff"}', 209),
  ('movel-luminaria',    'Luminária de chão',   'Luz amarelinha para o canto.',                           'movel', 200,  '{"w":1,"d":1,"desenho":"luminaria"}', 210),
  ('movel-guarda-roupa', 'Guarda-roupa',        'Duas portas e muito espaço.',                            'movel', 800,  '{"w":2,"d":1,"desenho":"guarda-roupa"}', 211)
on conflict (id) do update set nome = excluded.nome, descricao = excluded.descricao, espaco = excluded.espaco,
  preco = excluded.preco, dados = excluded.dados, ordem = excluded.ordem;

-- os itens de piso de antes viram móveis (continuam no espaço antigo, para o quarto fixo da ficha)
update public.loja_itens set dados = dados || '{"w":1,"d":1}'::jsonb where id in ('cadeira-gamer', 'cadeira-trono', 'planta-samambaia', 'planta-cacto') and not dados ? 'w';
update public.loja_itens set dados = dados || '{"w":2,"d":1}'::jsonb where id = 'mesa-rgb' and not dados ? 'w';
update public.loja_itens set dados = dados || '{"w":2,"d":2}'::jsonb where id in ('tapete-rift', 'tapete-pelucia') and not dados ? 'w';

create table if not exists public.quartos (
  user_id       uuid primary key references auth.users(id) on delete cascade,
  tamanho       int not null check (tamanho in (6, 9, 12)),
  criado_em     timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);
alter table public.quartos enable row level security;
revoke all on public.quartos from public, anon, authenticated;
grant select on public.quartos to authenticated;
drop policy if exists quartos_ler on public.quartos;
create policy quartos_ler on public.quartos for select to authenticated using (public.eh_membro());

create table if not exists public.quarto_moveis (
  id      bigserial primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  item_id text not null references public.loja_itens(id) on delete cascade,
  i       int not null check (i between 0 and 11),
  j       int not null check (j between 0 and 11),
  giro    boolean not null default false,
  em      timestamptz not null default now()
);
create index if not exists quarto_moveis_dono on public.quarto_moveis (user_id);
alter table public.quarto_moveis enable row level security;
revoke all on public.quarto_moveis from public, anon, authenticated;
grant select on public.quarto_moveis to authenticated;
drop policy if exists quarto_moveis_ler on public.quarto_moveis;
create policy quarto_moveis_ler on public.quarto_moveis for select to authenticated using (public.eh_membro());

do $$
begin
  begin alter publication supabase_realtime add table public.quartos; exception when duplicate_object then null; end;
  begin alter publication supabase_realtime add table public.quarto_moveis; exception when duplicate_object then null; end;
end $$;

-- vai no chão do quarto? (os móveis e os itens de piso antigos, que têm w e d)
create or replace function public.eh_posicionavel(p_item text) returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce((select espaco = 'movel' or dados ? 'w' from public.loja_itens where id = p_item), false);
$$;

-- a regra de "cabe": dentro do quarto, fora da porta (piso 0,0) e sem encostar em cima de outro móvel
create or replace function public.quarto_cabe(p_tam int, p_ocupados jsonb, p_i int, p_j int, p_w int, p_d int)
returns boolean language sql immutable as $$
  select p_i >= 0 and p_j >= 0 and p_w >= 1 and p_d >= 1 and p_i + p_w <= p_tam and p_j + p_d <= p_tam
     and not (p_i = 0 and p_j = 0)
     and not exists (select 1 from jsonb_array_elements(coalesce(p_ocupados, '[]'::jsonb)) o
                      where p_i < (o->>'i')::int + (o->>'w')::int and (o->>'i')::int < p_i + p_w
                        and p_j < (o->>'j')::int + (o->>'d')::int and (o->>'j')::int < p_j + p_d);
$$;

-- os móveis já colocados de alguém, como retângulos (com o giro), menos um (o que está sendo movido)
create or replace function public.quarto_ocupados(p_user uuid, p_ignorar bigint) returns jsonb
language sql stable security definer set search_path = public as $$
  select coalesce(jsonb_agg(jsonb_build_object('i', q.i, 'j', q.j,
           'w', case when q.giro then (l.dados->>'d')::int else (l.dados->>'w')::int end,
           'd', case when q.giro then (l.dados->>'w')::int else (l.dados->>'d')::int end)), '[]'::jsonb)
    from public.quarto_moveis q join public.loja_itens l on l.id = q.item_id
   where q.user_id = p_user and q.id is distinct from p_ignorar;
$$;

-- confere a regra com os mesmos exemplos do site (quarto-cabe.fixture.json); falha se divergir
do $$
declare
  c record;
begin
  for c in select * from jsonb_array_elements(
    -- fixture quarto-cabe (início)
    '[{"tam":6,"ocupados":[],"i":1,"j":1,"w":2,"d":1,"cabe":true},{"tam":6,"ocupados":[],"i":0,"j":0,"w":1,"d":1,"cabe":false},{"tam":6,"ocupados":[],"i":0,"j":1,"w":1,"d":2,"cabe":true},{"tam":6,"ocupados":[],"i":5,"j":5,"w":2,"d":1,"cabe":false},{"tam":6,"ocupados":[],"i":-1,"j":2,"w":1,"d":1,"cabe":false},{"tam":6,"ocupados":[{"i":2,"j":2,"w":2,"d":2}],"i":3,"j":3,"w":1,"d":1,"cabe":false},{"tam":6,"ocupados":[{"i":2,"j":2,"w":2,"d":2}],"i":4,"j":2,"w":1,"d":2,"cabe":true},{"tam":9,"ocupados":[{"i":0,"j":1,"w":1,"d":2}],"i":0,"j":3,"w":1,"d":1,"cabe":true},{"tam":12,"ocupados":[],"i":10,"j":11,"w":2,"d":1,"cabe":true},{"tam":12,"ocupados":[],"i":11,"j":11,"w":2,"d":1,"cabe":false}]'::jsonb
    -- fixture quarto-cabe (fim)
  ) x(v) loop
    if public.quarto_cabe((c.v->>'tam')::int, c.v->'ocupados', (c.v->>'i')::int, (c.v->>'j')::int, (c.v->>'w')::int, (c.v->>'d')::int)
       <> (c.v->>'cabe')::boolean then
      raise exception 'quarto_cabe diverge do exemplo %', c.v;
    end if;
  end loop;
end $$;

-- comprar: o quarto cobra só a diferença e cresce; móveis acumulam até 4; o resto como na seção 15
create or replace function public.comprar(p_item text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_uid   uuid := auth.uid();
  v_it    public.loja_itens;
  v_qtd   int;
  v_saldo int;
  v_atual int;
  v_novo  int;
  v_pago  int;
begin
  if not public.eh_membro() then raise exception 'Só nanicos compram na loja.' using errcode = 'P0001'; end if;
  perform public.limitar('loja', 20, interval '1 minute', 'Calma: muitas compras seguidas.');
  select * into v_it from public.loja_itens where id = p_item and ativo;
  if not found then raise exception 'Esse item não está à venda.' using errcode = 'P0001'; end if;
  if v_it.espaco = 'quarto' then
    v_novo := (v_it.dados->>'tamanho')::int;
    select tamanho into v_atual from public.quartos where user_id = v_uid for update;
    if v_atual is not null and v_atual >= v_novo then
      raise exception 'Você já tem um quarto %.', case when v_atual = v_novo then 'desse tamanho' else 'maior' end using errcode = 'P0001';
    end if;
    select preco into v_pago from public.loja_itens where espaco = 'quarto' and (dados->>'tamanho')::int = v_atual;
    v_saldo := public.creditar(v_uid, -(v_it.preco - coalesce(v_pago, 0)), 'loja', p_item);
    insert into public.quartos (user_id, tamanho) values (v_uid, v_novo)
      on conflict (user_id) do update set tamanho = excluded.tamanho, atualizado_em = now();
    insert into public.mochila (user_id, item_id, qtd) values (v_uid, p_item, 1) on conflict (user_id, item_id) do nothing;
    return jsonb_build_object('saldo', v_saldo, 'item', p_item, 'tamanho', v_novo);
  end if;
  select qtd into v_qtd from public.mochila where user_id = v_uid and item_id = p_item for update;
  if public.eh_posicionavel(p_item) then
    if coalesce(v_qtd, 0) >= 4 then raise exception 'Dá para ter no máximo 4 desse móvel.' using errcode = 'P0001'; end if;
  elsif v_it.espaco not in ('escudo', 'consumivel') and coalesce(v_qtd, 0) > 0 then
    raise exception 'Você já tem esse item. Ele está na sua mochila.' using errcode = 'P0001';
  end if;
  if v_it.espaco = 'escudo' and coalesce(v_qtd, 0) >= 3 then
    raise exception 'Dá para guardar no máximo 3 escudos.' using errcode = 'P0001';
  end if;
  if v_it.espaco = 'consumivel' and coalesce(v_qtd, 0) >= 20 then
    raise exception 'A mochila já tem 20 desse. Use antes de comprar mais.' using errcode = 'P0001';
  end if;
  v_saldo := public.creditar(v_uid, -v_it.preco, 'loja', p_item);   -- falha sem saldo e desfaz tudo
  insert into public.mochila (user_id, item_id, qtd) values (v_uid, p_item, 1)
    on conflict (user_id, item_id) do update set qtd = public.mochila.qtd + 1, comprado_em = now();
  return jsonb_build_object('saldo', v_saldo, 'item', p_item);
end $$;

-- pôr, mover e guardar um móvel (só o dono, com quarto e com o móvel na mochila)
create or replace function public.quarto_por(p_item text, p_i int, p_j int, p_giro boolean)
returns bigint language plpgsql security definer set search_path = public as $$
declare
  v_uid  uuid := auth.uid();
  v_tam  int;
  v_qtd  int;
  v_dad  jsonb;
  v_w    int;
  v_d    int;
  v_id   bigint;
begin
  if not public.eh_membro() then raise exception 'Só nanicos arrumam quarto.' using errcode = 'P0001'; end if;
  perform public.limitar('quarto', 60, interval '1 minute', 'Calma: muitas mudanças seguidas no quarto.');
  select tamanho into v_tam from public.quartos where user_id = v_uid for update;
  if v_tam is null then raise exception 'Compre um quarto na Loja primeiro.' using errcode = 'P0001'; end if;
  if not public.eh_posicionavel(p_item) then raise exception 'Esse item não vai no chão do quarto.' using errcode = 'P0001'; end if;
  select m.qtd, l.dados into v_qtd, v_dad from public.mochila m join public.loja_itens l on l.id = m.item_id
   where m.user_id = v_uid and m.item_id = p_item and m.qtd > 0;
  if v_qtd is null then raise exception 'Esse móvel não está na sua mochila.' using errcode = 'P0001'; end if;
  if (select count(*) from public.quarto_moveis where user_id = v_uid and item_id = p_item) >= v_qtd then
    raise exception 'Todos os seus desse móvel já estão no quarto.' using errcode = 'P0001';
  end if;
  v_w := case when p_giro then (v_dad->>'d')::int else (v_dad->>'w')::int end;
  v_d := case when p_giro then (v_dad->>'w')::int else (v_dad->>'d')::int end;
  if not public.quarto_cabe(v_tam, public.quarto_ocupados(v_uid, null), p_i, p_j, v_w, v_d) then
    raise exception 'Não cabe aí.' using errcode = 'P0001';
  end if;
  insert into public.quarto_moveis (user_id, item_id, i, j, giro) values (v_uid, p_item, p_i, p_j, coalesce(p_giro, false)) returning id into v_id;
  return v_id;
end $$;

create or replace function public.quarto_mover(p_id bigint, p_i int, p_j int, p_giro boolean)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  v_tam int;
  v_dad jsonb;
  v_w   int;
  v_d   int;
begin
  if not public.eh_membro() then raise exception 'Só nanicos arrumam quarto.' using errcode = 'P0001'; end if;
  perform public.limitar('quarto', 60, interval '1 minute', 'Calma: muitas mudanças seguidas no quarto.');
  select tamanho into v_tam from public.quartos where user_id = v_uid for update;
  select l.dados into v_dad from public.quarto_moveis q join public.loja_itens l on l.id = q.item_id
   where q.id = p_id and q.user_id = v_uid;
  if v_tam is null or v_dad is null then raise exception 'Esse móvel não está no seu quarto.' using errcode = 'P0001'; end if;
  v_w := case when p_giro then (v_dad->>'d')::int else (v_dad->>'w')::int end;
  v_d := case when p_giro then (v_dad->>'w')::int else (v_dad->>'d')::int end;
  if not public.quarto_cabe(v_tam, public.quarto_ocupados(v_uid, p_id), p_i, p_j, v_w, v_d) then
    raise exception 'Não cabe aí.' using errcode = 'P0001';
  end if;
  update public.quarto_moveis set i = p_i, j = p_j, giro = coalesce(p_giro, false), em = now() where id = p_id and user_id = v_uid;
end $$;

create or replace function public.quarto_guardar(p_id bigint)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.eh_membro() then raise exception 'Só nanicos arrumam quarto.' using errcode = 'P0001'; end if;
  perform public.limitar('quarto', 60, interval '1 minute', 'Calma: muitas mudanças seguidas no quarto.');
  delete from public.quarto_moveis where id = p_id and user_id = auth.uid();
  if not found then raise exception 'Esse móvel não está no seu quarto.' using errcode = 'P0001'; end if;
end $$;

-- quarto_de devolve os equipados, o tamanho e os móveis colocados (o site também lê as tabelas pelo tempo real)
drop function if exists public.quarto_de(uuid);
create or replace function public.quarto_de(p_friend uuid) returns jsonb
language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'equipados', coalesce((select jsonb_agg(jsonb_build_object('item', m.item_id, 'espaco', i.espaco) order by i.ordem)
                             from public.mochila m join public.loja_itens i on i.id = m.item_id
                            where m.user_id = f.user_id and m.equipado), '[]'::jsonb),
    'tamanho', (select tamanho from public.quartos where user_id = f.user_id),
    'moveis', coalesce((select jsonb_agg(jsonb_build_object('id', q.id, 'item', q.item_id, 'i', q.i, 'j', q.j, 'giro', q.giro) order by q.id)
                          from public.quarto_moveis q where q.user_id = f.user_id), '[]'::jsonb))
    from public.friends f
   where f.id = p_friend and public.eh_membro();
$$;

revoke all on function public.eh_posicionavel(text) from public, anon;
grant execute on function public.eh_posicionavel(text) to authenticated;
revoke all on function public.quarto_ocupados(uuid, bigint) from public, anon, authenticated;
revoke all on function public.quarto_por(text, int, int, boolean) from public, anon;
revoke all on function public.quarto_mover(bigint, int, int, boolean) from public, anon;
revoke all on function public.quarto_guardar(bigint) from public, anon;
revoke all on function public.quarto_de(uuid) from public, anon;
grant execute on function public.quarto_por(text, int, int, boolean) to authenticated;
grant execute on function public.quarto_mover(bigint, int, int, boolean) to authenticated;
grant execute on function public.quarto_guardar(bigint) to authenticated;
grant execute on function public.quarto_de(uuid) to authenticated;

-- 43) blackjack ao vivo (03/11/2026): todos na mesma mesa contra o mesmo dealer, como num cassino -----------------------
--   A mesa fica parada até alguém apostar. A primeira aposta abre a rodada com 10 s de apostas (até 5 lugares, de 5 a
--   200 moedas). No fechamento o banco dá as cartas de um sapato de 6 baralhos e cada um joga a sua vez (pedir, parar,
--   dobrar, dividir uma vez) em até 15 s; acabou o tempo, a mão para. Depois o dealer pede até 16 e para em 17 (em
--   todos os 17) e paga: blackjack 3 para 2 (empata com o do dealer), ganhou 1 para 1, empate devolve.
--   Justo: o sapato é embaralhado pelo segredo da rodada (cada carta k vai para a posição de HMAC-SHA256(segredo,
--   "bj:id:k")); o sha256 do segredo (hash) aparece antes de apostar e o segredo sai no fim, para conferir.
--   Sem servidor: bj_estado (o site pergunta toda hora) e as jogadas fazem a mesa andar, com uma trava.
--   Ninguém lê as tabelas direto: só pelas funções. As cartas são públicas (no blackjack todas ficam viradas para cima),
--   menos a segunda do dealer, que bj_estado só mostra quando a vez dele chega.
alter table public.cassino_apostas drop constraint if exists cassino_apostas_jogo_check;
alter table public.cassino_apostas add constraint cassino_apostas_jogo_check
  check (jogo in ('roleta', 'limbo', 'dado', 'slot', 'aviao', 'penalti', 'blackjack')); -- a lista completa

create table if not exists public.bj_rodadas (
  id        bigint generated always as identity primary key,
  abre_em   timestamptz not null default clock_timestamp(),
  fecha_em  timestamptz not null,
  segredo   bytea not null,
  hash      text not null,
  sapato    text[],
  pos       int not null default 0,
  fase      text not null default 'apostas' check (fase in ('apostas', 'jogo', 'fim')),
  vez_ate   timestamptz,
  dealer    text[] not null default '{}',
  fim_em    timestamptz
);
create table if not exists public.bj_maos (
  id        bigint generated always as identity primary key,
  rodada_id bigint not null references public.bj_rodadas(id) on delete cascade,
  user_id   uuid not null references auth.users(id) on delete cascade,
  lugar     int not null check (lugar between 1 and 5),
  mao       int not null default 1 check (mao in (1, 2)),
  ordem     int not null,
  aposta    int not null check (aposta between 5 and 400),
  cartas    text[] not null default '{}',
  estado    text not null default 'aposta' check (estado in ('aposta', 'jogando', 'parou', 'estourou', 'blackjack')),
  dobrou    boolean not null default false,
  pagou     int,
  unique (rodada_id, user_id, mao)
);
create index if not exists bj_maos_rodada on public.bj_maos (rodada_id, ordem);
alter table public.bj_rodadas enable row level security;
alter table public.bj_maos    enable row level security;
revoke all on public.bj_rodadas, public.bj_maos from public, anon, authenticated;

-- pontos de uma mão: Ás vale 11 ou 1, figuras 10
create or replace function public.bj_pontos(p_cartas text[]) returns int
language plpgsql immutable as $$
declare
  c text; v text; t int := 0; ases int := 0;
begin
  foreach c in array coalesce(p_cartas, '{}') loop
    v := left(c, length(c) - 1);
    if v = 'A' then t := t + 11; ases := ases + 1;
    elsif v in ('J', 'Q', 'K', '10') then t := t + 10;
    else t := t + v::int; end if;
  end loop;
  while t > 21 and ases > 0 loop t := t - 10; ases := ases - 1; end loop;
  return t;
end $$;

-- valor para dividir (10, J, Q e K valem igual)
create or replace function public.bj_valor(p_carta text) returns int
language sql immutable as $$
  select case left(p_carta, length(p_carta) - 1) when 'A' then 11 when 'J' then 10 when 'Q' then 10 when 'K' then 10 else left(p_carta, length(p_carta) - 1)::int end;
$$;

-- o sapato da rodada (6 baralhos), embaralhado pelo segredo: a mesma conta que o site refaz para conferir
create or replace function public.bj_sapato(p_segredo bytea, p_id bigint) returns text[]
language sql immutable set search_path = public, extensions as $$
  select array_agg(c order by h)
  from (
    select (array['A','2','3','4','5','6','7','8','9','10','J','Q','K'])[k % 13 + 1] || (array['s','h','d','c'])[(k / 13) % 4 + 1] as c,
           extensions.hmac(convert_to('bj:' || p_id || ':' || k, 'UTF8'), p_segredo, 'sha256') as h
    from generate_series(0, 311) k
  ) x;
$$;
revoke all on function public.bj_sapato(bytea, bigint) from public, anon, authenticated;

-- tira a próxima carta do sapato
create or replace function public.bj_tirar(p_id bigint) returns text
language plpgsql security definer set search_path = public as $$
declare v_c text;
begin
  update public.bj_rodadas set pos = pos + 1 where id = p_id returning sapato[pos] into v_c;
  return v_c;
end $$;
revoke all on function public.bj_tirar(bigint) from public, anon, authenticated;

-- paga a rodada: o dealer joga (pede até 16) e cada mão recebe o que deu
create or replace function public.bj_dealer(p_id bigint) returns void
language plpgsql security definer set search_path = public as $$
declare
  r     public.bj_rodadas;
  m     record;
  v_d   int;
  v_dbj boolean;
  v_p   int;
  v_pg  int;
  v_n   int := 0;
  v_vivo boolean;
begin
  select * into r from public.bj_rodadas where id = p_id for update;
  if r.fase <> 'jogo' then return; end if;
  -- o dealer só tira mais cartas se alguém ainda está no jogo (sem estourar e sem blackjack)
  v_vivo := exists (select 1 from public.bj_maos where rodada_id = r.id and estado = 'parou');
  while v_vivo and public.bj_pontos(r.dealer) < 17 loop
    r.dealer := r.dealer || public.bj_tirar(r.id);
    v_n := v_n + 1;
  end loop;
  v_d := public.bj_pontos(r.dealer);
  v_dbj := v_d = 21 and coalesce(array_length(r.dealer, 1), 0) = 2;
  for m in select * from public.bj_maos where rodada_id = r.id order by ordem loop
    v_p := public.bj_pontos(m.cartas);
    v_pg := case
      when m.estado = 'estourou' then 0
      when m.estado = 'blackjack' then case when v_dbj then m.aposta else floor(m.aposta * 2.5)::int end
      when v_dbj then 0
      when v_d > 21 or v_p > v_d then m.aposta * 2
      when v_p = v_d then m.aposta
      else 0 end;
    update public.bj_maos set pagou = v_pg where id = m.id;
    if v_pg > 0 then perform public.creditar(m.user_id, v_pg, 'cassino', 'blackjack'); end if;
    insert into public.cassino_apostas (user_id, jogo, aposta, escolha, resultado, pagou, hash, nonce)
    values (m.user_id, 'blackjack', m.aposta,
            jsonb_build_object('rodada', r.id, 'mao', m.mao, 'dobrou', m.dobrou),
            jsonb_build_object('cartas', m.cartas, 'pontos', v_p, 'dealer', r.dealer, 'dealer_pontos', v_d, 'estado', m.estado),
            v_pg, r.hash, r.id::int);
  end loop;
  -- a tela mostra o dealer virando as cartas (um pouco por carta) e o resultado por uns segundos
  update public.bj_rodadas set dealer = r.dealer, pos = (select pos from public.bj_rodadas where id = r.id), fase = 'fim', vez_ate = null,
    fim_em = clock_timestamp() + make_interval(secs => 4 + v_n * 0.9) where id = r.id;
end $$;
revoke all on function public.bj_dealer(bigint) from public, anon, authenticated;

-- a mão da vez (a primeira ainda jogando, na ordem dos lugares)
create or replace function public.bj_vez(p_id bigint) returns public.bj_maos
language sql stable security definer set search_path = public as $$
  select * from public.bj_maos where rodada_id = p_id and estado = 'jogando' order by ordem limit 1;
$$;
revoke all on function public.bj_vez(bigint) from public, anon, authenticated;

-- faz a mesa andar: dá as cartas no fechamento, para a mão que estourou o tempo e paga quando ninguém mais joga
create or replace function public.bj_avancar() returns public.bj_rodadas
language plpgsql security definer set search_path = public as $$
declare
  r   public.bj_rodadas;
  m   record;
  v_v public.bj_maos;
  v_c text;
begin
  perform pg_advisory_xact_lock(hashtext('mesa:blackjack'));
  select * into r from public.bj_rodadas order by id desc limit 1;
  if not found then return null; end if;
  if r.fase = 'apostas' and clock_timestamp() >= r.fecha_em then
    if not exists (select 1 from public.bj_maos where rodada_id = r.id) then
      update public.bj_rodadas set fase = 'fim', fim_em = clock_timestamp() where id = r.id returning * into r;
      return r;
    end if;
    update public.bj_rodadas set sapato = public.bj_sapato(r.segredo, r.id), pos = 0 where id = r.id;
    -- uma carta para cada um, uma para o dealer, a segunda para cada um e a segunda do dealer (a escondida)
    for m in select id from public.bj_maos where rodada_id = r.id order by ordem loop
      update public.bj_maos set cartas = array[public.bj_tirar(r.id)] where id = m.id;
    end loop;
    v_c := public.bj_tirar(r.id);
    update public.bj_rodadas set dealer = array[v_c] where id = r.id;
    for m in select id from public.bj_maos where rodada_id = r.id order by ordem loop
      update public.bj_maos set cartas = cartas || public.bj_tirar(r.id) where id = m.id;
    end loop;
    v_c := public.bj_tirar(r.id);
    update public.bj_rodadas set dealer = dealer || v_c, fase = 'jogo',
      vez_ate = clock_timestamp() + interval '15 seconds' where id = r.id;
    update public.bj_maos set estado = case when public.bj_pontos(cartas) = 21 then 'blackjack' else 'jogando' end where rodada_id = r.id;
    select * into r from public.bj_rodadas where id = r.id;
  end if;
  if r.fase = 'jogo' then
    v_v := public.bj_vez(r.id);
    -- acabou o tempo de quem está na vez: a mão para como está
    if v_v.id is not null and clock_timestamp() > r.vez_ate then
      update public.bj_maos set estado = 'parou' where id = v_v.id;
      update public.bj_rodadas set vez_ate = clock_timestamp() + interval '15 seconds' where id = r.id;
      v_v := public.bj_vez(r.id);
    end if;
    if v_v.id is null then perform public.bj_dealer(r.id); end if;
    select * into r from public.bj_rodadas where id = r.id;
  end if;
  return r;
end $$;
revoke all on function public.bj_avancar() from public, anon, authenticated;

-- só para ler o estado: sem a trava enquanto não há o que fazer (apostas abertas, alguém na vez dentro do tempo ou a
-- rodada já paga); senão chama bj_avancar, que trava. bj_apostar e bj_acao continuam passando pela trava.
create or replace function public.bj_olhar() returns public.bj_rodadas
language plpgsql security definer set search_path = public as $$
declare
  r public.bj_rodadas;
begin
  select * into r from public.bj_rodadas order by id desc limit 1;
  if not found then return null; end if;
  if r.fase = 'fim'
     or (r.fase = 'apostas' and clock_timestamp() < r.fecha_em)
     or (r.fase = 'jogo' and r.vez_ate is not null and clock_timestamp() <= r.vez_ate and (public.bj_vez(r.id)).id is not null) then
    return r;
  end if;
  return public.bj_avancar();
end $$;
revoke all on function public.bj_olhar() from public, anon, authenticated;

-- o estado da mesa para a tela (sem o sapato e, até a vez do dealer, sem a segunda carta dele)
create or replace function public.bj_estado() returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  r     public.bj_rodadas;
  v_v   public.bj_maos;
  v_dl  text[];
  v_hist jsonb;
begin
  if not public.eh_membro() then raise exception 'Só nanicos jogam.' using errcode = 'P0001'; end if;
  r := public.bj_olhar();
  -- as últimas somas do dealer (a faixa de histórico da tela)
  v_hist := coalesce((select jsonb_agg(jsonb_build_object('pontos', public.bj_pontos(x.dealer), 'bj', coalesce(array_length(x.dealer, 1), 0) = 2 and public.bj_pontos(x.dealer) = 21) order by x.id desc)
    from (select id, dealer from public.bj_rodadas where fase = 'fim' order by id desc limit 8) x), '[]'::jsonb);
  if r.id is null then return jsonb_build_object('agora', clock_timestamp(), 'rodada', null, 'maos', '[]'::jsonb, 'historico', v_hist); end if;
  v_v := public.bj_vez(r.id);
  v_dl := case when r.fase = 'fim' then r.dealer when r.fase = 'jogo' then r.dealer[1:1] || array['X'] else '{}' end;
  return jsonb_build_object(
    'agora', clock_timestamp(),
    'historico', v_hist,
    'rodada', jsonb_build_object(
      'id', r.id, 'fase', r.fase, 'fecha_em', r.fecha_em, 'vez_ate', r.vez_ate, 'fim_em', r.fim_em, 'hash', r.hash,
      'segredo', case when r.fase = 'fim' then encode(r.segredo, 'hex') end,
      'dealer', to_jsonb(v_dl),
      'dealer_pontos', public.bj_pontos(case when r.fase = 'fim' then r.dealer else r.dealer[1:1] end),
      'vez', v_v.id),
    'maos', coalesce((
      select jsonb_agg(jsonb_build_object('id', m.id, 'user_id', m.user_id, 'lugar', m.lugar, 'mao', m.mao, 'aposta', m.aposta,
        'cartas', to_jsonb(m.cartas), 'pontos', public.bj_pontos(m.cartas), 'estado', m.estado, 'dobrou', m.dobrou, 'pagou', m.pagou) order by m.ordem)
      from public.bj_maos m where m.rodada_id = r.id), '[]'::jsonb));
end $$;
revoke all on function public.bj_estado() from public, anon;
grant execute on function public.bj_estado() to authenticated;

-- apostar (ou trocar a aposta) na rodada aberta; abre uma se a mesa estiver parada
create or replace function public.bj_apostar(p_aposta int) returns jsonb
language plpgsql security definer set search_path = public, extensions as $$
declare
  v_uid uuid := auth.uid();
  r     public.bj_rodadas;
  v_m   public.bj_maos;
  v_l   int;
  v_s   bytea;
begin
  if not public.eh_membro() then raise exception 'Só nanicos jogam.' using errcode = 'P0001'; end if;
  if p_aposta is null or p_aposta not between 5 and 200 then raise exception 'A aposta vai de 5 a 200 moedas.' using errcode = 'P0001'; end if;
  perform public.limitar('cassino', 30, interval '1 minute', 'Calma: muitas apostas seguidas. Espere um pouco.');
  r := public.bj_avancar();
  if r.id is null or (r.fase = 'fim' and clock_timestamp() >= r.fim_em) then
    v_s := extensions.gen_random_bytes(32);
    insert into public.bj_rodadas (fecha_em, segredo, hash)
      values (clock_timestamp() + interval '10 seconds', v_s, encode(extensions.digest(v_s, 'sha256'), 'hex')) returning * into r;
  elsif r.fase <> 'apostas' or clock_timestamp() >= r.fecha_em then
    raise exception 'A rodada já começou. Espere a próxima.' using errcode = 'P0001';
  end if;
  select * into v_m from public.bj_maos where rodada_id = r.id and user_id = v_uid and mao = 1;
  if v_m.id is not null then
    -- trocou a aposta: devolve a antiga e cobra a nova
    perform public.creditar(v_uid, v_m.aposta, 'cassino', 'blackjack');
    perform public.creditar(v_uid, -p_aposta, 'cassino', 'blackjack');
    update public.bj_maos set aposta = p_aposta where id = v_m.id;
  else
    select min(l) into v_l from generate_series(1, 5) l where l not in (select lugar from public.bj_maos where rodada_id = r.id);
    if v_l is null then raise exception 'A mesa está cheia (5 lugares). Espere a próxima rodada.' using errcode = 'P0001'; end if;
    perform public.creditar(v_uid, -p_aposta, 'cassino', 'blackjack');
    insert into public.bj_maos (rodada_id, user_id, lugar, mao, ordem, aposta) values (r.id, v_uid, v_l, 1, v_l * 10 + 1, p_aposta);
  end if;
  return public.bj_estado();
end $$;
revoke all on function public.bj_apostar(int) from public, anon;
grant execute on function public.bj_apostar(int) to authenticated;

-- jogar a vez: pedir, parar, dobrar ou dividir
create or replace function public.bj_acao(p_acao text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  r     public.bj_rodadas;
  v_v   public.bj_maos;
  v_p   int;
  v_c   text;
begin
  if not public.eh_membro() then raise exception 'Só nanicos jogam.' using errcode = 'P0001'; end if;
  if p_acao not in ('pedir', 'parar', 'dobrar', 'dividir') then raise exception 'Jogada desconhecida.' using errcode = 'P0001'; end if;
  r := public.bj_avancar();
  if r.id is null or r.fase <> 'jogo' then raise exception 'Não é hora de jogar.' using errcode = 'P0001'; end if;
  perform pg_advisory_xact_lock(hashtext('mesa:blackjack'));
  v_v := public.bj_vez(r.id);
  if v_v.id is null or v_v.user_id <> v_uid then raise exception 'Não é a sua vez.' using errcode = 'P0001'; end if;
  if p_acao = 'pedir' then
    v_c := public.bj_tirar(r.id);
    v_p := public.bj_pontos(v_v.cartas || v_c);
    update public.bj_maos set cartas = cartas || v_c, estado = case when v_p > 21 then 'estourou' when v_p = 21 then 'parou' else 'jogando' end where id = v_v.id;
  elsif p_acao = 'parar' then
    update public.bj_maos set estado = 'parou' where id = v_v.id;
  elsif p_acao = 'dobrar' then
    if coalesce(array_length(v_v.cartas, 1), 0) <> 2 or v_v.dobrou then raise exception 'Só dá para dobrar com as duas primeiras cartas.' using errcode = 'P0001'; end if;
    perform public.creditar(v_uid, -v_v.aposta, 'cassino', 'blackjack');
    v_c := public.bj_tirar(r.id);
    v_p := public.bj_pontos(v_v.cartas || v_c);
    update public.bj_maos set cartas = cartas || v_c, aposta = aposta * 2, dobrou = true, estado = case when v_p > 21 then 'estourou' else 'parou' end where id = v_v.id;
  else
    if coalesce(array_length(v_v.cartas, 1), 0) <> 2 or v_v.mao <> 1 or public.bj_valor(v_v.cartas[1]) <> public.bj_valor(v_v.cartas[2]) then
      raise exception 'Só dá para dividir duas cartas iguais, uma vez.' using errcode = 'P0001';
    end if;
    perform public.creditar(v_uid, -v_v.aposta, 'cassino', 'blackjack');
    insert into public.bj_maos (rodada_id, user_id, lugar, mao, ordem, aposta, cartas, estado)
      values (r.id, v_uid, v_v.lugar, 2, v_v.ordem + 1, v_v.aposta, array[v_v.cartas[2], public.bj_tirar(r.id)], 'jogando');
    update public.bj_maos set cartas = array[v_v.cartas[1], public.bj_tirar(r.id)] where id = v_v.id;
    -- dividiu ases: uma carta para cada e para (como nos cassinos); 21 depois de dividir não é blackjack
    if left(v_v.cartas[1], length(v_v.cartas[1]) - 1) = 'A' then
      update public.bj_maos set estado = 'parou' where rodada_id = r.id and user_id = v_uid;
    else
      update public.bj_maos set estado = 'parou' where rodada_id = r.id and user_id = v_uid and public.bj_pontos(cartas) = 21;
    end if;
  end if;
  update public.bj_rodadas set vez_ate = clock_timestamp() + interval '15 seconds' where id = r.id;
  if (public.bj_vez(r.id)).id is null then perform public.bj_dealer(r.id); end if;
  return public.bj_estado();
end $$;
revoke all on function public.bj_acao(text) from public, anon;
grant execute on function public.bj_acao(text) to authenticated;

-- 44) pôquer Texas Hold'em entre nanicos (03/11/2026): mesas como as do truco, até 6 lugares --------------------------
--   Alguém abre uma mesa escolhendo os blinds (5/10, 10/20 ou 25/50). Cada um senta levando fichas da carteira (de 20 a
--   100 big blinds) e, ao levantar, o que sobrou volta. Com 2 ou mais sentados, a mão começa sozinha: o botão anda, os
--   blinds saem, 2 cartas para cada um, e as rodadas de aposta (pré-flop, flop, turn e river) com 20 s por jogada (acabou
--   o tempo: passa se puder, senão desiste). All-in com potes paralelos; no showdown vence a melhor mão de 5 das 7 cartas.
--   A casa leva 3% do pote, só se a mão chegou ao flop. O baralho é embaralhado pelo segredo da mão (carta k na posição
--   de HMAC-SHA256(segredo, "pk:id:k")); o hash aparece no começo e o segredo no fim.
--   Ninguém lê as tabelas direto: as cartas de cada um só saem para o dono (pk_estado) e, no showdown, as de quem chegou.
--   Sem servidor: pk_estado (o site pergunta toda hora) e as jogadas fazem a mesa andar, com uma trava por mesa.
create table if not exists public.pk_mesas (
  id         bigint generated always as identity primary key,
  criada_por uuid not null references auth.users(id) on delete cascade,
  blind      int not null check (blind in (10, 20, 50)),
  criada_em  timestamptz not null default clock_timestamp(),
  fechada    boolean not null default false,
  mao_atual  bigint
);
create table if not exists public.pk_lugares (
  mesa_id  bigint not null references public.pk_mesas(id) on delete cascade,
  lugar    int not null check (lugar between 1 and 6),
  user_id  uuid not null references auth.users(id) on delete cascade,
  fichas   int not null check (fichas >= 0),
  sair     boolean not null default false,
  sentou_em timestamptz not null default clock_timestamp(),
  primary key (mesa_id, lugar),
  unique (mesa_id, user_id)
);
-- a última jogada de cada um na rodada (PAGOU 40, AUMENTOU 120…): small, big, passou, pagou, apostou, aumentou, allin, desistiu
alter table public.pk_jog add column if not exists acao text;
alter table public.pk_jog add column if not exists acao_valor int;
-- quantas vezes seguidas o tempo acabou na vez dele (2 = foi embora: levanta no fim da mão)
alter table public.pk_lugares add column if not exists ausente int not null default 0;
create table if not exists public.pk_maos (
  id          bigint generated always as identity primary key,
  mesa_id     bigint not null references public.pk_mesas(id) on delete cascade,
  segredo     bytea not null,
  hash        text not null,
  baralho     text[] not null,
  pos         int not null default 0,
  fase        text not null default 'preflop' check (fase in ('preflop', 'flop', 'turn', 'river', 'fim')),
  mesa_cartas text[] not null default '{}',
  pote        int not null default 0,
  aposta      int not null default 0,
  min_aumento int not null,
  vez         int,
  vez_ate     timestamptz,
  botao       int not null,
  sb          int not null,
  bb          int not null,
  inicio      timestamptz not null default clock_timestamp(),
  fim_em      timestamptz,
  rake        int not null default 0,
  resultado   jsonb
);
create index if not exists pk_maos_mesa on public.pk_maos (mesa_id, id desc);
create table if not exists public.pk_jog (
  mao_id    bigint not null references public.pk_maos(id) on delete cascade,
  lugar     int not null,
  user_id   uuid not null references auth.users(id) on delete cascade,
  cartas    text[] not null default '{}',
  estado    text not null default 'ativo' check (estado in ('ativo', 'desistiu', 'allin')),
  na_rodada int not null default 0,
  total     int not null default 0,
  agiu      boolean not null default false,
  ganhou    int not null default 0,
  primary key (mao_id, lugar)
);
alter table public.pk_mesas   enable row level security;
alter table public.pk_lugares enable row level security;
alter table public.pk_maos    enable row level security;
alter table public.pk_jog     enable row level security;
revoke all on public.pk_mesas, public.pk_lugares, public.pk_maos, public.pk_jog from public, anon, authenticated;

-- valor da carta para o pôquer (2 a 14)
create or replace function public.pk_rank(p_carta text) returns int
language sql immutable as $$
  select case left(p_carta, length(p_carta) - 1) when 'A' then 14 when 'K' then 13 when 'Q' then 12 when 'J' then 11 else left(p_carta, length(p_carta) - 1)::int end;
$$;

-- força de 5 cartas: categoria (0 carta alta … 8 straight flush) e os desempates, num número só (maior = melhor)
create or replace function public.pk_valor5(p_c text[]) returns bigint
language plpgsql immutable as $$
declare
  r int[]; g int[]; n int[]; v_flush boolean; v_seq int := 0; v_cat int; v_t int[]; v_val bigint := 0; i int; k int;
begin
  select array_agg(public.pk_rank(c) order by public.pk_rank(c) desc) into r from unnest(p_c) c;
  v_flush := (select count(distinct right(c, 1)) from unnest(p_c) c) = 1;
  -- grupos: por quantidade (desc) e valor (desc)
  select array_agg(x.rk order by x.qt desc, x.rk desc), array_agg(x.qt order by x.qt desc, x.rk desc) into g, n
    from (select rk, count(*) qt from unnest(r) rk group by rk) x;
  if array_length(g, 1) = 5 then
    if r[1] - r[5] = 4 then v_seq := r[1];
    elsif r[1] = 14 and r[2] = 5 and r[5] = 2 then v_seq := 5; end if;
  end if;
  if v_seq > 0 and v_flush then v_cat := 8; v_t := array[v_seq];
  elsif n[1] = 4 then v_cat := 7; v_t := g;
  elsif n[1] = 3 and n[2] = 2 then v_cat := 6; v_t := g;
  elsif v_flush then v_cat := 5; v_t := r;
  elsif v_seq > 0 then v_cat := 4; v_t := array[v_seq];
  elsif n[1] = 3 then v_cat := 3; v_t := g;
  elsif n[1] = 2 and n[2] = 2 then v_cat := 2; v_t := g;
  elsif n[1] = 2 then v_cat := 1; v_t := g;
  else v_cat := 0; v_t := r; end if;
  v_val := v_cat;
  for i in 1..5 loop
    k := coalesce(v_t[i], 0);
    v_val := v_val * 15 + k;
  end loop;
  return v_val;
end $$;

-- a melhor mão de 5 entre as cartas (5, 6 ou 7)
create or replace function public.pk_melhor(p_c text[]) returns bigint
language plpgsql immutable as $$
declare
  v_n int := coalesce(array_length(p_c, 1), 0); a int; b int; v_m bigint := -1; v_x bigint; v_5 text[]; i int;
begin
  if v_n < 5 then return -1; end if;
  for a in 1..v_n loop
    for b in a..v_n loop
      -- tira as cartas a e b (com a = b, tira uma só: serve para 6 cartas)
      if v_n = 7 and a = b then continue; end if;
      if v_n = 6 and a <> b then continue; end if;
      if v_n = 5 and not (a = 1 and b = 1) then continue; end if;
      v_5 := '{}';
      for i in 1..v_n loop
        if v_n = 5 or (i <> a and i <> b) then v_5 := v_5 || p_c[i]; end if;
      end loop;
      v_x := public.pk_valor5(v_5);
      if v_x > v_m then v_m := v_x; end if;
    end loop;
  end loop;
  return v_m;
end $$;

-- o baralho da mão, embaralhado pelo segredo (a mesma conta que o site refaz para conferir)
create or replace function public.pk_baralho(p_segredo bytea, p_id bigint) returns text[]
language sql immutable set search_path = public, extensions as $$
  select array_agg(c order by h)
  from (
    select (array['A','2','3','4','5','6','7','8','9','10','J','Q','K'])[k % 13 + 1] || (array['s','h','d','c'])[k / 13 + 1] as c,
           extensions.hmac(convert_to('pk:' || p_id || ':' || k, 'UTF8'), p_segredo, 'sha256') as h
    from generate_series(0, 51) k
  ) x;
$$;
revoke all on function public.pk_baralho(bytea, bigint) from public, anon, authenticated;

create or replace function public.pk_tirar(p_mao bigint) returns text
language plpgsql security definer set search_path = public as $$
declare v_c text;
begin
  update public.pk_maos set pos = pos + 1 where id = p_mao returning baralho[pos] into v_c;
  return v_c;
end $$;
revoke all on function public.pk_tirar(bigint) from public, anon, authenticated;

-- o próximo lugar (no sentido do relógio, depois de p_de) com alguém que ainda pode agir na mão
create or replace function public.pk_proximo(p_mao bigint, p_de int) returns int
language sql stable security definer set search_path = public as $$
  select lugar from public.pk_jog where mao_id = p_mao and estado = 'ativo'
  order by (lugar - p_de + 5) % 6 limit 1;
$$;
revoke all on function public.pk_proximo(bigint, int) from public, anon, authenticated;

-- põe fichas do jogador no pote (o que ele tiver, no máximo)
create or replace function public.pk_por(p_mao bigint, p_lugar int, p_valor int) returns int
language plpgsql security definer set search_path = public as $$
declare v_m public.pk_maos; v_f int; v_v int;
begin
  select * into v_m from public.pk_maos where id = p_mao;
  select fichas into v_f from public.pk_lugares where mesa_id = v_m.mesa_id and lugar = p_lugar for update;
  v_v := greatest(0, least(p_valor, v_f));
  update public.pk_lugares set fichas = fichas - v_v where mesa_id = v_m.mesa_id and lugar = p_lugar;
  update public.pk_jog set na_rodada = na_rodada + v_v, total = total + v_v,
    estado = case when v_f - v_v = 0 then 'allin' else estado end where mao_id = p_mao and lugar = p_lugar;
  update public.pk_maos set pote = pote + v_v where id = p_mao;
  return v_v;
end $$;
revoke all on function public.pk_por(bigint, int, int) from public, anon, authenticated;

-- paga a mão: potes paralelos pelo quanto cada um pôs; ganha a melhor mão entre quem não desistiu
create or replace function public.pk_pagar(p_mao bigint) returns void
language plpgsql security definer set search_path = public as $$
declare
  h public.pk_maos; v_niv int; v_ant int := 0; v_parte int; v_rake int; v_melhor bigint; v_gan int[]; v_cada int; v_resto int;
  v_vivos int; v_flop boolean; v_tot_rake int := 0; v_pago int := 0; j record; v_l int;
begin
  select * into h from public.pk_maos where id = p_mao for update;
  if h.fase = 'fim' then return; end if;
  v_vivos := (select count(*) from public.pk_jog where mao_id = p_mao and estado <> 'desistiu');
  v_flop := coalesce(array_length(h.mesa_cartas, 1), 0) >= 3;
  for v_niv in select distinct total from public.pk_jog where mao_id = p_mao and estado <> 'desistiu' and total > 0 order by total loop
    v_parte := (select coalesce(sum(least(total, v_niv) - least(total, v_ant)), 0) from public.pk_jog where mao_id = p_mao);
    if v_parte > 0 then
      -- a casa só leva do que foi disputado: aposta que ninguém pagou volta inteira
      v_rake := case when v_flop and (select count(*) from public.pk_jog where mao_id = p_mao and total > v_ant) >= 2
        then floor(v_parte * 0.03)::int else 0 end;
      v_tot_rake := v_tot_rake + v_rake;
      if v_vivos = 1 then
        select array_agg(lugar) into v_gan from public.pk_jog where mao_id = p_mao and estado <> 'desistiu';
      else
        select max(public.pk_melhor(cartas || h.mesa_cartas)) into v_melhor from public.pk_jog
          where mao_id = p_mao and estado <> 'desistiu' and total >= v_niv;
        -- os vencedores, a partir de quem está depois do botão (o que sobra da divisão vai para o primeiro)
        select array_agg(lugar order by (lugar - h.botao + 5) % 6) into v_gan from public.pk_jog
          where mao_id = p_mao and estado <> 'desistiu' and total >= v_niv and public.pk_melhor(cartas || h.mesa_cartas) = v_melhor;
      end if;
      v_cada := (v_parte - v_rake) / array_length(v_gan, 1);
      v_resto := (v_parte - v_rake) - v_cada * array_length(v_gan, 1);
      foreach v_l in array v_gan loop
        update public.pk_jog set ganhou = ganhou + v_cada + case when v_l = v_gan[1] then v_resto else 0 end where mao_id = p_mao and lugar = v_l;
      end loop;
      v_pago := v_pago + (v_parte - v_rake);
    end if;
    v_ant := v_niv;
  end loop;
  -- sobra (fichas de quem desistiu acima de todo mundo que ficou): vai para quem ganhou o último pote
  if h.pote - v_tot_rake - v_pago > 0 and v_gan is not null then
    update public.pk_jog set ganhou = ganhou + (h.pote - v_tot_rake - v_pago) where mao_id = p_mao and lugar = v_gan[1];
  end if;
  for j in select * from public.pk_jog where mao_id = p_mao and ganhou > 0 loop
    update public.pk_lugares set fichas = fichas + j.ganhou where mesa_id = h.mesa_id and lugar = j.lugar;
  end loop;
  update public.pk_maos set fase = 'fim', vez = null, vez_ate = null, rake = v_tot_rake,
    fim_em = clock_timestamp() + case when v_vivos > 1 then interval '7 seconds' else interval '3 seconds' end,
    resultado = jsonb_build_object('showdown', v_vivos > 1, 'jogadores', (
      select jsonb_agg(jsonb_build_object('lugar', lugar, 'ganhou', ganhou, 'total', total, 'estado', estado,
        'cartas', case when v_vivos > 1 and estado <> 'desistiu' then to_jsonb(cartas) end,
        'valor', case when v_vivos > 1 and estado <> 'desistiu' then public.pk_melhor(cartas || h.mesa_cartas) end) order by lugar)
      from public.pk_jog where mao_id = p_mao))
  where id = p_mao;
end $$;
revoke all on function public.pk_pagar(bigint) from public, anon, authenticated;

-- terminou a rodada de apostas? então vem a próxima carta (ou o showdown). Se só sobrou um, ele leva.
create or replace function public.pk_seguir(p_mao bigint) returns void
language plpgsql security definer set search_path = public as $$
declare
  h public.pk_maos; v_vivos int; v_podem int; v_faltam int; v_blind int; v_c text; v_vez int;
begin
  loop
    select * into h from public.pk_maos where id = p_mao for update;
    if h.fase = 'fim' then return; end if;
    v_vivos := (select count(*) from public.pk_jog where mao_id = p_mao and estado <> 'desistiu');
    if v_vivos <= 1 then perform public.pk_pagar(p_mao); return; end if;
    v_podem := (select count(*) from public.pk_jog where mao_id = p_mao and estado = 'ativo');
    -- quem ainda pode agir e não agiu, ou está devendo
    v_faltam := (select count(*) from public.pk_jog where mao_id = p_mao and estado = 'ativo' and (not agiu or na_rodada < h.aposta));
    -- só um pode agir e já cobriu a aposta (os outros estão all-in): não tem com quem apostar
    if v_faltam > 0 and not (v_podem = 1 and (select na_rodada from public.pk_jog where mao_id = p_mao and estado = 'ativo') >= h.aposta) then
      return;
    end if;
    if h.fase = 'river' then perform public.pk_pagar(p_mao); return; end if;
    select blind into v_blind from public.pk_mesas where id = h.mesa_id;
    if h.fase = 'preflop' then
      v_c := public.pk_tirar(p_mao); h.mesa_cartas := h.mesa_cartas || v_c;
      v_c := public.pk_tirar(p_mao); h.mesa_cartas := h.mesa_cartas || v_c;
      v_c := public.pk_tirar(p_mao); h.mesa_cartas := h.mesa_cartas || v_c;
    else
      v_c := public.pk_tirar(p_mao); h.mesa_cartas := h.mesa_cartas || v_c;
    end if;
    update public.pk_jog set na_rodada = 0, agiu = false,
      acao = case when acao in ('desistiu', 'allin') then acao end, acao_valor = case when acao = 'allin' then acao_valor end where mao_id = p_mao;
    v_vez := public.pk_proximo(p_mao, h.botao);
    update public.pk_maos set mesa_cartas = h.mesa_cartas, aposta = 0, min_aumento = v_blind,
      fase = case h.fase when 'preflop' then 'flop' when 'flop' then 'turn' else 'river' end,
      vez = v_vez, vez_ate = clock_timestamp() + interval '20 seconds'
    where id = p_mao;
    -- com dois ou mais podendo agir, a rodada nova começa; senão (all-in) as cartas saem até o river
    if v_podem >= 2 then return; end if;
  end loop;
end $$;
revoke all on function public.pk_seguir(bigint) from public, anon, authenticated;

-- a jogada de alguém (o banco já conferiu que é a vez dele): desistir, passar, pagar, aumentar (até p_valor na rodada) ou all-in
create or replace function public.pk_fazer(p_mao bigint, p_acao text, p_valor int) returns void
language plpgsql security definer set search_path = public as $$
declare
  h public.pk_maos; j public.pk_jog; v_f int; v_deve int; v_max int; v_alvo int; v_prox int; v_fase text;
begin
  select * into h from public.pk_maos where id = p_mao for update;
  v_fase := h.fase;
  select * into j from public.pk_jog where mao_id = p_mao and lugar = h.vez;
  select fichas into v_f from public.pk_lugares where mesa_id = h.mesa_id and lugar = h.vez;
  v_deve := greatest(0, h.aposta - j.na_rodada);
  v_max := j.na_rodada + v_f;
  if p_acao = 'desistir' then
    update public.pk_jog set estado = 'desistiu', agiu = true, acao = 'desistiu', acao_valor = null where mao_id = p_mao and lugar = j.lugar;
  elsif p_acao = 'passar' then
    if v_deve > 0 then raise exception 'Não dá para passar: tem aposta para pagar.' using errcode = 'P0001'; end if;
    update public.pk_jog set agiu = true, acao = 'passou', acao_valor = null where mao_id = p_mao and lugar = j.lugar;
  elsif p_acao = 'pagar' then
    if v_deve = 0 then raise exception 'Não tem aposta para pagar: é só passar.' using errcode = 'P0001'; end if;
    perform public.pk_por(p_mao, j.lugar, v_deve);
    update public.pk_jog set agiu = true, acao = case when estado = 'allin' then 'allin' else 'pagou' end, acao_valor = na_rodada where mao_id = p_mao and lugar = j.lugar;
  else
    v_alvo := case when p_acao = 'allin' then v_max else p_valor end;
    if v_alvo is null or v_alvo <= h.aposta then
      if p_acao = 'allin' then
        -- all-in sem cobrir a aposta: é pagar com o que tem
        perform public.pk_por(p_mao, j.lugar, v_f);
        update public.pk_jog set agiu = true, acao = 'allin', acao_valor = na_rodada where mao_id = p_mao and lugar = j.lugar;
        v_alvo := null;
      else
        raise exception 'O aumento tem que passar da aposta da mesa.' using errcode = 'P0001';
      end if;
    end if;
    if v_alvo is not null then
      if v_alvo > v_max then raise exception 'Você não tem tudo isso de fichas.' using errcode = 'P0001'; end if;
      if v_alvo < v_max and v_alvo < h.aposta + h.min_aumento then
        raise exception 'O aumento mínimo é para %.', h.aposta + h.min_aumento using errcode = 'P0001';
      end if;
      perform public.pk_por(p_mao, j.lugar, v_alvo - j.na_rodada);
      -- aumentou: todo mundo que ainda pode agir precisa falar de novo
      update public.pk_jog set agiu = false where mao_id = p_mao and estado = 'ativo' and lugar <> j.lugar;
      update public.pk_jog set agiu = true, acao_valor = v_alvo,
        acao = case when estado = 'allin' then 'allin' when h.aposta = 0 then 'apostou' else 'aumentou' end where mao_id = p_mao and lugar = j.lugar;
      update public.pk_maos set min_aumento = greatest(min_aumento, v_alvo - aposta), aposta = v_alvo where id = p_mao;
    end if;
  end if;
  perform public.pk_seguir(p_mao);
  select * into h from public.pk_maos where id = p_mao;
  if h.fase = v_fase and h.vez = j.lugar then
    -- a mesma rodada continua: passa a vez para o próximo
    v_prox := public.pk_proximo(p_mao, j.lugar);
    update public.pk_maos set vez = v_prox, vez_ate = clock_timestamp() + interval '20 seconds' where id = p_mao;
  end if;
end $$;
revoke all on function public.pk_fazer(bigint, text, int) from public, anon, authenticated;

-- começa uma mão nova na mesa, se tiver 2 ou mais com fichas
create or replace function public.pk_iniciar(p_mesa bigint) returns void
language plpgsql security definer set search_path = public, extensions as $$
declare
  m public.pk_mesas; v_ant int; v_lug int[]; v_n int; v_bt int; v_sb int; v_bb int; v_id bigint; v_s bytea; l int; i int; v_c text;
begin
  select * into m from public.pk_mesas where id = p_mesa;
  select array_agg(lugar order by lugar) into v_lug from public.pk_lugares where mesa_id = p_mesa and fichas > 0 and not sair;
  v_n := coalesce(array_length(v_lug, 1), 0);
  if v_n < 2 then update public.pk_mesas set mao_atual = null where id = p_mesa; return; end if;
  select botao into v_ant from public.pk_maos where mesa_id = p_mesa order by id desc limit 1;
  -- o botão anda para o próximo lugar com gente
  select x into v_bt from unnest(v_lug) x order by (x - coalesce(v_ant, 0) + 5) % 6 limit 1;
  if v_n = 2 then
    v_sb := v_bt;
    select x into v_bb from unnest(v_lug) x where x <> v_bt limit 1;
  else
    select x into v_sb from unnest(v_lug) x order by (x - v_bt + 5) % 6 limit 1;
    select x into v_bb from unnest(v_lug) x order by (x - v_sb + 5) % 6 limit 1;
  end if;
  v_s := extensions.gen_random_bytes(32);
  insert into public.pk_maos (mesa_id, segredo, hash, baralho, min_aumento, botao, sb, bb)
    values (p_mesa, v_s, encode(extensions.digest(v_s, 'sha256'), 'hex'), '{}', m.blind, v_bt, v_sb, v_bb) returning id into v_id;
  update public.pk_maos set baralho = public.pk_baralho(v_s, v_id) where id = v_id;
  update public.pk_mesas set mao_atual = v_id where id = p_mesa;
  insert into public.pk_jog (mao_id, lugar, user_id)
    select v_id, lugar, user_id from public.pk_lugares where mesa_id = p_mesa and lugar = any (v_lug);
  -- duas voltas de uma carta, a partir de quem está depois do botão
  for i in 1..2 loop
    for l in select x from unnest(v_lug) x order by (x - v_bt + 5) % 6 loop
      v_c := public.pk_tirar(v_id);
      update public.pk_jog set cartas = cartas || v_c where mao_id = v_id and lugar = l;
    end loop;
  end loop;
  perform public.pk_por(v_id, v_sb, m.blind / 2);
  perform public.pk_por(v_id, v_bb, m.blind);
  update public.pk_jog set acao = case when lugar = v_sb then 'small' else 'big' end, acao_valor = na_rodada where mao_id = v_id and lugar in (v_sb, v_bb);
  update public.pk_maos set aposta = m.blind, vez = public.pk_proximo(v_id, v_bb), vez_ate = clock_timestamp() + interval '20 seconds' where id = v_id;
  -- se os blinds já deixaram todos all-in, as cartas saem sozinhas
  perform public.pk_seguir(v_id);
end $$;
revoke all on function public.pk_iniciar(bigint) from public, anon, authenticated;

-- faz a mesa andar: começa a mão, joga por quem estourou o tempo (ou levantou) e acerta quem saiu
create or replace function public.pk_avancar(p_mesa bigint) returns void
language plpgsql security definer set search_path = public as $$
declare
  m public.pk_mesas; h public.pk_maos; j public.pk_jog; v_sair boolean; l record;
begin
  perform pg_advisory_xact_lock(hashtext('poker:' || p_mesa));
  select * into m from public.pk_mesas where id = p_mesa;
  if not found or m.fechada then return; end if;
  if m.mao_atual is not null then select * into h from public.pk_maos where id = m.mao_atual; end if;
  if h.id is null or (h.fase = 'fim' and clock_timestamp() >= h.fim_em) then
    -- entre uma mão e outra: quem pediu para sair (ou ficou sem fichas) levanta e leva o que tem
    for l in select * from public.pk_lugares where mesa_id = p_mesa and (sair or fichas = 0) loop
      if l.fichas > 0 then perform public.creditar(l.user_id, l.fichas, 'cassino', 'poker'); end if;
      delete from public.pk_lugares where mesa_id = p_mesa and lugar = l.lugar;
    end loop;
    -- todo mundo levantou depois de jogar: a mesa fecha (recém-aberta e vazia, ela espera alguém sentar; a lista
    -- fecha a que ficar 5 min sem ninguém)
    if not exists (select 1 from public.pk_lugares where mesa_id = p_mesa) then
      if m.mao_atual is not null then update public.pk_mesas set fechada = true, mao_atual = null where id = p_mesa; end if;
      return;
    end if;
    perform public.pk_iniciar(p_mesa);
    return;
  end if;
  if h.fase <> 'fim' and h.vez is not null then
    select * into j from public.pk_jog where mao_id = h.id and lugar = h.vez;
    select sair into v_sair from public.pk_lugares where mesa_id = p_mesa and lugar = h.vez;
    if coalesce(v_sair, true) or clock_timestamp() > h.vez_ate then
      -- tempo esgotado (ou levantou): passa se puder, senão desiste; duas vezes seguidas, levanta no fim da mão
      if not coalesce(v_sair, true) then
        update public.pk_lugares set ausente = ausente + 1, sair = (ausente + 1 >= 2) where mesa_id = p_mesa and lugar = h.vez;
      end if;
      perform public.pk_fazer(h.id, case when j.na_rodada >= h.aposta and not coalesce(v_sair, true) then 'passar' else 'desistir' end, null);
    end if;
  end if;
end $$;
revoke all on function public.pk_avancar(bigint) from public, anon, authenticated;

-- o estado da mesa para a tela: as minhas cartas, as de todo mundo só no showdown
create or replace function public.pk_estado(p_mesa bigint) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid(); m public.pk_mesas; h public.pk_maos;
begin
  if not public.eh_membro() then raise exception 'Só nanicos jogam.' using errcode = 'P0001'; end if;
  perform public.pk_avancar(p_mesa);
  select * into m from public.pk_mesas where id = p_mesa;
  if not found then raise exception 'Essa mesa não existe mais.' using errcode = 'P0001'; end if;
  if m.mao_atual is not null then select * into h from public.pk_maos where id = m.mao_atual; end if;
  return jsonb_build_object(
    'agora', clock_timestamp(),
    'mesa', jsonb_build_object('id', m.id, 'blind', m.blind, 'criada_por', m.criada_por, 'fechada', m.fechada),
    'lugares', coalesce((select jsonb_agg(jsonb_build_object('lugar', lugar, 'user_id', user_id, 'fichas', fichas, 'sair', sair) order by lugar)
      from public.pk_lugares where mesa_id = p_mesa), '[]'::jsonb),
    -- as últimas mãos pagas da mesa: quem levou, quanto e com o quê
    'historico', coalesce((select jsonb_agg(jsonb_build_object('id', x.id, 'showdown', coalesce((x.resultado->>'showdown')::boolean, false),
        'ganhadores', (select jsonb_agg(jsonb_build_object('user_id', j.user_id, 'ganhou', j.ganhou,
            'valor', case when (x.resultado->>'showdown')::boolean then public.pk_melhor(j.cartas || x.mesa_cartas) end) order by j.ganhou desc)
          from public.pk_jog j where j.mao_id = x.id and j.ganhou > 0)) order by x.id desc)
      from (select id, resultado, mesa_cartas from public.pk_maos where mesa_id = p_mesa and fase = 'fim' order by id desc limit 6) x), '[]'::jsonb),
    'mao', case when h.id is null then null else jsonb_build_object(
      'id', h.id, 'fase', h.fase, 'mesa_cartas', to_jsonb(h.mesa_cartas), 'pote', h.pote, 'aposta', h.aposta, 'min_aumento', h.min_aumento,
      'vez', h.vez, 'vez_ate', h.vez_ate, 'botao', h.botao, 'sb', h.sb, 'bb', h.bb, 'fim_em', h.fim_em, 'hash', h.hash, 'rake', h.rake,
      'segredo', case when h.fase = 'fim' then encode(h.segredo, 'hex') end,
      'resultado', h.resultado,
      'jogadores', (select jsonb_agg(jsonb_build_object('lugar', lugar, 'user_id', user_id, 'estado', estado, 'na_rodada', na_rodada, 'total', total, 'ganhou', ganhou,
          'acao', acao, 'acao_valor', acao_valor) order by lugar)
        from public.pk_jog where mao_id = h.id),
      'minhas', (select to_jsonb(cartas) from public.pk_jog where mao_id = h.id and user_id = v_uid)) end);
end $$;
revoke all on function public.pk_estado(bigint) from public, anon;
grant execute on function public.pk_estado(bigint) to authenticated;

-- as mesas abertas (salão)
create or replace function public.pk_mesas_lista() returns jsonb
language plpgsql security definer set search_path = public as $$
begin
  if not public.eh_membro() then raise exception 'Só nanicos jogam.' using errcode = 'P0001'; end if;
  -- mesa aberta há 5 min sem ninguém sentado fecha sozinha
  update public.pk_mesas m set fechada = true where not m.fechada and m.criada_em < clock_timestamp() - interval '5 minutes'
    and not exists (select 1 from public.pk_lugares l where l.mesa_id = m.id);
  return coalesce((select jsonb_agg(jsonb_build_object('id', m.id, 'blind', m.blind, 'criada_por', m.criada_por,
      'em_jogo', m.mao_atual is not null,
      'lugares', coalesce((select jsonb_agg(jsonb_build_object('lugar', l.lugar, 'user_id', l.user_id, 'fichas', l.fichas) order by l.lugar)
        from public.pk_lugares l where l.mesa_id = m.id), '[]'::jsonb)) order by m.id)
    from public.pk_mesas m where not m.fechada), '[]'::jsonb);
end $$;
revoke all on function public.pk_mesas_lista() from public, anon;
grant execute on function public.pk_mesas_lista() to authenticated;

-- abrir uma mesa (no máximo 4 abertas; cada um abre uma por vez)
create or replace function public.pk_abrir(p_blind int) returns bigint
language plpgsql security definer set search_path = public as $$
declare v_id bigint;
begin
  if not public.eh_membro() then raise exception 'Só nanicos jogam.' using errcode = 'P0001'; end if;
  if p_blind not in (10, 20, 50) then raise exception 'Os blinds são 5/10, 10/20 ou 25/50.' using errcode = 'P0001'; end if;
  perform public.limitar('poker', 10, interval '1 minute', 'Calma: muitas mesas seguidas.');
  if (select count(*) from public.pk_mesas where not fechada) >= 4 then raise exception 'Já tem 4 mesas abertas: sente numa delas.' using errcode = 'P0001'; end if;
  update public.pk_mesas m set fechada = true where not m.fechada and m.criada_em < clock_timestamp() - interval '5 minutes'
    and not exists (select 1 from public.pk_lugares l where l.mesa_id = m.id);
  if exists (select 1 from public.pk_mesas where not fechada and criada_por = auth.uid()) then raise exception 'Você já tem uma mesa aberta.' using errcode = 'P0001'; end if;
  insert into public.pk_mesas (criada_por, blind) values (auth.uid(), p_blind) returning id into v_id;
  return v_id;
end $$;
revoke all on function public.pk_abrir(int) from public, anon;
grant execute on function public.pk_abrir(int) to authenticated;

-- sentar com fichas da carteira (de 20 a 100 big blinds)
create or replace function public.pk_sentar(p_mesa bigint, p_lugar int, p_fichas int) returns jsonb
language plpgsql security definer set search_path = public as $$
declare v_uid uuid := auth.uid(); m public.pk_mesas;
begin
  if not public.eh_membro() then raise exception 'Só nanicos jogam.' using errcode = 'P0001'; end if;
  perform pg_advisory_xact_lock(hashtext('poker:' || p_mesa));
  select * into m from public.pk_mesas where id = p_mesa;
  if not found or m.fechada then raise exception 'Essa mesa fechou.' using errcode = 'P0001'; end if;
  if p_lugar not between 1 and 6 then raise exception 'Lugar inválido.' using errcode = 'P0001'; end if;
  if p_fichas is null or p_fichas < m.blind * 20 or p_fichas > m.blind * 100 then
    raise exception 'Nesta mesa se senta com % a % fichas.', m.blind * 20, m.blind * 100 using errcode = 'P0001';
  end if;
  if exists (select 1 from public.pk_lugares where mesa_id = p_mesa and user_id = v_uid) then raise exception 'Você já está nesta mesa.' using errcode = 'P0001'; end if;
  if exists (select 1 from public.pk_lugares where mesa_id = p_mesa and lugar = p_lugar) then raise exception 'Esse lugar já tem gente.' using errcode = 'P0001'; end if;
  perform public.creditar(v_uid, -p_fichas, 'cassino', 'poker');
  insert into public.pk_lugares (mesa_id, lugar, user_id, fichas) values (p_mesa, p_lugar, v_uid, p_fichas);
  return public.pk_estado(p_mesa);
end $$;
revoke all on function public.pk_sentar(bigint, int, int) from public, anon;
grant execute on function public.pk_sentar(bigint, int, int) to authenticated;

-- levantar: no meio de uma mão, desiste quando chegar a vez e sai no fim dela; fora da mão, sai na hora com as fichas
create or replace function public.pk_levantar(p_mesa bigint) returns jsonb
language plpgsql security definer set search_path = public as $$
declare v_uid uuid := auth.uid(); m public.pk_mesas; l public.pk_lugares; v_na_mao boolean;
begin
  if not public.eh_membro() then raise exception 'Só nanicos jogam.' using errcode = 'P0001'; end if;
  perform pg_advisory_xact_lock(hashtext('poker:' || p_mesa));
  select * into m from public.pk_mesas where id = p_mesa;
  select * into l from public.pk_lugares where mesa_id = p_mesa and user_id = v_uid;
  if l.lugar is null then raise exception 'Você não está sentado aqui.' using errcode = 'P0001'; end if;
  v_na_mao := exists (select 1 from public.pk_maos h join public.pk_jog j on j.mao_id = h.id
    where h.id = m.mao_atual and h.fase <> 'fim' and j.user_id = v_uid and j.estado <> 'desistiu');
  if v_na_mao then
    update public.pk_lugares set sair = true where mesa_id = p_mesa and lugar = l.lugar;
  else
    if l.fichas > 0 then perform public.creditar(v_uid, l.fichas, 'cassino', 'poker'); end if;
    delete from public.pk_lugares where mesa_id = p_mesa and lugar = l.lugar;
  end if;
  -- mesa vazia fecha sozinha
  if not exists (select 1 from public.pk_lugares where mesa_id = p_mesa) then update public.pk_mesas set fechada = true where id = p_mesa; end if;
  return public.pk_estado(p_mesa);
end $$;
revoke all on function public.pk_levantar(bigint) from public, anon;
grant execute on function public.pk_levantar(bigint) to authenticated;

-- jogar a vez
create or replace function public.pk_acao(p_mesa bigint, p_acao text, p_valor int default null) returns jsonb
language plpgsql security definer set search_path = public as $$
declare v_uid uuid := auth.uid(); m public.pk_mesas; h public.pk_maos; v_u uuid;
begin
  if not public.eh_membro() then raise exception 'Só nanicos jogam.' using errcode = 'P0001'; end if;
  if p_acao not in ('desistir', 'passar', 'pagar', 'aumentar', 'allin') then raise exception 'Jogada desconhecida.' using errcode = 'P0001'; end if;
  perform public.pk_avancar(p_mesa);
  select * into m from public.pk_mesas where id = p_mesa;
  select * into h from public.pk_maos where id = m.mao_atual;
  if h.id is null or h.fase = 'fim' then raise exception 'Não é hora de jogar.' using errcode = 'P0001'; end if;
  select user_id into v_u from public.pk_jog where mao_id = h.id and lugar = h.vez;
  if v_u is distinct from v_uid then raise exception 'Não é a sua vez.' using errcode = 'P0001'; end if;
  update public.pk_lugares set ausente = 0 where mesa_id = p_mesa and lugar = h.vez;
  perform public.pk_fazer(h.id, p_acao, p_valor);
  return public.pk_estado(p_mesa);
end $$;
revoke all on function public.pk_acao(bigint, text, int) from public, anon;
grant execute on function public.pk_acao(bigint, text, int) to authenticated;

-- 45) mais moedas (03/11/2026, pedido do João): as missões pagam cerca de 10 vezes mais (bônus das 3: +250) e o tempo
--     online paga 5 moedas onde pagava 1 (5 a cada 6 minutos; no happy hour, 5 a cada 3). Muda as funções que já estão
--     no banco por troca de texto, como a seção 39, então rodar de novo não muda nada.
alter table public.missoes_def drop constraint if exists missoes_def_valor_check;
alter table public.missoes_def add constraint missoes_def_valor_check check (valor between 1 and 1000);
update public.missoes_def m set valor = v.valor
  from (values ('online30', 100), ('chat5', 100), ('nanicada', 150), ('chinelada', 150), ('torta', 200),
               ('truco', 200), ('bingo', 200), ('roleta', 100), ('aposta', 150)) as v(id, valor)
 where m.id = v.id and m.valor <> v.valor;

do $$
declare
  v_def  text;
  v_novo text;
begin
  for v_def in select pg_get_functiondef(oid) from pg_proc
                where pronamespace = 'public'::regnamespace and proname in ('pulso', 'minhas_missoes') loop
    v_novo := replace(v_def, 'creditar(v_uid, 1, ''online''', 'creditar(v_uid, 5, ''online''');
    v_novo := replace(v_novo, 'v_hgan := v_hgan + 1;', 'v_hgan := v_hgan + 5;');
    v_novo := replace(v_novo, 'creditar(v_uid, 25, ''missao''', 'creditar(v_uid, 250, ''missao''');
    v_novo := replace(v_novo, 'v_ganhou := v_ganhou + 25;', 'v_ganhou := v_ganhou + 250;');
    v_novo := replace(v_novo, '''bonus'', 25,', '''bonus'', 250,');
    if v_novo <> v_def then execute v_novo; end if;
  end loop;
end $$;

-- 46) hall da fama do LoL e do CS2 (03/11/2026, pedido do João): no lugar de Feeder, Turista, Carregou o piano, Viciado
--     e Sumido, a função riot-semana calcula, em cada jogo, quem mais venceu, quem mais perdeu e o melhor KDA (pelo menos
--     3 partidas). O LoL vem da Riot (op.gg) e o CS2 do Leetify. Os troféus antigos ficam na tabela como histórico.
--     1º em vitórias ou em KDA ganha +100; quem mais perdeu leva o chapéu de burro e o melhor KDA a coroa (pulso).
alter table public.trofeus_semana drop constraint if exists trofeus_semana_trofeu_check;
alter table public.trofeus_semana add constraint trofeus_semana_trofeu_check
  check (trofeu in ('feeder', 'turista', 'piano', 'viciado', 'sumido',
                    'lol_vitorias', 'lol_derrotas', 'lol_kda', 'cs_vitorias', 'cs_derrotas', 'cs_kda'));

-- paga os troféus da semana uma vez só (o ref com a semana evita repetir): os novos +100; os antigos como antes
create or replace function public.trofeus_pagar(p_semana date) returns int
language plpgsql security definer set search_path = public as $$
declare
  r record;
  v_ref text;
  v_n int := 0;
begin
  for r in select t.trofeu, f.user_id from public.trofeus_semana t join public.friends f on f.id = t.friend_id
            where t.semana = p_semana and t.posicao = 1 and f.user_id is not null
              and t.trofeu in ('piano', 'viciado', 'lol_vitorias', 'lol_kda', 'cs_vitorias', 'cs_kda') loop
    v_ref := p_semana::text || ':' || r.trofeu;
    if not exists (select 1 from public.extrato where user_id = r.user_id and motivo = 'trofeu' and ref = v_ref) then
      perform public.creditar(r.user_id, case r.trofeu when 'piano' then 50 when 'viciado' then 20 else 100 end, 'trofeu', v_ref);
      v_n := v_n + 1;
    end if;
  end loop;
  return v_n;
end $$;
revoke all on function public.trofeus_pagar(date) from public, anon, authenticated;
do $$ begin
  if exists (select 1 from pg_roles where rolname = 'service_role') then
    grant execute on function public.trofeus_pagar(date) to service_role;
  end if;
end $$;

-- chapéu e coroa (minutos do emblema, no pulso) e o emblema dos 1º lugares (quem mais perdeu não conta)
do $$
declare
  v_def  text;
  v_novo text;
begin
  for v_def in select pg_get_functiondef(oid) from pg_proc
                where pronamespace = 'public'::regnamespace and proname in ('pulso', 'emblemas_de') loop
    v_novo := replace(v_def, 't.trofeu in (''feeder'', ''piano'')',
                             't.trofeu in (''feeder'', ''piano'', ''lol_derrotas'', ''lol_kda'', ''cs_derrotas'', ''cs_kda'')');
    v_novo := replace(v_novo, 'trofeu <> ''feeder''', 'trofeu not in (''feeder'', ''lol_derrotas'', ''cs_derrotas'')');
    if v_novo <> v_def then execute v_novo; end if;
  end loop;
end $$;

-- a última semana pronta é calculada de novo com os troféus novos (só enquanto ainda não existe nenhum troféu novo)
do $$
declare
  v_sem date := (select max(semana) from public.riot_semana_meta);
begin
  if v_sem is not null and not exists (select 1 from public.trofeus_semana where trofeu like 'lol\_%' or trofeu like 'cs\_%') then
    delete from public.riot_semana_partidas where semana = v_sem;
    update public.riot_semana_meta set estado = 'parcial', progresso = '{}'::jsonb, erro = null where semana = v_sem;
  end if;
end $$;

-- 47) Banca Nanica (03/11/2026, pedido do João): todo dinheiro perdido no cassino vai para a banca, e o que o cassino
--     paga sai dela. Uma linha só, mantida por um gatilho no extrato: cada linha com motivo 'cassino' (aposta, prêmio,
--     fichas do pôquer) mexe na banca ao contrário do jogador. Começa com o saldo de tudo que já foi jogado.
--     O pênalti x1 e o truco são entre jogadores (motivos próprios) e não passam pela banca.
create table if not exists public.banca (
  id         int primary key default 1 check (id = 1),
  valor      bigint not null default 0,
  atualizada timestamptz not null default now()
);
alter table public.banca enable row level security;
revoke all on public.banca from public, anon, authenticated;
grant select on public.banca to authenticated;
drop policy if exists banca_ler on public.banca;
create policy banca_ler on public.banca for select to authenticated using (public.eh_membro());
insert into public.banca (id, valor)
  select 1, coalesce(-sum(valor), 0) from public.extrato where motivo = 'cassino'
on conflict (id) do nothing;

create or replace function public.banca_extrato() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.motivo = 'cassino' and new.valor <> 0 then
    update public.banca set valor = valor - new.valor, atualizada = now() where id = 1;
  end if;
  return new;
end $$;
revoke all on function public.banca_extrato() from public, anon, authenticated;
drop trigger if exists banca_extrato on public.extrato;
create trigger banca_extrato after insert on public.extrato for each row execute function public.banca_extrato();

do $$
begin
  begin alter publication supabase_realtime add table public.banca; exception when duplicate_object then null; end;
end $$;

-- 48) pênalti x1 (03/11/2026, pedido do João): duelo de pênaltis entre dois membros, valendo moedas -------------------
--   Alguém abre um duelo com uma aposta (de 10 até o saldo inteiro: all-in vale) e espera. Outro membro com saldo entra
--   e os dois pagam a aposta. Quem abriu pode cancelar antes de alguém entrar (volta tudo); aberto há 10 min sem
--   ninguém, cancela sozinho e devolve (dentro de duelo_estado/duelo_lista, sem servidor rodando o relógio).
--   Disputa: 5 cobranças para cada, alternadas (quem abriu bate primeiro). Em cada uma, quem bate escolhe um canto
--   (esq, dir, meio, sup_esq, sup_dir) e quem defende também, ao mesmo tempo. Só defende se os dois escolherem o mesmo
--   canto. Para antes quando um lado não alcança mais o outro; empatado depois das 5, morte súbita em pares, até 10
--   pares a mais (30 cobranças); se ainda empatar, as duas apostas voltam.
--   Tempo: 15 s por cobrança pelo relógio do banco; quem não escolher a tempo leva um canto sorteado com random().
--   Depois de cada cobrança, 3 s para a tela mostrar o lance antes da próxima abrir (pelos horários, sem laço).
--   Quem vence leva 2× a aposta; não há taxa (é um contra o outro). O dinheiro anda com creditar(..., 'duelo', ...),
--   que não conta como cassino. As escolhas ficam em duelo_chutes, que ninguém lê: só saem quando a cobrança acaba.
alter table public.extrato drop constraint if exists extrato_motivo_check;
alter table public.extrato add constraint extrato_motivo_check
  check (motivo in ('inicio', 'diario', 'sequencia', 'online', 'cassino', 'bingo', 'truco', 'aposta', 'loja', 'admin', 'zoeira', 'trofeu', 'churrasco', 'missao', 'bolsa', 'duelo', 'troca', 'mercado'));

create table if not exists public.duelos (
  id              bigint generated always as identity primary key,
  criador         uuid not null references auth.users(id) on delete cascade,
  desafiante      uuid references auth.users(id) on delete cascade,
  aposta          int not null check (aposta between 10 and 1000000000),
  estado          text not null default 'aberto' check (estado in ('aberto', 'jogando', 'fim', 'cancelado')),
  gols_criador    int not null default 0,
  gols_desafiante int not null default 0,
  vencedor        uuid,
  -- a cobrança da vez (1, 2, …; 0 antes de começar) e o prazo das escolhas dela
  chute           int not null default 0,
  chute_ate       timestamptz,
  criado_em       timestamptz not null default clock_timestamp(),
  comecou_em      timestamptz,
  fim_em          timestamptz,
  check (desafiante is null or desafiante <> criador)
);
create index if not exists duelos_estado on public.duelos (estado, id);
-- um duelo aberto ou em jogo por pessoa (a trava por pessoa das funções cuida de quem aparece nas duas colunas)
create unique index if not exists duelos_um_por_criador on public.duelos (criador) where estado in ('aberto', 'jogando');
create unique index if not exists duelos_um_por_desafiante on public.duelos (desafiante) where estado in ('aberto', 'jogando');

create table if not exists public.duelo_chutes (
  duelo_id        bigint not null references public.duelos(id) on delete cascade,
  n               int not null check (n between 1 and 30),
  batedor         uuid not null,
  goleiro         uuid not null,
  zona_batedor    text check (zona_batedor in ('esq', 'dir', 'meio', 'sup_esq', 'sup_dir')),
  zona_goleiro    text check (zona_goleiro in ('esq', 'dir', 'meio', 'sup_esq', 'sup_dir')),
  -- o canto foi sorteado porque a pessoa não escolheu a tempo
  sorteou_batedor boolean not null default false,
  sorteou_goleiro boolean not null default false,
  gol             boolean,
  abre_em         timestamptz not null,
  ate             timestamptz not null,
  resolvido_em    timestamptz,
  primary key (duelo_id, n)
);
alter table public.duelos       enable row level security;
alter table public.duelo_chutes enable row level security;
revoke all on public.duelos, public.duelo_chutes from public, anon, authenticated;
-- os duelos (sem as escolhas) são públicos para os membros; duelo_chutes não tem política nenhuma: só as funções leem
grant select on public.duelos to authenticated;
drop policy if exists "membros veem os duelos" on public.duelos;
create policy "membros veem os duelos" on public.duelos for select to authenticated using (public.eh_membro());

-- um canto sorteado (para quem deixou o tempo acabar)
create or replace function public.duelo_zona_sorteada() returns text
language sql volatile as $$
  select (array['esq', 'dir', 'meio', 'sup_esq', 'sup_dir'])[1 + floor(random() * 5)::int];
$$;
revoke all on function public.duelo_zona_sorteada() from public, anon, authenticated;

-- depois de p_n cobranças (quem abriu bate as ímpares), o duelo já está decidido? A mesma conta de `decidido` em dueloRegras.ts.
--   Nas 5 de cada: um lado não alcança o outro nem fazendo todas as que faltam. Na morte súbita: só no fim de cada par.
create or replace function public.duelo_decidido(p_n int, p_gc int, p_gd int) returns boolean
language plpgsql immutable as $$
declare
  v_a int := (p_n + 1) / 2;  -- cobranças já batidas por quem abriu
  v_b int := p_n / 2;        -- cobranças já batidas pelo desafiante
begin
  if p_n <= 10 then
    return p_gc + (5 - v_a) < p_gd or p_gd + (5 - v_b) < p_gc;
  end if;
  return p_n % 2 = 0 and p_gc <> p_gd;
end $$;
revoke all on function public.duelo_decidido(int, int, int) from public, anon, authenticated;

-- paga uma vez só: o ref ('duelo:<id>:premio', ':devolvida') já no extrato da pessoa não paga de novo
create or replace function public.duelo_pagar(p_user uuid, p_valor int, p_ref text) returns void
language plpgsql security definer set search_path = public as $$
begin
  if p_user is null or p_valor is null or p_valor <= 0 then return; end if;
  if exists (select 1 from public.extrato where user_id = p_user and motivo = 'duelo' and ref = p_ref) then return; end if;
  perform public.creditar(p_user, p_valor, 'duelo', p_ref);
end $$;
revoke all on function public.duelo_pagar(uuid, int, text) from public, anon, authenticated;

-- faz o duelo andar: cancela o aberto vencido, resolve as cobranças que já podem (as duas escolhas ou o tempo acabou),
-- abre a próxima 3 s depois e paga no fim. Interna, com uma trava por duelo (como mesa_avancar, seção 32).
create or replace function public.duelo_avancar(p_id bigint) returns void
language plpgsql security definer set search_path = public as $$
declare
  d      public.duelos;
  c      public.duelo_chutes;
  v_ag   timestamptz;
  v_res  timestamptz;
  v_zb   text;
  v_zg   text;
  v_gol  boolean;
  v_gc   int;
  v_gd   int;
  v_venc uuid;
  v_k    int := 0;
begin
  perform pg_advisory_xact_lock(hashtext('duelo:' || p_id));
  select * into d from public.duelos where id = p_id for update;
  if not found then return; end if;
  v_ag := clock_timestamp();
  if d.estado = 'aberto' then
    if v_ag >= d.criado_em + interval '10 minutes' then
      update public.duelos set estado = 'cancelado', fim_em = v_ag where id = d.id;
      perform public.duelo_pagar(d.criador, d.aposta, 'duelo:' || d.id || ':devolvida');
    end if;
    return;
  end if;
  if d.estado <> 'jogando' then return; end if;
  -- se ninguém olhou por um tempo, resolve as cobranças atrasadas em sequência (cada uma pelo prazo dela)
  loop
    v_k := v_k + 1;
    exit when v_k > 31;
    select * into c from public.duelo_chutes where duelo_id = d.id and n = d.chute for update;
    exit when not found or c.gol is not null;
    if c.zona_batedor is not null and c.zona_goleiro is not null then
      v_res := least(v_ag, c.ate);
    elsif v_ag >= c.ate then
      v_res := c.ate;
    else
      exit;
    end if;
    v_zb := coalesce(c.zona_batedor, public.duelo_zona_sorteada());
    v_zg := coalesce(c.zona_goleiro, public.duelo_zona_sorteada());
    v_gol := v_zb <> v_zg;
    update public.duelo_chutes
       set zona_batedor = v_zb, zona_goleiro = v_zg,
           sorteou_batedor = (c.zona_batedor is null), sorteou_goleiro = (c.zona_goleiro is null),
           gol = v_gol, resolvido_em = v_res
     where duelo_id = c.duelo_id and n = c.n;
    v_gc := d.gols_criador + case when v_gol and c.batedor = d.criador then 1 else 0 end;
    v_gd := d.gols_desafiante + case when v_gol and c.batedor = d.desafiante then 1 else 0 end;
    if public.duelo_decidido(c.n, v_gc, v_gd) or c.n >= 30 then
      v_venc := case when v_gc > v_gd then d.criador when v_gd > v_gc then d.desafiante end;
      update public.duelos set gols_criador = v_gc, gols_desafiante = v_gd, estado = 'fim', vencedor = v_venc,
             fim_em = v_res, chute_ate = null
       where id = d.id returning * into d;
      if v_venc is not null then
        perform public.duelo_pagar(v_venc, 2 * d.aposta, 'duelo:' || d.id || ':premio');
      else
        perform public.duelo_pagar(d.criador, d.aposta, 'duelo:' || d.id || ':devolvida');
        perform public.duelo_pagar(d.desafiante, d.aposta, 'duelo:' || d.id || ':devolvida');
      end if;
      exit;
    end if;
    -- a próxima: os papéis trocam, abre 3 s depois (o lance na tela) e tem 15 s
    insert into public.duelo_chutes (duelo_id, n, batedor, goleiro, abre_em, ate)
      values (d.id, c.n + 1, c.goleiro, c.batedor, v_res + interval '3 seconds', v_res + interval '18 seconds')
      on conflict (duelo_id, n) do nothing;
    update public.duelos set gols_criador = v_gc, gols_desafiante = v_gd, chute = c.n + 1, chute_ate = v_res + interval '18 seconds'
     where id = d.id returning * into d;
  end loop;
end $$;
revoke all on function public.duelo_avancar(bigint) from public, anon, authenticated;

-- o que a tela mostra: o duelo, as cobranças já resolvidas (com os dois cantos) e a da vez, só com quem já escolheu
-- (e o meu canto, só para mim). Faz o duelo andar antes.
create or replace function public.duelo_estado(p_id bigint) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  d     public.duelos;
  c     public.duelo_chutes;
begin
  if not public.eh_membro() then raise exception 'Só os membros jogam.' using errcode = 'P0001'; end if;
  if p_id is null then raise exception 'Duelo inválido.' using errcode = 'P0001'; end if;
  perform public.duelo_avancar(p_id);
  select * into d from public.duelos where id = p_id;
  if not found then raise exception 'Esse duelo não existe.' using errcode = 'P0001'; end if;
  select * into c from public.duelo_chutes where duelo_id = d.id and n = d.chute and gol is null;
  return jsonb_build_object(
    'id', d.id, 'criador', d.criador, 'desafiante', d.desafiante, 'aposta', d.aposta, 'estado', d.estado,
    'gols_criador', d.gols_criador, 'gols_desafiante', d.gols_desafiante, 'vencedor', d.vencedor,
    'criado_em', d.criado_em, 'expira_em', d.criado_em + interval '10 minutes', 'comecou_em', d.comecou_em, 'fim_em', d.fim_em,
    'agora', clock_timestamp(),
    'chutes', coalesce((select jsonb_agg(jsonb_build_object('n', x.n, 'batedor', x.batedor, 'goleiro', x.goleiro,
        'zona_batedor', x.zona_batedor, 'zona_goleiro', x.zona_goleiro, 'sorteou_batedor', x.sorteou_batedor,
        'sorteou_goleiro', x.sorteou_goleiro, 'gol', x.gol, 'resolvido_em', x.resolvido_em) order by x.n)
      from public.duelo_chutes x where x.duelo_id = d.id and x.gol is not null), '[]'::jsonb),
    'atual', case when c.n is null or d.estado <> 'jogando' then null else jsonb_build_object(
      'n', c.n, 'batedor', c.batedor, 'goleiro', c.goleiro, 'abre_em', c.abre_em, 'ate', c.ate,
      'batedor_escolheu', c.zona_batedor is not null, 'goleiro_escolheu', c.zona_goleiro is not null,
      'minha', case when v_uid = c.batedor then c.zona_batedor when v_uid = c.goleiro then c.zona_goleiro end) end);
end $$;
revoke all on function public.duelo_estado(bigint) from public, anon;
grant execute on function public.duelo_estado(bigint) to authenticated;

-- os duelos abertos e os em jogo (faz cada um andar antes: cancela os vencidos, resolve quem saiu da tela)
create or replace function public.duelo_lista() returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_id bigint;
begin
  if not public.eh_membro() then raise exception 'Só os membros jogam.' using errcode = 'P0001'; end if;
  -- sempre em ordem de id: quem trava mais de um duelo trava na mesma ordem (sem deadlock)
  for v_id in select id from public.duelos where estado in ('aberto', 'jogando') order by id limit 40 loop
    perform public.duelo_avancar(v_id);
  end loop;
  return coalesce((select jsonb_agg(jsonb_build_object('id', x.id, 'criador', x.criador, 'desafiante', x.desafiante,
      'aposta', x.aposta, 'estado', x.estado, 'gols_criador', x.gols_criador, 'gols_desafiante', x.gols_desafiante,
      'chute', x.chute, 'criado_em', x.criado_em, 'expira_em', x.criado_em + interval '10 minutes') order by x.id desc)
    from public.duelos x where x.estado in ('aberto', 'jogando')), '[]'::jsonb);
end $$;
revoke all on function public.duelo_lista() from public, anon;
grant execute on function public.duelo_lista() to authenticated;

-- abre um duelo (cobra a aposta na hora): de 10 até o saldo inteiro
create or replace function public.duelo_abrir(p_aposta int) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  v_ant bigint;
  v_id  bigint;
  v_sal int;
begin
  if not public.eh_membro() then raise exception 'Só os membros jogam.' using errcode = 'P0001'; end if;
  if p_aposta is null or p_aposta < 10 then raise exception 'A aposta mínima é 10 moedas.' using errcode = 'P0001'; end if;
  if p_aposta > 1000000000 then raise exception 'Aposta grande demais.' using errcode = 'P0001'; end if;
  perform public.limitar('duelo', 10, interval '1 minute', 'Calma: muitos duelos seguidos. Espere um pouco.');
  perform pg_advisory_xact_lock(hashtext('duelo-pessoa:' || v_uid));
  -- um duelo meu vencido não pode atrapalhar
  for v_ant in select id from public.duelos where estado in ('aberto', 'jogando') and (criador = v_uid or desafiante = v_uid) order by id loop
    perform public.duelo_avancar(v_ant);
  end loop;
  if exists (select 1 from public.duelos where estado in ('aberto', 'jogando') and (criador = v_uid or desafiante = v_uid)) then
    raise exception 'Você já tem um duelo aberto ou em jogo.' using errcode = 'P0001';
  end if;
  select saldo into v_sal from public.carteiras where user_id = v_uid;
  if coalesce(v_sal, 0) < p_aposta then raise exception 'Você não tem moedas para essa aposta.' using errcode = 'P0001'; end if;
  insert into public.duelos (criador, aposta) values (v_uid, p_aposta) returning id into v_id;
  v_sal := public.creditar(v_uid, -p_aposta, 'duelo', 'duelo:' || v_id || ':entrada');
  return jsonb_build_object('id', v_id, 'saldo', v_sal);
end $$;
revoke all on function public.duelo_abrir(int) from public, anon;
grant execute on function public.duelo_abrir(int) to authenticated;

-- entra num duelo aberto (paga a mesma aposta) e a disputa começa: a 1ª cobrança abre em 3 s.
-- Um duelo aberto meu (sem ninguém) é cancelado e devolvido antes.
create or replace function public.duelo_entrar(p_id bigint) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  v_ant bigint;
  a     record;
  d     public.duelos;
  v_sal int;
  v_ag  timestamptz;
begin
  if not public.eh_membro() then raise exception 'Só os membros jogam.' using errcode = 'P0001'; end if;
  if p_id is null then raise exception 'Duelo inválido.' using errcode = 'P0001'; end if;
  perform public.limitar('duelo', 10, interval '1 minute', 'Calma: muitos duelos seguidos. Espere um pouco.');
  perform pg_advisory_xact_lock(hashtext('duelo-pessoa:' || v_uid));
  for v_ant in select id from public.duelos
      where id = p_id or (estado in ('aberto', 'jogando') and (criador = v_uid or desafiante = v_uid)) order by id loop
    perform public.duelo_avancar(v_ant);
  end loop;
  select * into d from public.duelos where id = p_id for update;
  if not found then raise exception 'Esse duelo não existe.' using errcode = 'P0001'; end if;
  if d.criador = v_uid then raise exception 'Esse duelo é seu: espere alguém entrar.' using errcode = 'P0001'; end if;
  if d.estado <> 'aberto' then raise exception 'Esse duelo já começou ou foi cancelado.' using errcode = 'P0001'; end if;
  if exists (select 1 from public.duelos where estado = 'jogando' and (criador = v_uid or desafiante = v_uid)) then
    raise exception 'Você já está num duelo.' using errcode = 'P0001';
  end if;
  select saldo into v_sal from public.carteiras where user_id = v_uid;
  for a in select id, aposta from public.duelos where criador = v_uid and estado = 'aberto' loop
    v_sal := coalesce(v_sal, 0) + a.aposta;
  end loop;
  if coalesce(v_sal, 0) < d.aposta then raise exception 'Você não tem moedas para esse duelo.' using errcode = 'P0001'; end if;
  for a in select id, aposta from public.duelos where criador = v_uid and estado = 'aberto' order by id loop
    update public.duelos set estado = 'cancelado', fim_em = clock_timestamp() where id = a.id;
    perform public.duelo_pagar(v_uid, a.aposta, 'duelo:' || a.id || ':devolvida');
  end loop;
  perform public.creditar(v_uid, -d.aposta, 'duelo', 'duelo:' || d.id || ':entrada');
  v_ag := clock_timestamp();
  update public.duelos set desafiante = v_uid, estado = 'jogando', comecou_em = v_ag, chute = 1,
         chute_ate = v_ag + interval '18 seconds'
   where id = d.id;
  insert into public.duelo_chutes (duelo_id, n, batedor, goleiro, abre_em, ate)
    values (d.id, 1, d.criador, v_uid, v_ag + interval '3 seconds', v_ag + interval '18 seconds');
  return public.duelo_estado(d.id);
end $$;
revoke all on function public.duelo_entrar(bigint) from public, anon;
grant execute on function public.duelo_entrar(bigint) to authenticated;

-- quem abriu cancela antes de alguém entrar: a aposta volta inteira
create or replace function public.duelo_cancelar(p_id bigint) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  d     public.duelos;
begin
  if not public.eh_membro() then raise exception 'Só os membros jogam.' using errcode = 'P0001'; end if;
  if p_id is null then raise exception 'Duelo inválido.' using errcode = 'P0001'; end if;
  perform public.duelo_avancar(p_id);
  select * into d from public.duelos where id = p_id for update;
  if not found or d.criador <> v_uid then raise exception 'Só quem abriu o duelo pode cancelar.' using errcode = 'P0001'; end if;
  if d.estado = 'aberto' then
    update public.duelos set estado = 'cancelado', fim_em = clock_timestamp() where id = d.id;
    perform public.duelo_pagar(v_uid, d.aposta, 'duelo:' || d.id || ':devolvida');
  elsif d.estado <> 'cancelado' then
    raise exception 'O duelo já começou: não dá mais para cancelar.' using errcode = 'P0001';
  end if;
  return public.duelo_estado(d.id);
end $$;
revoke all on function public.duelo_cancelar(bigint) from public, anon;
grant execute on function public.duelo_cancelar(bigint) to authenticated;

-- a minha escolha na cobrança da vez (bater ou defender, pelo papel): uma vez só, entre a abertura e o prazo
create or replace function public.duelo_escolher(p_id bigint, p_zona text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  d     public.duelos;
  c     public.duelo_chutes;
  v_ag  timestamptz;
begin
  if not public.eh_membro() then raise exception 'Só os membros jogam.' using errcode = 'P0001'; end if;
  if p_id is null then raise exception 'Duelo inválido.' using errcode = 'P0001'; end if;
  if p_zona is null or p_zona not in ('esq', 'dir', 'meio', 'sup_esq', 'sup_dir') then
    raise exception 'Escolha um canto do gol.' using errcode = 'P0001';
  end if;
  perform public.limitar('duelo_chute', 60, interval '1 minute', 'Calma: muitos toques seguidos.');
  perform public.duelo_avancar(p_id);
  select * into d from public.duelos where id = p_id;
  if not found then raise exception 'Esse duelo não existe.' using errcode = 'P0001'; end if;
  if v_uid is distinct from d.criador and v_uid is distinct from d.desafiante then
    raise exception 'Você não está neste duelo.' using errcode = 'P0001';
  end if;
  if d.estado <> 'jogando' then raise exception 'O duelo já acabou.' using errcode = 'P0001'; end if;
  select * into c from public.duelo_chutes where duelo_id = d.id and n = d.chute for update;
  if not found or c.gol is not null then raise exception 'Espere a próxima cobrança.' using errcode = 'P0001'; end if;
  v_ag := clock_timestamp();
  if v_ag < c.abre_em then raise exception 'Espere a próxima cobrança.' using errcode = 'P0001'; end if;
  if v_ag >= c.ate then raise exception 'O tempo desta cobrança acabou.' using errcode = 'P0001'; end if;
  if c.batedor = v_uid then
    if c.zona_batedor is not null then raise exception 'Você já escolheu nesta cobrança.' using errcode = 'P0001'; end if;
    update public.duelo_chutes set zona_batedor = p_zona where duelo_id = c.duelo_id and n = c.n;
  else
    if c.zona_goleiro is not null then raise exception 'Você já escolheu nesta cobrança.' using errcode = 'P0001'; end if;
    update public.duelo_chutes set zona_goleiro = p_zona where duelo_id = c.duelo_id and n = c.n;
  end if;
  -- os dois já escolheram: resolve agora
  perform public.duelo_avancar(p_id);
  return public.duelo_estado(p_id);
end $$;
revoke all on function public.duelo_escolher(bigint, text) from public, anon;
grant execute on function public.duelo_escolher(bigint, text) to authenticated;

-- 49) Mural do K-FOFO (03/11/2026, pedido do João): no lugar do quadro dos troféus, um mural de cortiça onde os nanicos
--     pregam recados livres (até 200 letras, numa nota colorida). Os avisos automáticos (hall da fama, banca, eventos)
--     são montados no site com o que já existe; aqui fica só o que alguém escreveu. Apaga sozinho com 30 dias.
create table if not exists public.mural_recados (
  id      bigint generated always as identity primary key,
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  texto   text not null check (char_length(texto) between 1 and 200),
  cor     text not null default 'amarelo' check (cor in ('amarelo', 'rosa', 'azul', 'verde')),
  em      timestamptz not null default now()
);
create index if not exists mural_recados_em on public.mural_recados (em desc);
alter table public.mural_recados enable row level security;
revoke all on public.mural_recados from public, anon, authenticated;
grant select, delete on public.mural_recados to authenticated;
grant insert (texto, cor) on public.mural_recados to authenticated;
drop policy if exists mural_recados_ler on public.mural_recados;
create policy mural_recados_ler on public.mural_recados for select to authenticated using (public.eh_membro());
drop policy if exists mural_recados_pregar on public.mural_recados;
create policy mural_recados_pregar on public.mural_recados for insert to authenticated
  with check (public.eh_membro() and user_id = auth.uid());
drop policy if exists mural_recados_tirar on public.mural_recados;
create policy mural_recados_tirar on public.mural_recados for delete to authenticated using (user_id = auth.uid());

-- o autor é sempre quem está logado, o texto sai limpo, 10 recados por hora; e o que tem mais de 30 dias some
create or replace function public.mural_recado_protecao() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  new.user_id := auth.uid();
  new.em := now();
  new.texto := btrim(regexp_replace(coalesce(new.texto, ''), '[\x00-\x09\x0B-\x1F\x7F]', ' ', 'g'));
  if new.texto = '' then raise exception 'Escreva alguma coisa no recado.' using errcode = 'P0001'; end if;
  perform public.limitar('mural', 10, interval '1 hour', 'Calma: no máximo 10 recados por hora no mural.');
  delete from public.mural_recados where em < now() - interval '30 days';
  return new;
end $$;
revoke all on function public.mural_recado_protecao() from public, anon, authenticated;
drop trigger if exists mural_recado_protecao on public.mural_recados;
create trigger mural_recado_protecao before insert on public.mural_recados for each row execute function public.mural_recado_protecao();

do $$
begin
  begin alter publication supabase_realtime add table public.mural_recados; exception when duplicate_object then null; end;
end $$;

-- 51) banheiro do K-FOFO (03/11/2026, pedido do João): a porta do banheiro abre uma cena onde os nanicos pixam a parede
--     com o que quiserem (até 60 letras, numa cor de spray). A pixação fica para sempre: ninguém apaga nem edita pelo site
--     (só o admin, no painel). O lugar na parede vem do site (sorteado) e o banco confere os limites. 5 por hora.
create table if not exists public.banheiro_pixacoes (
  id      bigint generated always as identity primary key,
  user_id uuid default auth.uid() references auth.users(id) on delete set null,
  texto   text not null check (char_length(texto) between 1 and 60),
  cor     text not null default 'preto' check (cor in ('preto', 'vermelho', 'azul', 'verde', 'rosa', 'amarelo')),
  parede  text not null check (parede in ('esq', 'dir')),
  a       numeric not null check (a between 0.2 and 4.8),
  z       int not null check (z between 10 and 140),
  rot     int not null default 0 check (rot between -15 and 15),
  em      timestamptz not null default now()
);
alter table public.banheiro_pixacoes enable row level security;
revoke all on public.banheiro_pixacoes from public, anon, authenticated;
grant select on public.banheiro_pixacoes to authenticated;
grant insert (texto, cor, parede, a, z, rot) on public.banheiro_pixacoes to authenticated;
drop policy if exists banheiro_pixacoes_ler on public.banheiro_pixacoes;
create policy banheiro_pixacoes_ler on public.banheiro_pixacoes for select to authenticated using (public.eh_membro());
drop policy if exists banheiro_pixacoes_pixar on public.banheiro_pixacoes;
create policy banheiro_pixacoes_pixar on public.banheiro_pixacoes for insert to authenticated
  with check (public.eh_membro() and user_id = auth.uid());

-- o autor é sempre quem está logado, o texto sai limpo (uma linha só) e são 5 por hora
create or replace function public.banheiro_pixacao_protecao() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  new.user_id := auth.uid();
  new.em := now();
  new.texto := btrim(regexp_replace(coalesce(new.texto, ''), '[\x00-\x1F\x7F]', ' ', 'g'));
  if new.texto = '' then raise exception 'Escreva alguma coisa para pixar.' using errcode = 'P0001'; end if;
  perform public.limitar('pixar', 5, interval '1 hour', 'Calma: no máximo 5 pixações por hora. A tinta acabou.');
  return new;
end $$;
revoke all on function public.banheiro_pixacao_protecao() from public, anon, authenticated;
drop trigger if exists banheiro_pixacao_protecao on public.banheiro_pixacoes;
create trigger banheiro_pixacao_protecao before insert on public.banheiro_pixacoes for each row execute function public.banheiro_pixacao_protecao();

do $$
begin
  begin alter publication supabase_realtime add table public.banheiro_pixacoes; exception when duplicate_object then null; end;
end $$;

-- 50) pênalti x1: ranking e chat (03/11/2026, pedido do João) ---------------------------------------------------------
--   Ranking: duelo_ranking() junta os duelos terminados com vencedor (estado 'fim'; o empate da morte súbita e os
--   cancelados ficam de fora) e devolve, por pessoa, vitórias, derrotas, o saldo (+aposta por vitória, -aposta por
--   derrota) e o maior prêmio (2× a aposta). Ordem: mais vitórias, depois o maior saldo.
--   Chat: duelo_mensagens, as mensagens de cada duelo (até 200 letras). Todo membro lê as de qualquer duelo (a plateia
--   acompanha); só os dois jogadores escrevem, e só com o duelo aberto ou em jogo. Apaga sozinho com 7 dias.
create or replace function public.duelo_ranking() returns jsonb
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.eh_membro() then raise exception 'Só os membros veem o ranking.' using errcode = 'P0001'; end if;
  return coalesce((
    select jsonb_agg(jsonb_build_object('user_id', r.uid, 'vitorias', r.v, 'derrotas', r.d, 'saldo', r.s, 'maior_premio', r.m)
                     order by r.v desc, r.s desc, r.uid)
      from (
        select p.uid,
               (count(*) filter (where p.uid = p.vencedor))::int  as v,
               (count(*) filter (where p.uid <> p.vencedor))::int as d,
               coalesce(sum(case when p.uid = p.vencedor then p.aposta else -p.aposta end), 0)::bigint as s,
               coalesce(max(2 * p.aposta) filter (where p.uid = p.vencedor), 0)::bigint as m
          from (
            select x.criador as uid, x.vencedor, x.aposta::bigint as aposta
              from public.duelos x
             where x.estado = 'fim' and x.vencedor is not null and x.desafiante is not null
            union all
            select x.desafiante, x.vencedor, x.aposta::bigint
              from public.duelos x
             where x.estado = 'fim' and x.vencedor is not null and x.desafiante is not null
          ) p
         group by p.uid
      ) r
  ), '[]'::jsonb);
end $$;
revoke all on function public.duelo_ranking() from public, anon;
grant execute on function public.duelo_ranking() to authenticated;

create table if not exists public.duelo_mensagens (
  id       bigint generated always as identity primary key,
  duelo_id bigint not null references public.duelos(id) on delete cascade,
  user_id  uuid not null default auth.uid() references auth.users(id) on delete cascade,
  texto    text not null check (char_length(texto) between 1 and 200),
  em       timestamptz not null default now()
);
create index if not exists duelo_mensagens_duelo on public.duelo_mensagens (duelo_id, id);
create index if not exists duelo_mensagens_em on public.duelo_mensagens (em);
alter table public.duelo_mensagens enable row level security;
revoke all on public.duelo_mensagens from public, anon, authenticated;
grant select on public.duelo_mensagens to authenticated;
grant insert (duelo_id, texto) on public.duelo_mensagens to authenticated;
drop policy if exists duelo_mensagens_ler on public.duelo_mensagens;
create policy duelo_mensagens_ler on public.duelo_mensagens for select to authenticated using (public.eh_membro());
drop policy if exists duelo_mensagens_mandar on public.duelo_mensagens;
create policy duelo_mensagens_mandar on public.duelo_mensagens for insert to authenticated
  with check (public.eh_membro() and user_id = auth.uid());

-- o autor é sempre quem está logado, o texto sai limpo, só os dois jogadores com o duelo aberto ou em jogo,
-- 20 mensagens por minuto; e o que tem mais de 7 dias some
create or replace function public.duelo_mensagem_protecao() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  d public.duelos;
begin
  new.user_id := auth.uid();
  new.em := now();
  if new.user_id is null or not public.eh_membro() then raise exception 'Só os membros conversam aqui.' using errcode = 'P0001'; end if;
  new.texto := left(btrim(regexp_replace(coalesce(new.texto, ''), '[\x00-\x1F\x7F]', ' ', 'g')), 200);
  if new.texto = '' then raise exception 'Escreva alguma coisa.' using errcode = 'P0001'; end if;
  select * into d from public.duelos where id = new.duelo_id;
  if not found then raise exception 'Esse duelo não existe.' using errcode = 'P0001'; end if;
  if new.user_id is distinct from d.criador and new.user_id is distinct from d.desafiante then
    raise exception 'Só os dois jogadores escrevem no chat do duelo.' using errcode = 'P0001';
  end if;
  if d.estado not in ('aberto', 'jogando') then raise exception 'O duelo já acabou.' using errcode = 'P0001'; end if;
  perform public.limitar('duelo_chat', 20, interval '1 minute', 'Calma: muitas mensagens seguidas.');
  delete from public.duelo_mensagens where em < now() - interval '7 days';
  return new;
end $$;
revoke all on function public.duelo_mensagem_protecao() from public, anon, authenticated;
drop trigger if exists duelo_mensagem_protecao on public.duelo_mensagens;
create trigger duelo_mensagem_protecao before insert on public.duelo_mensagens for each row execute function public.duelo_mensagem_protecao();

do $$
begin
  begin alter publication supabase_realtime add table public.duelo_mensagens; exception when duplicate_object then null; end;
end $$;

-- 52) chat do K-FOFO como no Habbo: gritar e sussurrar (03/11/2026, pedido do João) --------------------------------
--   Grito: uma mensagem do chat marcada com `grito` (o balão sai maior para todo mundo). Vai para o #geral como as outras.
--   Sussurro: uma mensagem só para uma pessoa, em `sussurros`. Só quem mandou e quem recebeu leem (o RLS vale também
--   no tempo real, então ninguém mais recebe). Grava só por sussurrar(); some depois de 1 dia.
alter table public.chat_messages add column if not exists grito boolean not null default false;
grant insert (text, sala, grito) on public.chat_messages to authenticated;

create table if not exists public.sussurros (
  id    bigint generated always as identity primary key,
  de    uuid not null references auth.users(id) on delete cascade,
  para  uuid not null references auth.users(id) on delete cascade,
  texto text not null check (char_length(texto) between 1 and 200),
  em    timestamptz not null default now()
);
create index if not exists sussurros_em on public.sussurros (em);
alter table public.sussurros enable row level security;
revoke all on public.sussurros from public, anon, authenticated;
grant select on public.sussurros to authenticated;
drop policy if exists sussurros_ler on public.sussurros;
create policy sussurros_ler on public.sussurros for select to authenticated
  using (public.eh_membro() and (de = auth.uid() or para = auth.uid()));

-- sussurrar(nanico, texto): para um membro (friend id) que não seja eu; 20 por minuto; limpa os de mais de 1 dia
create or replace function public.sussurrar(p_para uuid, p_texto text) returns bigint
language plpgsql security definer set search_path = public as $$
declare
  v_uid  uuid := auth.uid();
  v_para uuid;
  v_txt  text;
  v_id   bigint;
begin
  if v_uid is null or not public.eh_membro() then raise exception 'Só os membros sussurram.' using errcode = 'P0001'; end if;
  select user_id into v_para from public.friends where id = p_para and user_id is not null;
  if v_para is null then raise exception 'Não achei quem vai receber o sussurro.' using errcode = 'P0001'; end if;
  if v_para = v_uid then raise exception 'Sussurrar para você mesmo não vale.' using errcode = 'P0001'; end if;
  v_txt := left(btrim(regexp_replace(coalesce(p_texto, ''), '[\x00-\x1F\x7F]', ' ', 'g')), 200);
  if v_txt = '' then raise exception 'Escreva alguma coisa.' using errcode = 'P0001'; end if;
  perform public.limitar('sussurro', 20, interval '1 minute', 'Calma: muitos sussurros seguidos.');
  delete from public.sussurros where em < now() - interval '1 day';
  insert into public.sussurros (de, para, texto) values (v_uid, v_para, v_txt) returning id into v_id;
  return v_id;
end $$;
revoke all on function public.sussurrar(uuid, text) from public, anon;
grant execute on function public.sussurrar(uuid, text) to authenticated;

do $$
begin
  begin alter publication supabase_realtime add table public.sussurros; exception when duplicate_object then null; end;
end $$;

-- 53) móveis que fazem algo, como no Habbo (03/11/2026, pedido do João) ----------------------------------------------------
--   Cada móvel colocado ganha um `estado` (jsonb pequeno), que só muda por usar_movel() e chega a todos pelo tempo real
--   de quarto_moveis. Dado (qualquer membro rola; o banco sorteia), luminária (liga e desliga), regulador de luz (a cor
--   do quarto) e quadro de recados (um bilhete) — os três últimos só o dono do quarto mexe.
alter table public.quarto_moveis add column if not exists estado jsonb not null default '{}'::jsonb;
alter table public.quarto_moveis drop constraint if exists quarto_moveis_estado_tamanho;
alter table public.quarto_moveis add constraint quarto_moveis_estado_tamanho check (octet_length(estado::text) <= 400);

insert into public.loja_itens (id, nome, descricao, espaco, preco, dados, ordem) values
  ('movel-dado',      'Dado gigante',      'Toque para rolar: todo mundo no quarto vê o número.',        'movel', 200, '{"w":1,"d":1,"desenho":"dado"}', 212),
  ('movel-regulador', 'Regulador de luz',  'Pinte a luz do quarto: âmbar, azul, rosa, verde ou roxo.',  'movel', 400, '{"w":1,"d":1,"desenho":"regulador"}', 213),
  ('movel-recado',    'Quadro de recados', 'Um bilhete para quem visitar o seu quarto.',               'movel', 150, '{"w":1,"d":1,"desenho":"recado"}', 214)
on conflict (id) do update set nome = excluded.nome, descricao = excluded.descricao, espaco = excluded.espaco,
  preco = excluded.preco, dados = excluded.dados, ordem = excluded.ordem;

-- usar_movel(móvel, argumento): o dado sorteia de 1 a 6; a luminária troca liga/desliga; o regulador recebe a cor;
-- o quadro recebe o texto (até 120 letras). 30 usos por minuto por pessoa.
create or replace function public.usar_movel(p_id bigint, p_arg text default null) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  v_dono uuid;
  v_est jsonb;
  v_des text;
  v_txt text;
begin
  if v_uid is null or not public.eh_membro() then raise exception 'Só os membros mexem nos móveis.' using errcode = 'P0001'; end if;
  select q.user_id, q.estado, l.dados->>'desenho' into v_dono, v_est, v_des
    from public.quarto_moveis q join public.loja_itens l on l.id = q.item_id where q.id = p_id for update of q;
  if not found then raise exception 'Esse móvel não está mais aí.' using errcode = 'P0001'; end if;
  if v_des in ('luminaria', 'regulador', 'recado') and v_dono <> v_uid then
    raise exception 'Só o dono do quarto mexe nisso.' using errcode = 'P0001';
  end if;
  perform public.limitar('movel', 30, interval '1 minute', 'Calma: muitos toques seguidos.');
  if v_des = 'dado' then
    v_est := jsonb_build_object('n', 1 + floor(random() * 6)::int, 'em', (extract(epoch from clock_timestamp()) * 1000)::bigint);
  elsif v_des = 'luminaria' then
    v_est := jsonb_build_object('liga', not coalesce((v_est->>'liga')::boolean, true));
  elsif v_des = 'regulador' then
    if p_arg is null or p_arg not in ('desligado', 'ambar', 'azul', 'rosa', 'verde', 'roxo') then
      raise exception 'Escolha uma das cores.' using errcode = 'P0001';
    end if;
    v_est := jsonb_build_object('cor', p_arg);
  elsif v_des = 'recado' then
    v_txt := left(btrim(regexp_replace(coalesce(p_arg, ''), '[\x00-\x1F\x7F]', ' ', 'g')), 120);
    v_est := case when v_txt = '' then '{}'::jsonb else jsonb_build_object('texto', v_txt) end;
  else
    raise exception 'Esse móvel não faz nada.' using errcode = 'P0001';
  end if;
  update public.quarto_moveis set estado = v_est where id = p_id;
  return v_est;
end $$;
revoke all on function public.usar_movel(bigint, text) from public, anon;
grant execute on function public.usar_movel(bigint, text) to authenticated;

-- 54) troca entre nanicos, como no Habbo (03/11/2026, pedido do João) --------------------------------------------------
--   Dois membros abrem uma troca, cada um põe itens da mochila e moedas no seu lado e os dois aceitam. Mexer na oferta
--   desfaz os "aceito". Quando os dois aceitam, troca_aceitar confere tudo de novo (o que cada um tem livre, o máximo
--   que o outro pode ter de cada item, o saldo) e troca tudo de uma vez: ou a troca inteira acontece, ou nada muda.
--   Não dá para trocar o quarto (é o tamanho do quarto) nem um móvel que está colocado no quarto (guarde antes).
--   Só os dois da troca leem a linha (o RLS vale no tempo real). Moedas no extrato com o motivo 'troca'.
alter table public.extrato drop constraint if exists extrato_motivo_check;
alter table public.extrato add constraint extrato_motivo_check
  check (motivo in ('inicio', 'diario', 'sequencia', 'online', 'cassino', 'bingo', 'truco', 'aposta', 'loja', 'admin', 'zoeira', 'trofeu', 'churrasco', 'missao', 'bolsa', 'duelo', 'troca', 'mercado'));

create table if not exists public.trocas (
  id            bigint generated always as identity primary key,
  de            uuid not null references auth.users(id) on delete cascade,
  para          uuid not null references auth.users(id) on delete cascade,
  estado        text not null default 'aberta' check (estado in ('aberta', 'feita', 'cancelada')),
  de_itens      jsonb not null default '{}'::jsonb check (octet_length(de_itens::text) <= 1000),
  para_itens    jsonb not null default '{}'::jsonb check (octet_length(para_itens::text) <= 1000),
  de_moedas     int not null default 0 check (de_moedas between 0 and 1000000),
  para_moedas   int not null default 0 check (para_moedas between 0 and 1000000),
  de_ok         boolean not null default false,
  para_ok       boolean not null default false,
  criada_em     timestamptz not null default now(),
  atualizada_em timestamptz not null default now()
);
create index if not exists trocas_abertas on public.trocas (estado, atualizada_em);
alter table public.trocas enable row level security;
revoke all on public.trocas from public, anon, authenticated;
grant select on public.trocas to authenticated;
drop policy if exists trocas_ler on public.trocas;
create policy trocas_ler on public.trocas for select to authenticated
  using (public.eh_membro() and (de = auth.uid() or para = auth.uid()));
do $$
begin
  begin alter publication supabase_realtime add table public.trocas; exception when duplicate_object then null; end;
end $$;

-- quanto de um item a pessoa tem livre para trocar: o da mochila menos o que está colocado no quarto; o quarto não troca
create or replace function public.troca_livre(p_uid uuid, p_item text) returns int
language sql stable security definer set search_path = public as $$
  select case when (select espaco from public.loja_itens where id = p_item) = 'quarto' then 0
    else greatest(0, coalesce((select qtd from public.mochila where user_id = p_uid and item_id = p_item), 0)
      - (select count(*)::int from public.quarto_moveis where user_id = p_uid and item_id = p_item)) end;
$$;
revoke all on function public.troca_livre(uuid, text) from public, anon, authenticated;

-- o máximo de um item que alguém pode ter (as mesmas regras do comprar): móvel 4, escudo 3, consumível 20, o resto 1
create or replace function public.item_maximo(p_item text) returns int
language sql stable security definer set search_path = public as $$
  select case when public.eh_posicionavel(p_item) then 4
    else case (select espaco from public.loja_itens where id = p_item) when 'escudo' then 3 when 'consumivel' then 20 else 1 end end;
$$;
revoke all on function public.item_maximo(text) from public, anon, authenticated;

-- troca_abrir(nanico): uma troca aberta por pessoa; as paradas há 30 min caem sozinhas
create or replace function public.troca_abrir(p_para uuid) returns bigint
language plpgsql security definer set search_path = public as $$
declare
  v_uid  uuid := auth.uid();
  v_para uuid;
  v_id   bigint;
begin
  if v_uid is null or not public.eh_membro() then raise exception 'Só os membros trocam.' using errcode = 'P0001'; end if;
  select user_id into v_para from public.friends where id = p_para and user_id is not null;
  if v_para is null then raise exception 'Não achei esse nanico.' using errcode = 'P0001'; end if;
  if v_para = v_uid then raise exception 'Trocar com você mesmo não vale.' using errcode = 'P0001'; end if;
  perform public.limitar('troca', 10, interval '1 minute', 'Calma: muitas trocas seguidas.');
  update public.trocas set estado = 'cancelada', atualizada_em = now()
   where estado = 'aberta' and atualizada_em < now() - interval '30 minutes';
  if exists (select 1 from public.trocas where estado = 'aberta' and v_uid in (de, para)) then
    raise exception 'Você já tem uma troca aberta. Termine ou cancele antes.' using errcode = 'P0001';
  end if;
  if exists (select 1 from public.trocas where estado = 'aberta' and v_para in (de, para)) then
    raise exception 'Esse nanico já está numa troca. Tente daqui a pouco.' using errcode = 'P0001';
  end if;
  insert into public.trocas (de, para) values (v_uid, v_para) returning id into v_id;
  return v_id;
end $$;
revoke all on function public.troca_abrir(uuid) from public, anon;
grant execute on function public.troca_abrir(uuid) to authenticated;

-- troca_oferecer(troca, itens {item: qtd}, moedas): troca o meu lado inteiro e desfaz os dois "aceito"
create or replace function public.troca_oferecer(p_id bigint, p_itens jsonb, p_moedas int) returns void
language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  t     public.trocas;
  k     text;
  v     jsonb;
  v_sal int;
begin
  select * into t from public.trocas where id = p_id for update;
  if not found or v_uid is null or v_uid not in (t.de, t.para) then raise exception 'Troca não encontrada.' using errcode = 'P0001'; end if;
  if t.estado <> 'aberta' then raise exception 'Essa troca já acabou.' using errcode = 'P0001'; end if;
  if p_itens is null or jsonb_typeof(p_itens) <> 'object' then raise exception 'Itens inválidos.' using errcode = 'P0001'; end if;
  if (select count(*) from jsonb_object_keys(p_itens)) > 12 then raise exception 'No máximo 12 itens diferentes por lado.' using errcode = 'P0001'; end if;
  for k, v in select * from jsonb_each(p_itens) loop
    if jsonb_typeof(v) <> 'number' or (v::text)::numeric <> floor((v::text)::numeric) or (v::text)::int not between 1 and 20 then
      raise exception 'Quantidade inválida.' using errcode = 'P0001';
    end if;
    if public.troca_livre(v_uid, k) < (v::text)::int then
      raise exception 'Você não tem % livre para trocar (guarde do quarto antes, se estiver colocado).', coalesce((select nome from public.loja_itens where id = k), 'esse item') using errcode = 'P0001';
    end if;
  end loop;
  select saldo into v_sal from public.carteiras where user_id = v_uid;
  if p_moedas is null or p_moedas < 0 or p_moedas > coalesce(v_sal, 0) then raise exception 'Você não tem essas moedas.' using errcode = 'P0001'; end if;
  perform public.limitar('troca_oferta', 60, interval '1 minute', 'Calma: muitas mudanças seguidas.');
  if v_uid = t.de then
    update public.trocas set de_itens = p_itens, de_moedas = p_moedas, de_ok = false, para_ok = false, atualizada_em = now() where id = p_id;
  else
    update public.trocas set para_itens = p_itens, para_moedas = p_moedas, de_ok = false, para_ok = false, atualizada_em = now() where id = p_id;
  end if;
end $$;
revoke all on function public.troca_oferecer(bigint, jsonb, int) from public, anon;
grant execute on function public.troca_oferecer(bigint, jsonb, int) to authenticated;

-- passa os itens de um lado para o outro (interna; troca_aceitar já travou e conferiu)
create or replace function public.troca_mover(p_de uuid, p_para uuid, p_itens jsonb) returns void
language plpgsql security definer set search_path = public as $$
declare
  k text;
  v jsonb;
  n int;
begin
  for k, v in select * from jsonb_each(p_itens) loop
    n := (v::text)::int;
    if public.troca_livre(p_de, k) < n then
      raise exception '% não tem mais % livre para trocar.', (select name from public.friends where user_id = p_de), coalesce((select nome from public.loja_itens where id = k), 'esse item') using errcode = 'P0001';
    end if;
    if coalesce((select qtd from public.mochila where user_id = p_para and item_id = k), 0) + n > public.item_maximo(k) then
      raise exception '% já tem o máximo de %.', (select name from public.friends where user_id = p_para), coalesce((select nome from public.loja_itens where id = k), 'esse item') using errcode = 'P0001';
    end if;
    update public.mochila set qtd = qtd - n where user_id = p_de and item_id = k;
    delete from public.mochila where user_id = p_de and item_id = k and qtd <= 0;
    insert into public.mochila (user_id, item_id, qtd) values (p_para, k, n)
      on conflict (user_id, item_id) do update set qtd = public.mochila.qtd + excluded.qtd;
  end loop;
end $$;
revoke all on function public.troca_mover(uuid, uuid, jsonb) from public, anon, authenticated;

-- troca_aceitar(troca): marca o meu "aceito"; com os dois aceitos, faz a troca inteira (ou nada)
create or replace function public.troca_aceitar(p_id bigint) returns text
language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  t     public.trocas;
begin
  select * into t from public.trocas where id = p_id for update;
  if not found or v_uid is null or v_uid not in (t.de, t.para) then raise exception 'Troca não encontrada.' using errcode = 'P0001'; end if;
  if t.estado <> 'aberta' then raise exception 'Essa troca já acabou.' using errcode = 'P0001'; end if;
  if v_uid = t.de then t.de_ok := true; else t.para_ok := true; end if;
  if not (t.de_ok and t.para_ok) then
    update public.trocas set de_ok = t.de_ok, para_ok = t.para_ok, atualizada_em = now() where id = p_id;
    return 'esperando';
  end if;
  if t.de_itens = '{}'::jsonb and t.para_itens = '{}'::jsonb and t.de_moedas = 0 and t.para_moedas = 0 then
    raise exception 'A troca está vazia.' using errcode = 'P0001';
  end if;
  -- trava as mochilas e as carteiras dos dois, sempre na mesma ordem (sem impasse com outra troca)
  perform 1 from public.mochila where user_id in (t.de, t.para) order by user_id, item_id for update;
  perform 1 from public.carteiras where user_id in (t.de, t.para) order by user_id for update;
  if t.de_moedas > coalesce((select saldo from public.carteiras where user_id = t.de), 0)
     or t.para_moedas > coalesce((select saldo from public.carteiras where user_id = t.para), 0) then
    raise exception 'Alguém não tem mais as moedas da oferta.' using errcode = 'P0001';
  end if;
  perform public.troca_mover(t.de, t.para, t.de_itens);
  perform public.troca_mover(t.para, t.de, t.para_itens);
  if t.de_moedas > 0 then
    perform public.creditar(t.de, -t.de_moedas, 'troca', p_id::text);
    perform public.creditar(t.para, t.de_moedas, 'troca', p_id::text);
  end if;
  if t.para_moedas > 0 then
    perform public.creditar(t.para, -t.para_moedas, 'troca', p_id::text);
    perform public.creditar(t.de, t.para_moedas, 'troca', p_id::text);
  end if;
  update public.trocas set de_ok = true, para_ok = true, estado = 'feita', atualizada_em = now() where id = p_id;
  return 'feita';
end $$;
revoke all on function public.troca_aceitar(bigint) from public, anon;
grant execute on function public.troca_aceitar(bigint) to authenticated;

-- troca_cancelar(troca): qualquer um dos dois desiste
create or replace function public.troca_cancelar(p_id bigint) returns void
language plpgsql security definer set search_path = public as $$
begin
  update public.trocas set estado = 'cancelada', atualizada_em = now()
   where id = p_id and estado = 'aberta' and auth.uid() in (de, para);
end $$;
revoke all on function public.troca_cancelar(bigint) from public, anon;
grant execute on function public.troca_cancelar(bigint) to authenticated;

-- 55) raros limitados, como os LTD do Habbo (03/11/2026, pedido do João) -------------------------------------------------
--   Um item da loja com `estoque` é raro: cada cópia vendida ganha um número ("3 de 15") em raros_numeros, que todo
--   membro lê (quem tem cada número é público). `lancamento` = só vende a partir dessa hora. O controle fica num gatilho
--   da mochila (raro_na_mochila), então a compra continua sendo o comprar() de sempre: esgotado ou antes da hora, o
--   gatilho recusa e a compra inteira volta (as moedas também). Na troca, o número vai junto (troca_mover marca
--   `nanicos.troca` e passa os números).
alter table public.loja_itens add column if not exists estoque int;
alter table public.loja_itens add column if not exists lancamento timestamptz;
alter table public.loja_itens drop constraint if exists loja_itens_estoque_check;
alter table public.loja_itens add constraint loja_itens_estoque_check check (estoque is null or estoque between 1 and 1000);

create table if not exists public.raros_numeros (
  item_id text not null references public.loja_itens(id) on delete cascade,
  numero  int not null check (numero >= 1),
  user_id uuid references auth.users(id) on delete set null,
  em      timestamptz not null default now(),
  primary key (item_id, numero)
);
alter table public.raros_numeros enable row level security;
revoke all on public.raros_numeros from public, anon, authenticated;
grant select on public.raros_numeros to authenticated;
drop policy if exists raros_numeros_ler on public.raros_numeros;
create policy raros_numeros_ler on public.raros_numeros for select to authenticated using (public.eh_membro());
do $$
begin
  begin alter publication supabase_realtime add table public.raros_numeros; exception when duplicate_object then null; end;
end $$;

create or replace function public.raro_na_mochila() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_est int;
  v_lan timestamptz;
  v_n   int;
  k     int;
begin
  select estoque, lancamento into v_est, v_lan from public.loja_itens where id = new.item_id for update;
  if v_est is null then return new; end if;
  -- troca e mercado: o número muda de dono em troca_mover, não nasce outro
  if current_setting('nanicos.troca', true) = '1' then return new; end if;
  -- "insere ou soma" (o comprar de móvel): quem já tem a linha passa pelo caminho do UPDATE, que conta a cópia nova
  if tg_op = 'INSERT' and exists (select 1 from public.mochila where user_id = new.user_id and item_id = new.item_id) then return new; end if;
  if tg_op = 'UPDATE' and new.qtd <= old.qtd then return new; end if;
  if v_lan is not null and v_lan > now() then
    raise exception 'Esse raro só sai em %.', to_char(v_lan at time zone 'America/Sao_Paulo', 'DD/MM "às" HH24"h"MI') using errcode = 'P0001';
  end if;
  for k in 1 .. (new.qtd - case when tg_op = 'UPDATE' then old.qtd else 0 end) loop
    select count(*) into v_n from public.raros_numeros where item_id = new.item_id;
    if v_n >= v_est then raise exception 'Esgotado! Todos os % já foram vendidos.', v_est using errcode = 'P0001'; end if;
    insert into public.raros_numeros (item_id, numero, user_id) values (new.item_id, v_n + 1, new.user_id);
  end loop;
  return new;
end $$;
revoke all on function public.raro_na_mochila() from public, anon, authenticated;
drop trigger if exists raro_na_mochila on public.mochila;
create trigger raro_na_mochila before insert or update of qtd on public.mochila for each row execute function public.raro_na_mochila();

-- troca_mover de novo (seção 54): marca a troca para o gatilho dos raros e passa os números junto com os itens
create or replace function public.troca_mover(p_de uuid, p_para uuid, p_itens jsonb) returns void
language plpgsql security definer set search_path = public as $$
declare
  k text;
  v jsonb;
  n int;
begin
  perform set_config('nanicos.troca', '1', true);
  for k, v in select * from jsonb_each(p_itens) loop
    n := (v::text)::int;
    if public.troca_livre(p_de, k) < n then
      raise exception '% não tem mais % livre para trocar.', (select name from public.friends where user_id = p_de), coalesce((select nome from public.loja_itens where id = k), 'esse item') using errcode = 'P0001';
    end if;
    if coalesce((select qtd from public.mochila where user_id = p_para and item_id = k), 0) + n > public.item_maximo(k) then
      raise exception '% já tem o máximo de %.', (select name from public.friends where user_id = p_para), coalesce((select nome from public.loja_itens where id = k), 'esse item') using errcode = 'P0001';
    end if;
    update public.mochila set qtd = qtd - n where user_id = p_de and item_id = k;
    delete from public.mochila where user_id = p_de and item_id = k and qtd <= 0;
    insert into public.mochila (user_id, item_id, qtd) values (p_para, k, n)
      on conflict (user_id, item_id) do update set qtd = public.mochila.qtd + excluded.qtd;
    update public.raros_numeros set user_id = p_para
     where (item_id, numero) in (select item_id, numero from public.raros_numeros where item_id = k and user_id = p_de order by numero desc limit n);
  end loop;
  perform set_config('nanicos.troca', '', true);
end $$;
revoke all on function public.troca_mover(uuid, uuid, jsonb) from public, anon, authenticated;

-- os primeiros raros: a estátua sai já; o globo de plasma sai no churrasco de sábado (07/11/2026, 20h de Brasília)
insert into public.loja_itens (id, nome, descricao, espaco, preco, dados, ordem, estoque, lancamento) values
  ('raro-estatua', 'Estátua Dourada do Nanico', 'Raro: só 15 no mundo, cada um com o seu número.', 'movel', 3000, '{"w":1,"d":1,"desenho":"estatua"}', 150, 15, null),
  ('raro-plasma',  'Globo de Plasma',           'Raro: só 25, com raios roxos lá dentro. Sai no churrasco de sábado.', 'movel', 1500, '{"w":1,"d":1,"desenho":"plasma"}', 151, 25, '2026-11-07 20:00:00-03')
on conflict (id) do update set nome = excluded.nome, descricao = excluded.descricao, espaco = excluded.espaco,
  preco = excluded.preco, dados = excluded.dados, ordem = excluded.ordem, estoque = excluded.estoque, lancamento = excluded.lancamento;

-- 56) mercado dos nanicos, como o Marketplace do Habbo (03/11/2026, pedido do João) --------------------------------------
--   Um membro anuncia 1 item livre da mochila pelo preço que quiser (10 a 100.000): o item sai da mochila e fica
--   guardado no anúncio. Quem compra paga o preço; o vendedor recebe o preço menos 5%, que vai para a Banca Nanica.
--   Retirar devolve o item. Raro (seção 55) vai com o número guardado no anúncio. Moedas no extrato com 'mercado'.
--   Todos os membros leem os anúncios (é uma vitrine); só as funções mexem. Até 10 anúncios abertos por pessoa.
create table if not exists public.mercado (
  id        bigint generated always as identity primary key,
  vendedor  uuid not null references auth.users(id) on delete cascade,
  item_id   text not null references public.loja_itens(id) on delete cascade,
  numero    int,
  preco     int not null check (preco between 10 and 100000),
  estado    text not null default 'aberta' check (estado in ('aberta', 'vendida', 'retirada')),
  comprador uuid references auth.users(id) on delete set null,
  criada_em timestamptz not null default now(),
  fim_em    timestamptz
);
create index if not exists mercado_abertas on public.mercado (estado, criada_em desc);
alter table public.mercado enable row level security;
revoke all on public.mercado from public, anon, authenticated;
grant select on public.mercado to authenticated;
drop policy if exists mercado_ler on public.mercado;
create policy mercado_ler on public.mercado for select to authenticated using (public.eh_membro());
do $$
begin
  begin alter publication supabase_realtime add table public.mercado; exception when duplicate_object then null; end;
end $$;

-- mercado_vender(item, preço): tira 1 da mochila e abre o anúncio
create or replace function public.mercado_vender(p_item text, p_preco int) returns bigint
language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  v_num int;
  v_id  bigint;
begin
  if v_uid is null or not public.eh_membro() then raise exception 'Só os membros vendem no mercado.' using errcode = 'P0001'; end if;
  if p_preco is null or p_preco not between 10 and 100000 then raise exception 'O preço vai de 10 a 100.000 moedas.' using errcode = 'P0001'; end if;
  perform public.limitar('mercado', 20, interval '1 hour', 'Calma: muitos anúncios seguidos.');
  if (select count(*) from public.mercado where vendedor = v_uid and estado = 'aberta') >= 10 then
    raise exception 'Você já tem 10 anúncios abertos. Retire algum antes.' using errcode = 'P0001';
  end if;
  perform 1 from public.mochila where user_id = v_uid and item_id = p_item for update;
  if public.troca_livre(v_uid, p_item) < 1 then
    raise exception 'Você não tem esse item livre (guarde do quarto antes, se estiver colocado).' using errcode = 'P0001';
  end if;
  -- raro: o anúncio guarda o maior número que a pessoa tem
  select max(numero) into v_num from public.raros_numeros where item_id = p_item and user_id = v_uid;
  perform set_config('nanicos.troca', '1', true);
  update public.mochila set qtd = qtd - 1 where user_id = v_uid and item_id = p_item;
  delete from public.mochila where user_id = v_uid and item_id = p_item and qtd <= 0;
  perform set_config('nanicos.troca', '', true);
  if v_num is not null then update public.raros_numeros set user_id = null where item_id = p_item and numero = v_num; end if;
  insert into public.mercado (vendedor, item_id, numero, preco) values (v_uid, p_item, v_num, p_preco) returning id into v_id;
  return v_id;
end $$;
revoke all on function public.mercado_vender(text, int) from public, anon;
grant execute on function public.mercado_vender(text, int) to authenticated;

-- devolve ou entrega o item de um anúncio (interna)
create or replace function public.mercado_entregar(p_uid uuid, p_item text, p_numero int) returns void
language plpgsql security definer set search_path = public as $$
begin
  if coalesce((select qtd from public.mochila where user_id = p_uid and item_id = p_item), 0) + 1 > public.item_maximo(p_item) then
    raise exception '% já tem o máximo desse item.', coalesce((select name from public.friends where user_id = p_uid), 'Quem recebe') using errcode = 'P0001';
  end if;
  perform set_config('nanicos.troca', '1', true);
  insert into public.mochila (user_id, item_id, qtd) values (p_uid, p_item, 1)
    on conflict (user_id, item_id) do update set qtd = public.mochila.qtd + 1;
  perform set_config('nanicos.troca', '', true);
  if p_numero is not null then update public.raros_numeros set user_id = p_uid where item_id = p_item and numero = p_numero; end if;
end $$;
revoke all on function public.mercado_entregar(uuid, text, int) from public, anon, authenticated;

-- mercado_comprar(anúncio): paga, o vendedor recebe 95% e a banca 5%, e o item vem para a mochila
create or replace function public.mercado_comprar(p_id bigint) returns void
language plpgsql security definer set search_path = public as $$
declare
  v_uid  uuid := auth.uid();
  o      public.mercado;
  v_taxa int;
begin
  if v_uid is null or not public.eh_membro() then raise exception 'Só os membros compram no mercado.' using errcode = 'P0001'; end if;
  select * into o from public.mercado where id = p_id for update;
  if not found or o.estado <> 'aberta' then raise exception 'Esse anúncio não está mais à venda.' using errcode = 'P0001'; end if;
  if o.vendedor = v_uid then raise exception 'Esse anúncio é seu: retire em vez de comprar.' using errcode = 'P0001'; end if;
  perform public.limitar('mercado_compra', 30, interval '1 minute', 'Calma: muitas compras seguidas.');
  if o.preco > coalesce((select saldo from public.carteiras where user_id = v_uid), 0) then
    raise exception 'Faltam moedas para comprar.' using errcode = 'P0001';
  end if;
  v_taxa := ceil(o.preco * 0.05)::int;
  perform public.creditar(v_uid, -o.preco, 'mercado', p_id::text);
  perform public.creditar(o.vendedor, o.preco - v_taxa, 'mercado', p_id::text);
  update public.banca set valor = valor + v_taxa, atualizada = now() where id = 1;
  perform public.mercado_entregar(v_uid, o.item_id, o.numero);
  update public.mercado set estado = 'vendida', comprador = v_uid, fim_em = now() where id = p_id;
end $$;
revoke all on function public.mercado_comprar(bigint) from public, anon;
grant execute on function public.mercado_comprar(bigint) to authenticated;

-- mercado_retirar(anúncio): o vendedor desiste e o item volta
create or replace function public.mercado_retirar(p_id bigint) returns void
language plpgsql security definer set search_path = public as $$
declare
  o public.mercado;
begin
  select * into o from public.mercado where id = p_id for update;
  if not found or o.vendedor <> auth.uid() then raise exception 'Anúncio não encontrado.' using errcode = 'P0001'; end if;
  if o.estado <> 'aberta' then raise exception 'Esse anúncio já acabou.' using errcode = 'P0001'; end if;
  perform public.mercado_entregar(o.vendedor, o.item_id, o.numero);
  update public.mercado set estado = 'retirada', fim_em = now() where id = p_id;
end $$;
revoke all on function public.mercado_retirar(bigint) from public, anon;
grant execute on function public.mercado_retirar(bigint) to authenticated;

-- 57) curtir quarto, para o navegador de quartos (03/11/2026, pedido do João) --------------------------------------------
--   Cada membro curte (ou descurte) o quarto de outro, uma vez. Todos leem as curtidas (o navegador mostra o ranking
--   dos quartos mais curtidos); só curtir_quarto() grava. 60 toques por hora.
create table if not exists public.quarto_curtidas (
  dono uuid not null references auth.users(id) on delete cascade,
  quem uuid not null references auth.users(id) on delete cascade,
  em   timestamptz not null default now(),
  primary key (dono, quem),
  check (dono <> quem)
);
alter table public.quarto_curtidas enable row level security;
revoke all on public.quarto_curtidas from public, anon, authenticated;
grant select on public.quarto_curtidas to authenticated;
drop policy if exists quarto_curtidas_ler on public.quarto_curtidas;
create policy quarto_curtidas_ler on public.quarto_curtidas for select to authenticated using (public.eh_membro());
do $$
begin
  begin alter publication supabase_realtime add table public.quarto_curtidas; exception when duplicate_object then null; end;
end $$;

-- curtir_quarto(nanico, ligar): o dono tem que ter quarto e não pode ser eu
create or replace function public.curtir_quarto(p_dono uuid, p_ligar boolean) returns void
language plpgsql security definer set search_path = public as $$
declare
  v_uid  uuid := auth.uid();
  v_dono uuid;
begin
  if v_uid is null or not public.eh_membro() then raise exception 'Só os membros curtem.' using errcode = 'P0001'; end if;
  select user_id into v_dono from public.friends where id = p_dono;
  if v_dono is null or not exists (select 1 from public.quartos where user_id = v_dono) then
    raise exception 'Esse nanico ainda não tem quarto.' using errcode = 'P0001';
  end if;
  if v_dono = v_uid then raise exception 'Curtir o próprio quarto não vale.' using errcode = 'P0001'; end if;
  perform public.limitar('curtir_quarto', 60, interval '1 hour', 'Calma: muitas curtidas seguidas.');
  if p_ligar then
    insert into public.quarto_curtidas (dono, quem) values (v_dono, v_uid) on conflict do nothing;
  else
    delete from public.quarto_curtidas where dono = v_dono and quem = v_uid;
  end if;
end $$;
revoke all on function public.curtir_quarto(uuid, boolean) from public, anon;
grant execute on function public.curtir_quarto(uuid, boolean) to authenticated;

-- 58) arena de pintar o chão (03/11/2026, pedido do João; um jogo nosso, no estilo das salas de jogo do Habbo) ------------
--   Dois times (azul e vermelho) entram na cena "arena"; quando alguém começa, a partida dura 90 s depois de 5 s de
--   contagem, e cada boneco pinta da cor do time o piso por onde passa. O banco guarda só a partida (times e horários),
--   para todo mundo ver a mesma; a pintura sai do andar dos bonecos, que já é igual em todas as telas. Não vale moedas.
create table if not exists public.arena_partidas (
  id        bigint generated always as identity primary key,
  estado    text not null default 'esperando' check (estado in ('esperando', 'jogando', 'fim')),
  times     jsonb not null default '{}'::jsonb check (octet_length(times::text) <= 2000),
  comeca_em timestamptz,
  acaba_em  timestamptz,
  criada_em timestamptz not null default now()
);
create index if not exists arena_partidas_estado on public.arena_partidas (estado, id desc);
alter table public.arena_partidas enable row level security;
revoke all on public.arena_partidas from public, anon, authenticated;
grant select on public.arena_partidas to authenticated;
drop policy if exists arena_partidas_ler on public.arena_partidas;
create policy arena_partidas_ler on public.arena_partidas for select to authenticated using (public.eh_membro());
do $$
begin
  begin alter publication supabase_realtime add table public.arena_partidas; exception when duplicate_object then null; end;
end $$;

-- fecha o que já acabou (jogo que passou da hora, espera parada há 30 min) e devolve a partida da vez, travada
create or replace function public.arena_atual() returns public.arena_partidas
language plpgsql security definer set search_path = public as $$
declare
  p public.arena_partidas;
begin
  update public.arena_partidas set estado = 'fim'
   where (estado = 'jogando' and acaba_em < now()) or (estado = 'esperando' and criada_em < now() - interval '30 minutes');
  select * into p from public.arena_partidas where estado in ('esperando', 'jogando') order by id desc limit 1 for update;
  return p;
end $$;
revoke all on function public.arena_atual() from public, anon, authenticated;

-- arena_entrar(): entra na partida que está esperando (cria uma se não houver), no time com menos gente; até 8
create or replace function public.arena_entrar() returns void
language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  p     public.arena_partidas;
  v_az  int;
  v_vm  int;
begin
  if v_uid is null or not public.eh_membro() then raise exception 'Só os membros jogam.' using errcode = 'P0001'; end if;
  perform public.limitar('arena', 20, interval '1 minute', 'Calma: muitos toques seguidos.');
  p := public.arena_atual();
  if p.id is not null and p.estado = 'jogando' then raise exception 'Tem uma partida rolando. Espere ela acabar.' using errcode = 'P0001'; end if;
  if p.id is null then insert into public.arena_partidas default values returning * into p; end if;
  if p.times ? v_uid::text then return; end if;
  select count(*) filter (where value = '"azul"'), count(*) filter (where value = '"vermelho"') into v_az, v_vm from jsonb_each(p.times);
  if v_az + v_vm >= 8 then raise exception 'A arena está cheia (8 jogadores).' using errcode = 'P0001'; end if;
  update public.arena_partidas set times = times || jsonb_build_object(v_uid::text, case when v_az <= v_vm then 'azul' else 'vermelho' end) where id = p.id;
end $$;
revoke all on function public.arena_entrar() from public, anon;
grant execute on function public.arena_entrar() to authenticated;

-- arena_sair(): sai da partida que está esperando
create or replace function public.arena_sair() returns void
language plpgsql security definer set search_path = public as $$
declare
  p public.arena_partidas;
begin
  p := public.arena_atual();
  if p.id is null or p.estado <> 'esperando' then return; end if;
  update public.arena_partidas set times = times - auth.uid()::text where id = p.id;
end $$;
revoke all on function public.arena_sair() from public, anon;
grant execute on function public.arena_sair() to authenticated;

-- arena_comecar(): quem está na partida começa, com gente nos dois times: 5 s de contagem e 90 s de jogo
create or replace function public.arena_comecar() returns void
language plpgsql security definer set search_path = public as $$
declare
  p public.arena_partidas;
begin
  p := public.arena_atual();
  if p.id is null or p.estado <> 'esperando' or not (p.times ? auth.uid()::text) then
    raise exception 'Entre na partida antes.' using errcode = 'P0001';
  end if;
  if not exists (select 1 from jsonb_each(p.times) where value = '"azul"') or not exists (select 1 from jsonb_each(p.times) where value = '"vermelho"') then
    raise exception 'Precisa de gente nos dois times.' using errcode = 'P0001';
  end if;
  update public.arena_partidas set estado = 'jogando', comeca_em = now() + interval '5 seconds', acaba_em = now() + interval '95 seconds' where id = p.id;
end $$;
revoke all on function public.arena_comecar() from public, anon;
grant execute on function public.arena_comecar() to authenticated;

-- 59) gatilhos no quarto, uma versão simples dos "wired" do Habbo (03/11/2026, pedido do João) --------------------------
--   O dono do quarto monta regras: QUANDO alguém entra no quarto (ou pisa num piso), ENTÃO aparece um aviso, toca a
--   campainha ou a pessoa vai para outro piso. Cada regra roda na tela de quem a disparou (o efeito é só para ela),
--   então o banco só guarda as regras: membros leem; só o dono cria e apaga, até 12 por quarto.
create table if not exists public.quarto_gatilhos (
  id     bigint generated always as identity primary key,
  dono   uuid not null references auth.users(id) on delete cascade,
  quando text not null check (quando in ('entra', 'pisa')),
  pi     int check (pi between 0 and 11),
  pj     int check (pj between 0 and 11),
  entao  text not null check (entao in ('aviso', 'campainha', 'vai')),
  texto  text check (char_length(texto) <= 80),
  ai     int check (ai between 0 and 11),
  aj     int check (aj between 0 and 11),
  em     timestamptz not null default now(),
  check (quando <> 'pisa' or (pi is not null and pj is not null)),
  check (entao <> 'vai' or (ai is not null and aj is not null)),
  check (entao <> 'aviso' or char_length(coalesce(texto, '')) between 1 and 80)
);
create index if not exists quarto_gatilhos_dono on public.quarto_gatilhos (dono);
alter table public.quarto_gatilhos enable row level security;
revoke all on public.quarto_gatilhos from public, anon, authenticated;
grant select on public.quarto_gatilhos to authenticated;
drop policy if exists quarto_gatilhos_ler on public.quarto_gatilhos;
create policy quarto_gatilhos_ler on public.quarto_gatilhos for select to authenticated using (public.eh_membro());
do $$
begin
  begin alter publication supabase_realtime add table public.quarto_gatilhos; exception when duplicate_object then null; end;
end $$;

-- gatilho_criar(quando, piso, então, texto, alvo): só quem tem quarto; os pisos têm que caber no quarto dele
create or replace function public.gatilho_criar(p_quando text, p_pi int, p_pj int, p_entao text, p_texto text, p_ai int, p_aj int) returns bigint
language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  v_tam int;
  v_id  bigint;
begin
  if v_uid is null or not public.eh_membro() then raise exception 'Só os membros montam gatilhos.' using errcode = 'P0001'; end if;
  select tamanho into v_tam from public.quartos where user_id = v_uid;
  if v_tam is null then raise exception 'Compre um quarto antes.' using errcode = 'P0001'; end if;
  if (p_quando = 'pisa' and (p_pi >= v_tam or p_pj >= v_tam)) or (p_entao = 'vai' and (p_ai >= v_tam or p_aj >= v_tam)) then
    raise exception 'Esse piso fica fora do seu quarto.' using errcode = 'P0001';
  end if;
  if (select count(*) from public.quarto_gatilhos where dono = v_uid) >= 12 then raise exception 'No máximo 12 gatilhos por quarto.' using errcode = 'P0001'; end if;
  perform public.limitar('gatilho', 30, interval '1 hour', 'Calma: muitos gatilhos seguidos.');
  insert into public.quarto_gatilhos (dono, quando, pi, pj, entao, texto, ai, aj)
  values (v_uid, p_quando, case when p_quando = 'pisa' then p_pi end, case when p_quando = 'pisa' then p_pj end, p_entao,
          case when p_entao = 'aviso' then left(btrim(regexp_replace(coalesce(p_texto, ''), '[\x00-\x1F\x7F]', ' ', 'g')), 80) end,
          case when p_entao = 'vai' then p_ai end, case when p_entao = 'vai' then p_aj end)
  returning id into v_id;
  return v_id;
end $$;
revoke all on function public.gatilho_criar(text, int, int, text, text, int, int) from public, anon;
grant execute on function public.gatilho_criar(text, int, int, text, text, int, int) to authenticated;

create or replace function public.gatilho_apagar(p_id bigint) returns void
language sql security definer set search_path = public as $$
  delete from public.quarto_gatilhos where id = p_id and dono = auth.uid();
$$;
revoke all on function public.gatilho_apagar(bigint) from public, anon;
grant execute on function public.gatilho_apagar(bigint) to authenticated;

-- 60) caixa de som no quarto (03/11/2026, pedido do João) -----------------------------------------------------------------
--   Um móvel que faz algo (como os da seção 53): o dono escolhe a estação (lo-fi, eletrônica ou samba) e quem está no
--   quarto ouve. A música é feita no navegador (Web Audio, notas e batidas simples), sem arquivo e sem site de fora.
--   usar_movel ganha o caso 'caixa' (estado {estacao}); o resto da função é o mesmo da seção 53.
insert into public.loja_itens (id, nome, descricao, espaco, preco, dados, ordem) values
  ('movel-caixa', 'Caixa de som', 'Escolha a estação e quem estiver no seu quarto ouve junto.', 'movel', 600, '{"w":1,"d":1,"desenho":"caixa"}', 215)
on conflict (id) do update set nome = excluded.nome, descricao = excluded.descricao, espaco = excluded.espaco,
  preco = excluded.preco, dados = excluded.dados, ordem = excluded.ordem;

create or replace function public.usar_movel(p_id bigint, p_arg text default null) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  v_dono uuid;
  v_est jsonb;
  v_des text;
  v_txt text;
begin
  if v_uid is null or not public.eh_membro() then raise exception 'Só os membros mexem nos móveis.' using errcode = 'P0001'; end if;
  select q.user_id, q.estado, l.dados->>'desenho' into v_dono, v_est, v_des
    from public.quarto_moveis q join public.loja_itens l on l.id = q.item_id where q.id = p_id for update of q;
  if not found then raise exception 'Esse móvel não está mais aí.' using errcode = 'P0001'; end if;
  if v_des in ('luminaria', 'regulador', 'recado', 'caixa') and v_dono <> v_uid then
    raise exception 'Só o dono do quarto mexe nisso.' using errcode = 'P0001';
  end if;
  perform public.limitar('movel', 30, interval '1 minute', 'Calma: muitos toques seguidos.');
  if v_des = 'dado' then
    v_est := jsonb_build_object('n', 1 + floor(random() * 6)::int, 'em', (extract(epoch from clock_timestamp()) * 1000)::bigint);
  elsif v_des = 'luminaria' then
    v_est := jsonb_build_object('liga', not coalesce((v_est->>'liga')::boolean, true));
  elsif v_des = 'regulador' then
    if p_arg is null or p_arg not in ('desligado', 'ambar', 'azul', 'rosa', 'verde', 'roxo') then
      raise exception 'Escolha uma das cores.' using errcode = 'P0001';
    end if;
    v_est := jsonb_build_object('cor', p_arg);
  elsif v_des = 'recado' then
    v_txt := left(btrim(regexp_replace(coalesce(p_arg, ''), '[\x00-\x1F\x7F]', ' ', 'g')), 120);
    v_est := case when v_txt = '' then '{}'::jsonb else jsonb_build_object('texto', v_txt) end;
  elsif v_des = 'caixa' then
    if p_arg is null or p_arg not in ('desligada', 'lofi', 'eletro', 'samba') then
      raise exception 'Escolha uma das estações.' using errcode = 'P0001';
    end if;
    v_est := jsonb_build_object('estacao', p_arg);
  else
    raise exception 'Esse móvel não faz nada.' using errcode = 'P0001';
  end if;
  update public.quarto_moveis set estado = v_est where id = p_id;
  return v_est;
end $$;
revoke all on function public.usar_movel(bigint, text) from public, anon;
grant execute on function public.usar_movel(bigint, text) to authenticated;

-- 61) grupos e efeitos no boneco, como no Habbo (03/11/2026, pedido do João) --------------------------------------------
--   Efeitos: itens do espaço 'efeito' (brilho, fogo nos pés, fantasma, arco-íris), comprados e equipados como os
--   acessórios (o equipar de sempre desliga o outro efeito). Grupos: cada membro cria um (500 moedas, com nome, cor e
--   símbolo) ou entra no de alguém; um grupo por pessoa. Todos leem grupos e membros (o grupo aparece no perfil).
alter table public.loja_itens drop constraint if exists loja_itens_espaco_check;
alter table public.loja_itens add constraint loja_itens_espaco_check
  check (espaco in ('cadeira', 'mesa', 'tapete', 'poster', 'planta', 'parede', 'luz', 'titulo', 'moldura', 'escudo', 'consumivel', 'celular', 'cabeca', 'quarto', 'movel', 'efeito', 'chave'));

insert into public.loja_itens (id, nome, descricao, espaco, preco, dados, ordem) values
  ('efeito-brilho',   'Brilho dourado', 'O seu boneco brilha como quem ganhou o jackpot.', 'efeito', 800,  '{"cor":"brilho"}', 300),
  ('efeito-fogo',     'Fogo nos pés',   'Chamas nos pés por onde você anda.',             'efeito', 1200, '{"cor":"fogo"}', 301),
  ('efeito-fantasma', 'Fantasma',       'Meio transparente, flutuando de leve.',          'efeito', 1000, '{"cor":"fantasma"}', 302),
  ('efeito-arco',     'Arco-íris',      'As cores do boneco vão mudando sem parar.',      'efeito', 1500, '{"cor":"arco"}', 303)
on conflict (id) do update set nome = excluded.nome, descricao = excluded.descricao, espaco = excluded.espaco,
  preco = excluded.preco, dados = excluded.dados, ordem = excluded.ordem;

create table if not exists public.grupos (
  id        bigint generated always as identity primary key,
  nome      text not null check (char_length(nome) between 2 and 24),
  cor       text not null check (cor in ('ouro', 'oliva', 'ardosia', 'vermelho', 'azul', 'roxo')),
  simbolo   text not null check (simbolo in ('estrela', 'coroa', 'raio', 'caveira', 'coracao', 'fogo', 'trevo', 'espada')),
  dono      uuid not null references auth.users(id) on delete cascade,
  criado_em timestamptz not null default now()
);
create unique index if not exists grupos_nome on public.grupos (lower(nome));
create table if not exists public.grupo_membros (
  user_id  uuid primary key references auth.users(id) on delete cascade,
  grupo_id bigint not null references public.grupos(id) on delete cascade,
  desde    timestamptz not null default now()
);
alter table public.grupos enable row level security;
alter table public.grupo_membros enable row level security;
revoke all on public.grupos, public.grupo_membros from public, anon, authenticated;
grant select on public.grupos, public.grupo_membros to authenticated;
drop policy if exists grupos_ler on public.grupos;
create policy grupos_ler on public.grupos for select to authenticated using (public.eh_membro());
drop policy if exists grupo_membros_ler on public.grupo_membros;
create policy grupo_membros_ler on public.grupo_membros for select to authenticated using (public.eh_membro());
do $$
begin
  begin alter publication supabase_realtime add table public.grupos; exception when duplicate_object then null; end;
  begin alter publication supabase_realtime add table public.grupo_membros; exception when duplicate_object then null; end;
end $$;

-- grupo_criar(nome, cor, símbolo): 500 moedas (motivo 'loja'); quem já está num grupo sai antes
create or replace function public.grupo_criar(p_nome text, p_cor text, p_simbolo text) returns bigint
language plpgsql security definer set search_path = public as $$
declare
  v_uid  uuid := auth.uid();
  v_nome text := left(btrim(regexp_replace(coalesce(p_nome, ''), '[\x00-\x1F\x7F]', ' ', 'g')), 24);
  v_id   bigint;
begin
  if v_uid is null or not public.eh_membro() then raise exception 'Só os membros criam grupos.' using errcode = 'P0001'; end if;
  if char_length(v_nome) < 2 then raise exception 'O nome precisa de pelo menos 2 letras.' using errcode = 'P0001'; end if;
  if exists (select 1 from public.grupo_membros where user_id = v_uid) then raise exception 'Saia do seu grupo antes de criar outro.' using errcode = 'P0001'; end if;
  if exists (select 1 from public.grupos where lower(nome) = lower(v_nome)) then raise exception 'Já existe um grupo com esse nome.' using errcode = 'P0001'; end if;
  perform public.limitar('grupo', 5, interval '1 hour', 'Calma: muitos grupos seguidos.');
  perform public.creditar(v_uid, -500, 'loja', 'grupo');
  insert into public.grupos (nome, cor, simbolo, dono) values (v_nome, p_cor, p_simbolo, v_uid) returning id into v_id;
  insert into public.grupo_membros (user_id, grupo_id) values (v_uid, v_id);
  return v_id;
end $$;
revoke all on function public.grupo_criar(text, text, text) from public, anon;
grant execute on function public.grupo_criar(text, text, text) to authenticated;

-- grupo_entrar(grupo): um grupo por pessoa
create or replace function public.grupo_entrar(p_id bigint) returns void
language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null or not public.eh_membro() then raise exception 'Só os membros entram em grupos.' using errcode = 'P0001'; end if;
  if not exists (select 1 from public.grupos where id = p_id) then raise exception 'Esse grupo não existe mais.' using errcode = 'P0001'; end if;
  if exists (select 1 from public.grupo_membros where user_id = v_uid) then raise exception 'Saia do seu grupo antes de entrar em outro.' using errcode = 'P0001'; end if;
  perform public.limitar('grupo_entrar', 20, interval '1 hour', 'Calma: muitas trocas de grupo.');
  insert into public.grupo_membros (user_id, grupo_id) values (v_uid, p_id);
end $$;
revoke all on function public.grupo_entrar(bigint) from public, anon;
grant execute on function public.grupo_entrar(bigint) to authenticated;

-- grupo_sair(): sai; se for o dono, o grupo acaba (todo mundo sai junto)
create or replace function public.grupo_sair() returns void
language plpgsql security definer set search_path = public as $$
begin
  delete from public.grupos where dono = auth.uid();
  delete from public.grupo_membros where user_id = auth.uid();
end $$;
revoke all on function public.grupo_sair() from public, anon;
grant execute on function public.grupo_sair() to authenticated;

-- 62) chaves das casas (03/11/2026, pedido do João): para entrar na Pirapó 114 (cena especial, das fotos) é preciso ter a
--   chave, um raro de 5.000 moedas (seção 55: numerado, 14 no mundo). As chaves da casa do Alemão, da casa do Gordão e
--   da baia da Vó Lia ficam guardadas (ativo = false) até as cenas delas existirem. Espaço novo 'chave' (não se equipa;
--   compra única). A porta da cena confere a chave na mochila de quem entra (a cena é só desenho: não há dado a proteger).
alter table public.loja_itens drop constraint if exists loja_itens_espaco_check;
alter table public.loja_itens add constraint loja_itens_espaco_check
  check (espaco in ('cadeira', 'mesa', 'tapete', 'poster', 'planta', 'parede', 'luz', 'titulo', 'moldura', 'escudo', 'consumivel', 'celular', 'cabeca', 'quarto', 'movel', 'efeito', 'chave'));

insert into public.loja_itens (id, nome, descricao, espaco, preco, dados, ordem, estoque, ativo) values
  ('chave-pirapo', 'Chave da Pirapó 114',   'Raro: abre a Pirapó 114. Só 14 cópias, cada uma com o seu número.', 'chave', 5000, '{"cena":"pirapo"}', 100, 14, true),
  ('chave-alemao', 'Chave da casa do Alemão', 'Raro: abre a casa do Alemão.',  'chave', 5000, '{"cena":"alemao"}', 101, 14, false),
  ('chave-gordao', 'Chave da casa do Gordão', 'Raro: abre a casa do Gordão.',  'chave', 5000, '{"cena":"gordao"}', 102, 14, false),
  ('chave-vo-lia', 'Chave da baia da Vó Lia', 'Raro: abre a baia da Vó Lia.', 'chave', 5000, '{"cena":"volia"}', 103, 14, false)
on conflict (id) do update set nome = excluded.nome, descricao = excluded.descricao, espaco = excluded.espaco,
  preco = excluded.preco, dados = excluded.dados, ordem = excluded.ordem, estoque = excluded.estoque;

-- 63) Pedro no K-FOFO (03/11/2026, pedido do Felippe) ------------------------------------------------------------------
--   Um botão na parede do K-FOFO: por 200 moedas, toca "pedro pedro pedro" para todo mundo que está no K-FOFO, com
--   a discoteca acesa enquanto a música dura (~12 s). Uma música por vez: enquanto toca, ninguém paga outra.
--   O site só toca o som: quem decide, cobra e avisa é o banco (a linha nova chega a todos pelo tempo real).
create table if not exists public.kfofo_pedro (
  id      bigint generated always as identity primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  em      timestamptz not null default now()
);
alter table public.kfofo_pedro enable row level security;
revoke all on public.kfofo_pedro from anon, authenticated;
grant select on public.kfofo_pedro to authenticated;
drop policy if exists "membros veem o pedro" on public.kfofo_pedro;
create policy "membros veem o pedro" on public.kfofo_pedro for select to authenticated using (public.eh_membro());

/** quanto dura a música (com folga): enquanto isso, não dá para tocar outra */
create or replace function public.pedro_tocar() returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  v_id bigint;
  v_saldo int;
begin
  if v_uid is null or not public.eh_membro() then raise exception 'Só os membros tocam o Pedro.' using errcode = 'P0001'; end if;
  perform pg_advisory_xact_lock(hashtext('kfofo_pedro'));
  if exists (select 1 from public.kfofo_pedro where em > now() - interval '13 seconds') then
    raise exception 'O Pedro já está tocando. Espere acabar.' using errcode = 'P0001';
  end if;
  perform public.limitar('pedro', 6, interval '10 minutes', 'Calma: muito Pedro seguido. Espere uns minutos.');
  v_saldo := public.creditar(v_uid, -200, 'loja', 'pedro');
  insert into public.kfofo_pedro (user_id) values (v_uid) returning id into v_id;
  delete from public.kfofo_pedro where em < now() - interval '1 day';
  return jsonb_build_object('id', v_id, 'saldo', v_saldo);
end $$;
revoke all on function public.pedro_tocar() from public, anon;
grant execute on function public.pedro_tocar() to authenticated;

/** o Pedro que está tocando agora (para quem chega no meio): id, quem pagou e há quantos ms começou */
create or replace function public.pedro_agora() returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  r record;
begin
  if not public.eh_membro() then return null; end if;
  select id, user_id, em into r from public.kfofo_pedro where em > now() - interval '13 seconds' order by id desc limit 1;
  if not found then return null; end if;
  return jsonb_build_object('id', r.id, 'user_id', r.user_id, 'passou_ms', (extract(epoch from now() - r.em) * 1000)::int);
end $$;
revoke all on function public.pedro_agora() from public, anon;
grant execute on function public.pedro_agora() to authenticated;

do $$
begin
  begin alter publication supabase_realtime add table public.kfofo_pedro; exception when duplicate_object then null; end;
end $$;

-- 64) apostas até o saldo, como num cassino de verdade (03/11/2026, pedido do grupo) --------------------------------
-- Em todos os jogos com aposta dá para apostar de 5 moedas até tudo o que a pessoa tem: o teto é o saldo, que o
-- creditar() já confere (sem saldo, falha com 'Saldo insuficiente.' e nada muda). Antes: 100 por aposta (aviãozinho,
-- pênalti, caça-níquel, apostas no LoL e no truco), 200 no blackjack, 100 por ficha e 1.000 por rodada na roleta e
-- 100 big blinds no pôquer. Continuam: o mínimo de 5, as 30 fichas por rodada da roleta e os 20 big blinds para sentar
-- no pôquer. As funções não são escritas de novo aqui: o bloco abaixo pega cada uma como está no banco e troca só o
-- trecho do limite (como a seção 39 faz), então nada mais muda nelas. Pode rodar de novo.
alter table public.cassino_apostas drop constraint if exists cassino_apostas_aposta_check;
alter table public.cassino_apostas add constraint cassino_apostas_aposta_check check (aposta >= 5);
alter table public.mesa_apostas drop constraint if exists mesa_apostas_aposta_check;
alter table public.mesa_apostas add constraint mesa_apostas_aposta_check check (aposta >= 5);
alter table public.aviao_voos drop constraint if exists aviao_voos_aposta_check;
alter table public.aviao_voos add constraint aviao_voos_aposta_check check (aposta >= 5);
alter table public.penalti_jogos drop constraint if exists penalti_jogos_aposta_check;
alter table public.penalti_jogos add constraint penalti_jogos_aposta_check check (aposta >= 5);
alter table public.bj_maos drop constraint if exists bj_maos_aposta_check;
alter table public.bj_maos add constraint bj_maos_aposta_check check (aposta >= 5);
alter table public.apostas drop constraint if exists apostas_valor_check;
alter table public.apostas add constraint apostas_valor_check check (valor >= 5);
alter table public.truco_apostas drop constraint if exists truco_apostas_valor_check;
alter table public.truco_apostas add constraint truco_apostas_valor_check check (valor >= 5);

do $$
declare
  v_fn    text;
  v_def   text;
  v_novo  text;
  v_achou boolean;
  -- {função, obrigatória (as dos jogos na tela; as antigas, fora do site, só se existirem)}
  v_lista text[][] := array[
    ['mesa_apostar_roleta', 's'], ['mesa_apostar_aviao', 's'], ['penalti_comecar', 's'], ['apostar_slot', 's'],
    ['bj_apostar', 's'], ['pk_sentar', 's'], ['apostar_partida', 's'], ['apostar_truco', 's'],
    ['apostar_roleta', 'n'], ['apostar_limbo', 'n'], ['apostar_dado', 'n'], ['aviao_decolar', 'n'], ['apostar_roleta_mesa', 'n']];
  i int;
begin
  for i in 1 .. array_length(v_lista, 1) loop
    v_fn := v_lista[i][1];
    v_achou := false;
    for v_def in select pg_get_functiondef(oid) from pg_proc where pronamespace = 'public'::regnamespace and proname = v_fn loop
      v_achou := true;
      v_novo := v_def;
      -- uma aposta só: de 5 para cima
      v_novo := replace(v_novo, 'p_aposta not between 5 and 100', 'p_aposta < 5');
      v_novo := replace(v_novo, 'p_aposta not between 5 and 200', 'p_aposta < 5');
      v_novo := replace(v_novo, '''A aposta vai de 5 a 100 moedas.''', '''A aposta mínima é 5 moedas.''');
      v_novo := replace(v_novo, '''A aposta vai de 5 a 200 moedas.''', '''A aposta mínima é 5 moedas.''');
      v_novo := replace(v_novo, 'p_valor < 5 or p_valor > 100', 'p_valor < 5');
      v_novo := replace(v_novo, '''Aposte de 5 a 100 moedas.''', '''A aposta mínima é 5 moedas.''');
      -- roleta: cada lugar de 5 para cima, sem teto na rodada (as 30 fichas continuam)
      v_novo := replace(v_novo, 'v_ap not between 5 and 100', 'v_ap < 5');
      v_novo := replace(v_novo, '''Cada ficha vai de 5 a 100 moedas.''', '''Cada lugar da mesa vai de 5 moedas para cima.''');
      v_novo := replace(v_novo, '    if v_ant.aposta + v_total > 1000 then raise exception ''No máximo 1.000 moedas por rodada.'' using errcode = ''P0001''; end if;' || chr(10), '');
      v_novo := replace(v_novo, '  elsif v_total > 1000 then raise exception ''No máximo 1.000 moedas por rodada.'' using errcode = ''P0001'';' || chr(10), '');
      v_novo := replace(v_novo, '  if v_total > 1000 then raise exception ''No máximo 1.000 moedas por rodada.'' using errcode = ''P0001''; end if;' || chr(10), '');
      -- pôquer: senta com pelo menos 20 big blinds e até tudo o que tem
      v_novo := replace(v_novo, 'p_fichas < m.blind * 20 or p_fichas > m.blind * 100', 'p_fichas < m.blind * 20');
      v_novo := replace(v_novo, '''Nesta mesa se senta com % a % fichas.'', m.blind * 20, m.blind * 100', '''Nesta mesa se senta com pelo menos % fichas.'', m.blind * 20');
      if v_novo <> v_def then
        execute v_novo;
      elsif v_lista[i][2] = 's' and v_def !~ '(p_aposta < 5|p_valor < 5|v_ap < 5|p_fichas < m\.blind \* 20 then)' then
        raise exception 'Seção 64: não achei o limite em %(): confira se a função mudou.', v_fn;
      end if;
    end loop;
    if not v_achou and v_lista[i][2] = 's' then
      raise exception 'Seção 64: a função %() não existe no banco.', v_fn;
    end if;
  end loop;
end $$;

-- 12) confere: deve listar as 6 proteções, as 4 funções das moedas, as 2 tabelas da ficha, as 4 funções dos atributos, as 4 salas, as 6 funções do cassino, as 2 da presença, as 4 do rodízio, as 2 da zoeira, as 3 dos troféus, as 2 dos eventos, as 4 da loja, as 5 do truco, as 6 do bingo, a das missões, as 3 tabelas de mídias e links, as 3 da rede nanica, as 3 funções das apostas, as 3 de respeitos e emblemas, a roleta de mesa, as 4 do aviãozinho, as 5 das mesas ao vivo, as 4 do pênalti, as 2 tabelas dos stories e as mensagens, a bolsa, as 3 dos amigos e as 3 tabelas e 6 funções do truco valendo e as 2 tabelas e 3 funções do quarto próprio e as 2 tabelas e 3 funções do blackjack e as 4 tabelas e 6 funções do pôquer
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
union all
select proname::text, 'trofeus' from pg_proc
 where pronamespace = 'public'::regnamespace and proname in ('semana_vez', 'trofeus_pagar', 'hall_da_fama')
union all
select proname::text, 'eventos' from pg_proc
 where pronamespace = 'public'::regnamespace and proname in ('agora_br', 'churrasco_pegar')
union all
select proname::text, 'loja' from pg_proc
 where pronamespace = 'public'::regnamespace and proname in ('comprar', 'equipar', 'usar_item', 'quarto_de')
union all
select proname::text, 'truco' from pg_proc
 where pronamespace = 'public'::regnamespace and proname in ('truco_vez', 'truco_carregar', 'truco_salvar', 'truco_fechar', 'truco_premiar')
union all
select proname::text, 'bingo' from pg_proc
 where pronamespace = 'public'::regnamespace and proname in ('bingo_abrir', 'bingo_nova_cartela', 'bingo_montada', 'bingo_cantar', 'bingo_confirmar', 'bingo_fechar')
union all
select proname::text, 'missoes' from pg_proc
 where pronamespace = 'public'::regnamespace and proname in ('minhas_missoes')
union all
select tablename::text, 'midias' from pg_tables
 where schemaname = 'public' and tablename in ('midias', 'perfil_links', 'mural_links')
union all
select tablename::text, 'rede' from pg_tables
 where schemaname = 'public' and tablename in ('rede_posts', 'rede_curtidas', 'rede_comentarios')
union all
select proname::text, 'apostas' from pg_proc
 where pronamespace = 'public'::regnamespace and proname in ('apostas_abrir', 'apostar_partida', 'apostas_liquidar')
union all
select proname::text, 'emblemas' from pg_proc
 where pronamespace = 'public'::regnamespace and proname in ('dar_respeito', 'meus_respeitos', 'emblemas_de')
union all
select proname::text, 'roleta' from pg_proc
 where pronamespace = 'public'::regnamespace and proname in ('apostar_roleta_mesa')
union all
select proname::text, 'aviao' from pg_proc
 where pronamespace = 'public'::regnamespace and proname in ('aviao_decolar', 'aviao_ver', 'aviao_sacar', 'aviao_mesa')
union all
select proname::text, 'mesas' from pg_proc
 where pronamespace = 'public'::regnamespace and proname in ('mesa_estado', 'mesa_avancar', 'mesa_apostar_roleta', 'mesa_apostar_aviao', 'mesa_sacar_aviao')
union all
select proname::text, 'penalti' from pg_proc
 where pronamespace = 'public'::regnamespace and proname in ('penalti_comecar', 'penalti_chutar', 'penalti_sacar', 'penalti_estado')
union all
select tablename::text, 'stories' from pg_tables
 where schemaname = 'public' and tablename in ('rede_stories', 'rede_stories_vistos', 'rede_mensagens')
union all
select proname::text, 'bolsa' from pg_proc
 where pronamespace = 'public'::regnamespace and proname in ('pedir_bolsa')
union all
select proname::text, 'amigos' from pg_proc
 where pronamespace = 'public'::regnamespace and proname in ('eh_membro', 'criar_login_amigo', 'desativar_amigo')
union all
select tablename::text, 'truco valendo' from pg_tables
 where schemaname = 'public' and tablename in ('truco_bolos', 'truco_mercados', 'truco_apostas')
union all
select proname::text, 'truco valendo' from pg_proc
 where pronamespace = 'public'::regnamespace and proname in ('truco_cobrar', 'truco_devolver', 'truco_mercado_abrir', 'truco_mercado_fechar', 'truco_mercado_liquidar', 'apostar_truco')
union all
select tablename::text, 'quarto' from pg_tables
 where schemaname = 'public' and tablename in ('quartos', 'quarto_moveis')
union all
select proname::text, 'quarto' from pg_proc
 where pronamespace = 'public'::regnamespace and proname in ('quarto_por', 'quarto_mover', 'quarto_guardar')
union all
select tablename::text, 'blackjack' from pg_tables
 where schemaname = 'public' and tablename in ('bj_rodadas', 'bj_maos')
union all
select proname::text, 'blackjack' from pg_proc
 where pronamespace = 'public'::regnamespace and proname in ('bj_estado', 'bj_apostar', 'bj_acao')
union all
select tablename::text, 'pôquer' from pg_tables
 where schemaname = 'public' and tablename in ('pk_mesas', 'pk_lugares', 'pk_maos', 'pk_jog')
union all
select proname::text, 'pôquer' from pg_proc
 where pronamespace = 'public'::regnamespace and proname in ('pk_estado', 'pk_mesas_lista', 'pk_abrir', 'pk_sentar', 'pk_levantar', 'pk_acao')
union all
select tablename::text, 'pênalti x1' from pg_tables
 where schemaname = 'public' and tablename in ('duelos', 'duelo_chutes')
union all
select proname::text, 'pênalti x1' from pg_proc
 where pronamespace = 'public'::regnamespace and proname in ('duelo_abrir', 'duelo_entrar', 'duelo_cancelar', 'duelo_escolher', 'duelo_estado', 'duelo_lista')
order by 2, 1;
