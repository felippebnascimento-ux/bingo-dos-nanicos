# Fase 25: Eventos com horário (happy hour e churrasco de sábado)

**Branch:** `eventos-com-horario` · **Depende de:** fases 2 (moedas) e 14 (hall v2) · **Banco:** sim (seção "25) eventos")

## Objetivo (para quem usa)
- **Happy hour, todo dia das 22h à meia-noite (Brasília):**
  - o tempo online paga **em dobro**: +1 moeda a cada 3 min em vez de 6;
  - o teto diário sobe de 40 para 60, mas só pelo que foi ganho no happy hour;
  - o hall fica com a luz mais quente, e aparece uma faixa "HAPPY HOUR · moedas em dobro até 00:00".
- **Churrasco de sábado, das 18h às 23h:**
  - **a churrasqueira do hall acende** (brasa e fumaça subindo);
  - quem estiver online pode clicar nela uma vez e **pegar um espetinho**: um prêmio surpresa de **10 a 60 moedas**, sorteado pelo banco;
  - aparece o aviso "Pitoco pegou um espetinho: +42".
- **Aviso no Log:** a primeira vez que alguém vê um evento, um toast explica o que é.

## Antes de começar
Siga as "Regras de toda sessão" de `planejamento/PLANO.md`. Leia a seção 7 do `seguranca.sql` (`pulso`, `hoje_br`, `creditar`), `src/lib/moedas.ts` (os números espelhados) e o `Sala.tsx` do hall (a churrasqueira).

## Como fazer

### Banco (seção "25) eventos")
- **`public.agora_br()`:** hora de Brasília, como a `hoje_br`.
- **`pulso()` (`create or replace`):**
  - durante o happy hour, a cada 3 minutos válidos paga 1 moeda;
  - o teto fica em `40 + happy_hour_ganho_hoje`, até 60.
  - Mantenha **todas** as outras regras do pulso (intervalo entre 55 e 150 s).
  - **Rode os testes de moedas da fase 2 de novo.**
- **`churrasco_pegar()`:**
  - aceita só no sábado, das 18h às 23h (`agora_br`), com `eh_nanico()`;
  - uma vez por pessoa por sábado (`ref` = data);
  - o valor é `10 + floor(random() * 51)`, pago com `creditar(valor, 'churrasco', data)`.
- **Mais nada:** o evento é só horário. Não tem tabela de "evento ligado", porque o relógio do banco decide.

### Regra pura
- `src/lib/eventos.ts` + teste: `eventoAgora(dataBr)` devolve `'happy' | 'churrasco' | null` e `fimDoEvento(dataBr)`.
- Teste as bordas: 21:59, 22:00, 23:59, 00:00 e sábado 17:59/18:00/23:00.
- **A hora vem de `Intl` com `America/Sao_Paulo`**, não do fuso de quem está usando.

### Tela
- **Faixa do evento** no topo do hall, com a contagem até o fim.
- **Happy hour:** uma camada com um tom âmbar bem leve por cima do cômodo (`--hall-luz-happy`).
- **Churrasco:** brasa (retângulos laranja que piscam devagar) e fumaça (3 círculos que sobem e somem) na churrasqueira, e a placa "Pegar espetinho" em cima dela. Depois de pegar, a placa vira "Volte sábado que vem".
- **`prefers-reduced-motion`:** brasa acesa, sem fumaça subindo.

## Não faça
- Não decida o horário pelo relógio do navegador na hora de pagar: quem decide é o banco.
- Não quebre as regras do pulso da fase 2.

## Pronto quando
- [ ] Os testes de borda de horário passam.
- [ ] Mudando a hora no SQL Editor (ou com uma função de teste que recebe a hora), o pulso paga em dobro às 22h e volta ao normal à meia-noite.
- [ ] Pegar o espetinho duas vezes no mesmo sábado falha, e fora do horário também.
- [ ] O `CLAUDE.md` (eventos, `agora_br`, a regra nova do pulso) e o `CHANGELOG` foram atualizados.

## Entrada do CHANGELOG
`"Happy hour das 22h à meia-noite com moedas em dobro"`, `"Churrasco de sábado no Sítio: pegue seu espetinho surpresa"`
