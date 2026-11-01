/*
 * Projeto Supabase do grupo.
 * - SUPABASE_URL: "Project URL" (Project Settings > API).
 * - SUPABASE_KEY: a chave "publishable" (ou "anon public"). Ela é pública por natureza.
 *   NUNCA coloque aqui a service_role / secret.
 * Dá para trocar sem mexer no código com NEXT_PUBLIC_SUPABASE_URL e NEXT_PUBLIC_SUPABASE_KEY
 * (por exemplo para testar num projeto Supabase de teste).
 */
export const SUPABASE_URL =
  process.env.NEXT_PUBLIC_SUPABASE_URL || "https://rigycanmwwnczpdsjbdt.supabase.co";
export const SUPABASE_KEY =
  process.env.NEXT_PUBLIC_SUPABASE_KEY || "sb_publishable_Ddz92Hv2BieIe-JlJqnHTQ_P8_8FRBB";

/** login: o usuário vira um e-mail interno do Supabase (ex.: pin → pin@nanicos.app) */
export const EMAIL_DOMAIN = "nanicos.app";

/** nome do canal privado da sala em tempo real */
export const CANAL_SALA = "bingo-dos-nanicos";
