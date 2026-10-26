import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import ImportarLista from '../components/ImportarLista'

const formVazio = {
  nome: '',
  data_nascimento: '',
  responsavel: '',
  telefone: '',
  turma_id: '',
}

export default function Catequizandos() {
  const [turmas, setTurmas] = useState([])
  const [todos, setTodos] = useState([]) // ativos e removidos
  const [form, setForm] = useState(formVazio)
  const [editandoId, setEditandoId] = useState(null)
  const [filtroTurma, setFiltroTurma] = useState('')
  const [mostrarRemovidos, setMostrarRemovidos] = useState(false)
  const [carregando, setCarregando] = useState(true)
  const [salvando, setSalvando] = useState(false)
  const [mensagem, setMensagem] = useState(null) // { tipo: 'ok' | 'erro', texto }

  async function carregar() {
    const [resTurmas, resLista] = await Promise.all([
      supabase.from('turmas').select('id, nome, ativa').order('nome'),
      supabase
        .from('catequizandos')
        .select('id, nome, data_nascimento, responsavel, telefone, turma_id, ativo, turmas(nome)')
        .order('nome'),
    ])

    const falha = resTurmas.error ?? resLista.error
    if (falha) {
      console.error(falha)
      setMensagem({
        tipo: 'erro',
        texto:
          falha.code === '42703'
            ? 'Falta a coluna "ativa" na tabela turmas. Rode o SQL indicado no Supabase.'
            : 'Não foi possível carregar os dados.',
      })
    }

    const listaTurmas = resTurmas.data ?? []
    setTurmas(listaTurmas)
    setTodos(resLista.data ?? [])

    // Se existe só uma turma ativa, já deixa selecionada no formulário
    const ativas = listaTurmas.filter((t) => t.ativa)
    setForm((f) => (f.turma_id || ativas.length !== 1 ? f : { ...f, turma_id: ativas[0].id }))

    setCarregando(false)
  }

  useEffect(() => {
    carregar()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function atualizar(campo, valor) {
    setForm((f) => ({ ...f, [campo]: valor }))
  }

  function editar(c) {
    setEditandoId(c.id)
    setForm({
      nome: c.nome,
      data_nascimento: c.data_nascimento ?? '',
      responsavel: c.responsavel ?? '',
      telefone: c.telefone ?? '',
      turma_id: c.turma_id ?? '',
    })
    setMensagem(null)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  function cancelarEdicao() {
    setEditandoId(null)
    setForm({ ...formVazio, turma_id: form.turma_id })
  }

  async function salvar(e) {
    e.preventDefault()
    const nome = form.nome.trim()

    if (!nome || !form.turma_id) {
      setMensagem({ tipo: 'erro', texto: 'Informe o nome e a turma.' })
      return
    }

    // Aviso (não bloqueia, porque pode haver dois alunos com o mesmo nome)
    const repetido = todos.some(
      (c) =>
        c.id !== editandoId &&
        c.ativo &&
        c.turma_id === form.turma_id &&
        c.nome.trim().toLowerCase() === nome.toLowerCase()
    )
    if (repetido && !confirm('Já existe um catequizando com esse nome nesta turma. Salvar mesmo assim?')) {
      return
    }

    setSalvando(true)
    setMensagem(null)

    const dados = {
      nome,
      data_nascimento: form.data_nascimento || null,
      responsavel: form.responsavel.trim() || null,
      telefone: form.telefone.trim() || null,
      turma_id: form.turma_id,
    }

    const { error } = editandoId
      ? await supabase.from('catequizandos').update(dados).eq('id', editandoId)
      : await supabase.from('catequizandos').insert(dados)

    setSalvando(false)

    if (error) {
      console.error(error)
      setMensagem({ tipo: 'erro', texto: 'Erro ao salvar. Tente de novo.' })
      return
    }

    setMensagem({
      tipo: 'ok',
      texto: editandoId ? 'Dados atualizados.' : 'Catequizando cadastrado.',
    })
    setEditandoId(null)
    setForm({ ...formVazio, turma_id: form.turma_id }) // mantém a turma para cadastrar vários seguidos
    carregar()
  }

  async function mudarSituacao(c, ativo) {
    if (!ativo && !confirm(`Remover ${c.nome} da lista? O histórico de presenças fica guardado.`)) {
      return
    }

    const { error } = await supabase.from('catequizandos').update({ ativo }).eq('id', c.id)

    if (error) {
      console.error(error)
      setMensagem({ tipo: 'erro', texto: 'Erro ao atualizar o catequizando.' })
      return
    }

    if (editandoId === c.id) cancelarEdicao()
    setMensagem({ tipo: 'ok', texto: ativo ? 'Catequizando reativado.' : 'Catequizando removido da lista.' })
    carregar()
  }

  if (carregando) return <p>Carregando...</p>

  const removidos = todos.filter((c) => !c.ativo).length
  const visiveis = todos.filter(
    (c) => c.ativo !== mostrarRemovidos && (!filtroTurma || c.turma_id === filtroTurma)
  )
  // Na lista do formulário aparecem as turmas ativas e, ao editar, a turma atual do aluno
  const opcoesTurma = turmas.filter((t) => t.ativa || t.id === form.turma_id)

  return (
    <section>
      <h1>Catequizandos</h1>

      <form className="cartao form-grid" onSubmit={salvar}>
        <strong className="cartao-titulo largura-total">
          {editandoId ? 'Editar catequizando' : 'Novo catequizando'}
        </strong>

        <label className="largura-total">
          Nome completo
          <input
            value={form.nome}
            onChange={(e) => atualizar('nome', e.target.value)}
            required
          />
        </label>

        <label>
          Turma
          <select
            value={form.turma_id}
            onChange={(e) => atualizar('turma_id', e.target.value)}
            required
          >
            <option value="">Selecione a turma</option>
            {opcoesTurma.map((t) => (
              <option key={t.id} value={t.id}>
                {t.nome}
                {t.ativa ? '' : ' (arquivada)'}
              </option>
            ))}
          </select>
        </label>

        <label>
          Data de nascimento
          <input
            type="date"
            value={form.data_nascimento}
            onChange={(e) => atualizar('data_nascimento', e.target.value)}
          />
        </label>

        <label>
          Responsável
          <input
            value={form.responsavel}
            onChange={(e) => atualizar('responsavel', e.target.value)}
          />
        </label>

        <label>
          Telefone
          <input
            type="tel"
            value={form.telefone}
            onChange={(e) => atualizar('telefone', e.target.value)}
          />
        </label>

        <div className="acoes largura-total">
          <button type="submit" disabled={salvando}>
            {salvando
              ? 'Salvando...'
              : editandoId
                ? 'Salvar alterações'
                : 'Adicionar catequizando'}
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

      <ImportarLista turmas={turmas} todos={todos} aoImportar={carregar} />

      <div className="filtro-linha">
        <label>
          Mostrar turma
          <select value={filtroTurma} onChange={(e) => setFiltroTurma(e.target.value)}>
            <option value="">Todas as turmas</option>
            {turmas.map((t) => (
              <option key={t.id} value={t.id}>
                {t.nome}
              </option>
            ))}
          </select>
        </label>

        {removidos > 0 && (
          <label className="check-linha">
            <input
              type="checkbox"
              checked={mostrarRemovidos}
              onChange={(e) => setMostrarRemovidos(e.target.checked)}
            />
            Ver removidos ({removidos})
          </label>
        )}
      </div>

      <h2>
        {mostrarRemovidos ? 'Removidos' : 'Cadastrados'} ({visiveis.length})
      </h2>

      {visiveis.length === 0 ? (
        <p className="vazio">
          {mostrarRemovidos
            ? 'Nenhum catequizando removido.'
            : 'Nenhum catequizando cadastrado ainda.'}
        </p>
      ) : (
        <ul className="lista">
          {visiveis.map((c) => {
            const detalhes = [c.turmas?.nome ?? 'Sem turma', c.responsavel, c.telefone]
              .filter(Boolean)
              .join(' · ')

            return (
              <li key={c.id} className={c.ativo ? 'lista-item' : 'lista-item inativo'}>
                <div>
                  <span className="lista-nome">{c.nome}</span>
                  <small>{detalhes}</small>
                </div>
                <div className="acoes">
                  {c.ativo ? (
                    <>
                      <button
                        type="button"
                        className="botao-pequeno"
                        onClick={() => editar(c)}
                        aria-label={`Editar ${c.nome}`}
                      >
                        Editar
                      </button>
                      <button
                        type="button"
                        className="botao-perigo botao-pequeno"
                        onClick={() => mudarSituacao(c, false)}
                        aria-label={`Remover ${c.nome}`}
                      >
                        Remover
                      </button>
                    </>
                  ) : (
                    <button
                      type="button"
                      className="botao-pequeno"
                      onClick={() => mudarSituacao(c, true)}
                      aria-label={`Reativar ${c.nome}`}
                    >
                      Reativar
                    </button>
                  )}
                </div>
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )
}