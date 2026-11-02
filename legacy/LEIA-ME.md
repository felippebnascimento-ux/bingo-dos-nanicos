# Bingo da Rift: Supabase + Vercel

## 1. Supabase: criar o banco
1. supabase.com/dashboard → **New project**. Nome `bingo-da-rift`, região **South America (São Paulo)**, qualquer senha de banco. Espere criar.
2. Menu esquerdo → **SQL Editor** → **New query** → cole todo o `supabase.sql` → **Run**. Deve aparecer "Success. No rows returned".

## 2. Supabase: pegar URL e chave
1. **Project Settings** (engrenagem) → **API Keys** (ou **Data API**).
2. Copie a **Project URL** (`https://xxxx.supabase.co`).
3. Copie a chave **publishable** (`sb_publishable_...`) ou, no formato antigo, a **anon public**. Nunca a `secret`/`service_role`.

## 3. Colar no site
No `index.html`, troque:
```js
const SUPABASE_URL = "COLE_AQUI_A_PROJECT_URL";
const SUPABASE_KEY = "COLE_AQUI_A_PUBLISHABLE_KEY";
```

## 4. Cadastrar os amigos (só você)
Supabase → **Table Editor** → tabela **friends** → **Insert** → **Insert row** → preencha só **name** → **Save**. Repita para cada amigo.
As fotos cada um coloca pelo site, em Amigos → "Trocar foto".

## 5. Vercel: publicar (pelo GitHub)
1. github.com → **New repository** → nome `bingo-da-rift` → **Create repository**.
2. Na página do repositório: **uploading an existing file** → arraste `index.html` → **Commit changes**.
3. vercel.com → **Add New… → Project** → **Import** o repositório `bingo-da-rift`.
4. Framework Preset: **Other**. Não mexa em Build/Output → **Deploy**.
5. O link sai como `bingo-da-rift.vercel.app` (ou parecido). Mande para o grupo.

Para atualizar: suba o `index.html` novo no GitHub (Add file → Upload files). A Vercel publica sozinha em ~30 s.

## Tarefas de admin (Supabase → Table Editor)
- **Apagar frase:** tabela `phrases` → marque a linha → **Delete**.
- **Renomear amigo:** tabela `friends` → clique duas vezes no nome → edite → Enter.
- **Tirar amigo:** tabela `friends` → marque → **Delete**. As frases dele viram genéricas.

## O que o público pode fazer
Cadastrar frases, trocar foto dos amigos e montar a escalação. Isso é travado no banco, então não dá para contornar pelo navegador.

Projetos grátis do Supabase pausam após ~1 semana sem acesso: se acontecer, clique em **Restore project** no painel.
