import { Avatar } from "@/components/ui/Avatar";
import { friendOf } from "@/lib/store";
import type { Cell, Friend } from "@/lib/tipos";

/** Etiqueta da casa: rostos e nomes de quem a nanicada é, mais os campeões. */
export function CellTag({ c, friends }: { c: Cell; friends: Friend[] }) {
  if (c.tag) return <span className="tag">{c.tag}</span>;
  /* cartelas antigas guardavam um nanico só (friendId); as novas guardam uma lista */
  const ids = Array.isArray(c.friendIds) ? c.friendIds : c.friendId ? [c.friendId] : [];
  const fn = Array.isArray(c.fnames) ? c.fnames : [c.fname];
  const fl = ids.map((id, i) => {
    const f = friendOf(id, friends);
    return { f, nm: f ? f.name : fn[i] || "" };
  });
  const nm = fl
    .map((x) => x.nm)
    .filter(Boolean)
    .join(" + ");
  if (!nm && !c.champs) return null;
  return (
    <span className="tag">
      {fl.slice(0, 3).map((x, i) => (
        <Avatar key={i} f={x.f || { name: x.nm }} size="xs" />
      ))}
      {[nm, c.champs].filter(Boolean).join(" / ")}
    </span>
  );
}
