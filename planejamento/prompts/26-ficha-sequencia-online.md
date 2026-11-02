# Fase 26: Sequência de dias e tempo online na ficha de cada um

**Branch:** `ficha-sequencia-online` · **Depende de:** fase 2 (moedas: `bonus_diario`, `online_diario`) e fase 3 (ficha). Pequena, pode entrar logo depois da 3 · **Banco:** sim (seção "26) presença pública")

## Objetivo (para quem usa)
Ao clicar no perfil de alguém (na aba Nanicos, no "Na sala agora", no boneco do hall ou no ranking), a ficha mostra um bloco **"No Sítio"** com:
- **Sequência:** "12 dias seguidos", com um ícone de chama (desenhado em SVG).
  - Com 0 ou sem sequência ativa, aparece "Sem sequência".
  - Se a pessoa ainda não entrou hoje, mas entrou ontem, a sequência continua valendo, com o aviso "entra hoje para não perder".
- **Recorde:** a maior sequência que a pessoa já teve ("recorde: 21 dias").
- **Tempo online:**
  - hoje ("1 h 20 min");
  - nos últimos 7 dias ("9 h 40 min"), com 7 barrinhas, uma por dia;
  - no total, desde que as moedas começaram.
- **Na própria ficha,** as mesmas informações, mais a frase "Faltam X dias para o prêmio de 7 dias" ou "de 30 dias" (os prêmios da fase 2).

## Antes de começar
Siga as "Regras de toda sessão" de `planejamento/PLANO.md`. Leia:
- a seção 7 do `seguranca.sql`: `bonus_diario` (`seq` por dia), `online_diario` (`minutos` por dia), `hoje_br()` e a RLS (cada um lê só os seus);
- `src/features/ficha/*` (onde o bloco entra) e `src/lib/moedas.ts` (prêmios da sequência).

## Como fazer

### Banco (seção "26) presença pública")
As tabelas continuam fechadas (cada um lê só as suas). O que fica público é **só o resumo**, por uma função:
- **`public.presenca_de(p_friend uuid) returns jsonb`**, `stable security definer`, que exige `eh_nanico()`. Ela devolve:
  - `seq`: a sequência atual, ou seja, o `seq` de hoje ou de ontem (`hoje_br() - 1`), senão 0;
  - `pegou_hoje boolean`;
  - `recorde`: `max(seq)`;
  - `hoje_min`: os minutos de hoje;
  - `semana`: array de 7 `{dia, min}`, de hoje para trás, com 0 nos dias sem linha;
  - `total_min`: a soma de todos os minutos.
- **`public.presenca_todos()`:** só `seq` e `hoje_min` dos 14, para a aba Nanicos e o ranking mostrarem a chama sem 14 chamadas.
- Mesmos `revoke`/`grant` das outras RPCs de leitura. Nada de `select` novo nas tabelas.
- Acrescente na conferência do fim do arquivo.

### Regra pura (`src/lib/moedas.ts` + teste)
- **`textoTempo(min)`:** "45 min", "1 h 20 min", "9 h".
- **`faltaParaPremio(seq)`:** dias até o próximo prêmio (7 ou 30), ou null depois do 30.
- **`sequenciaEmRisco(seq, pegouHoje)`.**
- Teste as bordas: 0, 59, 60 e 61 min; e as sequências 6, 7, 29, 30 e 31.

### Tela
- **`src/features/ficha/NoSitio.tsx`:** um `.block` no estilo da ficha.
  - Chama e número grandes (`var(--display)`), recorde embaixo.
  - Tempo de hoje e total, e as 7 barrinhas da semana (CSS, altura por `--h`, com `aria-label` "segunda: 1 h 10 min").
- **Atualização:** carrega ao abrir a ficha e recarrega a cada 2 min enquanto ela estiver aberta.
- **Chama pequena:** com `presenca_todos()`, aparece ao lado do nome na aba Nanicos, no "Na sala agora" e no ranking de moedas, só quando `seq ≥ 3`. É só o número, com o título "12 dias seguidos".
- **Sem o SQL rodado:** o bloco não aparece.

## Não faça
- Não abra `select` em `bonus_diario` nem em `online_diario`: só o resumo, pela função.
- Não calcule a sequência no navegador a partir de dados brutos.
- Não use emoji para a chama: SVG em `icones.tsx`.

## Pronto quando
- [ ] A ficha de outra pessoa mostra a sequência, o recorde e o tempo de hoje, da semana e total, iguais ao que o banco tem.
- [ ] Quem entrou ontem e não hoje aparece com a sequência e o aviso; quem pulou um dia aparece com "Sem sequência".
- [ ] `select` em `online_diario` de outra pessoa continua falhando.
- [ ] A chama aparece só a partir de 3 dias. Funciona com 390 px. `npm run check` passa, e o `CLAUDE.md` e o `CHANGELOG` foram atualizados.

## Entrada do CHANGELOG
`"Na ficha de cada um: dias seguidos no Sítio, recorde e tempo online (hoje, na semana e no total)"`
