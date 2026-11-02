/* Um boneco no hall: o quadro da spritesheet (ou o rosto num pino) e a placa com o nome.
   Tocar no boneco de outra pessoa abre a ficha dela (e não anda); o meu não abre nada. */
import { memo, type CSSProperties } from "react";
import { Avatar } from "@/components/ui/Avatar";
import { bonecoOf } from "@/lib/dados/nanicos";
import { setApp } from "@/lib/store";
import type { Rosto } from "@/lib/tipos";
import type { Boneco as B } from "./bonecos";
import { ANCORA, CEL_H, CEL_W, quadroSprite, tela, type Caixa2D } from "./hall";

const pct = (v: number) => `${v * 100}%`;

export const Boneco = memo(function Boneco({ b, f, eu, z, vb }: { b: B; f: Rosto; eu: boolean; z: number; vb: Caixa2D }) {
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
    <div className={"boneco" + (eu ? " eu" : "")} style={caixa}>
      <span className="boneco-nome">{b.name}</span>
      {eu || !f.id ? (
        corpo
      ) : (
        <button
          type="button"
          className="boneco-toque"
          aria-label={`Abrir a ficha de ${b.name}`}
          onClick={(e) => {
            e.stopPropagation();
            setApp({ fichaAberta: f.id! });
          }}
        >
          {corpo}
        </button>
      )}
    </div>
  );
});
