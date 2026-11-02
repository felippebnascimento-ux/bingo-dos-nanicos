/* Um boneco no hall: o quadro da spritesheet (ou o rosto num pino) e a placa com o nome. */
import { memo, type CSSProperties } from "react";
import { Avatar } from "@/components/ui/Avatar";
import { bonecoOf } from "@/lib/dados/nanicos";
import type { Rosto } from "@/lib/tipos";
import type { Boneco as B } from "./bonecos";
import { ANCORA, CEL_H, CEL_W, quadroSprite, tela, VB } from "./hall";

const pct = (v: number) => `${v * 100}%`;

export const Boneco = memo(function Boneco({ b, f, eu, z }: { b: B; f: Rosto; eu: boolean; z: number }) {
  const [x, y] = tela(b.i + 0.5, b.j + 0.5);
  const folha = bonecoOf(f);
  const q = quadroSprite(b.sentido, b.quadro);
  /* a célula do boneco, em % do hall, com o pé (âncora) no centro do piso */
  const caixa: CSSProperties = {
    left: pct((x - ANCORA.x - VB.x) / VB.w),
    top: pct((y - ANCORA.y - VB.y) / VB.h),
    width: pct(CEL_W / VB.w),
    height: pct(CEL_H / VB.h),
    zIndex: z,
  };
  return (
    <div className={"boneco" + (eu ? " eu" : "")} style={caixa}>
      <span className="boneco-nome">{b.name}</span>
      {folha ? (
        <span
          className={"boneco-img" + (q.espelha ? " espelha" : "")}
          style={{ backgroundImage: `url(${folha})`, backgroundPosition: `${(-q.x / CEL_W) * 25}% ${(-q.y / CEL_H) * 100}%` }}
        />
      ) : (
        <span className="boneco-pino">
          <Avatar f={f} size="xs" />
        </span>
      )}
    </div>
  );
});
