# Fase 30: Amigos dos nanicos (o Lightzin é o primeiro)

**Branch:** `amigos-dos-nanicos` · **Depende de:** fases 2, 5, 9, 14 · **Banco:** sim

Substitui a fase 13 (login de convidado). Em 03/11/2026 o João decidiu que o amigo tem **quase tudo**, inclusive moedas, e não só chat e salas.

## Objetivo (para quem usa)
Um amigo do grupo que não é um dos 14 ganha login próprio, criado pelo admin. O primeiro é o **Lightzin**.
- **Pode:**
  - entrar no site e ficar no K-FOFO com o próprio boneco;
  - ganhar e gastar moedas: bônus do dia, tempo online, Bolsa Cassino, cassino, loja, Celular e InstaNanico;
  - jogar truco, entrar em voz, câmera e chat, e assistir às lives;
  - zoar e ser zoado, e dar e receber respeitos;
  - ter ficha (quarto, links, emblemas) e Perfil (op.gg, Steam, links).
- **Não pode:**
  - criar, editar ou remover nanicadas;
  - ter cartela de bingo ou cantar no bingo;
  - mexer na escalação nem na roleta do rodízio;
  - votar ou receber votos nos atributos;
  - entrar nos troféus da semana.
- **Aba "Amigos"** (aba `amigos`, no grupo Turma do menu, logo depois de Nanicos):
  - mostra os amigos com a arte de corpo inteiro, como a aba Nanicos;
  - cada cartão tem online/offline e quem convidou ("amigo do Felippe");
  - tocar abre a ficha.
- **Na lista de membros**, os amigos ficam numa categoria "Amigos" abaixo dos 14, com o mesmo rosto e status.
- **No ranking da carteira**, o amigo aparece com uma etiqueta pequena "amigo".

## Decisão de modelo (já tomada, não mude sem voltar ao planejamento)
O amigo **ganha uma linha em `friends`** com a coluna nova `tipo = 'amigo'`; os nanicos ficam com `tipo = 'nanico'`. Assim tudo o que já usa o friend id (boneco, presença `fid`, `Lugar.fid` do truco, zoeiras, consumos, respeitos, ficha, mochila) funciona sem tabela paralela.
- `eh_nanico()` passa a exigir `tipo = 'nanico'`. **O padrão fica fechado:** toda política e função que usa `eh_nanico()` continua barrando o amigo até alguém abrir de propósito.
- `eh_membro()` é nova: qualquer linha em `friends` com o login, nanico ou amigo.

## Antes de começar
Siga as "Regras de toda sessão" de `planejamento/PLANO.md`. Leia:
- `supabase/sql/contas-e-ao-vivo.sql` (`eh_nanico`, `criar_login_nanico`, realtime do lobby, chat);
- **todas** as ~100 referências a `eh_nanico()` em `supabase/sql/` (28 políticas e uns 48 `raise` dentro de funções). No plano, faça uma tabela: cada uma vira `eh_membro()` ou continua `eh_nanico()`, seguindo as listas "Pode" e "Não pode" acima;
- as Edge Functions `truco-mesa`, `riot-ao-vivo`, `ficha-jogos` e `riot-semana`: cada uma confere a linha em `friends` por conta própria;
- `src/lib/dados.ts` (`startSession`, fase `semNanico`), `src/lib/store.ts` (`friends`, `friendOf`), `src/lib/dados/nanicos.ts` (`NAN_MAP`, `artOf`, `bonecoOf`);
- `src/components/shell/People.tsx` (`useNanicosOnline`), `src/features/nanicos/NanicosView.tsx`, `src/features/moedas/Ranking.tsx` e `src/components/ui/FriendPicker.tsx`.

## Como fazer

### Banco (seção "37) amigos dos nanicos" no `seguranca.sql`)
- **`friends.tipo text not null default 'nanico' check (tipo in ('nanico','amigo'))`** e **`friends.convidado_por uuid references friends(id)`**. Nenhuma das duas é gravável pelo site (confira o `GRANT` por coluna e o `perfil_protecao`).
- **`eh_nanico()`** com `and tipo = 'nanico'`, e **`eh_membro()`** sem o filtro, as duas `stable security definer set search_path = public`, com os mesmos `revoke`/`grant`.
- **Troque por `eh_membro()`** onde o amigo entra:
  - ler `friends`, `salas` e o chat, e escrever no chat;
  - `realtime.messages` do lobby e das salas;
  - moedas (`bater_ponto`, `pulso`, `minha_carteira`, `pedir_bolsa`, ler `carteiras`);
  - cassino (todas as funções e mesas ao vivo), loja, mochila, consumos e Celular/rede (que continuam pedindo `tem_item('celular')`);
  - mídias e links, zoeira, respeitos, emblemas e presença;
  - truco (`truco_mesas`, `truco_maos`);
  - missões: o sorteio do `minhas_missoes()` pula, para amigo, as missões de nanicada, bingo e rodízio;
  - leitura de `phrases` e `game`, só o necessário para ver a live e o Ao vivo (diga no plano).
- **Continua `eh_nanico()`:** escrever nanicadas, escalação, rodízio, bingo (`bingo_*`), atributos (`votar_atributos`, `meu_voto`) e apostas do LoL (a fase 31 decide as do truco).
- **Atributos e troféus:** `atributos_de`/`atributos_todos` e a `riot-semana` olham só `tipo = 'nanico'`, e ninguém vota em amigo.
- **`truco_premiar`:** a regra "todos os lugares são nanicos diferentes" vira "membros diferentes".
- **`criar_login_amigo(p_nome, p_usuario, p_senha, p_convidou)`:** cria a linha em `friends` com `tipo 'amigo'` e o login, copiando o `criar_login_nanico` (e-mail `usuario@nanicos.app`, `must_change: true`). `revoke` de todos: só o admin roda no SQL Editor.
- **`desativar_amigo(p_usuario)`:** troca `tipo` para `'inativo'` (acrescente no `check`); `eh_membro()` não aceita inativo.
- **Edge Functions:** onde a função confere `friends`, aceite `tipo in ('nanico','amigo')`. A `riot-semana` filtra `tipo = 'nanico'`. Publique de novo as que mudarem.
- **Conferência do fim** lista as funções novas.

### Site
- **Tipos:** `Friend` ganha `tipo` e `convidado_por`. Em `store.ts`, `nanicos()` (só `tipo = 'nanico'`) e `amigos()`. **Todo lugar que hoje assume "os 14"** usa `nanicos()`: `FriendPicker` das nanicadas e da escalação, `NanicosView`, atributos, troféus, cartela e "Quem disse". Liste no plano onde mexeu.
- **Arte:** em `src/lib/dados/nanicos.ts`, um mapa `AMIGOS_ARTE` (nome → slug) e o `artOf`/`bonecoOf` caindo nele quando o nome não está no `NAN_MAP`. Copie para o site:
  - `planejamento/assets/lightzin/lightzin-rosto.webp` e `lightzin-corpo.webp` → `public/arte/amigos/` (o corpo tem 159×440);
  - `planejamento/assets/lightzin/lightzin.webp` → `public/arte/bonecos/lightzin.webp` (mesmo formato do `bonecos.json`; acrescente o arquivo lá).
- **Aba Amigos:** `src/features/amigos/AmigosView.tsx`, no padrão `XxxView({ hidden })`. Usa o mesmo cartão da aba Nanicos, com "amigo de …" embaixo. Sem amigos, a aba some do menu.
- **Membros:** `People.tsx` ganha a categoria "Amigos" (recolhível como as outras; chave nova `membros-amigos-min`).
- **Ficha de amigo:** esconde "Segundo os nanicos" (atributos) e mostra a etiqueta "amigo dos nanicos".
- **Menu do amigo:** esconde Nanicadas, Jogar (bingo) e Troféus. É só para ficar limpo: **a proteção é o banco**.
- **K-FOFO:** o boneco do amigo anda e senta como os outros. O piso 14×11 já cabe mais um.

## Não faça
- Não crie amigo pelo site nem por código de convite.
- Não troque `eh_nanico()` por `eh_membro()` em massa: uma por uma, pela tabela do plano.
- Não mude o `NAN_MAP` nem os números das artes dos 14.

## Pronto quando
- [ ] Logado como amigo, ganha o bônus do dia, joga no cassino, compra na loja, joga truco e aparece no K-FOFO com o boneco do Lightzin.
- [ ] Logado como amigo, falham pelo banco: `insert` em `phrases`, `update` em `game`, `bingo_nova_cartela`, `votar_atributos` e `rodizio_girar`.
- [ ] Os 14 não perderam nada (login, nanicadas, bingo, atributos, troféus).
- [ ] A aba Amigos e a categoria "Amigos" dos membros mostram o Lightzin online e offline.
- [ ] Um amigo desativado não entra no canal nem lê o chat.
- [ ] O SQL roda duas vezes. 390 px ok. `npm run check` passa. O `CLAUDE.md` (tabela de permissões com a coluna "amigo", logins, arte, chaves do `localStorage`) e o `CHANGELOG` foram atualizados.

## Para o admin, depois do SQL
```sql
select public.criar_login_amigo('Lightzin', '<usuario>', '<senha inicial>', (select id from friends where name = '<quem convidou>'));
```
(Senha só no SQL Editor; nunca no repositório.)

## Entrada do CHANGELOG
`"Amigos dos nanicos: o Lightzin chegou! Amigos têm login, boneco no K-FOFO, moedas e truco, e uma aba só deles"`
