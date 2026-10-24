import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import './Chamada.css'

const CICLO = { presente: 'falta', falta: 'justificada', justificada: 'presente' }

const ROTULO = {
  presente: 'Presente',
  falta: 'Falta',
  justificada: 'Justificada',
}

function hoje() {
  // Data local no formato AAAA-MM-DD (toISOString usaria UTC e pode errar o dia)
  const d = new Date()
  const mes = String(d.getMonth() + 1).padStart(2, '0')
  const dia = String(d.getDate()).padStart(2, '0')
  return `${d.getFullYear()}-${mes}-${dia}`
}

function formatarData(iso) {
  return iso.split('-').reverse().join('/')
}

export default function Chamada() {
  const [turmas, setTurmas] = useState([])
  const [turmaId, setTurmaId] = useState('')
  const [data, setData] = useState(hoje())
  const [tema, setTema] = useState('')
  const [alunos, setAlunos] = useState([])
  const [status, setStatus] = useState({}) // { idDoAluno: 'presente' | 'falta' | 'justificada' }
  const [encontroId, setEncontroId] = useState(null) // id do encontro salvo (se houver)
  const [alterado, setAlterado] = useState(false) // há marcações ainda não salvas?
  const [historico, setHistorico] = useState([])
  const [versao, setVersao] = useState(0) // aumenta quando o histórico precisa recarregar
  const [carregando, setCarregando] = useState(true)
  const [salvando, setSalvando] = useState(false)
  const [excluindo, setExcluindo] = useState(false)
  const [mensagem, setMensagem] = useState(null) // { tipo: 'ok' | 'erro', texto }

  const jaSalva = encontroId !== null

  // 1) Carrega as turmas ativas uma vez
  useEffect(() => {
    async function carregarTurmas() {
      const { data: lista, error } = await supabase
        .from('turmas')
        .select('id, nome')
        .eq('ativa', true)
        .order('nome')

      if (error) {
        console.error(error)
        setMensagem({
          tipo: 'erro',
          texto:
            error.code === '42703'
              ? 'Falta a coluna "ativa" na tabela turmas. Rode o SQL indicado no Supabase.'
              : 'Não foi possível carregar as turmas.',
        })
        setCarregando(false)
        return
      }

      setTurmas(lista)
      if (lista.length > 0) setTurmaId(lista[0].id)
      else setCarregando(false)
    }
    carregarTurmas()
  }, [])

  // 2) Sempre que mudar a turma ou a data, carrega os alunos e a chamada já salva (se houver)
  useEffect(() => {
    if (!turmaId) return
    let cancelado = false

    async function carregarChamada() {
      setCarregando(true)
      setMensagem(null)

      const [resAlunos, resEncontro] = await Promise.all([
        supabase
          .from('catequizandos')
          .select('id, nome')
          .eq('turma_id', turmaId)
          .eq('ativo', true)
          .order('nome'),
        supabase
          .from('encontros')
          .select('id, tema')
          .eq('turma_id', turmaId)
          .eq('data', data)
          .maybeSingle(),
      ])

      if (cancelado) return

      if (resAlunos.error || resEncontro.error) {
        console.error(resAlunos.error ?? resEncontro.error)
        setMensagem({ tipo: 'erro', texto: 'Não foi possível carregar a chamada.' })
        setCarregando(false)
        return
      }

      const lista = resAlunos.data
      const encontro = resEncontro.data

      // Presenças já gravadas para este encontro
      let salvos = {}
      if (encontro) {
        const { data: presencas, error } = await supabase
          .from('presencas')
          .select('catequizando_id, status')
          .eq('encontro_id', encontro.id)

        if (cancelado) return
        if (error) console.error(error)
        else salvos = Object.fromEntries(presencas.map((p) => [p.catequizando_id, p.status]))
      }

      // Quem não tem registro começa como "presente"
      setAlunos(lista)
      setStatus(Object.fromEntries(lista.map((a) => [a.id, salvos[a.id] ?? 'presente'])))
      setTema(encontro?.tema ?? '')
      setEncontroId(encontro?.id ?? null)
      setAlterado(false)
      setCarregando(false)
    }

    carregarChamada()
    return () => {
      cancelado = true
    }
  }, [turmaId, data])

  // 3) Histórico: as últimas chamadas salvas da turma
  useEffect(() => {
    if (!turmaId) return
    let cancelado = false

    async function carregarHistorico() {
      const { data: lista, error } = await supabase
        .from('encontros')
        .select('id, data, tema, presencas(status)')
        .eq('turma_id', turmaId)
        .order('data', { ascending: false })
        .limit(10)

      if (cancelado) return
      if (error) {
        console.error(error)
        return
      }

      setHistorico(
        lista.map((e) => ({
          id: e.id,
          data: e.data,
          tema: e.tema,
          presentes: e.presencas.filter((p) => p.status === 'presente').length,
          faltas: e.presencas.filter((p) => p.status === 'falta').length,
          justificadas: e.presencas.filter((p) => p.status === 'justificada').length,
        }))
      )
    }

    carregarHistorico()
    return () => {
      cancelado = true
    }
  }, [turmaId, versao])

  // Evita perder marcações por engano ao trocar de turma ou de data
  function podeDescartar() {
    return !alterado || window.confirm('Há marcações que ainda não foram salvas. Descartar e continuar?')
  }

  function trocarTurma(id) {
    if (id === turmaId || !podeDescartar()) return
    setTurmaId(id)
  }

  function trocarData(novaData) {
    if (!novaData || novaData === data || !podeDescartar()) return
    setData(novaData)
  }

  function alternar(id) {
    setMensagem(null)
    setAlterado(true)
    setStatus((s) => ({ ...s, [id]: CICLO[s[id]] }))
  }

  function marcarTodos(valor) {
    setMensagem(null)
    setAlterado(true)
    setStatus(Object.fromEntries(alunos.map((a) => [a.id, valor])))
  }

  async function salvar() {
    if (!turmaId || alunos.length === 0) return

    setSalvando(true)
    setMensagem(null)

    // 1) cria (ou reaproveita) o encontro da turma nesta data
    const { data: encontro, error: erroEncontro } = await supabase
      .from('encontros')
      .upsert(
        { turma_id: turmaId, data, tema: tema.trim() || null },
        { onConflict: 'turma_id,data' }
      )
      .select()
      .single()

    if (erroEncontro) {
      console.error(erroEncontro)
      setMensagem({ tipo: 'erro', texto: 'Erro ao salvar o encontro. Tente de novo.' })
      setSalvando(false)
      return
    }

    // 2) grava as presenças (upsert evita duplicar ao salvar de novo)
    const linhas = alunos.map((a) => ({
      encontro_id: encontro.id,
      catequizando_id: a.id,
      status: status[a.id],
    }))

    const { error: erroPresencas } = await supabase
      .from('presencas')
      .upsert(linhas, { onConflict: 'encontro_id,catequizando_id' })

    setSalvando(false)

    if (erroPresencas) {
      console.error(erroPresencas)
      setMensagem({ tipo: 'erro', texto: 'Erro ao salvar as presenças. Tente de novo.' })
      return
    }

    setEncontroId(encontro.id)
    setAlterado(false)
    setVersao((v) => v + 1)
    setMensagem({ tipo: 'ok', texto: 'Chamada salva.' })
  }

  async function excluir() {
    if (!encontroId) return

    const ok = window.confirm(
      `Excluir a chamada de ${formatarData(data)}? As marcações deste dia serão apagadas.`
    )
    if (!ok) return

    setExcluindo(true)
    setMensagem(null)

    // As presenças são apagadas junto (on delete cascade)
    const { error } = await supabase.from('encontros').delete().eq('id', encontroId)

    setExcluindo(false)

    if (error) {
      console.error(error)
      setMensagem({ tipo: 'erro', texto: 'Erro ao excluir a chamada. Tente de novo.' })
      return
    }

    setStatus(Object.fromEntries(alunos.map((a) => [a.id, 'presente'])))
    setTema('')
    setEncontroId(null)
    setAlterado(false)
    setVersao((v) => v + 1)
    setMensagem({ tipo: 'ok', texto: 'Chamada excluída.' })
  }

  const total = alunos.length
  const presentes = alunos.filter((a) => status[a.id] === 'presente').length
  const faltas = alunos.filter((a) => status[a.id] === 'falta').length
  const justificadas = alunos.filter((a) => status[a.id] === 'justificada').length
  const ocupado = salvando || excluindo

  if (!carregando && turmas.length === 0) {
    return (
      <section className="chamada">
        <h1>Chamada</h1>
        {mensagem ? (
          <p className="chamada-msg chamada-msg-erro">{mensagem.texto}</p>
        ) : (
          <p>
            Nenhuma turma ativa. Crie uma na tela <Link to="/turmas">Turmas</Link>.
          </p>
        )}
      </section>
    )
  }

  return (
    <section className="chamada">
      <h1>Chamada</h1>

      <div className="chamada-filtros">
        <label>
          Turma
          <select value={turmaId} onChange={(e) => trocarTurma(e.target.value)}>
            {turmas.map((t) => (
              <option key={t.id} value={t.id}>
                {t.nome}
              </option>
            ))}
          </select>
        </label>

        <label>
          Data do encontro
          <input type="date" value={data} onChange={(e) => trocarData(e.target.value)} required />
        </label>

        <label>
          Tema (opcional)
          <input
            type="text"
            value={tema}
            placeholder="Ex.: Os sacramentos"
            onChange={(e) => {
              setTema(e.target.value)
              setAlterado(true)
            }}
          />
        </label>
      </div>

      {jaSalva && !carregando && (
        <p className="chamada-aviso">Já existe uma chamada salva neste dia. Ao salvar, ela será atualizada.</p>
      )}

      {carregando ? (
        <p>Carregando...</p>
      ) : total === 0 ? (
        <p>
          Esta turma ainda não tem catequizandos ativos. Cadastre na tela{' '}
          <Link to="/catequizandos">Catequizandos</Link>.
        </p>
      ) : (
        <>
          <p className="chamada-resumo">
            {presentes} presentes · {faltas} faltas · {justificadas} justificadas (de {total})
          </p>

          {alterado && <p className="chamada-aviso">Há marcações que ainda não foram salvas.</p>}

          <div className="chamada-atalhos">
            <button type="button" onClick={() => marcarTodos('presente')}>
              Todos presentes
            </button>
            <button type="button" onClick={() => marcarTodos('falta')}>
              Todos com falta
            </button>
          </div>

          <ul className="chamada-lista">
            {alunos.map((a) => (
              <li key={a.id}>
                <button
                  type="button"
                  className={`aluno aluno-${status[a.id]}`}
                  onClick={() => alternar(a.id)}
                >
                  <span className="aluno-nome">{a.nome}</span>
                  <span className="aluno-status">{ROTULO[status[a.id]]}</span>
                </button>
              </li>
            ))}
          </ul>

          <button type="button" className="chamada-salvar" onClick={salvar} disabled={ocupado}>
            {salvando ? 'Salvando...' : jaSalva ? 'Atualizar chamada' : 'Salvar chamada'}
          </button>

          {jaSalva && (
            <button
              type="button"
              className="botao-perigo chamada-excluir"
              onClick={excluir}
              disabled={ocupado}
            >
              {excluindo ? 'Excluindo...' : 'Excluir esta chamada'}
            </button>
          )}
        </>
      )}

      {mensagem && (
        <p className={`chamada-msg chamada-msg-${mensagem.tipo}`} role="status">
          {mensagem.texto}
        </p>
      )}

      {historico.length > 0 && (
        <div className="historico">
          <h2>Chamadas salvas</h2>
          <ul className="historico-lista">
            {historico.map((h) => (
              <li key={h.id}>
                <button
                  type="button"
                  className={h.data === data ? 'historico-item atual' : 'historico-item'}
                  onClick={() => trocarData(h.data)}
                >
                  <span className="historico-data">
                    {formatarData(h.data)}
                    {h.tema ? ` · ${h.tema}` : ''}
                  </span>
                  <span className="historico-detalhe">
                    {h.presentes} presentes · {h.faltas} faltas · {h.justificadas} justificadas
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  )
}