# Fase 20: Mesa de som do Sítio (bordões do grupo)

**Branch:** `mesa-de-som` · **Depende de:** fase 14 (hall v2) · **Banco:** sim (seção "21) mesa de som") · **Storage:** bucket novo `sons`

## Objetivo (para quem usa)
- **Mesa de som:** os bordões e gritos do grupo em botões, cada um com um nome curto ("TILTOU", "bora uma", "ai meu deus") e o rosto de quem gravou.
  - Ela abre por um botão no canto do hall (ícone de alto-falante).
- **Tocar:** um clique toca o som **para todo mundo que está no hall**. Cada um tem o próprio volume e pode silenciar a mesa (`local`, chave `som-vol`).
- **Enviar um som:**
  - grava pelo microfone (até 6 s) ou sobe um arquivo de áudio curto;
  - dá um nome de até 20 caracteres;
  - cada nanico tem até 10 sons e apaga os seus (`useSure()`).
- **Limites:**
  - cada pessoa toca no máximo 1 som a cada 8 s;
  - a mesa inteira toca no máximo 1 som por vez: se outro estiver tocando, o novo espera até 2 s ou é descartado.

## Antes de começar
Siga as "Regras de toda sessão" de `planejamento/PLANO.md`. Leia:
- `vercel.json`: a CSP já tem `media-src 'self' blob: mediastream:`. **O áudio baixado do bucket vira `blob:` e não precisa mudar a CSP**;
- `src/features/live/*` (como o site já pede o microfone e trata o erro);
- `src/lib/sala.ts` (`EVENTOS`, `aoReceber`, `limitePorPessoa`, `estaNaSala`).

## Como fazer

### Banco e Storage (seção "21) mesa de som")
- **Bucket `sons`:** privado, com `file_size_limit` de 300 KB e `allowed_mime_types` `audio/webm, audio/ogg, audio/mpeg, audio/mp4`. Crie por SQL de forma idempotente.
  - **`select`** para `eh_nanico()`;
  - **`insert`** só na pasta `<uid>/`;
  - **`delete`** só do dono.
- **`sons`:** `(id bigint identity, user_id uuid default auth.uid(), nome text check (char_length between 1 and 20), caminho text unique, ms int check (ms between 200 and 6000), em)`.
  - **Gatilho de proteção:** autor = `auth.uid()`, o caminho começa com `<uid>/`, no máximo 10 por pessoa e `limitar('som', 10, '1 hour')`.
  - **RLS:** nanicos leem; o dono apaga.
  - Entra no tempo real (para a lista se atualizar sozinha).

### Tocar
- **Evento novo `som` em `EVENTOS`:** `{ id: number }`. O handler:
  - confere se é inteiro e se **existe na lista de sons carregada** (som desconhecido é ignorado);
  - confere `estaNaSala` e `limitePorPessoa(1, 8000)`;
  - só toca para quem está com a aba Sítio aberta e o som ligado.
- **Cache:** cada som é baixado uma vez (`storage.download` → `URL.createObjectURL`) e guardado na memória. As URLs são revogadas ao sair.
- **Um som por vez**, numa fila de 1 (regra pura `filaDeSom.ts` + teste).
- **Quem tocou:** o boneco ganha um balão com o nome do som por 2 s.

### Gravar
- `MediaRecorder` com `audio/webm` (ou `audio/mp4` no Safari), corte automático em 6 s e uma prévia antes de enviar.
- O arquivo enviado passa pelo mesmo limite (300 KB, 6 s). Confira a duração com um `Audio` antes de enviar.
- Erro de microfone: "Libere o microfone no cadeado ao lado do endereço".

## Não faça
- Não mande o áudio pelo broadcast: só o `id`.
- Não deixe o bucket público nem mude a CSP.
- Não toque som automaticamente para quem silenciou a mesa ou está em outra aba.

## Pronto quando
- [ ] Com duas abas no hall, um clique toca o som nas duas.
- [ ] Um broadcast com `id` inexistente, com texto ou 10 por segundo é ignorado.
- [ ] O 11º som da mesma pessoa e um arquivo de 1 MB são recusados.
- [ ] O console está sem erros de CSP. Funciona com 390 px. O `CLAUDE.md` (bucket, tabela, evento `som`, chave `som-vol`) e o `CHANGELOG` foram atualizados.

## Entrada do CHANGELOG
`"Mesa de som no Sítio: gravem os bordões do grupo e toquem para todo mundo ouvir"`
