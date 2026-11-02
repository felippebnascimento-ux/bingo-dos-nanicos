-- Bingo dos Nanicos: contas por nanico + sala privada para o Ao vivo
-- Cole tudo no SQL Editor do Supabase e clique em "Run". Pode rodar de novo sem problema.
-- Depois disso, só quem tiver login consegue ver e usar o site.

-- 1) cada conta fica ligada a um nanico -------------------------------------
alter table public.friends add column if not exists user_id  uuid unique references auth.users(id) on delete set null;
alter table public.friends add column if not exists username text unique;
alter table public.phrases add column if not exists created_by uuid default auth.uid() references auth.users(id) on delete set null;

-- "é um nanico?": a pessoa está logada E a conta dela está ligada a um nanico
create or replace function public.eh_nanico() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.friends where user_id = auth.uid());
$$;
revoke all on function public.eh_nanico() from public, anon;
grant execute on function public.eh_nanico() to authenticated;

-- 2) permissões: só nanicos logados -----------------------------------------
--    podem: ver tudo, cadastrar nanicadas e mudar a escalação
--    não podem: mudar nome ou foto, apagar ou editar nanicadas
revoke all on public.friends, public.phrases, public.game from anon, authenticated;
grant select on public.friends, public.phrases, public.game to authenticated;
grant insert (text, friend_id, champions) on public.phrases to authenticated;
grant update (players, updated_at) on public.game to authenticated;

drop policy if exists "publico_tudo"    on public.friends;
drop policy if exists "publico_tudo"    on public.phrases;
drop policy if exists "publico_tudo"    on public.game;
drop policy if exists "ler"             on public.friends;
drop policy if exists "trocar_foto"     on public.friends;
drop policy if exists "ler"             on public.phrases;
drop policy if exists "cadastrar"       on public.phrases;
drop policy if exists "ler"             on public.game;
drop policy if exists "mudar_escalacao" on public.game;
drop policy if exists "nanicos leem"    on public.friends;
drop policy if exists "nanicos leem"    on public.phrases;
drop policy if exists "nanicos cadastram" on public.phrases;
drop policy if exists "nanicos leem"    on public.game;
drop policy if exists "nanicos mudam a escalacao" on public.game;

create policy "nanicos leem"      on public.friends for select to authenticated using (public.eh_nanico());
create policy "nanicos leem"      on public.phrases for select to authenticated using (public.eh_nanico());
create policy "nanicos cadastram" on public.phrases for insert to authenticated with check (public.eh_nanico());
create policy "nanicos leem"      on public.game    for select to authenticated using (public.eh_nanico());
create policy "nanicos mudam a escalacao" on public.game for update to authenticated
  using (id = 1 and public.eh_nanico()) with check (id = 1 and public.eh_nanico());

-- 3) sala privada (quem está online, Ao vivo e atualizações) -----------------
drop policy if exists "nanicos entram na sala" on realtime.messages;
drop policy if exists "nanicos falam na sala"  on realtime.messages;
create policy "nanicos entram na sala" on realtime.messages for select to authenticated
  using (realtime.topic() = 'bingo-dos-nanicos' and public.eh_nanico());
create policy "nanicos falam na sala"  on realtime.messages for insert to authenticated
  with check (realtime.topic() = 'bingo-dos-nanicos' and public.eh_nanico());

-- 4) chat da sala (aba Ao vivo) ---------------------------------------------------
--    o autor é sempre quem está logado (ninguém manda mensagem no nome de outro)
create table if not exists public.chat_messages (
  id         bigint generated always as identity primary key,
  user_id    uuid not null default auth.uid() references auth.users(id) on delete cascade,
  text       text not null check (char_length(trim(text)) between 1 and 300),
  created_at timestamptz not null default now()
);
create index if not exists chat_messages_created_at on public.chat_messages (created_at desc);
alter table public.chat_messages enable row level security;
revoke all on public.chat_messages from anon, authenticated;
grant select on public.chat_messages to authenticated;
grant insert (text) on public.chat_messages to authenticated;
drop policy if exists "nanicos leem o chat"     on public.chat_messages;
drop policy if exists "nanicos escrevem no chat" on public.chat_messages;
create policy "nanicos leem o chat"      on public.chat_messages for select to authenticated using (public.eh_nanico());
create policy "nanicos escrevem no chat" on public.chat_messages for insert to authenticated
  with check (public.eh_nanico() and user_id = auth.uid());

-- guarda só os últimos 30 dias de conversa
create or replace function public.limpar_chat_antigo() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  delete from public.chat_messages where created_at < now() - interval '30 days';
  return null;
end $$;
drop trigger if exists limpar_chat on public.chat_messages;
create trigger limpar_chat after insert on public.chat_messages for each statement execute function public.limpar_chat_antigo();

do $$
begin
  begin alter publication supabase_realtime add table public.chat_messages; exception when duplicate_object then null; end;
end $$;

-- 5) ferramentas do admin -----------------------------------------------------
-- Cria o login de um nanico (no primeiro acesso o site pede uma senha nova). Uso:  select public.criar_login_nanico('Pin', 'pin', 'senha123');
create or replace function public.criar_login_nanico(p_nome text, p_usuario text, p_senha text)
returns text language plpgsql security definer set search_path = public, auth, extensions as $$
declare
  v_friend uuid;
  v_uid    uuid := gen_random_uuid();
  v_user   text := lower(trim(p_usuario));
  v_email  text := lower(trim(p_usuario)) || '@nanicos.app';
begin
  if v_user !~ '^[a-z0-9._-]{2,30}$' then
    raise exception 'Usuário "%" inválido: use só letras sem acento, números, ponto, traço ou _', p_usuario;
  end if;
  if length(p_senha) < 6 then raise exception 'A senha de % precisa ter pelo menos 6 caracteres', p_nome; end if;
  select id into v_friend from public.friends where lower(name) = lower(trim(p_nome));
  if v_friend is null then raise exception 'Nanico "%" não encontrado na tabela friends', p_nome; end if;
  if exists (select 1 from public.friends where id = v_friend and user_id is not null) then
    raise exception '% já tem login', p_nome;
  end if;
  if exists (select 1 from auth.users where email = v_email) then
    raise exception 'O usuário "%" já existe', v_user;
  end if;

  insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
    raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
    confirmation_token, email_change, email_change_token_new, recovery_token)
  values ('00000000-0000-0000-0000-000000000000', v_uid, 'authenticated', 'authenticated', v_email,
    extensions.crypt(p_senha, extensions.gen_salt('bf')), now(),
    '{"provider":"email","providers":["email"]}'::jsonb, jsonb_build_object('nanico', p_nome, 'must_change', true), now(), now(),
    '', '', '', '');

  insert into auth.identities (id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
  values (gen_random_uuid(), v_uid, v_uid::text,
    jsonb_build_object('sub', v_uid::text, 'email', v_email, 'email_verified', true),
    'email', now(), now(), now());

  update public.friends set user_id = v_uid, username = v_user where id = v_friend;
  return p_nome || ' → usuário: ' || v_user;
end $$;
revoke all on function public.criar_login_nanico(text, text, text) from public, anon, authenticated;

-- Troca a senha de alguém que esqueceu. Uso:  select public.resetar_senha_nanico('pin', 'novaSenha');
create or replace function public.resetar_senha_nanico(p_usuario text, p_senha text)
returns text language plpgsql security definer set search_path = public, auth, extensions as $$
begin
  if length(p_senha) < 6 then raise exception 'A senha precisa ter pelo menos 6 caracteres'; end if;
  -- depois do reset, a pessoa escolhe uma senha nova no próximo login
  update auth.users set encrypted_password = extensions.crypt(p_senha, extensions.gen_salt('bf')), updated_at = now(),
         raw_user_meta_data = coalesce(raw_user_meta_data, '{}'::jsonb) || '{"must_change": true}'::jsonb
   where email = lower(trim(p_usuario)) || '@nanicos.app';
  if not found then raise exception 'Usuário "%" não encontrado', p_usuario; end if;
  return 'senha trocada para ' || lower(trim(p_usuario));
end $$;
revoke all on function public.resetar_senha_nanico(text, text) from public, anon, authenticated;

-- Para conferir quem já tem login:
-- select f.name, f.username, u.last_sign_in_at from public.friends f left join auth.users u on u.id = f.user_id order by f.name;
