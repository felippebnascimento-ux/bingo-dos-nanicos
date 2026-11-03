# Fase 13: Login para amigo dos nanicos (convidado)

> **Substituída pela fase 30 (`30-amigos-dos-nanicos.md`) em 03/11/2026.** Não implemente esta fase.

**Branch:** `login-convidado` · **Depende de:** fase 5 (salas) · **Banco:** sim

## Objetivo (para quem usa)
Um amigo de fora pode ter um login de **convidado**, criado pelo admin.
- **Pode:** entrar no lobby e nas salas, assistir às lives, ligar câmera, reagir, desenhar na live e usar os chats.
- **Não pode:**
  - criar, editar ou remover nanicadas;
  - mudar a escalação;
  - votar em atributos;
  - ter ficha;
  - ganhar ou gastar moedas.
- **Na lista da sala**, aparece com a etiqueta "convidado".
- Proponha no plano se o convidado joga truco **sem prêmio**, e espere o ok.

## Antes de começar
Siga as "Regras de toda sessão" de `planejamento/PLANO.md`. Leia:
- `supabase/sql/contas-e-ao-vivo.sql` (`eh_nanico`, `criar_login_nanico`, `resetar_senha_nanico`, políticas de `realtime.messages` e do chat);
- **todas** as políticas que usam `eh_nanico()` nos SQLs (liste-as no plano e diga, uma por uma, se o convidado entra ou não);
- `src/lib/dados.ts` (`startSession` manda para `fase: "semNanico"` quem não tem nanico);
- `src/lib/store.ts`, `src/components/portas/Portas.tsx` e `src/components/ui/Avatar.tsx` (tem o rosto com iniciais).

## Como fazer

### Banco (seção "17) convidados" no `seguranca.sql`)
- **`convidados`:** `(user_id uuid pk → auth.users, nome text check (1..30), convidado_por uuid → friends, ativo bool default true, criado_em)`.
  - Nanicos e convidados leem `nome`; ninguém escreve pelo site.
- **`public.eh_convidado()` e `public.eh_membro()`:** a segunda é `eh_nanico() or eh_convidado()`. Ambas `stable security definer`, com os mesmos `revoke`/`grant` da `eh_nanico`.
- **`criar_login_convidado(p_nome, p_usuario, p_senha, p_quem_convidou)`:**
  - copie o padrão de `criar_login_nanico` (`auth.users` + `auth.identities`, e-mail `usuario@nanicos.app`, `must_change: true`), com `convidado: true` no metadata;
  - `revoke` de todos, porque só o admin roda pelo SQL Editor.
- **`desativar_convidado(p_usuario)`:** `ativo = false`. O `eh_convidado()` só aceita convidados ativos.
- **Troque `eh_nanico()` por `eh_membro()`** só onde o convidado entra:
  - leitura de `friends` (nomes) e `salas`;
  - chat (ler e escrever);
  - políticas de `realtime.messages` do lobby e das salas.
  - Na leitura de `phrases`/`game`, só se a cartela ou a live precisarem; diga no plano.
- **Todo o resto continua `eh_nanico()`:** nanicadas, escalação, votos, moedas, cassino, loja e mídias (decida no plano se o convidado vê as mídias).

### Site
- **`startSession`:** se não há nanico mas a conta é convidado ativo, entra no app com `myFid = null`, `myName = convidados.nome` e um campo novo `souConvidado: true` na store.
- **Presença:** ganha `conv: true`, conferido em `cleanPresence`. O `People.tsx` mostra a etiqueta "convidado" e o rosto com iniciais.
- **Menu:** esconde o que o convidado não usa (Nanicadas, Perfil de nanico, Cassino, Loja, botões de escalação e de votar). É só para ficar limpo: **a proteção é o banco**.
- **"Trocar senha"** continua igual para o convidado.

## Não faça
- Não crie convidado pelo site nem com código de convite.
- Não confie no menu escondido como proteção.
- Não dê `eh_membro()` em nada que mexa em moedas ou nanicadas.

## Pronto quando
- [ ] Logado como convidado: chat e salas funcionam; `insert` em `phrases`, `update` em `game`, `votar_atributos` e `bater_ponto` falham pelo banco.
- [ ] Um convidado desativado não entra no canal nem lê o chat.
- [ ] O SQL roda duas vezes, e a conferência do fim lista as funções novas.
- [ ] O `CLAUDE.md` (seção de logins e tabela de permissões, com uma coluna "convidado") e o `CHANGELOG` foram atualizados.

## Entrada do CHANGELOG
`"Login de convidado para os amigos dos nanicos: entram nas salas, assistem e conversam"`
