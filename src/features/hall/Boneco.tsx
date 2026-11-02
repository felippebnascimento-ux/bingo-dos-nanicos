/* Um boneco no hall: o quadro da spritesheet (ou o rosto num pino) e a placa com o nome.
   Tocar num boneco abre o cartão do perfil no canto (e, no de outra pessoa, o menu de chinelada e torta); não anda.
   `rot` é o cambaleio de quem levou uma chinelada (graus). */
import { memo, type CSSProperties } from "react";
import { Avatar } from "@/components/ui/Avatar";
import { bonecoOf } from "@/lib/dados/nanicos";
import type { Rosto } from "@/lib/tipos";
import type { Boneco as B } from "./bonecos";
import { ANCORA, CEL_H, CEL_W, quadroSprite, tela, type Caixa2D } from "./hall";
import { abrirMenu } from "./zoeiraSala";
import { Chapeu } from "./Chapeu";
import type { Enfeite } from "@/features/trofeus/trofeus";

const pct = (v: number) => `${v * 100}%`;

export const Boneco = memo(function Boneco({ b, f, eu, z, vb, rot = 0, enfeite }: { b: B; f: Rosto; eu: boolean; z: number; vb: Caixa2D; rot?: number; enfeite?: Enfeite }) {
  const [x, y] = tela(b.i + 0.5, b.j + 0.5);
  const folha = bonecoOf(f);
  const q = quadroSprite(b.sentido, b.quadro);
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
    <div className={"boneco" + (eu ? " eu" : "") + (rot ? " balanca" : "") + (enfeite ? " chapeu-" + enfeite : "")} style={caixa}>
      <span className="boneco-nome">{b.name}</span>
      {enfeite && <Chapeu tipo={enfeite} />}
      {!f.id ? (
        corpo
      ) : (
        <button
          type="button"
          className="boneco-toque"
          aria-label={eu ? "Você: abrir o seu perfil" : `${b.name}, abrir opções`}
          aria-haspopup={eu ? undefined : "menu"}
          onClick={(e) => {
            e.stopPropagation();
            abrirMenu(b.key);
          }}
        >
          {corpo}
        </button>
      )}
    </div>
  );
});
