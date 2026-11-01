-- Bingo dos Nanicos: frases sempre em minúsculas
-- Cole no SQL Editor do Supabase e clique em "Run". Pode rodar de novo sem problema.

-- 1. converte para minúsculas as frases que já existem
update public.phrases set text = lower(text) where text <> lower(text);

-- 2. a partir de agora o banco recusa frase com letra maiúscula
alter table public.phrases drop constraint if exists phrases_text_minusculas;
alter table public.phrases add constraint phrases_text_minusculas check (text = lower(text));
