# Fase 4: Atributos votados (metade zoeira da ficha), com voto anônimo

**Branch:** `atributos-votados` · **Depende de:** fase 3 (ficha) · **Banco:** sim

## Objetivo (para quem usa)
- **Os atributos:** na ficha, o bloco "Segundo os nanicos" mostra seis barras de 0 a 10: **Tilt, Choro, Clutch (CS2), Farm, Sorte e Call**.
  - **A nota é sempre a média de todos os votos** que a pessoa recebeu naquele atributo, recalculada a cada voto novo ou mudado.
  - **Todo mundo vê as notas de todo mundo:** na ficha de cada um e num resumo na aba Nanicos (as 6 notas de cada um).
  - Ao lado da nota aparece quantos votaram ("7,4 · 9 votos"). Sem nenhum voto ainda, a barra fica vazia com "sem votos".
- **Votar:**
  - o botão "Votar no Fulano" abre seis controles de 0 a 10;
  - ninguém vota em si mesmo;
  - cada um pode mudar o voto em alguém **uma vez por semana**.
- **Anonimato:** a nota (média) e a quantidade de votos são públicas, mas **quem votou e quanto cada um deu nunca aparecem**. Nem o banco entrega isso para o site.
- **Tempo real:** quando alguém vota, a média muda na hora para todo mundo que está com a ficha ou a aba Nanicos aberta.

## Antes de começar
Siga as "Regras de toda sessão" de `planejamento/PLANO.md`. Leia:
- o `Ficha.tsx` da fase 3 e o espaço reservado;
- `supabase/sql/seguranca.sql` (padrão de função, `limitar`);
- `src/components/ui/useSure.ts`;
- os controles `.seg` que já existem.

## Como fazer

### Banco (seção "9) atributos" no `seguranca.sql`)
- **Tabela `atributos_votos`:** `(de uuid → auth.users, para uuid → friends, atributo text check in ('tilt','choro','clutch','farm','sorte','call'), nota smallint check between 0 and 10, em timestamptz default now(), primary key(de, para, atributo))`.
- **RLS ligado e `revoke all` para todos.** Nem `select`: é isso que garante o anonimato no site.
- **`public.votar_atributos(p_para uuid, p_notas jsonb)`** (RPC para authenticated):
  - exige `eh_nanico()`;
  - `p_para` tem que existir e **não pode** ser o nanico do próprio usuário;
  - `p_notas` é um objeto com só as 6 chaves e inteiros de 0 a 10;
  - se já existe voto de `auth.uid()` para `p_para` com `em > now() - interval '7 days'`, erro "Você já votou no Fulano esta semana. Dá para mudar a partir de DD/MM.";
  - faz upsert das 6 linhas com `em = now()`;
  - `limitar('votar', 20, '10 minutes', …)`.
- **`public.atributos_de(p_para uuid)`** (RPC, `stable`):
  - devolve `jsonb` por atributo: `{media numeric(3,1), votos int}`;
  - a média é sempre `avg(nota)` de todos os votos daquele atributo; sem votos, `media` sai `null` e `votos` 0.
- **`public.meu_voto(p_para uuid)`:** devolve as minhas notas para ele e quando posso mudar. Só as do próprio usuário.
- **`public.atributos_todos()`:** a mesma regra para os 14 de uma vez, para a aba Nanicos não fazer 14 chamadas.
- **Aviso de mudança sem expor votos:** a tabela de votos não pode ir para o tempo real (o tempo real entregaria as linhas). Crie a tabela `atributos_versao (id int pk default 1 check (id = 1), em timestamptz)`, legível por nanicos, que a `votar_atributos` atualiza a cada voto. Ela entra na publicação `supabase_realtime`; o site escuta e chama `atributos_todos()` de novo.

### Regra pura `src/features/nanicos/atributos.ts` + teste
- `ATRIBUTOS` traz a chave, o nome, a dica curta ("quanto chora depois de morrer") e a marca "CS2" no Clutch.
- `limparNotas()` confere o objeto antes de mandar.
- `textoMedia(media, votos)` usa vírgula decimal ("7,4 · 9 votos", "1 voto", "sem votos").

### Tela
- **Barras:** em `Ficha.tsx`, seis barras (no estilo da demo), com `aria-valuenow` e com a nota máxima (≥ 9) na cor `--live`.
- **Votar:** o botão abre o formulário com seis controles 0–10 (`input type="range"` com o número ao lado, ou `.seg`), já com as minhas notas se eu tiver votado.
  - Tem "Salvar votos" e "Cancelar".
  - Na própria ficha, o botão fica escondido ("Limpo: só aparece o que está disponível").
- **Aba Nanicos:** cada cartão ganha as 6 notas em miniatura (barrinhas finas com o número), a partir de `atributos_todos()`.
- **Atualização:** depois de salvar, `toast("Votos salvos")`. As barras de todo mundo recarregam pelo aviso de `atributos_versao`.

## Não faça
- Não crie view nem `select` em `atributos_votos` para ninguém.
- Não mande o `user_id` de quem votou para a tela.
- Não guarde os votos no `localStorage`.

## Pronto quando
- [ ] `select * from atributos_votos` como authenticated falha.
- [ ] Votar em si mesmo falha com mensagem clara, e votar duas vezes na mesma semana também.
- [ ] Com 1, 2 ou 10 votos, a nota é sempre a média de todos, com a contagem ao lado, e muda na hora em outra aba aberta quando alguém vota.
- [ ] Nenhuma resposta do banco para o site traz quem votou nem a nota individual de outra pessoa.
- [ ] Os testes passam, e o `CLAUDE.md` e o `CHANGELOG` foram atualizados.

## Entrada do CHANGELOG
`"Atributos na ficha: tilt, choro, clutch, farm, sorte e call, com a média dos votos anônimos do grupo à vista de todos"`
