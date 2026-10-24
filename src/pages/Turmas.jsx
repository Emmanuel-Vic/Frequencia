import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

const DIAS = [
  'Domingo',
  'Segunda-feira',
  'Terça-feira',
  'Quarta-feira',
  'Quinta-feira',
  'Sexta-feira',
  'Sábado',
]

const formVazio = { nome: '', etapa: '', dia_semana: '' }

export default function Turmas() {
  const [turmas, setTurmas] = useState([])
  const [form, setForm] = useState(formVazio)
  const [editandoId, setEditandoId] = useState(null)
  const [mostrarArquivadas, setMostrarArquivadas] = useState(false)
  const [carregando, setCarregando] = useState(true)
  const [salvando, setSalvando] = useState(false)
  const [mensagem, setMensagem] = useState(null) // { tipo: 'ok' | 'erro', texto }

  async function carregar() {
    const [resTurmas, resAlunos] = await Promise.all([
      supabase.from('turmas').select('id, nome, etapa, dia_semana, ativa').order('nome'),
      supabase.from('catequizandos').select('turma_id').eq('ativo', true),
    ])

    if (resTurmas.error || resAlunos.error) {
      const erro = resTurmas.error ?? resAlunos.error
      console.error(erro)
      setMensagem({
        tipo: 'erro',
        texto:
          erro.code === '42703'
            ? 'Falta a coluna "ativa" na tabela turmas. Rode o SQL indicado no Supabase.'
            : 'Não foi possível carregar as turmas.',
      })
      setCarregando(false)
      return
    }

    // Quantos catequizandos ativos cada turma tem
    const contagem = {}
    for (const a of resAlunos.data) {
      contagem[a.turma_id] = (contagem[a.turma_id] ?? 0) + 1
    }

    setTurmas(resTurmas.data.map((t) => ({ ...t, total: contagem[t.id] ?? 0 })))
    setCarregando(false)
  }

  useEffect(() => {
    carregar()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function atualizar(campo, valor) {
    setForm((f) => ({ ...f, [campo]: valor }))
  }

  function editar(turma) {
    setEditandoId(turma.id)
    setForm({
      nome: turma.nome,
      etapa: turma.etapa ?? '',
      dia_semana: turma.dia_semana ?? '',
    })
    setMensagem(null)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  function cancelarEdicao() {
    setEditandoId(null)
    setForm(formVazio)
  }

  async function salvar(e) {
    e.preventDefault()
    const nome = form.nome.trim()

    if (!nome) {
      setMensagem({ tipo: 'erro', texto: 'Informe o nome da turma.' })
      return
    }

    const duplicada = turmas.some(
      (t) => t.id !== editandoId && t.nome.trim().toLowerCase() === nome.toLowerCase()
    )
    if (duplicada) {
      setMensagem({ tipo: 'erro', texto: 'Já existe uma turma com esse nome.' })
      return
    }

    setSalvando(true)
    setMensagem(null)

    const dados = {
      nome,
      etapa: form.etapa.trim() || null,
      dia_semana: form.dia_semana || null,
    }

    const { error } = editandoId
      ? await supabase.from('turmas').update(dados).eq('id', editandoId)
      : await supabase.from('turmas').insert(dados)

    setSalvando(false)

    if (error) {
      console.error(error)
      setMensagem({ tipo: 'erro', texto: 'Erro ao salvar a turma. Tente de novo.' })
      return
    }

    setMensagem({ tipo: 'ok', texto: editandoId ? 'Turma atualizada.' : 'Turma criada.' })
    cancelarEdicao()
    carregar()
  }

  async function alternarArquivo(turma) {
    if (turma.ativa) {
      const aviso =
        turma.total > 0
          ? ` Os ${turma.total} catequizandos continuam cadastrados.`
          : ''
      const ok = confirm(
        `Arquivar "${turma.nome}"? Ela some das telas de chamada e relatório, mas o histórico fica guardado.${aviso}`
      )
      if (!ok) return
    }

    const { error } = await supabase
      .from('turmas')
      .update({ ativa: !turma.ativa })
      .eq('id', turma.id)

    if (error) {
      console.error(error)
      setMensagem({ tipo: 'erro', texto: 'Erro ao atualizar a turma.' })
      return
    }

    setMensagem({
      tipo: 'ok',
      texto: turma.ativa ? 'Turma arquivada.' : 'Turma reativada.',
    })
    carregar()
  }

  function itemDaLista(turma) {
    const detalhes = [turma.etapa, turma.dia_semana].filter(Boolean).join(' · ')
    const alunos = `${turma.total} ${turma.total === 1 ? 'catequizando' : 'catequizandos'}`

    return (
      <li key={turma.id} className={turma.ativa ? 'lista-item' : 'lista-item inativo'}>
        <div>
          <span className="lista-nome">{turma.nome}</span>
          <small>{detalhes ? `${detalhes} · ${alunos}` : alunos}</small>
        </div>
        <div className="acoes">
          <button type="button" className="botao-pequeno" onClick={() => editar(turma)}>
            Editar
          </button>
          <button
            type="button"
            className={turma.ativa ? 'botao-perigo botao-pequeno' : 'botao-pequeno'}
            onClick={() => alternarArquivo(turma)}
          >
            {turma.ativa ? 'Arquivar' : 'Reativar'}
          </button>
        </div>
      </li>
    )
  }

  if (carregando) return <p>Carregando...</p>

  const ativas = turmas.filter((t) => t.ativa)
  const arquivadas = turmas.filter((t) => !t.ativa)

  return (
    <section>
      <h1>Turmas</h1>

      <form className="cartao form-grid" onSubmit={salvar}>
        <strong className="cartao-titulo largura-total">
          {editandoId ? 'Editar turma' : 'Nova turma'}
        </strong>

        <label className="largura-total">
          Nome da turma
          <input
            value={form.nome}
            placeholder="Ex.: Crisma 1"
            onChange={(e) => atualizar('nome', e.target.value)}
            required
          />
        </label>

        <label>
          Etapa (opcional)
          <input
            value={form.etapa}
            placeholder="Ex.: Eucaristia"
            onChange={(e) => atualizar('etapa', e.target.value)}
          />
        </label>

        <label>
          Dia do encontro (opcional)
          <select value={form.dia_semana} onChange={(e) => atualizar('dia_semana', e.target.value)}>
            <option value="">Não informado</option>
            {DIAS.map((d) => (
              <option key={d} value={d}>
                {d}
              </option>
            ))}
          </select>
        </label>

        <div className="acoes largura-total">
          <button type="submit" disabled={salvando}>
            {salvando ? 'Salvando...' : editandoId ? 'Salvar alterações' : 'Criar turma'}
          </button>
          {editandoId && (
            <button type="button" onClick={cancelarEdicao}>
              Cancelar
            </button>
          )}
        </div>
      </form>

      {mensagem && (
        <p className={`msg msg-${mensagem.tipo}`} role="status">
          {mensagem.texto}
        </p>
      )}

      <h2>Turmas ativas ({ativas.length})</h2>

      {ativas.length === 0 ? (
        <p className="vazio">Nenhuma turma ativa. Crie a primeira acima.</p>
      ) : (
        <ul className="lista">{ativas.map(itemDaLista)}</ul>
      )}

      {arquivadas.length > 0 && (
        <>
          <label className="check-linha" style={{ marginTop: '1.5rem' }}>
            <input
              type="checkbox"
              checked={mostrarArquivadas}
              onChange={(e) => setMostrarArquivadas(e.target.checked)}
            />
            Mostrar turmas arquivadas ({arquivadas.length})
          </label>

          {mostrarArquivadas && <ul className="lista">{arquivadas.map(itemDaLista)}</ul>}
        </>
      )}
    </section>
  )
}