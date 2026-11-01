-- Bingo da Rift: estrutura do banco no Supabase
-- Cole tudo no SQL Editor do Supabase e clique em "Run". Pode rodar de novo sem problema.
--
-- O que o público (quem abre o site, sem login) pode fazer:
--   frases ......... ver e CADASTRAR (não edita nem apaga)
--   amigos ......... ver e TROCAR A FOTO (não cria, não renomeia, não apaga)
--   escalação ...... ver e alterar (necessário para jogar)
-- Criar/renomear/apagar amigos e apagar frases: só você, pelo Table Editor do Supabase.

create table if not exists public.friends (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(trim(name)) between 1 and 30),
  photo text check (photo is null or (photo like 'data:image/%' and char_length(photo) < 120000)),
  created_at timestamptz not null default now()
);

create table if not exists public.phrases (
  id uuid primary key default gen_random_uuid(),
  text text not null check (char_length(trim(text)) between 1 and 90),
  friend_id uuid references public.friends(id) on delete set null,
  champions text[] not null default '{}' check (coalesce(array_length(champions, 1), 0) <= 20),
  created_at timestamptz not null default now()
);

create table if not exists public.game (
  id int primary key default 1 check (id = 1),
  players jsonb not null default '[]'::jsonb,
  updated_at timestamptz not null default now()
);
insert into public.game (id) values (1) on conflict (id) do nothing;

alter table public.friends enable row level security;
alter table public.phrases enable row level security;
alter table public.game    enable row level security;

-- limpa políticas antigas (inclusive da versão anterior deste arquivo)
drop policy if exists "publico_tudo"   on public.friends;
drop policy if exists "publico_tudo"   on public.phrases;
drop policy if exists "publico_tudo"   on public.game;
drop policy if exists "ler"            on public.friends;
drop policy if exists "trocar_foto"    on public.friends;
drop policy if exists "ler"            on public.phrases;
drop policy if exists "cadastrar"      on public.phrases;
drop policy if exists "ler"            on public.game;
drop policy if exists "mudar_escalacao" on public.game;

-- permissões por coluna: o público só consegue mexer no que está aqui
revoke all on public.friends, public.phrases, public.game from anon, authenticated;
grant select on public.friends, public.phrases, public.game to anon, authenticated;
grant update (photo) on public.friends to anon, authenticated;
grant insert (text, friend_id, champions) on public.phrases to anon, authenticated;
grant update (players, updated_at) on public.game to anon, authenticated;

create policy "ler"             on public.friends for select to anon, authenticated using (true);
create policy "trocar_foto"     on public.friends for update to anon, authenticated using (true) with check (true);
create policy "ler"             on public.phrases for select to anon, authenticated using (true);
create policy "cadastrar"       on public.phrases for insert to anon, authenticated with check (true);
create policy "ler"             on public.game    for select to anon, authenticated using (true);
create policy "mudar_escalacao" on public.game    for update to anon, authenticated using (id = 1) with check (id = 1);

-- atualização ao vivo
do $$
begin
  begin alter publication supabase_realtime add table public.friends; exception when duplicate_object then null; end;
  begin alter publication supabase_realtime add table public.phrases; exception when duplicate_object then null; end;
  begin alter publication supabase_realtime add table public.game;    exception when duplicate_object then null; end;
end $$;

-- frases sempre em minúsculas
update public.phrases set text = lower(text) where text <> lower(text);
alter table public.phrases drop constraint if exists phrases_text_minusculas;
alter table public.phrases add constraint phrases_text_minusculas check (text = lower(text));
