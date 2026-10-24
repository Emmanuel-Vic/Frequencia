import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

const formVazio = {
  nome: '',
  data_nascimento: '',
  responsavel: '',
  telefone: '',
  turma_id: '',
}

export default function Catequizandos() {
  const [turmas, setTurmas] = useState([])
  const [lista, setLista] = useState([])
  const [form, setForm] = useState(formVazio)
  const [carregando, setCarregando] = useState(true)
  const [salvando, setSalvando] = useState(false)
  const [mensagem, setMensagem] = useState(null) // { tipo: 'ok' | 'erro', texto }

  async function carregar() {
    const [resTurmas, resLista] = await Promise.all([
      supabase.from('turmas').select('id, nome').order('nome'),
      supabase
        .from('catequizandos')
        .select('id, nome, responsavel, telefone, turmas(nome)')
        .eq('ativo', true)
        .order('nome'),
    ])

    if (resTurmas.error || resLista.error) {
      console.error(resTurmas.error ?? resLista.error)
      setMensagem({ tipo: 'erro', texto: 'Não foi possível carregar os dados.' })
    }

    setTurmas(resTurmas.data ?? [])
    setLista(resLista.data ?? [])
    setCarregando(false)
  }

  useEffect(() => {
    carregar()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function atualizar(campo, valor) {
    setForm((f) => ({ ...f, [campo]: valor }))
  }

  async function adicionar(e) {
    e.preventDefault()
    if (!form.nome.trim() || !form.turma_id) {
      setMensagem({ tipo: 'erro', texto: 'Informe o nome e a turma.' })
      return
    }

    setSalvando(true)
    setMensagem(null)

    const { error } = await supabase.from('catequizandos').insert({
      nome: form.nome.trim(),
      data_nascimento: form.data_nascimento || null,
      responsavel: form.responsavel.trim() || null,
      telefone: form.telefone.trim() || null,
      turma_id: form.turma_id,
    })

    setSalvando(false)

    if (error) {
      console.error(error)
      setMensagem({ tipo: 'erro', texto: 'Erro ao cadastrar. Tente de novo.' })
      return
    }

    setForm({ ...formVazio, turma_id: form.turma_id }) // mantém a turma para cadastrar vários seguidos
    setMensagem({ tipo: 'ok', texto: 'Catequizando cadastrado.' })
    carregar()
  }

  async function desativar(id) {
    if (!confirm('Remover este catequizando da lista?')) return

    const { error } = await supabase.from('catequizandos').update({ ativo: false }).eq('id', id)

    if (error) {
      console.error(error)
      setMensagem({ tipo: 'erro', texto: 'Erro ao remover.' })
      return
    }

    setMensagem({ tipo: 'ok', texto: 'Catequizando removido da lista.' })
    carregar()
  }

  if (carregando) return <p>Carregando...</p>

  return (
    <section>
      <h1>Catequizandos</h1>

      <form className="cartao form-grid" onSubmit={adicionar}>
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
            {turmas.map((t) => (
              <option key={t.id} value={t.id}>
                {t.nome}
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

        <button type="submit" className="largura-total" disabled={salvando}>
          {salvando ? 'Salvando...' : 'Adicionar catequizando'}
        </button>
      </form>

      {mensagem && (
        <p className={`msg msg-${mensagem.tipo}`} role="status">
          {mensagem.texto}
        </p>
      )}

      <h2>Cadastrados ({lista.length})</h2>

      {lista.length === 0 ? (
        <p className="vazio">Nenhum catequizando cadastrado ainda.</p>
      ) : (
        <ul className="lista">
          {lista.map((c) => (
            <li key={c.id} className="lista-item">
              <div>
                <span className="lista-nome">{c.nome}</span>
                <small>{c.turmas?.nome ?? 'Sem turma'}</small>
              </div>
              <button
                type="button"
                className="botao-perigo botao-pequeno"
                onClick={() => desativar(c.id)}
                aria-label={`Remover ${c.nome}`}
              >
                Remover
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}