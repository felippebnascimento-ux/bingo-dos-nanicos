/* Um boneco no hall: o quadro da spritesheet (ou o rosto num pino) e a placa com o nome.
   Tocar num boneco abre o cartão do perfil no canto (e, no de outra pessoa, o menu de chinelada e torta); não anda.
   `rot` é o cambaleio de quem levou uma chinelada (graus). */
import { memo, type CSSProperties } from "react";
import { Avatar } from "@/components/ui/Avatar";
import { bonecoOf } from "@/lib/dados/nanicos";
import type { Rosto } from "@/lib/tipos";
import type { Boneco as B } from "./bonecos";
import { ANCORA, assentoDe, CEL_H, CEL_W, quadroSprite, tela, type Caixa2D } from "./hall";
import { abrirMenu } from "./zoeiraSala";
import { Chapeu } from "./Chapeu";
import { CartasNaMao } from "./MesaVerde";
import { Acessorio, noAlto, tipoAcessorio } from "@/features/loja/Acessorio";
import { useEquipados } from "@/features/loja/lojaDados";
import type { Enfeite } from "@/features/trofeus/trofeus";
import { iconeAcao, useAcaoDe } from "./acoes";

const pct = (v: number) => `${v * 100}%`;

export const Boneco = memo(function Boneco({
  b, f, eu, z, vb, rot = 0, enfeite, cartas, fala,
}: { b: B; f: Rosto; eu: boolean; z: number; vb: Caixa2D; rot?: number; enfeite?: Enfeite; cartas?: number; fala?: string | null }) {
  /* sentado: o boneco vai para o centro do assento, em cima do móvel */
  const a = assentoDe(b.senta);
  const [x, y] = a ? tela(a.i, a.j) : tela(b.i + 0.5, b.j + 0.5);
  const folha = bonecoOf(f);
  const olha = a ? a.olha : b.sentido;
  const q = quadroSprite(olha, a ? 0 : b.quadro);
  /* acessório da loja (boné, óculos…): o enfeite dos troféus tem prioridade no alto da cabeça */
  /* acenar, dançar ou deitar (acoes.ts) */
  const acao = useAcaoDe(b.key);
  const cabeca = tipoAcessorio(useEquipados(f.user_id).cabeca?.dados.cor);
  const acess = folha && cabeca && !(enfeite && noAlto(cabeca)) ? cabeca : null;
  /* a célula do boneco, em % do hall, com o pé (âncora) no centro do piso */
  const caixa: CSSProperties = {
    left: pct((x - ANCORA.x - vb.x) / vb.w),
    top: pct((y - ANCORA.y - vb.y) / vb.h),
    width: pct(CEL_W / vb.w),
    height: pct(CEL_H / vb.h),
    zIndex: z,
    ...(rot ? { ["--balanco" as string]: `${rot.toFixed(2)}deg` } : {}),
  };
  const corpo = folha ? (
    <span
      className={"boneco-img" + (q.espelha ? " espelha" : "")}
      style={{ backgroundImage: `url(${folha})`, backgroundPosition: `${(-q.x / CEL_W) * 25}% ${(-q.y / CEL_H) * 100}%` }}
    />
  ) : (
    <span className="boneco-pino">
      <Avatar f={f} size="xs" />
    </span>
  );
  return (
    <div className={"boneco" + (eu ? " eu" : "") + (a ? " sentado" : "") + (rot ? " balanca" : "") + (enfeite ? " chapeu-" + enfeite : "") + (acess ? " acess-" + acess : "") + (acao ? " acao-" + acao : "")} style={caixa}>
      <span className="boneco-nome">{b.name}</span>
      {acao && (
        <span className="boneco-acao" aria-hidden="true">
          {iconeAcao(acao)}
        </span>
      )}
      {enfeite && <Chapeu tipo={enfeite} />}
      {/* no truco da mesa verde: o leque de cartas na mão e o grito ("Truco!"), texto fixo do jogo */}
      {fala && <span className="boneco-fala">{fala}</span>}
      {!f.id ? (
        corpo
      ) : (
        /* um <span> que age como botão (e não um <button>): assim nem o navegador nem extensões de modo escuro
           pintam um quadrado em volta do boneco ao passar o mouse */
        <span
          role="button"
          tabIndex={0}
          className="boneco-toque"
          aria-label={eu ? "Você: abrir o seu perfil" : `${b.name}, abrir opções`}
          aria-haspopup={eu ? undefined : "menu"}
          onClick={(e) => {
            e.stopPropagation();
            abrirMenu(b.key);
          }}
          onKeyDown={(e) => {
            if (e.key !== "Enter" && e.key !== " ") return;
            e.preventDefault();
            e.stopPropagation();
            abrirMenu(b.key);
          }}
        >
          {corpo}
        </span>
      )}
      {!!cartas && <CartasNaMao n={cartas} />}
      {acess && <Acessorio tipo={acess} costas={olha.startsWith("costas")} />}
    </div>
  );
});
