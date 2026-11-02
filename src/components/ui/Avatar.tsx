import { useEquipados } from "@/features/loja/lojaDados";
import { artOf } from "@/lib/dados/nanicos";
import type { Rosto } from "@/lib/tipos";
import { initials } from "@/lib/util";

type Props = { f: Rosto | null | undefined; size?: "" | "xs" | "lg"; className?: string };

/** Rosto de um nanico: a arte (NAN_ART), a foto antiga ou as iniciais, com a moldura da loja se tiver. */
export function Avatar({ f, size = "", className = "" }: Props) {
  const moldura = useEquipados(f?.user_id).moldura?.dados.cor;
  const cls = (extra: string) => ["av", extra, size, className, moldura ? "mold-" + moldura : ""].filter(Boolean).join(" ");
  if (!f) return <span className={cls("none")} aria-hidden="true">–</span>;
  const art = artOf(f);
  // eslint-disable-next-line @next/next/no-img-element
  if (art) return <img className={cls("art")} src={art.face} alt="" />;
  const ph = typeof f.photo === "string" && f.photo.startsWith("data:image/") ? f.photo : "";
  // eslint-disable-next-line @next/next/no-img-element
  if (ph) return <img className={cls("")} src={ph} alt="" />;
  return <span className={cls("")} aria-hidden="true">{initials(f.name)}</span>;
}
