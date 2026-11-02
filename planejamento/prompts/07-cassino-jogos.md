# Fase 7: Cassino, parte 2: limbo, maior ou menor e caça-níquel dos nanicos

**Branch:** `cassino-jogos` · **Depende de:** fase 6 (motor `cassino_numero`, sementes, aba Cassino) · **Banco:** sim

## Objetivo (para quem usa)
Três jogos novos na aba Cassino, cada um mostrando quanto a casa leva:
- **Limbo (estilo crash):**
  - a pessoa escolhe um alvo de 1,01× a 100×;
  - o resultado é sorteado e, se for maior ou igual ao alvo, ela ganha alvo × aposta;
  - a casa leva 3%;
  - a tela anima o multiplicador subindo até o resultado.
- **Maior ou menor:**
  - sorteio de 0 a 9999;
  - a pessoa escolhe "abaixo de N" ou "acima de N";
  - paga `0,97 / chance`, e a tela mostra a chance e o pagamento antes;
  - a casa leva 3%.
- **Caça-níquel dos nanicos:**
  - 3 rolos com os **rostos** dos nanicos (`artOf(f).face`) mais 2 símbolos especiais (bola de bingo e moeda);
  - a tabela de pagamentos aparece na tela;
  - RTP de 92% (a casa leva 8%).

## Antes de começar
Siga as "Regras de toda sessão" de `planejamento/PLANO.md`. Leia o SQL e o `src/features/cassino/*` da fase 6. Reaproveite `cassino_numero`, `cassino_apostas` e `conferir()`. **Não crie outro motor.**

## Como fazer

### Banco (continue a seção "11) cassino")
- **`apostar_limbo(p_aposta int, p_alvo numeric)`:**
  - o alvo fica entre 1.01 e 100, com 2 casas;
  - `resultado = greatest(1, floor((0.97 / (1 - u)) * 100) / 100)`;
  - ganha se `resultado >= alvo`, e o pagamento é `floor(aposta * alvo)`.
- **`apostar_dado(p_aposta int, p_lado text, p_n int)`:**
  - `lado` é `'abaixo'` ou `'acima'`, e a chance precisa ficar entre 1% e 95%;
  - o número é `floor(u * 10000)`;
  - o pagamento é `floor(aposta * 0.97 / chance)`.
- **Caça-níquel:**
  - a tabela `cassino_rolos(simbolo text pk, peso int)` e a `cassino_pagamentos(combinacao text pk, multiplicador numeric)` ficam **no banco**, com semente idempotente. O site só lê, para mostrar.
  - `apostar_slot(p_aposta int)` sorteia 3 números (3 chamadas a `cassino_numero`, ou 3 fatias do mesmo HMAC), escolhe os símbolos por peso e paga pela tabela (3 iguais e 2 iguais com especial, por exemplo).
- **Conferência do RTP:** no fim da seção, uma consulta **calcula o RTP exato** do caça-níquel enumerando todas as combinações com os pesos. Ela faz `raise exception` se o valor sair de 91,5%–92,5%. Ajuste pesos e multiplicadores até passar.
- **Regras de sempre:** todos os jogos usam `creditar`, o limite de aposta 5–100, `limitar('cassino', …)` e gravam em `cassino_apostas` com `jogo`, `escolha`, `resultado`, `hash` e `nonce`.

### Regra pura (`regras.ts` + teste)
- `pagamentoLimbo`, `chanceDado`, `pagamentoDado` e `rtpSlot(pesos, tabela)`.
- O teste prova RTP de 97% no limbo e no dado (por integração exata, não por simulação) e confere `rtpSlot` com a tabela que o banco devolve. Copie a semente do SQL num fixture de teste.
- `conferir()` também sabe refazer limbo, dado e caça-níquel a partir da semente revelada.

### Tela
- **Seletor de jogo** dentro da aba Cassino (`.seg` com `role="radio"`): Roleta, Limbo, Maior ou menor, Caça-níquel.
- **Limbo:** campo do alvo com atalhos (1,5× / 2× / 10×), a chance de ganhar ao lado e a animação do número subindo.
- **Maior ou menor:** um controle deslizante de N com a chance e o pagamento ao vivo.
- **Caça-níquel:** os 3 rolos com os rostos girando e parando um por um (sem animação com `prefers-reduced-motion`), e a tabela de pagamentos num `<details>`.
- **Mesmo bloco de sempre** para "Como conferir que é justo" e o histórico.

## Não faça
- Não sorteie nada no navegador.
- Não ponha tabela de pagamentos só no TS: o banco é a fonte, e o TS só mostra e testa.
- Não use imagens novas: os símbolos são as artes que já existem.

## Pronto quando
- [ ] A consulta de RTP do SQL passa, e os testes de RTP passam.
- [ ] Para cada jogo, `conferir()` reproduz uma aposta real depois de revelar a semente.
- [ ] Alvo 1,00 ou 101, e chance 0% ou 99%, são recusados com mensagem clara.
- [ ] Funciona com 390 px, e o `CHANGELOG` foi atualizado.

## Entrada do CHANGELOG
`"Cassino: limbo, maior ou menor e caça-níquel com o rosto dos nanicos"`
