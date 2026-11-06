"use client";
/*
 * Configurações como as do Discord (engrenagem embaixo do menu): uma caixa grande por cima do site escurecido, com a
 * lista de seções à esquerda (o meu rosto e "Editar perfil" em cima, a busca, os grupos e o Sair) e a seção à direita.
 * Fecha no X, no Esc ou tocando fora da caixa; no celular a lista é uma tela e cada seção abre por cima, com a seta de voltar. Tudo vale na hora (sem
 * "Salvar"); os ajustes novos ficam em ajustes.ts.
 */
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { PontoStatus, MeuStatus, useSituacao } from "@/components/shell/CartaoPerfil";
import { Avatar } from "@/components/ui/Avatar";
import { IcFechar, IcSeta } from "@/components/ui/icones";
import { arrobaDe } from "@/features/chat/chat";
import { aplicarDesfoque, mudarDesfoque, querDesfoque } from "@/features/live/camera";
import { VideoMudo } from "@/features/live/Video";
import { setLive, useLive, type Fps, type Res } from "@/features/live/estado";
import { Chave, ModoEntrada } from "@/features/live/PainelVoz";
import { ajustarVoz, mudarModoVoz, nomeDaTecla, semSoundboardDe, silenciarNanico, useAjustesVoz, useModoVoz } from "@/features/live/voz";
import { bloquear, ignorar, salvarNota, useNotas } from "@/features/status/notas";
import { NOME_SITUACAO, recadoValido, useStatus } from "@/features/status/status";
import { VERSION } from "@/lib/dados/changelog";
import { sb } from "@/lib/supabase";
import { local } from "@/lib/util";
import { aplicarNaPagina, CORES, FONTE_MAX, instalarApp, useInstalar, FONTE_MIN, mudarAjuste, pedirAvisoDoComputador, useAjustes, type Ajustes } from "./ajustes";
import { abrirMic, type MicFiltrado } from "@/features/live/ruido";
import { volumeDe } from "@/features/live/vozRegras";
import { logout } from "@/lib/dados";
import { setApp, useApp } from "@/lib/store";
import { toast } from "@/lib/toast";
import { acompanharAparelhos, aplicarSaida, listarAparelhos, podeEscolherSaida, restricoesCam, salvarMidia, useMidia, type Dispositivo } from "./midia";

/** Lista de aparelhos com "Padrão do sistema" no topo. Aparelho salvo que sumiu volta para o padrão. */
function Escolha({ rotulo, valor, lista, onChange }: { rotulo: string; valor: string; lista: Dispositivo[]; onChange: (id: string) => void }) {
  const existe = !valor || lista.some((d) => d.id === valor);
  return (
    <label className="cfg-campo">
      <span className="seg-lbl">{rotulo}</span>
      <select value={existe ? valor : ""} onChange={(e) => onChange(e.target.value)}>
        <option value="">Padrão do sistema</option>
        {lista.map((d) => (
          <option key={d.id} value={d.id}>
            {d.nome}
          </option>
        ))}
      </select>
    </label>
  );
}

/**
 * Teste do microfone: uma barra que mexe com a voz e, com "Me ouvir", o som de volta no fone. Usa o mesmo
 * caminho da voz (aparelho, eco e a supressão de ruído escolhidos), então dá para comparar ligando e desligando.
 */
function TesteMic() {
  const [ligado, setLigado] = useState(false);
  const [ouvir, setOuvir] = useState(false);
  const barra = useRef<HTMLSpanElement>(null);
  const mic = useMidia((s) => s.mic);
  const eco = useMidia((s) => s.eco);
  const ruido = useMidia((s) => s.ruido);

  useEffect(() => {
    if (!ligado) return;
    const el = barra.current;
    let fim = false;
    let aberto: MicFiltrado | null = null;
    let ctx: AudioContext | null = null;
    let eco_: HTMLAudioElement | null = null;
    let quadro = 0;
    (async () => {
      try {
        aberto = await abrirMic({ ...useMidia.getState(), mic, eco, ruido });
        if (fim) return aberto.parar();
        listarAparelhos();
        if (ouvir) {
          eco_ = new Audio();
          eco_.srcObject = aberto.stream;
          aplicarSaida(eco_);
          eco_.play().catch(() => {});
        }
        /* só mede, não toca: sem abrir a saída de som */
        try {
          ctx = new AudioContext({ sinkId: { type: "none" } } as AudioContextOptions);
        } catch {
          ctx = new AudioContext();
        }
        const an = ctx.createAnalyser();
        an.fftSize = 512;
        ctx.createMediaStreamSource(aberto.stream).connect(an);
        const buf = new Float32Array(an.fftSize);
        const passo = () => {
          an.getFloatTimeDomainData(buf);
          /* a fala fica entre 0,01 e 0,2: a raiz espalha melhor na barra */
          const n = Math.min(1, Math.sqrt(volumeDe(buf) / 0.2));
          el?.style.setProperty("--nivel", String(n));
          quadro = requestAnimationFrame(passo);
        };
        passo();
      } catch (e) {
        console.warn(e);
        toast("Não deu para ligar o microfone. Libere no cadeado ao lado do endereço do site.");
        setLigado(false);
      }
    })();
    return () => {
      fim = true;
      cancelAnimationFrame(quadro);
      if (eco_) eco_.srcObject = null;
      aberto?.parar();
      ctx?.close().catch(() => {});
      el?.style.setProperty("--nivel", "0");
    };
  }, [ligado, ouvir, mic, eco, ruido]);

  return (
    <div className="cfg-teste-bloco">
      <div className="cfg-teste">
        <button type="button" className="btn soft sm" aria-pressed={ligado} onClick={() => setLigado(!ligado)}>
          {ligado ? "Parar a verificação" : "Vamos verificar"}
        </button>
        <span className="cfg-nivel" ref={barra} aria-hidden="true">
          <i />
        </span>
      </div>
      <label className="cfg-chk">
        <input type="checkbox" checked={ouvir} onChange={(e) => setOuvir(e.target.checked)} />
        <span>
          Me ouvir no teste
          <small>Use fone. Ligue e desligue a supressão de ruído para comparar.</small>
        </span>
      </label>
    </div>
  );
}

/** A janela só existe aberta (fechar desliga o teste do microfone). */
export function ConfigJanela() {
  const aberto = useApp((s) => s.configAberto);
  /* o tema, o tamanho do texto e a acessibilidade valem desde a abertura do site (a janela fica sempre montada) */
  useEffect(() => aplicarNaPagina(), []);
  return aberto ? <ConfigAberta /> : null;
}

type IdSecao = "conta" | "perfil" | "priv" | "voz" | "notif" | "apar" | "aces" | "texto" | "atalhos" | "novidades" | "sobre";
const SECOES: { id: IdSecao; nome: string; grupo: string; busca: string }[] = [
  { id: "conta", nome: "Minha conta", grupo: "Configurações de usuário", busca: "senha usuario sair aparelhos conta" },
  { id: "perfil", nome: "Perfil", grupo: "Configurações de usuário", busca: "status recado opgg steam links cartao" },
  { id: "priv", nome: "Privacidade", grupo: "Configurações de usuário", busca: "bloqueados ignorados notas bloquear" },
  { id: "voz", nome: "Voz e vídeo", grupo: "Configurações do app", busca: "microfone fone saida camera ruido eco volume sensibilidade apertar falar transmissao qualidade desfocar espelhar" },
  { id: "notif", nome: "Notificações", grupo: "Configurações do app", busca: "sons mencao aviso computador live soundboard chamada" },
  { id: "apar", nome: "Aparência", grupo: "Configurações do app", busca: "tema claro escuro texto tamanho fonte compacto chat embaixo" },
  { id: "aces", nome: "Acessibilidade", grupo: "Configurações do app", busca: "movimento animacao destaque falando" },
  { id: "texto", nome: "Texto e imagens", grupo: "Configurações do app", busca: "videos links imagens spoiler enter" },
  { id: "atalhos", nome: "Atalhos de teclado", grupo: "Configurações do app", busca: "teclas atalho mudo surdo" },
  { id: "novidades", nome: "Novidades", grupo: "Atividade", busca: "log versoes" },
  { id: "sobre", nome: "Sobre", grupo: "Atividade", busca: "versao conexao" },
];
/* um ícone por seção, como no Discord (traço simples, na cor do texto) */
const ICONE: Record<IdSecao, ReactNode> = {
  conta: <path d="M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm-7 8a7 7 0 0 1 14 0" />,
  perfil: <path d="M4 5h16v14H4zM8.5 12a2 2 0 1 0 0-4 2 2 0 0 0 0 4Zm-3 4a3 3 0 0 1 6 0M14 9h4M14 13h3" />,
  priv: <path d="M12 3 5 6v5c0 4.5 3 8 7 10 4-2 7-5.5 7-10V6l-7-3Zm-2.5 9 2 2 3.5-4" />,
  voz: <path d="M12 3a3 3 0 0 0-3 3v6a3 3 0 0 0 6 0V6a3 3 0 0 0-3-3Zm-6 9a6 6 0 0 0 12 0M12 18v3" />,
  notif: <path d="M6 16V11a6 6 0 0 1 12 0v5l1.5 2h-15L6 16Zm4 4a2 2 0 0 0 4 0" />,
  apar: <path d="M12 3a9 9 0 1 0 0 18c1.2 0 1.6-1 1-1.9-.7-1.1.1-2.6 1.4-2.6H17a4 4 0 0 0 4-4c0-5-4-9.5-9-9.5ZM7.5 12h.01M10 7.5h.01M15 7.5h.01" />,
  aces: <path d="M12 6a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3Zm-6 2 6 1.5L18 8m-6 1.5V14l-3 7m3-7 3 7" />,
  texto: <path d="M5 5h14v10H9l-4 4V5Zm4 4h6m-6 3h4" />,
  atalhos: <path d="M3 7h18v10H3zM7 11h.01M11 11h.01M15 11h.01M8 14h8" />,
  novidades: <path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8L12 3Zm6 12 .8 2.2L21 18l-2.2.8L18 21l-.8-2.2L15 18l2.2-.8L18 15Z" />,
  sobre: <path d="M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Zm0-10v6m0-9h.01" />,
};
const IconeSecao = ({ id }: { id: IdSecao }) => (
  <svg className="cfgd-it-ic" viewBox="0 0 24 24" width={18} height={18} fill="none" stroke="currentColor" strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    {ICONE[id]}
  </svg>
);

const semAcento = (t: string) => t.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");

function ConfigAberta() {
  const fecharRef = useRef<HTMLButtonElement>(null);
  const fechar = () => setApp({ configAberto: false });
  const [secao, setSecaoEstado] = useState<IdSecao>(() => SECOES.find((x) => x.id === local.get("cfg-secao"))?.id ?? "voz");
  /* no celular a lista é uma tela própria: começa nela */
  const [naLista, setNaLista] = useState(true);
  const [busca, setBusca] = useState("");
  const setSecao = (id: IdSecao) => {
    setSecaoEstado(id);
    setNaLista(false);
    local.set("cfg-secao", id);
  };

  useEffect(() => {
    fecharRef.current?.focus();
    acompanharAparelhos();
    listarAparelhos();
    /* Esc fecha de qualquer lugar (no celular, dentro de uma seção, volta para a lista) */
    const esc = (e: KeyboardEvent) => {
      if (e.key !== "Escape" || document.querySelector(".vz-balao")) return;
      fechar();
    };
    addEventListener("keydown", esc);
    return () => removeEventListener("keydown", esc);
  }, []);

  const achadas = useMemo(() => {
    const t = semAcento(busca.trim());
    return t ? SECOES.filter((x) => semAcento(x.nome + " " + x.busca).includes(t)) : SECOES;
  }, [busca]);
  const grupos = [...new Set(achadas.map((x) => x.grupo))];
  const atual = SECOES.find((x) => x.id === secao)!;

  return (
    <div className="cfgd" role="dialog" aria-modal="true" aria-labelledby="cfgTitulo" onClick={(e) => e.target === e.currentTarget && fechar()}>
      <div className="cfgd-caixa">
      <nav className={"cfgd-nav" + (naLista ? " na-lista" : "")} aria-label="Seções das configurações">
        <div className="cfgd-nav-in">
          {/* no celular, a lista é uma tela: o título e o X ficam em cima dela */}
          <div className="cfgd-nav-topo">
            <b>Configurações</b>
            <button type="button" aria-label="Fechar as configurações" onClick={fechar}>
              <IcFechar />
            </button>
          </div>
          <Eu irPerfil={() => setSecao("perfil")} />
          <input className="cfgd-busca" type="search" placeholder="Buscar" aria-label="Buscar nas configurações" value={busca} onChange={(e) => setBusca(e.target.value)} />
          {grupos.map((g) => (
            <div key={g} className="cfgd-grupo">
              <h3>{g}</h3>
              {achadas
                .filter((x) => x.grupo === g)
                .map((x) => (
                  <button key={x.id} type="button" className={"cfgd-it" + (secao === x.id ? " on" : "")} aria-current={secao === x.id ? "page" : undefined} onClick={() => setSecao(x.id)}>
                    <IconeSecao id={x.id} />
                    <span className="cfgd-it-nome">{x.nome}</span>
                    <IcSeta tam={14} className="cfgd-it-seta" />
                  </button>
                ))}
            </div>
          ))}
          {!achadas.length && <p className="cfgd-nada">Nada encontrado.</p>}
          <div className="cfgd-sep" />
          <button
            type="button"
            className="cfgd-it sair"
            onClick={() => {
              fechar();
              void logout();
            }}
          >
            Sair
          </button>
          <p className="cfgd-versao">Bingo dos Nanicos {VERSION}</p>
        </div>
      </nav>
      <main className={"cfgd-main" + (naLista ? "" : " aberta")}>
        <div className="cfgd-main-in">
          <div className="cfgd-topo">
            <button type="button" className="cfgd-voltar" aria-label="Voltar para a lista" onClick={() => setNaLista(true)}>
              <IcSeta tam={18} />
            </button>
            <span className="cfgd-topo-ic">
            <IconeSecao id={atual.id} />
          </span>
          <h2 id="cfgTitulo">{atual.nome}</h2>
          </div>
          <Secao id={secao} fechar={fechar} />
        </div>
        <div className="cfgd-fechar">
          <button type="button" ref={fecharRef} aria-label="Fechar as configurações" onClick={fechar}>
            <IcFechar />
          </button>
          <small aria-hidden="true">ESC</small>
        </div>
      </main>
      </div>
    </div>
  );
}

/** Em cima da lista: o meu rosto, o nome e "Editar perfil", como no Discord. */
function Eu({ irPerfil }: { irPerfil: () => void }) {
  const myFid = useApp((s) => s.myFid);
  const eu = useApp((s) => s.friends.find((f) => f.id === s.myFid));
  const myName = useApp((s) => s.myName);
  const sit = useSituacao(myFid);
  return (
    <button type="button" className="cfgd-eu" onClick={irPerfil}>
      <span className="cfgd-eu-rosto">
        {eu ? <Avatar f={eu} /> : <span className="av">{myName[0]}</span>}
        <PontoStatus sit={sit} />
      </span>
      <span>
        <b>{eu?.name ?? myName}</b>
        <small>Editar perfil ✎</small>
      </span>
    </button>
  );
}

function Linha({ titulo, dica, children }: { titulo: string; dica?: ReactNode; children?: ReactNode }) {
  return (
    <div className="cfgd-linha">
      <div>
        <b>{titulo}</b>
        {dica && <small>{dica}</small>}
      </div>
      {children}
    </div>
  );
}
function Interruptor({ k, titulo, dica }: { k: keyof Ajustes; titulo: string; dica?: string }) {
  const v = useAjustes((s) => s[k]) as boolean;
  return (
    <div className="cfgd-chave">
      <Chave rotulo={titulo} ligado={v} onChange={(x) => mudarAjuste({ [k]: x } as Partial<Ajustes>)} />
      {dica && <small>{dica}</small>}
    </div>
  );
}

function Secao({ id, fechar }: { id: IdSecao; fechar: () => void }) {
  if (id === "conta") return <SecConta fechar={fechar} />;
  if (id === "perfil") return <SecPerfil fechar={fechar} />;
  if (id === "priv") return <SecPrivacidade />;
  if (id === "voz") return <SecVoz />;
  if (id === "notif") return <SecNotificacoes />;
  if (id === "apar") return <SecAparencia />;
  if (id === "aces") return <SecAcessibilidade />;
  if (id === "texto") return <SecTexto />;
  if (id === "atalhos") return <SecAtalhos />;
  if (id === "novidades") return <SecNovidades fechar={fechar} />;
  return <SecSobre />;
}

/* ---------- Minha conta ---------- */
function SecConta({ fechar }: { fechar: () => void }) {
  const eu = useApp((s) => s.friends.find((f) => f.id === s.myFid));
  const myName = useApp((s) => s.myName);
  const usuario = (eu as { username?: string } | undefined)?.username || arrobaDe(eu?.name ?? myName);
  const [certeza, setCerteza] = useState(false);
  return (
    <div className="cfgd-sec">
      <div className="cfgd-conta-card">
        <div className="cfgd-faixa" aria-hidden="true" />
        <div className="cfgd-conta-cab">
          {eu ? <Avatar f={eu} size="lg" /> : <span className="av lg">{myName[0]}</span>}
          <b>{eu?.name ?? myName}</b>
        </div>
        <div className="cfgd-conta-dados">
          <Linha titulo="Nome de usuário" dica={usuario}>
            <button type="button" className="btn soft sm" onClick={() => void navigator.clipboard?.writeText(usuario).then(() => toast("Copiado"))}>
              Copiar
            </button>
          </Linha>
        </div>
      </div>
      <h3>Senha e segurança</h3>
      <Linha titulo="Senha">
        <button type="button" className="btn soft sm" onClick={() => setApp({ configAberto: false, pwAberto: true })}>
          Trocar senha
        </button>
      </Linha>
      <Linha titulo="Aparelhos conectados" dica="Sai da conta em todos os outros aparelhos e navegadores, menos neste.">
        <button
          type="button"
          className={"btn soft sm" + (certeza ? " sure" : "")}
          onClick={async () => {
            if (!certeza) {
              setCerteza(true);
              setTimeout(() => setCerteza(false), 3000);
              return;
            }
            setCerteza(false);
            const { error } = await sb().auth.signOut({ scope: "others" });
            toast(error ? "Não deu para sair dos outros aparelhos. Tente de novo." : "Pronto: você saiu dos outros aparelhos.");
          }}
        >
          {certeza ? "Confirmar" : "Sair dos outros"}
        </button>
      </Linha>
      <Linha titulo="Sair da conta" dica="Neste aparelho.">
        <button
          type="button"
          className="btn soft sm cfgd-perigo"
          onClick={() => {
            fechar();
            void logout();
          }}
        >
          Sair
        </button>
      </Linha>
    </div>
  );
}

/* ---------- Perfil ---------- */
function SecPerfil({ fechar }: { fechar: () => void }) {
  const myFid = useApp((s) => s.myFid);
  const eu = useApp((s) => s.friends.find((f) => f.id === s.myFid));
  const meu = useStatus((s) => s.meu);
  const sit = useSituacao(myFid);
  return (
    <div className="cfgd-sec cfgd-perfil">
      <div>
        <h3>Status e recado</h3>
        <MeuStatus />
        <h3>Jogos e links</h3>
        <Linha titulo="op.gg, smurf, Steam e os seus links" dica="Aparecem na sua ficha e no seu cartão.">
          <button type="button" className="btn soft sm" onClick={() => (fechar(), setApp({ aba: "perfil" }))}>
            Editar
          </button>
        </Linha>
        <Linha titulo="A sua ficha" dica="O que os outros veem ao tocar em você.">
          <button type="button" className="btn soft sm" onClick={() => (fechar(), setApp({ fichaAberta: myFid }))}>
            Ver a ficha
          </button>
        </Linha>
      </div>
      {eu && (
        <div className="cfgd-previa" aria-label="Prévia do seu cartão">
          <div className="cartao-faixa" aria-hidden="true" />
          <div className="cartao-rosto">
            <Avatar f={eu} size="lg" />
            <PontoStatus sit={sit} />
          </div>
          <div className="cartao-corpo">
            <b className="cartao-nome">{eu.name}</b>
            <small className="cartao-at">
              @{arrobaDe(eu.name)} · {NOME_SITUACAO[sit]}
            </small>
            {recadoValido(meu) && (
              <p className="cartao-recado">
                {meu.emoji} {meu.texto}
              </p>
            )}
          </div>
          <small className="cfgd-previa-txt">Prévia do seu cartão</small>
        </div>
      )}
    </div>
  );
}

/* ---------- Privacidade ---------- */
function SecPrivacidade() {
  const friends = useApp((s) => s.friends);
  const { bloqueados, ignorados, porFid } = useNotas();
  const nome = (fid: string) => friends.find((f) => f.id === fid)?.name ?? "Alguém";
  const notas = Object.entries(porFid);
  return (
    <div className="cfgd-sec">
      <h3>Bloqueados</h3>
      <p className="cfgd-dica">Você não vê as mensagens deles e não ouve a voz nem a soundboard deles. Eles não ficam sabendo.</p>
      {bloqueados.length ? (
        bloqueados.map((fid) => (
          <Linha key={fid} titulo={nome(fid)}>
            <button
              type="button"
              className="btn soft sm"
              onClick={() => {
                bloquear(fid, false);
                silenciarNanico(fid, false);
                semSoundboardDe(fid, false);
                toast("Desbloqueado");
              }}
            >
              Desbloquear
            </button>
          </Linha>
        ))
      ) : (
        <p className="cfgd-vazio">Ninguém bloqueado. Para bloquear, clique com o botão direito no nome da pessoa.</p>
      )}
      <h3>Ignorados</h3>
      {ignorados.length ? (
        ignorados.map((fid) => (
          <Linha key={fid} titulo={nome(fid)} dica="As mensagens ficam escondidas no seu chat.">
            <button type="button" className="btn soft sm" onClick={() => ignorar(fid, false)}>
              Deixar de ignorar
            </button>
          </Linha>
        ))
      ) : (
        <p className="cfgd-vazio">Ninguém ignorado.</p>
      )}
      <h3>As suas notas</h3>
      <p className="cfgd-dica">Só você vê. Ficam na sua conta, em qualquer aparelho.</p>
      {notas.length ? (
        notas.map(([fid, t]) => (
          <Linha key={fid} titulo={nome(fid)} dica={`“${t}”`}>
            <button type="button" className="btn soft sm" onClick={() => (salvarNota(fid, ""), toast("Nota apagada"))}>
              Apagar
            </button>
          </Linha>
        ))
      ) : (
        <p className="cfgd-vazio">Nenhuma nota. No menu de uma pessoa, use “Adicionar nota”.</p>
      )}
    </div>
  );
}

/* ---------- Voz e vídeo (na ordem do Discord) ---------- */
/** "Testar vídeo": a prévia da câmera ali mesmo, sem ligar para ninguém. */
function PreviaVideo() {
  const camId = useMidia((s) => s.cam);
  const espelho = useLive((s) => s.espelho);
  const [ligada, setLigada] = useState(false);
  const [stream, setStream] = useState<MediaStream | null>(null);
  useEffect(() => {
    if (!ligada) return;
    let vivo = true;
    let aberto: MediaStream | null = null;
    navigator.mediaDevices
      .getUserMedia({ video: { width: { ideal: 640 }, height: { ideal: 360 }, facingMode: "user", ...restricoesCam() }, audio: false })
      .then((st) => {
        if (!vivo) return st.getTracks().forEach((t) => t.stop());
        aberto = st;
        if (querDesfoque()) void aplicarDesfoque(st.getVideoTracks()[0], true);
        setStream(st);
        void listarAparelhos();
      })
      .catch(() => {
        if (!vivo) return;
        toast("Não deu para abrir a câmera. Libere no cadeado ao lado do endereço do site.");
        setLigada(false);
      });
    return () => {
      vivo = false;
      aberto?.getTracks().forEach((t) => t.stop());
      setStream(null);
    };
  }, [ligada, camId]);
  return (
    <div className={"cfgd-video" + (espelho ? " espelho" : "")}>
      {ligada && stream ? <VideoMudo stream={stream} /> : <span className="cfgd-video-vazio">📷</span>}
      <button type="button" className="btn sm" onClick={() => setLigada((v) => !v)}>
        {ligada ? "Parar o teste" : "Testar vídeo"}
      </button>
    </div>
  );
}

function SecVoz() {
  const m = useMidia();
  const naVoz = useApp((s) => !!s.myVozSid);
  const geral = useAjustesVoz((s) => s.geral);
  const espelho = useLive((s) => s.espelho);
  const res = useLive((s) => s.res);
  const fps = useLive((s) => s.fps);
  const somPc = useLive((s) => s.somPc);
  const [desfoque, setDesfoque] = useState(querDesfoque);
  const [certeza, setCerteza] = useState(false);
  const ruido = m.ruido ? "forte" : m.ruidoNav ? "padrao" : "nenhum";
  const liberar = async () => {
    try {
      const st = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
      st.getTracks().forEach((t) => t.stop());
      await listarAparelhos();
    } catch {
      toast("O microfone foi bloqueado. Libere no cadeado ao lado do endereço do site.");
    }
  };
  const redefinir = () => {
    salvarMidia({ mic: "", saida: "", cam: "", eco: true, ruido: true, ruidoNav: true, agc: true, volEntrada: 1 });
    mudarModoVoz({ modo: "voz", tecla: "KeyV", sensib: 0, sensAuto: true, atrasoPtt: 0 });
    ajustarVoz({ geral: 1 });
    toast("Configurações de voz redefinidas");
  };
  return (
    <div className="cfgd-sec">
      {!m.liberado && (
        <p className="cfg-aviso">
          O navegador só mostra o nome dos aparelhos depois de liberar o microfone.{" "}
          <button type="button" className="linkish" onClick={liberar}>
            Liberar o microfone
          </button>
        </p>
      )}
      <h3>Configurações de voz</h3>
      <div className="cfgd-duas">
        <Escolha rotulo="Dispositivo de entrada" valor={m.mic} lista={m.mics} onChange={(mic) => salvarMidia({ mic })} />
        {podeEscolherSaida() && <Escolha rotulo="Dispositivo de saída" valor={m.saida} lista={m.saidas} onChange={(saida) => salvarMidia({ saida })} />}
      </div>
      <div className="cfgd-duas">
        <label className="cfgd-faixa-vol">
          <span className="seg-lbl">Volume de entrada · {Math.round(m.volEntrada * 100)}%</span>
          <input type="range" min={0} max={200} step={5} value={Math.round(m.volEntrada * 100)} onChange={(e) => salvarMidia({ volEntrada: Number(e.target.value) / 100 })} onDoubleClick={() => salvarMidia({ volEntrada: 1 })} />
        </label>
        <label className="cfgd-faixa-vol">
          <span className="seg-lbl">Volume de saída · {Math.round(geral * 100)}%</span>
          <input type="range" min={0} max={100} value={Math.round(geral * 100)} onChange={(e) => ajustarVoz({ geral: Number(e.target.value) / 100 })} />
        </label>
      </div>
      <div className="cfgd-teste-mic">
        <b>Teste de microfone</b>
        <small>Está com problema no microfone? Comece o teste e fale algo: a barra mostra se o som está chegando.</small>
        <TesteMic />
      </div>
      <div className="cfgd-modo vz-balao-dentro">
        <ModoEntrada />
      </div>
      <p className="cfgd-dica">{naVoz ? "Você está na voz: o que mudar aqui vale na hora." : "Vale para a próxima vez que você entrar na voz."}</p>

      <h3>Configurações de vídeo</h3>
      <Escolha rotulo="Câmera" valor={m.cam} lista={m.cams} onChange={(cam) => salvarMidia({ cam })} />
      <PreviaVideo />
      <div className="cfgd-chave">
        <Chave
          rotulo="Espelhar a minha imagem"
          ligado={espelho}
          onChange={(v) => {
            setLive({ espelho: v });
            local.set("cam-espelho", v ? "1" : "0");
          }}
        />
        <small>Muda só o que você vê; os outros te veem do jeito certo.</small>
      </div>
      <div className="cfgd-seg-linha">
        <span className="seg-lbl">Fundo do vídeo</span>
        <div className="seg" role="radiogroup" aria-label="Fundo do vídeo">
          {(
            [
              [false, "Nenhum"],
              [true, "Desfocar"],
            ] as const
          ).map(([v, n]) => (
            <button
              key={n}
              type="button"
              role="radio"
              aria-checked={desfoque === v}
              className={desfoque === v ? "on" : undefined}
              onClick={() => {
                setDesfoque(v);
                mudarDesfoque(v);
              }}
            >
              {n}
            </button>
          ))}
        </div>
        <small className="cfgd-seg-dica">O desfoque é o do próprio aparelho (Windows 11 e Mac). Onde ele não existe, não muda nada.</small>
      </div>

      <h3>Compartilhamento de tela</h3>
      <div className="cfgd-seg-linha">
        <span className="seg-lbl">Resolução</span>
        <div className="seg" role="radiogroup" aria-label="Resolução">
          {([720, 1080, 1440] as Res[]).map((r) => (
            <button key={r} type="button" role="radio" aria-checked={res === r} className={res === r ? "on" : undefined} onClick={() => (setLive({ res: r }), local.set("live-res", String(r)))}>
              {r}p
            </button>
          ))}
        </div>
      </div>
      <div className="cfgd-seg-linha">
        <span className="seg-lbl">Taxa de quadros</span>
        <div className="seg" role="radiogroup" aria-label="Taxa de quadros">
          {([30, 60] as Fps[]).map((f) => (
            <button key={f} type="button" role="radio" aria-checked={fps === f} className={fps === f ? "on" : undefined} onClick={() => (setLive({ fps: f }), local.set("live-fps", String(f)))}>
              {f} fps
            </button>
          ))}
        </div>
      </div>
      <div className="cfgd-chave">
        <Chave rotulo="Transmitir com o som do PC" ligado={somPc} onChange={(v) => (setLive({ somPc: v }), local.set("live-som", v ? "1" : "0"))} />
      </div>

      <h3>Avançado</h3>
      <div className="cfgd-seg-linha">
        <span className="seg-lbl">Supressão de ruído</span>
        <div className="seg" role="radiogroup" aria-label="Supressão de ruído">
          {(
            [
              ["forte", "Forte (IA)"],
              ["padrao", "Padrão"],
              ["nenhum", "Nenhuma"],
            ] as const
          ).map(([v, n]) => (
            <button
              key={v}
              type="button"
              role="radio"
              aria-checked={ruido === v}
              className={ruido === v ? "on" : undefined}
              onClick={() => salvarMidia(v === "forte" ? { ruido: true } : { ruido: false, ruidoNav: v === "padrao" })}
            >
              {n}
            </button>
          ))}
        </div>
        <small className="cfgd-seg-dica">A forte é uma inteligência artificial no seu navegador que corta teclado, ventilador e barulho de fundo. A padrão é a do próprio navegador.</small>
      </div>
      <div className="cfgd-chave">
        <Chave rotulo="Cancelamento de eco" ligado={m.eco} onChange={(eco) => salvarMidia({ eco })} />
        <small>Com fone de ouvido, dá para desligar. Em alguns fones Bluetooth, desligar evita um soluço na música ao entrar na voz.</small>
      </div>
      <div className="cfgd-chave">
        <Chave rotulo="Controle automático de ganho" ligado={m.agc} onChange={(agc) => salvarMidia({ agc })} />
        <small>O navegador ajusta o volume do microfone sozinho para a sua voz chegar sempre no mesmo volume.</small>
      </div>
      <button
        type="button"
        className={"btn soft cfgd-redefinir" + (certeza ? " sure" : "")}
        onClick={() => {
          if (!certeza) {
            setCerteza(true);
            setTimeout(() => setCerteza(false), 3000);
            return;
          }
          setCerteza(false);
          redefinir();
        }}
      >
        {certeza ? "Confirmar: redefinir" : "Redefinir configurações de voz"}
      </button>
    </div>
  );
}

/* ---------- Notificações ---------- */
function SecNotificacoes() {
  const aviso = useAjustes((s) => s.avisoMencao);
  const negado = typeof Notification !== "undefined" && Notification.permission === "denied";
  return (
    <div className="cfgd-sec">
      <h3>Avisos</h3>
      <div className="cfgd-chave">
        <Chave
          rotulo="Aviso do computador quando te mencionam"
          ligado={aviso}
          onChange={async (v) => {
            if (v && !(await pedirAvisoDoComputador())) return toast("O navegador bloqueou os avisos. Libere no cadeado ao lado do endereço do site.");
            mudarAjuste({ avisoMencao: v });
          }}
        />
        <small>{negado ? "Os avisos estão bloqueados no navegador: libere no cadeado ao lado do endereço." : "Aparece no canto da tela quando o site está minimizado ou em outra aba."}</small>
      </div>
      <h3>Sons</h3>
      <Interruptor k="somMencao" titulo="Menção a você" />
      <Interruptor k="somVoz" titulo="Alguém entra ou sai da voz" />
      <Interruptor k="somMudo" titulo="Mutar e desmutar" />
      <Interruptor k="somLive" titulo="Alguém entra ao vivo" />
      <Interruptor k="somSoundboard" titulo="Soundboard dos outros" />
      <Interruptor k="somChamada" titulo="Chamado para a call" />
    </div>
  );
}

/* ---------- Aparência ---------- */
function SecAparencia() {
  const tema = useAjustes((s) => s.tema);
  const fonte = useAjustes((s) => s.fonteChat);
  const cor = useAjustes((s) => s.cor);
  const chatEmbaixo = useLive((s) => s.chatEmbaixo);
  return (
    <div className="cfgd-sec">
      <h3>Tema</h3>
      <div className="cfgd-temas" role="radiogroup" aria-label="Tema">
        {(
          [
            ["claro", "Claro"],
            ["escuro", "Escuro"],
            ["sistema", "Do sistema"],
          ] as const
        ).map(([v, n]) => (
          <button key={v} type="button" role="radio" aria-checked={tema === v} className={"cfgd-tema " + v + (tema === v ? " on" : "")} onClick={() => mudarAjuste({ tema: v })}>
            <i aria-hidden="true" />
            {n}
          </button>
        ))}
      </div>
      <h3>Cor de destaque</h3>
      <div className="cfgd-cores" role="radiogroup" aria-label="Cor de destaque">
        {CORES.map((c) => (
          <button key={c.id} type="button" role="radio" aria-checked={cor === c.id} className={"cfgd-cor cor-" + c.id + (cor === c.id ? " on" : "")} onClick={() => mudarAjuste({ cor: c.id })}>
            <i aria-hidden="true" />
            {c.nome}
          </button>
        ))}
      </div>
      <h3>Chat</h3>
      <label className="cfgd-faixa-vol">
        <span className="seg-lbl">Tamanho do texto do chat · {fonte}px</span>
        <input type="range" min={FONTE_MIN} max={FONTE_MAX} value={fonte} onChange={(e) => mudarAjuste({ fonteChat: Number(e.target.value) })} />
      </label>
      <Interruptor k="compacto" titulo="Mensagens compactas" dica="Sem o rosto grande: mais mensagens na tela." />
      <div className="cfgd-chave">
        <Chave
          rotulo="Chat embaixo da call"
          ligado={chatEmbaixo}
          onChange={(v) => {
            setLive({ chatEmbaixo: v });
            local.set("cv-chat-lado", v ? "0" : "1");
          }}
        />
        <small>Desligado, o chat do Ao vivo fica do lado da transmissão.</small>
      </div>
    </div>
  );
}

function SecAcessibilidade() {
  return (
    <div className="cfgd-sec">
      <Interruptor k="reduzirMovimento" titulo="Reduzir movimento" dica="Desliga as animações do site (o sistema também pode pedir isso sozinho)." />
      <Interruptor k="destacarFala" titulo="Destacar quem está falando" dica="A borda verde em volta de quem fala, na call e nas listas." />
    </div>
  );
}

function SecTexto() {
  return (
    <div className="cfgd-sec">
      <Interruptor k="videosLinks" titulo="Mostrar os vídeos dos links" dica="YouTube, Twitch e Medal tocam no chat." />
      <Interruptor k="imagensChat" titulo="Mostrar as imagens no chat" dica="Desligado, cada imagem aparece com um botão para mostrar." />
      <Interruptor k="spoilersAbertos" titulo="Spoilers sempre abertos" />
      <Interruptor k="enterEnvia" titulo="Enter envia a mensagem" dica="Desligado, Enter pula linha e Shift+Enter envia." />
    </div>
  );
}

function SecAtalhos() {
  const tecla = useModoVoz((s) => s.tecla);
  const modo = useModoVoz((s) => s.modo);
  const lista: [string, string][] = [
    ["Ligar e desligar o microfone", "Ctrl + Shift + M"],
    ["Parar e voltar a ouvir", "Ctrl + Shift + D"],
    ["Apertar para falar" + (modo === "ptt" ? "" : " (desligado)"), nomeDaTecla(tecla)],
    ["Editar a sua última mensagem", "Seta para cima"],
    ["Pular linha no chat", "Shift + Enter"],
    ["Histórico do chat no K-FOFO", "Z"],
    ["Busca rápida (ir para qualquer lugar)", "Ctrl + K"],
    ["Fechar janelas e menus", "Esc"],
  ];
  return (
    <div className="cfgd-sec">
      <p className="cfgd-dica">A tecla do apertar para falar muda em Voz e vídeo. No Mac, Cmd funciona no lugar do Ctrl.</p>
      {lista.map(([t, k]) => (
        <Linha key={t} titulo={t}>
          <kbd className="cfgd-kbd">{k}</kbd>
        </Linha>
      ))}
    </div>
  );
}

function SecNovidades({ fechar }: { fechar: () => void }) {
  return (
    <div className="cfgd-sec">
      <p className="cfgd-dica">Tudo o que mudou no site, versão por versão.</p>
      <button type="button" className="btn" onClick={() => (fechar(), setApp({ logAberto: true, logModo: "tudo" }))}>
        Abrir o Log
      </button>
    </div>
  );
}

function SecSobre() {
  const conn = useApp((s) => s.conn);
  const { pode, instalado } = useInstalar();
  const mac = typeof navigator !== "undefined" && /Mac|iPhone|iPad/.test(navigator.userAgent) && !/Chrome|Edg/.test(navigator.userAgent);
  return (
    <div className="cfgd-sec">
      <h3>App</h3>
      <Linha
        titulo="Instalar como app"
        dica={
          instalado
            ? "Já está instalado: você está usando o app."
            : pode
              ? "Ganha um ícone no Dock (ou na tela inicial do celular) e abre sem a barra do navegador."
              : mac
                ? "No Safari: Compartilhar › Adicionar ao Dock (Mac) ou Adicionar à Tela de Início (iPhone)."
                : "No Chrome ou no Edge: o ícone de instalar fica no fim da barra de endereço."
        }
      >
        {pode && !instalado && (
          <button type="button" className="btn sm" onClick={() => void instalarApp().then((ok) => ok && toast("Pronto: o Bingo dos Nanicos está instalado"))}>
            Instalar
          </button>
        )}
      </Linha>
      <h3>Versão</h3>
      <Linha titulo="Versão" dica={VERSION} />
      <Linha titulo="Conexão" dica={conn} />
      <Linha titulo="Navegador" dica={navigator.userAgent.match(/(Edg|Chrome|Firefox|Safari)\/[\d.]+/)?.[0] ?? "—"} />
      <p className="cfgd-dica">Feito pelos nanicos, para os nanicos.</p>
    </div>
  );
}

