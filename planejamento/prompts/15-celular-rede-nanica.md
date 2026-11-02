# Fase 15: Celular (item da loja) e a rede social nanica

**Branch:** `celular-rede-nanica` · **Depende de:** fase 11 (loja e mochila) e fase 12 (bucket `midias` e a compressão de imagem) · **Banco:** sim

## Objetivo (para quem usa)
- **Celular na loja:** um item novo, "Celular", por **3.000 moedas** (compra única). Quem compra ganha um **celular** no canto do Sítio e no menu.
  - **O preço é alto de propósito:** com o bônus diário e o tempo online, dá umas 70 a 100 moedas por dia, então leva cerca de **um mês** de presença para comprar. É a meta grande da economia, para o pessoal ficar mais tempo no site.
  - A loja mostra quanto falta ("faltam 1.716 moedas") e uma barra de progresso.
- **Dentro do celular:** a tela tem formato de celular (moldura, barra de cima com a hora) e um app só, a **rede social nanica**:
  - **feed** com as postagens de todo mundo, das mais novas para as mais velhas;
  - **postar:** texto de até 500 caracteres e, se quiser, **uma imagem**;
  - **curtir** e **comentar** (até 280 caracteres);
  - **apagar** as próprias postagens e os próprios comentários;
  - **perfil:** tocar no nome de alguém mostra só as postagens dela e um botão "Ver ficha".
- **Quem pode:** postar, curtir e comentar só quem **tem o celular**. Ler o feed também, porque a graça é estar "dentro do celular".
- **Aviso no Sítio:** quando alguém posta, aparece um aviso no canto dos ganhos (fase 14): "Pitoco postou na rede nanica". Quem tem celular vê uma bolinha de não lidas no ícone do celular.

## Antes de começar
Siga as "Regras de toda sessão" de `planejamento/PLANO.md`. Leia:
- o SQL das fases 11 (`loja_itens`, `mochila`, `comprar`) e 12 (bucket `midias`, políticas de `storage.objects`, gatilho de `midias`);
- `src/features/loja/*`, `src/features/midias/*` (compressão e `download` → `blob:`) e o `Cantos.tsx`/`Ganhos.tsx` da fase 14;
- `src/features/chat/*` (padrão de enviar, receber por `postgres_changes` e o gatilho `chat_protecao`).

## Como fazer

### Banco (seção "18) rede nanica" no `seguranca.sql`)
- **Item:** semente idempotente em `loja_itens` com `('celular', 'Celular', espaco 'celular', preco 3000)`. Acrescente `'celular'` ao `check` de `espaco` (troque o `check` com `drop constraint if exists` + `add constraint`).
- **`public.tem_item(p_item text) returns boolean`:** `stable security definer`, olha a `mochila` de `auth.uid()`. Mesmos `revoke`/`grant` da `eh_nanico`.
- **Tabelas:**
  - `rede_posts (id bigint identity pk, user_id uuid default auth.uid() → auth.users, texto text check (char_length(texto) between 1 and 500), midia text null, em timestamptz default now())`, com `midia` obrigatoriamente no formato `rede/<uid>/<id>.webp` do bucket `midias`;
  - `rede_curtidas (post_id → rede_posts on delete cascade, user_id, em, primary key(post_id, user_id))`;
  - `rede_comentarios (id, post_id → rede_posts on delete cascade, user_id, texto check (1..280), em)`.
- **RLS em todas:**
  - `select` com `eh_nanico() and tem_item('celular')`;
  - `insert` com `user_id = auth.uid() and tem_item('celular')`;
  - `delete` só do dono. Ninguém faz `update`.
- **Gatilho `rede_protecao`** (no estilo do `chat_protecao`): força `user_id = auth.uid()`, limpa o texto (`trim`, sem caracteres de controle), `limitar('rede_post', 10, '1 hour')` e `limitar('rede_comentario', 40, '1 hour')`, e confere que a `midia` começa com `rede/<uid>/`.
- **Storage:** a política de `insert` do bucket `midias` (fase 12) passa a aceitar também a pasta `rede/<uid>/`. Use `drop policy if exists` e recrie.
- **Tempo real:** `rede_posts`, `rede_curtidas` e `rede_comentarios` na publicação `supabase_realtime`, com o bloco `exception when duplicate_object`.
- **Sem moedas por postagem ou curtida:** não dá para virar fábrica de moedas.

### Site
- **`src/features/celular/`:** `Celular.tsx` (a moldura, abre por cima de tudo como as portas, fecha com Esc e com o botão "Fechar"), `Rede.tsx` (feed, postar, curtir, comentar) e `rede.ts` (carregar, paginar de 20 em 20, receber por `aoMudarTabela`).
- **Abrir:** o ícone do celular aparece no canto do Sítio (perto da carteira) e no menu **só para quem tem o item**. Quem não tem, não vê o ícone. A loja é que mostra o celular à venda.
- **Imagem:** reaproveite a compressão da fase 12 (webp, até 1920 px, qualidade 0,82) e o `download` → `URL.createObjectURL`. Revogue as URLs ao fechar o celular.
- **Texto** sempre por `{}` no JSX. Links no texto aparecem como texto, sem virar link clicável (fica para depois, se o grupo pedir).
- **Apagar** usa `useSure()`.
- **Celular com 390 px:** o celular ocupa a tela inteira, sem moldura.
- **Não lidas:** a última postagem vista fica em `local` (chave `rede-visto`). É só conveniência.

## Não faça
- Não proteja só escondendo o ícone: quem não tem celular não lê nem posta **pelo banco**.
- Não use `dangerouslySetInnerHTML`, `<iframe>` nem imagem com URL externa.
- Não dê moedas por postar ou curtir.
- Não crie bucket novo: use o `midias` com a pasta `rede/`.

## Pronto quando
- [ ] Sem o celular, `select` e `insert` em `rede_posts` falham pelo banco. Com o celular, funcionam.
- [ ] Comprar o celular duas vezes falha, e o ícone aparece logo depois da compra.
- [ ] Postar com uma imagem de 6 MB comprime e envia. Uma imagem enviada para a pasta de outra pessoa é recusada.
- [ ] Com duas abas, a postagem de uma aparece na outra sem recarregar, com o aviso no Sítio.
- [ ] A 11ª postagem na mesma hora é recusada com uma mensagem clara.
- [ ] O SQL roda duas vezes sem erro, e funciona com 390 px.
- [ ] O `CLAUDE.md` (tabelas, `tem_item`, pasta `rede/` do bucket, chave `rede-visto`, `features/celular`) e o `CHANGELOG` foram atualizados.

## Entrada do CHANGELOG
`"Celular na loja: compre e entre na rede social nanica para postar, curtir e comentar"`
