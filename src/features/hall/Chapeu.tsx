/* Enfeite na cabeça do boneco, a semana inteira: chapéu de burro (Feeder), coroa dourada (Carregou o
   piano) e coroa de moedas (o mais rico agora). Desenhados aqui, fora do quadro espelhado do boneco. */
import type { Enfeite } from "@/features/trofeus/trofeus";

export function Chapeu({ tipo }: { tipo: Enfeite }) {
  if (tipo === "burro")
    return (
      <svg className="boneco-chapeu burro" viewBox="0 0 40 40" aria-hidden="true">
        <path d="M20 1 L33 34 Q20 39 7 34 Z" className="ch-burro" />
        <path d="M7 34 Q20 39 33 34" className="ch-aba" />
        <text x="20" y="27" textAnchor="middle" transform="rotate(-8 20 27)" className="ch-texto">
          BURRO
        </text>
      </svg>
    );
  if (tipo === "coroa")
    return (
      <svg className="boneco-chapeu coroa" viewBox="0 0 40 24" aria-hidden="true">
        <path d="M3 22 L5 6 L13 14 L20 3 L27 14 L35 6 L37 22 Z" className="ch-ouro" />
        <circle cx="20" cy="15" r="2.5" className="ch-pedra" />
      </svg>
    );
  return (
    <svg className="boneco-chapeu moedas" viewBox="0 0 40 26" aria-hidden="true">
      <path d="M4 24 L6 10 L14 15 L20 6 L26 15 L34 10 L36 24 Z" className="ch-ouro" />
      {[8, 20, 32].map((x, k) => (
        <g key={x}>
          <circle cx={x} cy={k === 1 ? 6 : 10} r="5" className="ch-moeda" />
          <text x={x} y={(k === 1 ? 6 : 10) + 2.6} textAnchor="middle" className="ch-cifrao">
            $
          </text>
        </g>
      ))}
    </svg>
  );
}
