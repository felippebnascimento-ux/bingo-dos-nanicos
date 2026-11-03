-- Campeões Selados. Aplicar após seguranca.sql.
begin;

create table if not exists public.campeoes_selados (
  jogador uuid not null references public.friends(id) on delete cascade,
  campeao text not null check (char_length(campeao) between 1 and 60 and campeao = btrim(campeao)),
  motivo text not null check (char_length(btrim(motivo)) between 1 and 300 and char_length(motivo) <= 300),
  chaves integer not null check (chaves > 0),
  primary key (jogador, campeao)
);

alter table public.campeoes_selados enable row level security;
revoke all on public.campeoes_selados from public, anon, authenticated;
grant select on public.campeoes_selados to authenticated;
drop policy if exists "nanicos leem selos" on public.campeoes_selados;
create policy "nanicos leem selos" on public.campeoes_selados
  for select to authenticated using (public.eh_nanico());

create or replace function public.registrar_campeao_selado(
  p_jogador uuid, p_campeao text, p_motivo text, p_chaves integer
) returns void language plpgsql security definer set search_path = '' as $$
begin
  if not public.eh_nanico() then
    raise exception 'Só nanicos podem registrar selos.' using errcode = '42501';
  end if;
  if not exists (select 1 from public.friends where id = p_jogador and tipo = 'nanico') then
    raise exception 'Selecione um nanico.';
  end if;
  insert into public.campeoes_selados (jogador, campeao, motivo, chaves)
  values (p_jogador, btrim(p_campeao), btrim(p_motivo), p_chaves)
  on conflict (jogador, campeao) do update
    set motivo = excluded.motivo, chaves = excluded.chaves;
end;
$$;

create or replace function public.quebrar_campeao_selado(p_jogador uuid, p_campeao text)
returns void language plpgsql security definer set search_path = '' as $$
declare restantes integer;
begin
  if not public.eh_nanico() then
    raise exception 'Só nanicos podem quebrar selos.' using errcode = '42501';
  end if;
  select chaves into restantes from public.campeoes_selados
    where jogador = p_jogador and campeao = p_campeao for update;
  if restantes = 1 then
    delete from public.campeoes_selados where jogador = p_jogador and campeao = p_campeao;
  elsif restantes > 1 then
    update public.campeoes_selados set chaves = restantes - 1
      where jogador = p_jogador and campeao = p_campeao;
  end if;
end;
$$;

revoke all on function public.registrar_campeao_selado(uuid, text, text, integer) from public, anon, authenticated;
revoke all on function public.quebrar_campeao_selado(uuid, text) from public, anon, authenticated;
grant execute on function public.registrar_campeao_selado(uuid, text, text, integer) to authenticated;
grant execute on function public.quebrar_campeao_selado(uuid, text) to authenticated;

commit;
