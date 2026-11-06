/* Um boneco no hall: o quadro da spritesheet (ou o rosto num pino) e a placa com o nome.
   Tocar num boneco abre o cartão do perfil no canto (e, no de outra pessoa, o menu de chinelada e torta); não anda.
   `rot` é o cambaleio de quem levou uma chinelada (graus). */
import { memo, useEffect, useState, type CSSProperties } from "react";
import { Avatar } from "@/components/ui/Avatar";
import { bonecoOf, hotelOf, posesOf } from "@/lib/dados/nanicos";
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
import { poseDaAcao, posicaoPose, quadroPose, sequenciaPose, type Pose } from "./poses";
import { reduzMovimento } from "@/lib/util";
import { ACAO_DO_SITE, HOTEL_CEL, HOTEL_ESC, HOTEL_PE, alturaHotel, direcaoHotel, jeitoDeConsumir, posicaoHotel, quadroAndando, quadroConsumo, quadroHotel, sequenciaHotel, type AcaoHotel } from "./hotel";
import { useConsumo } from "@/features/loja/consumoSala";

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

/** O desenho do boneco do Nanico Hotel (hotel.ts) para a ação, o lado e o passo, andando no tempo da ação. */
export function useQuadroHotel(acao: AcaoHotel, costas: boolean, passo: number) {
  const [t, setT] = useState(() => performance.now());
  const s = sequenciaHotel(acao, costas);
  const anima = acao !== "walk" && s.q.length > 1 && !reduzMovimento();
  useEffect(() => {
    if (!anima) return;
    const id = setInterval(() => setT(performance.now()), s.ms);
    return () => clearInterval(id);
  }, [anima, s.ms]);
  return acao === "walk" ? quadroAndando(costas, passo) : quadroHotel(acao, costas, anima ? t : 0);
}

/** Um relógio (Date.now()) que bate a cada `ms` enquanto `ativo`: o consumo na mão anda por ele. */
export function useRelogio(ativo: boolean, ms: number) {
  const [agora, setAgora] = useState(() => Date.now());
  useEffect(() => {
    if (!ativo || reduzMovimento()) return;
    const id = setInterval(() => setAgora(Date.now()), ms);
    return () => clearInterval(id);
  }, [ativo, ms]);
  return agora;
}

/** A célula do atlas do hotel dentro da célula do boneco (CEL_W × CEL_H), com o pé no mesmo ponto (ANCORA). */
const CAIXA_HOTEL: CSSProperties = {
  left: `${((ANCORA.x - HOTEL_PE.x * HOTEL_ESC) / CEL_W) * 100}%`,
  top: `${((ANCORA.y - HOTEL_PE.y * HOTEL_ESC) / CEL_H) * 100}%`,
  width: `${((HOTEL_CEL * HOTEL_ESC) / CEL_W) * 100}%`,
  height: `${((HOTEL_CEL * HOTEL_ESC) / CEL_H) * 100}%`,
};

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
  /* o boneco do Nanico Hotel (16 ações em 4 direções) vale antes da folha de poses */
  const hotel = hotelOf(f);
  const poses = hotel ? null : posesOf(f);
  const pose: Pose | null = poses ? (acao ? poseDaAcao(acao) : a ? "sentar" : null) : null;
  const costas = olha.startsWith("costas");
  const quadroPoseAgora = usePoseQuadro(pose, costas);
  const acaoHotel: AcaoHotel = a ? "sit" : acao ? (ACAO_DO_SITE[acao] ?? "idle") : andando ? "walk" : "idle";
  const dirHotel = direcaoHotel(olha);
  const quadroHotelAgora = useQuadroHotel(acaoHotel, dirHotel.costas, b.quadro);
  /* com um consumível (loja/consumoSala.ts), parado em pé: segura o item e leva à boca de tempos em tempos */
  const consumo = useConsumo((s) => s.ativos.find((c) => c.fid === b.fid));
  const consome = !!hotel && !!consumo && !a && !andando && !acao;
  const agoraConsumo = useRelogio(consome, 200);
  const qConsumo = consome && consumo ? quadroConsumo(jeitoDeConsumir(consumo.anim, consumo.item), dirHotel.costas, agoraConsumo - consumo.inicio, alturaHotel(hotel)) : null;
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
  const corpo = hotel ? (
    <span
      className={"boneco-hotel hotel-" + (qConsumo ? "consome" : acaoHotel) + (dirHotel.espelha ? " espelha" : "")}
      style={{ ...CAIXA_HOTEL, backgroundImage: `url(${hotel})`, backgroundPosition: posicaoHotel(qConsumo ?? quadroHotelAgora) }}
    />
  ) : poses && pose && quadroPoseAgora ? (
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
    <div className={"boneco" + (eu ? " eu" : "") + (andando ? " andando " + (olha.endsWith("direita") ? "vai-dir" : "vai-esq") : "") + (a ? " sentado" : "") + (rot ? " balanca" : "") + (enfeite ? " chapeu-" + enfeite : "") + (acess ? " acess-" + acess : "") + (acao ? " acao-" + acao : "") + (pose || hotel ? " com-pose" : "") + (hotel ? " com-hotel" : "") + (efeito ? " efeito-" + efeito : "")} style={caixa}>
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
