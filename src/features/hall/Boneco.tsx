/* Um boneco no hall: o quadro da spritesheet (ou o rosto num pino) e a placa com o nome.
   Tocar num boneco abre o cartão do perfil no canto (e, no de outra pessoa, o menu de chinelada e torta); não anda.
   `rot` é o cambaleio de quem levou uma chinelada (graus). */
import { memo, useEffect, useState, type CSSProperties } from "react";
import { Avatar } from "@/components/ui/Avatar";
import { bonecoOf, posesOf } from "@/lib/dados/nanicos";
import type { Rosto } from "@/lib/tipos";
import type { Boneco as B } from "./bonecos";
import { ANCORA, assentoDe, CEL_H, CEL_W, quadroSprite, tela, type Caixa2D, type Sentido } from "./hall";
import { abrirMenu } from "./zoeiraSala";
import { Chapeu } from "./Chapeu";
import { CartasNaMao } from "./MesaVerde";
import { Acessorio, noAlto, tipoAcessorio } from "@/features/loja/Acessorio";
import { useEquipados } from "@/features/loja/lojaDados";
import type { Enfeite } from "@/features/trofeus/trofeus";
import { iconeAcao, useAcaoDe } from "./acoes";
import { posicaoPose, quadroPose, sequenciaPose, type Pose } from "./poses";
import { reduzMovimento } from "@/lib/util";

/** O quadro da folha de poses, andando pelos quadros da pose no tempo dela (parado com menos movimento). */
export function usePoseQuadro(pose: Pose | null, costas: boolean) {
  /* relógio contínuo: o quadro sai do tempo corrido, então não precisa zerar ao trocar de pose */
  const [t, setT] = useState(() => performance.now());
  const s = pose ? sequenciaPose(pose, costas) : null;
  const anima = !!s && s.q.length > 1 && s.ms > 0 && !reduzMovimento();
  useEffect(() => {
    if (!anima || !s) return;
    const id = setInterval(() => setT(performance.now()), s.ms);
    return () => clearInterval(id);
  }, [anima, s]);
  return pose ? quadroPose(pose, costas, anima ? t : 0) : null;
}

/** O outro lado da mesma linha da folha (frente-direita ↔ frente-esquerda): a olhadinha para o lado. */
const VIRA: Record<Sentido, Sentido> = {
  "frente-direita": "frente-esquerda",
  "frente-esquerda": "frente-direita",
  "costas-direita": "costas-esquerda",
  "costas-esquerda": "costas-direita",
};

/** Parado em pé, de vez em quando o boneco olha para o lado (1,4 a 2,4 s) e volta, cada um no seu tempo. */
function useOlhadela(ativo: boolean) {
  const [vira, setVira] = useState(false);
  useEffect(() => {
    if (!ativo || reduzMovimento()) return;
    let t: ReturnType<typeof setTimeout>;
    const espera = () => (t = setTimeout(olha, 7000 + Math.random() * 9000));
    const olha = () => {
      setVira(true);
      t = setTimeout(() => (setVira(false), espera()), 1400 + Math.random() * 1000);
    };
    espera();
    return () => {
      clearTimeout(t);
      setVira(false);
    };
  }, [ativo]);
  return ativo && vira;
}

const pct = (v: number) => `${v * 100}%`;
/** Um atraso fixo (0 a 3,4 s) tirado do nome do boneco, para a respiração de cada um começar num ponto diferente. */
const atrasoDe = (k: string) => {
  let h = 0;
  for (let n = 0; n < k.length; n++) h = (h * 31 + k.charCodeAt(n)) | 0;
  return ((Math.abs(h) % 34) / 10).toFixed(1);
};

export const Boneco = memo(function Boneco({
  b, f, eu, z, vb, rot = 0, enfeite, cartas, fala,
}: { b: B; f: Rosto; eu: boolean; z: number; vb: Caixa2D; rot?: number; enfeite?: Enfeite; cartas?: number; fala?: string | null }) {
  /* sentado: o boneco vai para o centro do assento, em cima do móvel */
  const a = assentoDe(b.senta);
  const [x, y] = a ? tela(a.i, a.j) : tela(b.i + 0.5, b.j + 0.5);
  const folha = bonecoOf(f);
  /* acenar, dançar ou deitar (acoes.ts) */
  const acao = useAcaoDe(b.key);
  const andando = !a && b.quadro > 0;
  const virou = useOlhadela(!a && !andando && !acao);
  const olha = a ? a.olha : virou ? VIRA[b.sentido] : b.sentido;
  const q = quadroSprite(olha, a ? 0 : b.quadro, folha);
  /* acessório da loja (boné, óculos…): o enfeite dos troféus tem prioridade no alto da cabeça */
  /* com a folha de poses (poses.ts): a ação e o sentar viram o desenho; sem ela, o balanço e o corte de antes */
  const poses = posesOf(f);
  const pose: Pose | null = poses ? (acao ?? (a ? "sentar" : null)) : null;
  const costas = olha.startsWith("costas");
  const quadroPoseAgora = usePoseQuadro(pose, costas);
  const equip = useEquipados(f.user_id);
  const cabeca = tipoAcessorio(equip.cabeca?.dados.cor);
  /* efeito comprado na loja (seção 61): brilho, fogo, fantasma ou arco-íris */
  const efeito = equip.efeito?.dados.cor;
  const acess = folha && cabeca && !(enfeite && noAlto(cabeca)) ? cabeca : null;
  /* a célula do boneco, em % do hall, com o pé (âncora) no centro do piso */
  const caixa: CSSProperties = {
    left: pct((x - ANCORA.x - vb.x) / vb.w),
    top: pct((y - ANCORA.y - vb.y) / vb.h),
    width: pct(CEL_W / vb.w),
    height: pct(CEL_H / vb.h),
    zIndex: z,
    ...(rot ? { ["--balanco" as string]: `${rot.toFixed(2)}deg` } : {}),
    /* cada um respira no seu tempo (senão a sala inteira sobe e desce junto) */
    ["--resp-atraso" as string]: `-${atrasoDe(b.key)}s`,
  };
  const corpo = poses && pose && quadroPoseAgora ? (
    <span
      className={"boneco-pose pose-" + pose + (q.espelha ? " espelha" : "")}
      style={{ backgroundImage: `url(${poses})`, backgroundPosition: posicaoPose(quadroPoseAgora) }}
    />
  ) : folha ? (
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
    <div className={"boneco" + (eu ? " eu" : "") + (andando ? " andando " + (olha.endsWith("direita") ? "vai-dir" : "vai-esq") : "") + (a ? " sentado" : "") + (rot ? " balanca" : "") + (enfeite ? " chapeu-" + enfeite : "") + (acess ? " acess-" + acess : "") + (acao ? " acao-" + acao : "") + (pose ? " com-pose" : "") + (efeito ? " efeito-" + efeito : "")} style={caixa}>
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
