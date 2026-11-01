-- Bingo dos Nanicos: renomeia Dion → John e Maino → Max (e ajusta Le Bubu)
-- Cole no SQL Editor do Supabase e clique em "Run".
update public.friends set name = 'John'    where name = 'Dion';
update public.friends set name = 'Max'     where name = 'Maino';
update public.friends set name = 'Le Bubu' where name = 'Le bubu';

-- confere o resultado
select name from public.friends order by name;
