import { useEffect, useRef, useState, type FormEvent, type Ref } from "react";
import { Avatar } from "@/components/ui/Avatar";
import { soNanicos } from "@/lib/dados/nanicos";
import type { Friend } from "@/lib/tipos";
import { sb } from "@/lib/supabase";
import { CHAMPS } from "@/lib/dados/campeoes";
import styles from "./CampeoesSelados.module.css";

const idsRiot: Record<string, string> = {
  Wukong: "MonkeyKing", Fiddlesticks: "FiddleSticks", "Nunu & Willump": "Nunu",
  "Renata Glasc": "Renata", LeBlanc: "Leblanc",
};

function Retrato({ campeao }: { campeao: string }) {
  const nome = CHAMPS.find((nome) => nome.toLowerCase() === campeao.toLowerCase());
  const id = nome && (idsRiot[nome] ?? nome.replace(/[^a-z0-9]/gi, ""));
  return (
    <div className={styles.retrato}>
      {/* eslint-disable-next-line @next/next/no-img-element -- Arte da Riot com exportação estática. */}
      {id && <img src={`https://ddragon.leagueoflegends.com/cdn/img/champion/splash/${id}_0.jpg`} alt="" loading="lazy" />}
      <span className={styles.selo}>SELADO</span>
    </div>
  );
}

export function CampeoesSelados({ dialogRef, friends }: { dialogRef: Ref<HTMLDialogElement>; friends: readonly Friend[] }) {
  const [filtro, setFiltro] = useState("");
  const [registrando, setRegistrando] = useState(false);
  const [campeaoEscolhido, setCampeaoEscolhido] = useState("");
  const [erro, setErro] = useState("");
  type Registro = { jogador: string; campeao: string; motivo: string; chaves: number };
  const [registros, setRegistros] = useState<Registro[]>([]);
  const [aberto, setAberto] = useState(false);
  const [pronto, setPronto] = useState(false);
  const [falhaLeitura, setFalhaLeitura] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const revisao = useRef(0);
  const nanicos = soNanicos(friends).sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));
  const selecionado = nanicos.find((nanico) => nanico.id === filtro);

  useEffect(() => {
    if (!aberto || salvando) return;
    let ativo = true;
    async function carregar() {
      const pedido = ++revisao.current;
      const { data, error } = await sb().from("campeoes_selados").select("jogador,campeao,motivo,chaves").order("campeao");
      if (!ativo || pedido !== revisao.current) return;
      if (error) {
        setFalhaLeitura(true);
        setPronto(false);
        return;
      }
      setFalhaLeitura(false);
      setRegistros(data);
      setPronto(true);
    }
    void carregar();
    const intervalo = window.setInterval(carregar, 5000);
    return () => { ativo = false; window.clearInterval(intervalo); };
  }, [aberto, salvando]);

  async function gravar(funcao: string, dados: Record<string, string | number>) {
    ++revisao.current;
    setSalvando(true);
    setErro("");
    try {
      const { error } = await sb().rpc(funcao, dados);
      if (!error) return true;
      setErro(error.message);
      return false;
    } finally {
      setSalvando(false);
    }
  }

  async function quebrar(registro: Registro) {
    if (salvando) return;
    await gravar("quebrar_campeao_selado", { p_jogador: registro.jogador, p_campeao: registro.campeao });
  }

  async function salvar(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    if (salvando) return;
    const dados = new FormData(evento.currentTarget);
    const jogador = String(dados.get("jogador"));
    const campeao = String(dados.get("campeao")).trim();
    const motivo = String(dados.get("motivo")).trim();
    const chaves = Number(dados.get("chaves"));
    if (!nanicos.some((n) => n.id === jogador) || !CHAMPS.includes(campeao) || !motivo || !Number.isSafeInteger(chaves) || chaves < 1 || chaves > 2147483647) {
      setErro("Preencha todos os campos e informe pelo menos uma chave.");
      return;
    }
    if (!await gravar("registrar_campeao_selado", { p_jogador: jogador, p_campeao: campeao, p_motivo: motivo, p_chaves: chaves })) return;
    setFiltro(jogador);
    setRegistrando(false);
    setCampeaoEscolhido("");
    setErro("");
  }
  return (
    <dialog ref={dialogRef} onToggle={(evento) => { setAberto(evento.currentTarget.open); setPronto(false); }} className={styles.bau} aria-labelledby="campeoes-selados-titulo">
      <header className={styles.cabecalho}>
        <div>
          <small>BAÚ DO SÍTIO</small>
          <h2 id="campeoes-selados-titulo">Campeões Selados</h2>
        </div>
        <form method="dialog"><button type="submit" aria-label="Fechar baú">×</button></form>
      </header>
      <label className={styles.filtro}>
        Filtrar por Nanico
        <select value={selecionado?.id ?? ""} onChange={(evento) => setFiltro(evento.target.value)}>
          <option value="">Todos os Nanicos</option>
          {nanicos.map((nanico) => <option key={nanico.id} value={nanico.id}>{nanico.name}</option>)}
        </select>
      </label>
      <div className={styles.jogador}>
        <button className={styles.acao} type="button" disabled={!nanicos.length || !pronto || salvando} onClick={() => { setRegistrando(!registrando); setErro(""); }}>
          {registrando ? "Cancelar" : "Registrar selo"}
        </button>
        {registrando && (
          <form className={`${styles.filtro} ${styles.formulario}`} onSubmit={salvar}>
            <h3>Novo selo</h3>
            <label>Nanico <select name="jogador" defaultValue={selecionado?.id} required>
              {nanicos.map((n) => <option key={n.id} value={n.id}>{n.name}</option>)}
            </select></label>
            <label>Campeão <select name="campeao" value={campeaoEscolhido} onChange={(evento) => setCampeaoEscolhido(evento.target.value)} required>
              <option value="">Selecione um campeão</option>
              {CHAMPS.map((nome) => <option key={nome}>{nome}</option>)}
            </select></label>
            {campeaoEscolhido && <Retrato campeao={campeaoEscolhido} />}
            <label>Motivo do selo <textarea name="motivo" maxLength={300} required /></label>
            <label>Chaves para abrir <input name="chaves" type="number" min={1} max={2147483647} step={1} required /></label>
            <small>Os selos são compartilhados entre os Nanicos.</small>

            <button className={styles.acao} type="submit" disabled={salvando || !pronto}>Salvar selo</button>
          </form>
        )}
      </div>
      {aberto && !pronto && <p className={styles.jogador} role="status">{falhaLeitura ? "Não foi possível carregar os selos. Tentando novamente…" : "Aguardando a lista compartilhada de selos…"}</p>}
      {erro && <p className={styles.jogador} role="alert">{erro}</p>}
      {pronto && (selecionado ? [selecionado] : nanicos).map((nanico) => (
        <section key={nanico.id} className={styles.jogador} aria-label={nanico.name}>
          <h3 className={styles.perfil}><Avatar f={nanico} size="xs" />{nanico.name}</h3>
          {registros.some((r) => r.jogador === nanico.id)
            ? <div className={styles.cartas}>{registros.filter((r) => r.jogador === nanico.id).map((r) => (
              <article key={r.campeao} className={styles.carta}>
                <Retrato campeao={r.campeao} />
                <div className={styles.detalhes}>
                  <h4>{r.campeao}</h4>
                  <p>{r.motivo}</p>
                  <span className={styles.chaves}>⚿ {r.chaves} {r.chaves === 1 ? "chave" : "chaves"}</span>
                  <button className={styles.acao} type="button" disabled={salvando || !pronto} aria-label={`Quebrar um selo de ${r.campeao} de ${nanico.name}`} onClick={() => quebrar(r)}>
                    Quebrar selo
                  </button>
                </div>
              </article>
            ))}</div>
            : <p>Nenhum campeão selado cadastrado.</p>}
        </section>
      ))}
    </dialog>
  );
}
