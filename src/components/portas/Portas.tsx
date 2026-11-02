"use client";
/* Janelas que cobrem o site: login, primeira senha, trocar senha e o log de versões. */
import { useEffect, useRef, useState, type FormEvent } from "react";
import { enterApp, logout, marcarLogVisto, startSession, toEmail } from "@/lib/dados";
import { novidadesDesde, todasAsVersoes, ULTIMA } from "@/lib/dados/novidades";
import { CREW } from "@/lib/dados/nanicos";
import { getApp, setApp, useApp } from "@/lib/store";
import { sb } from "@/lib/supabase";
import { toast } from "@/lib/toast";
import { norm } from "@/lib/util";

const Turma = () => (
  // eslint-disable-next-line @next/next/no-img-element
  <img className="gate-crew" src={CREW} alt="" decoding="async" />
);

/** Erro do Supabase ao trocar senha → texto para a pessoa. */
function erroSenha(e: { code?: string; message?: string }, igual: string, padrao: string) {
  const s = e.code || e.message || "";
  if (/same/i.test(s)) return igual;
  if (/weak|short|length/i.test(s)) return "Senha fraca demais. Use uma mais longa.";
  return padrao;
}

/** Tela de entrada. Também mostra "Carregando…" e o aviso de conta sem nanico. */
export function PortaLogin() {
  const fase = useApp((s) => s.fase);
  const loginMsg = useApp((s) => s.loginMsg);
  const [user, setUser] = useState("");
  const [pass, setPass] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [entrando, setEntrando] = useState(false);
  const userRef = useRef<HTMLInputElement>(null);
  const passRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (fase !== "login") return;
    setTimeout(() => (userRef.current?.value ? passRef.current : userRef.current)?.focus(), 30);
  }, [fase]);

  if (fase !== "carregando" && fase !== "login" && fase !== "semNanico") return null;
  const msg = err || loginMsg;

  const entrar = async (e: FormEvent) => {
    e.preventDefault();
    setErr(null);
    setApp({ loginMsg: null });
    if (!norm(user) || !pass) return setErr("Preencha o usuário e a senha.");
    setEntrando(true);
    try {
      const { data, error } = await sb().auth.signInWithPassword({ email: toEmail(user), password: pass });
      if (error) {
        setErr(
          error.status === 400 || /invalid/i.test(error.message || "")
            ? "Usuário ou senha incorretos."
            : "Não deu para entrar. Confira a internet e tente de novo.",
        );
        return;
      }
      setPass("");
      await startSession(data.session);
    } catch (ex) {
      console.error(ex);
      setErr("Não deu para entrar. Confira a internet e tente de novo.");
    } finally {
      setEntrando(false);
    }
  };

  return (
    <div className="gate" id="gate" role="dialog" aria-modal="true" aria-labelledby="gateTitle">
      <form className="gate-card" id="loginForm" noValidate onSubmit={entrar}>
        <Turma />
        <h2 id="gateTitle">Bingo dos Nanicos</h2>
        {fase === "carregando" && <p id="gateWait" className="gate-wait">Carregando…</p>}
        {fase === "login" && (
          <div id="loginFields" style={{ display: "grid", gap: 14 }}>
            <p id="gateMsg">Entre com o usuário e a senha que o admin te passou.</p>
            <div>
              <label className="lbl" htmlFor="loginUser">Usuário</label>
              <input id="loginUser" ref={userRef} autoComplete="username" autoCapitalize="none" spellCheck={false} required value={user} onChange={(e) => setUser(e.target.value)} />
            </div>
            <div>
              <label className="lbl" htmlFor="loginPass">Senha</label>
              <input id="loginPass" ref={passRef} type="password" autoComplete="current-password" required value={pass} onChange={(e) => setPass(e.target.value)} />
            </div>
            {msg && <p className="form-err" id="loginErr" role="alert">{msg}</p>}
            <button className="btn" type="submit" id="loginBtn" disabled={entrando}>
              {entrando ? "Entrando…" : "Entrar"}
            </button>
          </div>
        )}
        {fase === "semNanico" && (
          <div id="unlinked" style={{ display: "grid", gap: 14 }}>
            <p>Sua conta entrou, mas ainda não está ligada a nenhum nanico. Fale com o admin.</p>
            <button className="btn soft" type="button" id="unlinkedOut" onClick={logout}>Sair</button>
          </div>
        )}
      </form>
    </div>
  );
}

/** Primeiro acesso: troca obrigatória da senha que o admin passou. */
export function PortaPrimeiraSenha() {
  const fase = useApp((s) => s.fase);
  const usuario = useApp((s) => s.primeiroUsuario);
  const [a, setA] = useState("");
  const [b, setB] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (fase === "primeiraSenha") setTimeout(() => ref.current?.focus(), 30);
  }, [fase]);
  if (fase !== "primeiraSenha") return null;

  const salvar = async (e: FormEvent) => {
    e.preventDefault();
    setErr(null);
    if (a.length < 6) return setErr("A senha precisa ter pelo menos 6 caracteres.");
    if (a !== b) return setErr("As duas senhas não são iguais.");
    setSalvando(true);
    try {
      const { error } = await sb().auth.updateUser({ password: a, data: { must_change: false } });
      if (error) return setErr(erroSenha(error, "Escolha uma senha diferente da que o admin te passou.", "Não deu para salvar a senha. Tente de novo."));
      toast(`Senha salva. Bem-vindo, ${getApp().myName}`);
      enterApp();
    } catch (ex) {
      console.error(ex);
      setErr("Não deu para salvar a senha. Tente de novo.");
    } finally {
      setSalvando(false);
    }
  };

  return (
    <div className="gate" id="firstGate" role="dialog" aria-modal="true" aria-labelledby="firstTitle">
      <form className="gate-card" id="firstForm" noValidate onSubmit={salvar}>
        <Turma />
        <h2 id="firstTitle">Escolha sua senha</h2>
        <p>É o seu primeiro acesso. Troque a senha que o admin te passou por uma só sua. Depois disso, este navegador lembra de você e não pede login de novo.</p>
        <input type="text" id="firstUser" autoComplete="username" hidden readOnly value={usuario} />
        <div>
          <label className="lbl" htmlFor="fp1">Senha nova</label>
          <input id="fp1" ref={ref} type="password" autoComplete="new-password" value={a} onChange={(e) => setA(e.target.value)} />
        </div>
        <div>
          <label className="lbl" htmlFor="fp2">Repita a senha nova</label>
          <input id="fp2" type="password" autoComplete="new-password" value={b} onChange={(e) => setB(e.target.value)} />
        </div>
        {err && <p className="form-err" id="fpErr" role="alert">{err}</p>}
        <button className="btn" type="submit" id="fpSave" disabled={salvando}>{salvando ? "Salvando…" : "Salvar e entrar"}</button>
        <button className="linkish" type="button" id="firstOut" style={{ justifySelf: "center" }} onClick={logout}>Sair</button>
      </form>
    </div>
  );
}

/** Trocar a senha (link no rodapé do menu). Cada vez que abre, o formulário começa vazio. */
export function PortaTrocarSenha() {
  return useApp((s) => s.pwAberto) ? <FormTrocarSenha /> : null;
}

function FormTrocarSenha() {
  const [a, setA] = useState("");
  const [b, setB] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);
  const ref = useRef<HTMLInputElement>(null);
  const fechar = () => setApp({ pwAberto: false });

  useEffect(() => {
    setTimeout(() => ref.current?.focus(), 30);
    const esc = (e: KeyboardEvent) => e.key === "Escape" && fechar();
    document.addEventListener("keydown", esc);
    return () => document.removeEventListener("keydown", esc);
  }, []);

  const salvar = async (e: FormEvent) => {
    e.preventDefault();
    setErr(null);
    if (a.length < 6) return setErr("A senha precisa ter pelo menos 6 caracteres.");
    if (a !== b) return setErr("As duas senhas não são iguais.");
    setSalvando(true);
    try {
      const { error } = await sb().auth.updateUser({ password: a });
      if (error) return setErr(erroSenha(error, "A senha nova é igual à atual.", "Não deu para trocar a senha. Tente de novo."));
      fechar();
      toast("Senha trocada");
    } catch (ex) {
      console.error(ex);
      setErr("Não deu para trocar a senha. Tente de novo.");
    } finally {
      setSalvando(false);
    }
  };

  return (
    <div className="gate" id="pwGate" role="dialog" aria-modal="true" aria-labelledby="pwTitle">
      <form className="gate-card" id="pwForm" noValidate onSubmit={salvar}>
        <h2 id="pwTitle">Trocar senha</h2>
        <p>Use pelo menos 6 caracteres. A senha nova já vale no próximo login, em qualquer aparelho.</p>
        <div>
          <label className="lbl" htmlFor="pw1">Senha nova</label>
          <input id="pw1" ref={ref} type="password" autoComplete="new-password" value={a} onChange={(e) => setA(e.target.value)} />
        </div>
        <div>
          <label className="lbl" htmlFor="pw2">Repita a senha nova</label>
          <input id="pw2" type="password" autoComplete="new-password" value={b} onChange={(e) => setB(e.target.value)} />
        </div>
        {err && <p className="form-err" id="pwErr" role="alert">{err}</p>}
        <div className="row">
          <button type="button" className="btn soft" id="pwCancel" onClick={fechar}>Cancelar</button>
          <button className="btn" type="submit" id="pwSave" disabled={salvando}>Salvar senha</button>
        </div>
      </form>
    </div>
  );
}

/**
 * Log de versões. Pelo botão "Log" do rodapé mostra tudo; depois de uma atualização abre sozinho
 * no modo novidades, só com o que mudou desde a última visita. Fechar marca a versão como vista.
 */
export function PortaLog() {
  const aberto = useApp((s) => s.logAberto);
  const modo = useApp((s) => s.logModo);
  const visto = useApp((s) => s.logVisto);
  const fecharRef = useRef<HTMLButtonElement>(null);
  const fechar = () => {
    marcarLogVisto();
    setApp({ logAberto: false, logModo: "tudo" });
  };
  useEffect(() => {
    if (!aberto) return;
    if (modo === "tudo") marcarLogVisto();
    fecharRef.current?.focus();
    const esc = (e: KeyboardEvent) => e.key === "Escape" && fechar();
    document.addEventListener("keydown", esc);
    return () => document.removeEventListener("keydown", esc);
  }, [aberto, modo]);
  if (!aberto) return null;
  const novidades = modo === "novidades" ? novidadesDesde(visto) : [];
  const soNovidades = novidades.length > 0;
  const lista = soNovidades ? novidades : todasAsVersoes();
  const temRiscado = lista.some((e) => e.itens.some((t) => typeof t !== "string"));
  return (
    <div className="gate" id="logGate" role="dialog" aria-modal="true" aria-labelledby="logTitle" onClick={(e) => e.target === e.currentTarget && fechar()}>
      <div className="gate-card log-card">
        <div className="log-head">
          <h2 id="logTitle">{soNovidades ? "Novidades desde a sua última visita" : "Atualizações"}</h2>
          <button className="btn soft sm" id="logClose" type="button" ref={fecharRef} onClick={fechar}>Fechar</button>
        </div>
        {temRiscado && <p className="status log-obs">Itens riscados não funcionam mais.</p>}
        <div className="log-list" id="logList">
          {lista.map((e) => (
            <section className="log-entry" key={e.v}>
              <h3>
                {e.v}
                <time>{e.data}</time>
                {e.i === ULTIMA && <span className="atual">ATUAL</span>}
              </h3>
              <ul>
                {e.itens.map((t, j) =>
                  typeof t === "string" ? (
                    <li key={j}>{t}</li>
                  ) : (
                    <li key={j} className="off">
                      <s>{t.t}</s> <span className="off-why">{t.off}</span>
                    </li>
                  ),
                )}
              </ul>
            </section>
          ))}
        </div>
        {soNovidades && (
          <button className="btn soft log-todas" type="button" onClick={() => setApp({ logModo: "tudo" })}>
            Ver todas as versões
          </button>
        )}
      </div>
    </div>
  );
}
