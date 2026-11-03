---
name: nanicos-full-stack
description: Implement and verify changes to Bingo dos Nanicos, including the hall and UI, game rules, Supabase data and Edge Functions, and Realtime voice and chat.
---

# Desenvolvimento no Bingo dos Nanicos

## Antes de editar

1. Leia o `CLAUDE.md` e as instruções da pasta afetada. Confira o status do Git, compare com a principal atualizada e preserve as alterações locais de outras tarefas.
2. Transforme o pedido em um resultado observável. Siga o caminho da interface até a regra, a gravação e a atualização das outras telas. Para um ajuste visual, basta identificar o componente e seu estado.
3. Faça a menor mudança completa. Reaproveite os componentes, estilos e contratos existentes. Se uma regra do grupo estiver ambígua e mudar permissões, pontuação ou prêmios, confirme com o responsável antes de codificá-la.

## Aplique as verificações da camada alterada

- **Interface.** Preserve a exportação estática do Next.js e os estilos do projeto. Confira o fluxo em desktop e a 390 px. Para o hall, verifique a posição na grade, a ordem do desenho e o caminho dos avatares.
- **Supabase.** Autorize leitura e escrita no banco ou na Edge Function com a identidade autenticada. Valide argumentos e confira RLS e permissões de funções. Em ambiente de teste, prove que a conta autorizada consegue agir e que uma conta sem permissão é rejeitada. Compare o SQL do repo com o esquema real antes de preparar mudanças para publicação. Se o acesso estiver indisponível, registre que a comparação está pendente. Mantenha credenciais privilegiadas nos segredos do backend.
- **Tempo real e voz.** Trate IDs, sala e eventos enviados pelo navegador como dados não confiáveis. Para operações que dependem da identidade do remetente, use uma identidade vinculada à sessão pelo backend. Confira entrada, saída e reconexão com dois clientes de teste e verifique que um cliente sem acesso à sala é rejeitado.
- **Jogos e moedas.** Mantenha placar, cartas privadas, prêmios e saldo sob controle do backend. Para ações que movimentam moedas ou encerram partidas, teste repetições e ações simultâneas quando puderem pagar duas vezes ou corromper o estado. Se alterar a engine do truco, use o comando de sincronização do projeto e valide o código copiado para a Edge Function.

## Entrega

- **Teste direto.** Para mudanças de permissão, chame a RPC, a Edge Function ou o canal sem passar pela interface, em ambiente de teste. Use o menor conjunto relevante de contas: sem sessão, membro comum, conta inativa e conta autorizada. Tente trocar o ID do remetente ou da sala. Verifique a resposta e confirme que nenhuma leitura ou escrita indevida ocorreu.
- **Funções privilegiadas.** Antes de usar o cliente de serviço, valide o token, o vínculo ativo com o grupo e a autorização para o recurso solicitado. Confira as permissões da RPC chamada. Uma origem permitida pelo CORS só indica de onde veio a chamada no navegador.
- **Falhas parciais.** Quando uma operação grava estado e depois paga ou liquida apostas, simule uma falha entre as etapas e repita a chamada. Confira os erros retornados pelo Supabase. Use uma transação quando as etapas precisarem ser atômicas, ou um estado retomável com operações idempotentes. Só sinalize conclusão quando as etapas obrigatórias tiverem sido confirmadas.
- **Leituras que alteram estado.** Ao mudar consultas periódicas, confira se a RPC também avança relógios ou partidas, como `pk_estado`. Teste dois clientes consultando enquanto outro joga e confira que as cartas privadas só saem para quem pode vê-las.

- Rode as verificações pertinentes e siga o checklist de entrega do `CLAUDE.md`, incluindo o registro de versão quando houver mudança visível.
- Diga o que mudou, como reproduzir, o que passou e em qual ambiente. Uma checagem local comprova apenas o que foi exercitado localmente.
- Trate push, merge, publicação na Vercel e mudanças no Supabase hospedado como ações separadas. Execute cada uma quando estiver autorizada para a tarefa e confirme o projeto de destino antes de agir.
