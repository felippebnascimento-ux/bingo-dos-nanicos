# Fase 1: Log de novidades no login

**Branch:** `log-novidades` · **Depende de:** migração juntada na `main` · **Banco:** nenhum SQL

## Objetivo (para quem usa)
Saiu versão nova? No primeiro login (ou na primeira abertura do site) depois dela, o Log abre sozinho e mostra **só o que mudou desde a última vez daquela pessoa**. Ela fecha e ele não abre mais sozinho até a próxima versão. O botão "Log" do rodapé continua mostrando tudo.

## Antes de começar
Siga as "Regras de toda sessão" de `planejamento/PLANO.md`. Leia:
- `src/components/portas/Portas.tsx`: `PortaLog`, que hoje grava `local.set("log-visto", VERSION)` ao abrir;
- `src/components/shell/Sidebar.tsx`: o selo de novidade compara `local.get("log-visto")` com `VERSION`;
- `src/lib/dados/changelog.ts`: `CHANGELOG`, `versionAt`, `VERSION`;
- `src/lib/dados.ts`: `startSession` e `enterApp` (o "já vi" é lido depois que o usuário carrega);
- `src/lib/store.ts`: `logAberto`;
- `src/styles/10-log.css`.

## Como fazer
1. **Onde guardar o "já vi":** na conta, em `user_metadata.log_visto` (número do índice no `CHANGELOG`, não o texto "v1.NN"). Assim vale em todos os aparelhos e não precisa de SQL.
   - Para gravar, use `sb().auth.updateUser({ data: { log_visto: n } })`. O Supabase junta o `data` com o que já existe, então `must_change` e `nanico` continuam lá.
   - Continue gravando também em `local` (`log-visto`) como reserva. Se a gravação na conta falhar, o site segue funcionando.
2. **Regra pura** em `src/lib/dados/changelog.ts` (ou `novidades.ts` ao lado), com teste:
   - `novidadesDesde(visto: number | null): EntradaLog[]` devolve as entradas com índice maior que `visto`.
   - Quem nunca viu nada (`null`) recebe só a última entrada, para não despejar o log inteiro.
   - Item riscado (`off`) que entrou numa versão nova aparece riscado também.
3. **Quando abrir:**
   - Ao entrar no app (`fase === "app"`, depois da primeira senha), compare `log_visto` (da conta ou, se não tiver, do `local`) com o índice atual. Se houver novidade, abra o Log no **modo novidades**.
   - Não abra por cima da tela de primeira senha nem durante o login.
   - Abre uma vez por sessão do navegador, no máximo.
4. **Modo novidades no `PortaLog`:**
   - **Título:** "Novidades desde a sua última visita".
   - **Conteúdo:** a lista de `novidadesDesde`.
   - **Botões:** "Ver todas as versões" (troca para a lista completa) e "Fechar".
   - **Ao fechar:** grave o índice atual (conta e `local`).
   - **Pelo rodapé:** o botão "Log" abre a lista completa, como hoje, e também marca como visto.
5. **Selo do rodapé:** passa a usar o mesmo "já vi" (conta, com `local` de reserva).
6. **Acessibilidade:** o foco vai para o título ou para o botão de fechar, Esc fecha (já existe), e o modal tem `aria-labelledby` certo nos dois modos.

## Não faça
- Não crie tabela nem SQL.
- Não mude o formato do `CHANGELOG` nem apague itens antigos.
- Não use `alert`/`confirm`.

## Pronto quando
- [ ] Com `log_visto` antigo na conta, o login mostra só as entradas novas, e recarregar não mostra de novo.
- [ ] Em outro navegador com a mesma conta, não aparece de novo.
- [ ] Conta sem `log_visto` vê só a última versão.
- [ ] O botão "Log" do rodapé continua mostrando tudo.
- [ ] Os testes da regra pura passam e `npm run check` passa.
- [ ] Funciona com 390 px: a lista rola dentro do modal, sem rolagem para o lado.

## Entrada do CHANGELOG
`"As novidades aparecem sozinhas na primeira vez que você entra depois de uma atualização"`
