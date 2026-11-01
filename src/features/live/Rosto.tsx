"use client";
import { Avatar } from "@/components/ui/Avatar";
import { friendDaPresenca, useApp } from "@/lib/store";

/** Rosto pequeno de quem está na sala (nada, se não for um nanico conhecido). */
export function Rosto({ p }: { p: { fid: string | null; name: string } }) {
  const friends = useApp((s) => s.friends);
  const f = friendDaPresenca(p, friends);
  return f ? <Avatar f={f} size="xs" /> : null;
}
