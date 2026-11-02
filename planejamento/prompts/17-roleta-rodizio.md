# Fase 17: Roleta do rodízio (sortear quem entra no time)

**Branch:** `roleta-rodizio` · **Depende de:** só da migração (pode entrar a qualquer momento). Se a fase 5 (salas) já existir, a roleta é de cada sala de LoL · **Banco:** sim (seção "19) rodízio" no `seguranca.sql`)

## Objetivo (para quem usa)
O modelo está em `planejamento/demo/roleta.html` e `roleta.png`. Abra os dois antes de começar.

Quando tem mais de 5 nanicos querendo jogar, quem está de fora entra numa **roleta**. A cada partida, ela sorteia quem entra no time, e o rodízio continua até todo mundo jogar.
- **Fila "Querem jogar":**
  - cada um entra ou sai sozinho ("Quero jogar" / "Sair da fila");
  - qualquer nanico pode pôr ou tirar alguém da fila com o `FriendPicker`, para quem não está no site.
- **Roleta:**
  - uma fatia por pessoa da fila que **ainda não entrou nesta rodada**, com o rosto e o nome;
  - "Girar a roleta" sorteia um, e **todo mundo vê a roleta girar e parar no mesmo nome**, ao mesmo tempo.
- **Rodada:**
  - quem foi sorteado fica riscado na fila e sai da roleta até a rodada acabar;
  - quando todos da fila já entraram, começa a rodada seguinte com todo mundo de novo;
  - uma barra mostra quantos já entraram ("2 de 6").
- **Depois do sorteio:**
  - aparece "Pitoco entra!" e as 5 rotas da escalação;
  - a rota de quem está há **mais partidas seguidas** vem marcada como sugestão de quem sai;
  - escolhida a rota, "Colocar na escalação" troca o jogador. Quem saiu entra na fila automaticamente;
  - "Pitoco não vai jogar" tira o sorteado da fila e libera girar de novo. É o único jeito de girar outra vez antes de colocar alguém no time.
- **Partidas seguidas:** cada rota mostra há quantas trocas aquela pessoa está no time ("4 seguidas").

## Antes de começar
Siga as "Regras de toda sessão" de `planejamento/PLANO.md`. Leia:
- `planejamento/demo/roleta.html` e `.png`;
- `src/features/jogar/*` (`JogarView`, como a escalação aparece e muda) e `src/lib/dados.ts` (`salvarEscalacao`, `cleanLineup`, `loadGame`);
- no `seguranca.sql`: a tabela `game`, o gatilho `escalacao_protecao`, `limitar()` e a conferência do fim;
- `src/components/ui/FriendPicker.tsx`, `Avatar.tsx` e `useSure`.

## Como fazer

### Banco (seção "19) rodízio")
- **Tabela `rodizio`**, uma linha como a `game` (ou uma por sala, se a fase 5 existir):
  - `fila uuid[]` (friend ids);
  - `rodada int`;
  - `ja_entraram uuid[]` (nesta rodada);
  - `sorteado uuid null`, `sorteado_por uuid null`, `girado_em timestamptz null`, `giro int null` (número sorteado, para a animação);
  - `trocas int default 0` (quantas vezes alguém entrou no time);
  - `no_time jsonb` (`{friend_id: troca em que entrou}`, para contar as "seguidas").
- **RLS:** nanicos leem. Ninguém escreve direto: só as funções abaixo, todas `security definer`, exigindo `eh_nanico()` e com `limitar('rodizio', 30, '10 minutes')`.
- **Funções:**
  - **`rodizio_fila(p_friend uuid, p_entra boolean)`:** põe ou tira alguém da fila. Confere que o friend existe. Não deixa entrar na fila quem está na escalação.
  - **`rodizio_girar()`:**
    - recusa se já houver um `sorteado` pendente ("Coloque o sorteado no time ou diga que ele não vai jogar");
    - os candidatos são `fila - ja_entraram`. Se ficar vazio e a fila não estiver vazia, começa a rodada nova (`rodada + 1`, `ja_entraram = '{}'`);
    - sorteia com `random()` do Postgres, o sorteio é sempre do banco. Grava `sorteado`, `sorteado_por = auth.uid()`, `girado_em = now()` e `giro` (índice do sorteado na lista de candidatos, em ordem estável por nome).
  - **`rodizio_colocar(p_rota int)`:**
    - troca, **na própria função**, o jogador da rota `p_rota` (0 a 4) da `game.players` pelo sorteado, mantendo o campeão vazio;
    - quem saiu entra na fila. O sorteado sai da fila e vai para `ja_entraram`;
    - soma `trocas` e atualiza `no_time`;
    - limpa `sorteado`.
    - Ela tem que passar pelo gatilho `escalacao_protecao`.
  - **`rodizio_desistir()`:** tira o sorteado da fila e limpa `sorteado`.
- **Tempo real:** `rodizio` na publicação `supabase_realtime` (bloco `exception when duplicate_object`).
- **Conferência do fim do arquivo:** liste as funções novas.

### Regra pura (`src/features/jogar/rodizio.ts` + teste)
- **`candidatos(fila, jaEntraram, nomes)`:** a mesma ordem estável que o banco usa.
- **`anguloFinal(indice, total, voltas)`:** onde a roleta para, com o ponteiro em cima e no meio da fatia.
- **`seguidas(noTime, trocas, fid)`** e **`sugestaoDeSaida(lineup, noTime, trocas)`:** quem está há mais trocas no time. Empate: a rota mais alta (TOP primeiro).
- **Testes:**
  - candidatos sem quem já entrou;
  - rodada nova quando acabam os candidatos;
  - ângulo dentro da fatia certa;
  - sugestão com empate.

### Tela (`src/features/jogar/Roleta.tsx`, CSS no arquivo da aba Jogar)
- **Lugar:** um `.block` "Roleta do rodízio" na aba Jogar, embaixo da escalação. No celular, a roleta vem antes da fila.
- **A roleta é um SVG:** fatias alternando `--olive`, `--accent`, `--mint` e um tom entre eles, com o rosto (`artOf(f).face`) e o nome.
- **Animação:**
  - quando chega um `girado_em` novo pelo tempo real, **todos** animam ~4 s com desaceleração, parando em `anguloFinal(giro, …)`;
  - quem abrir a página depois vê a roleta já parada no sorteado;
  - com `prefers-reduced-motion`, ela vai direto para o resultado.
- **Fila:** grade com rosto, nome e situação ("esperando 2", "jogou", "você").
- **Resultado:** o cartão "X entra!", as 5 rotas com a sugestão marcada (borda `--live`) e os botões "Colocar na escalação" e "X não vai jogar". "Colocar" usa `useSure()`, porque mexe no time de todo mundo.
- **Botões:** escondidos quando não servem: "Girar" some com fila vazia ou com sorteado pendente. Erros do banco aparecem com `toast(errMsg(e))`.

## Não faça
- Não sorteie no navegador: o banco sorteia, e a tela só anima até o resultado.
- Não mande o resultado por broadcast: ele vem da tabela pelo tempo real.
- Não deixe girar de novo com um sorteado pendente.
- Não troque a escalação por fora do `rodizio_colocar` nesse fluxo.

## Pronto quando
- [ ] Com duas abas, uma gira e as duas veem a roleta parar no mesmo nome.
- [ ] Ninguém é sorteado duas vezes na mesma rodada, e a rodada vira sozinha quando todos já entraram.
- [ ] "Colocar na escalação" troca a rota certa, quem saiu vai para a fila e as "seguidas" contam certo.
- [ ] Girar com um sorteado pendente é recusado pelo banco com mensagem clara.
- [ ] O SQL roda duas vezes sem erro, e funciona com 390 px.
- [ ] `npm run check` passa. O `CLAUDE.md` (tabela `rodizio`, funções, tempo real) e o `CHANGELOG` foram atualizados.

## Entrada do CHANGELOG
`"Roleta do rodízio na aba Jogar: quem está de fora entra na roleta e todo mundo joga na sua vez"`
