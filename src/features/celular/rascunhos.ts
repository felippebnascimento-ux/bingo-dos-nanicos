/*
 * Rascunhos das publicações do InstaNanico (seção 69): ficam só neste aparelho, no IndexedDB (as fotos não cabem no
 * localStorage). Se o navegador não deixar (aba anônima, sem espaço), simplesmente não guarda.
 */
export type Rascunho = { id: string; texto: string; marcados: string[]; fotos: Blob[]; em: number };

const BANCO = "insta-rascunhos", LOJA = "rascunhos";
function abrir(): Promise<IDBDatabase | null> {
  return new Promise((ok) => {
    try {
      const r = indexedDB.open(BANCO, 1);
      r.onupgradeneeded = () => r.result.createObjectStore(LOJA, { keyPath: "id" });
      r.onsuccess = () => ok(r.result);
      r.onerror = () => ok(null);
    } catch {
      ok(null);
    }
  });
}
async function mexer<T>(modo: IDBTransactionMode, fazer: (l: IDBObjectStore) => IDBRequest<T>): Promise<T | null> {
  const db = await abrir();
  if (!db) return null;
  return new Promise((ok) => {
    try {
      const t = db.transaction(LOJA, modo);
      const req = fazer(t.objectStore(LOJA));
      req.onsuccess = () => ok(req.result);
      req.onerror = () => ok(null);
      t.oncomplete = () => db.close();
    } catch {
      ok(null);
    }
  });
}

export async function salvarRascunho(r: Rascunho): Promise<boolean> {
  return (await mexer("readwrite", (l) => l.put(r))) !== null;
}
export async function listarRascunhos(): Promise<Rascunho[]> {
  const todos = (await mexer("readonly", (l) => l.getAll() as IDBRequest<Rascunho[]>)) ?? [];
  return todos.filter((r) => r && typeof r.id === "string").sort((a, b) => b.em - a.em);
}
export async function apagarRascunho(id: string) {
  await mexer("readwrite", (l) => l.delete(id));
}
