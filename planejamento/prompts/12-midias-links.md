# Fase 12: Mídias (prints do grupo) e links (no perfil e num mural)

**Branch:** `midias-links` · **Depende de:** fase 5 (salas, para marcar de qual sala veio) · **Banco:** sim · **Storage:** bucket novo

## Objetivo (para quem usa)
- **Mídias:**
  - galeria de **prints e imagens** do grupo (jogadas, memes);
  - qualquer nanico manda, todos veem, cada um apaga o que mandou;
  - **vídeo entra como link** (YouTube, Medal, Twitch clip), não como arquivo, porque o plano grátis do Supabase tem 1 GB.
- **Links:**
  - na ficha, cada um mostra os próprios links (Twitch, YouTube, Instagram, TikTok, X, Faceit, Leetify), além de op.gg e Steam;
  - um **mural de links** do grupo junta builds, vídeos e coisas para jogar.

## Antes de começar
Siga as "Regras de toda sessão" de `planejamento/PLANO.md`. Leia:
- `vercel.json` (CSP: `img-src` já aceita `blob:`, `connect-src` já aceita o Supabase do projeto, `frame-src` não existe, então iframe está bloqueado);
- `src/lib/supabase.ts`, `src/features/perfil/opgg.ts` (padrão de validar link) e o `Ficha.tsx` da fase 3.

## Como fazer

### Banco e Storage (seção "16) midias e links" no `seguranca.sql`)
- **Bucket `midias`:** **privado**, `file_size_limit` 5 MB e `allowed_mime_types` `image/webp, image/png, image/jpeg, image/gif`. Crie por SQL de forma idempotente (`insert into storage.buckets … on conflict do update`).
- **Políticas em `storage.objects`** para `bucket_id = 'midias'`:
  - `select` para `eh_nanico()`;
  - `insert` só com `(storage.foldername(name))[1] = auth.uid()::text`;
  - `delete` só do dono.
  - **Use `drop policy if exists`.**
- **`midias`:** `(id, user_id, caminho text unique, legenda text check (char_length ≤ 140), sala text null, link text null, em)`. Ou é um caminho no bucket, ou um link de vídeo, com check.
  - Gatilho de proteção no estilo do `chat_protecao`: limpa a legenda, `limitar('midia', 10, '1 hour')` e no máximo 60 mídias por pessoa.
- **`perfil_links`:** `(friend_id, tipo text check in ('twitch','youtube','instagram','tiktok','x','faceit','leetify'), url text, primary key(friend_id, tipo))`.
  - Um check por tipo com regex do domínio (ex.: `^https://(www\.)?twitch\.tv/[A-Za-z0-9_]{3,25}/?$`).
  - Cada um escreve só nos próprios.
- **`mural_links`:** `(id, user_id, url, titulo text ≤ 80, em)`.
  - `url` só `https://`, até 300 caracteres.
  - Gatilho com `limitar` e autor sempre `auth.uid()`.
  - O autor apaga o próprio link.

### Site
- **Envio:**
  - comprima no navegador **antes de enviar**: canvas → `webp`, lado maior até 1920 px, qualidade 0,82;
  - GIF vai como está, se ≤ 5 MB;
  - caminho `"<uid>/<newId()>.webp"`.
- **Exibir:**
  - `sb().storage.from('midias').download(caminho)` → `URL.createObjectURL`, que já é permitido pela CSP (`blob:`). **Não precisa mudar a CSP.**
  - Revogue as URLs ao desmontar e carregue sob demanda (só o que está na tela).
- **Galeria:**
  - fica em `src/features/midias/MidiasView.tsx` (aba nova ou seção do lobby; decida no plano);
  - grade com legenda, autor (`Avatar`) e sala;
  - clicar abre em tela cheia;
  - apagar com `useSure()`.
- **Links de vídeo e do mural:** abrem em nova aba com `rel="noopener noreferrer"`, sem iframe nem prévia de imagem externa. A CSP bloqueia, e liberar domínios novos não vale a pena aqui.
- **Validação:**
  - `src/features/perfil/links.ts` + teste: `cleanLink(tipo, url)` no molde de `cleanOpgg`;
  - o mural aceita qualquer `https` e mostra o domínio em destaque, para ninguém cair em link disfarçado.
- **Texto:** todo texto (legenda, título) vai por `{}` no JSX, nunca `dangerouslySetInnerHTML`.

## Não faça
- Não deixe o bucket público.
- Não ponha `<iframe>` nem `img` com URL externa nova.
- Não mexa na CSP sem necessidade (aqui não precisa).
- Não aceite arquivo maior que o limite no navegador nem no bucket.

## Pronto quando
- [ ] Sem login, baixar um arquivo do bucket falha.
- [ ] Logado, enviar com um caminho que não começa com o seu uid falha.
- [ ] Um print de 6 MB é comprimido e enviado. Um PDF é recusado.
- [ ] Um link do Twitch inválido mostra o formato certo. Um link `javascript:` no mural é recusado.
- [ ] O console fica sem erro de CSP e funciona com 390 px. O `CLAUDE.md` (bucket, tabelas, aba) e o `CHANGELOG` foram atualizados.

## Entrada do CHANGELOG
`"Mídias: galeria de prints do grupo"`, `"Links de Twitch, YouTube e outros na ficha, e um mural de links do grupo"`
