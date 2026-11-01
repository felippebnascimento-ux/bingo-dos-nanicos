# Bingo dos Nanicos

Site privado do grupo: bingo de nanicadas, live com câmera e chat, partida ao vivo da Riot e truco gaudério.

Feito com **Next.js + React + TypeScript**, banco e login no **Supabase**, publicado na **Vercel**.
As regras do projeto (segurança, padrão de código, visual e dados) estão no [CLAUDE.md](CLAUDE.md). Leia antes de mexer.

## Rodar no computador

Precisa do [Node.js](https://nodejs.org) 20 ou mais novo.

```bash
npm install
npm run dev
```

Abra http://localhost:8810 e entre com o seu usuário de nanico.

## Antes de mandar uma mudança

```bash
npm run check
```

Esse comando confere os tipos, o lint e os testes, e gera o site em `out/`. Para ver o site gerado, rode `npm start` e abra http://localhost:8811.

## Publicar

A Vercel publica sozinha a cada push na branch principal, e cada Pull Request ganha um link de preview.
Na Vercel, o projeto usa o preset **Next.js**. O `vercel.json` já diz isso e também guarda os cabeçalhos de segurança.

## Supabase

- **SQL:** fica em `supabase/sql/`. O principal é o `seguranca.sql`, que pode rodar de novo sem quebrar nada.
- **Função da Riot:** fica em `supabase/functions/riot-ao-vivo/`. A chave da Riot mora só no segredo `RIOT_API_KEY` do Supabase.
- **Logins:** quem cria é o admin, com `criar_login_nanico(nome, usuario, senha)`. O arquivo com as senhas iniciais (`criar-logins.sql`) **nunca** vai para o GitHub.
