import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/auth-context'

const formVazio = {
  nome: '',
  email: '',
  senha: '',
  papel: 'catequista',
  ativo: true,
  turmaIds: [],
}

// Criar conta e redefinir senha passam pela função segura do Supabase (Edge Function)
async function chamarFuncao(corpo) {
  const { data, error } = await supabase.functions.invoke('gerenciar-equipe', { body: corpo })

  if (error) {
    let mensagem = 'Não foi possível concluir. Verifique se a função gerenciar-equipe foi publicada.'
    try {
      const resposta = await error.context.json()
      if (resposta?.erro) mensagem = resposta.erro
    } catch {
      // mantém a mensagem padrão
    }
    throw new Error(mensagem)
  }

  return data
}

export default function Equipe() {
  const { usuario } = useAuth()
  const [pessoas, setPessoas] = useState([])
  const [turmas, setTurmas] = useState([])
  const [acessos, setAcessos] = useState([]) // [{ perfil_id, turma_id }]
  const [form, setForm] = useState(formVazio)
  const [editandoId, setEditandoId] = useState(null)
  const [carregando, setCarregando] = useState(true)
  const [salvando, setSalvando] = useState(false)
  const [mensagem, setMensagem] = useState(null) // { tipo: 'ok' | 'erro', texto }

  const ehEu = editandoId !== null && editandoId === usuario?.id

  async function carregar() {
    const [resPessoas, resTurmas, resAcessos] = await Promise.all([
      supabase.from('perfis').select('id, nome, email, papel, ativo').order('nome'),
      supabase.from('turmas').select('id, nome, ativa').order('nome'),
      supabase.from('turmas_catequistas').select('perfil_id, turma_id'),
    ])

    const falha = resPessoas.error ?? resTurmas.error ?? resAcessos.error
    if (falha) {
      console.error(falha)
      setMensagem({
        tipo: 'erro',
        texto:
          falha.code === '42703'
            ? 'Falta a coluna "email" em perfis. Rode o arquivo 03-equipe.sql no Supabase.'
            : 'Não foi possível carregar a equipe.',
      })
    }

    setPessoas(resPessoas.data ?? [])
    setTurmas(resTurmas.data ?? [])
    setAcessos(resAcessos.data ?? [])
    setCarregando(false)
  }

  useEffect(() => {
    carregar()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function atualizar(campo, valor) {
    setForm((f) => ({ ...f, [campo]: valor }))
  }

  function alternarTurma(id) {
    setForm((f) => ({
      ...f,
      turmaIds: f.turmaIds.includes(id) ? f.turmaIds.filter((t) => t !== id) : [...f.turmaIds, id],
    }))
  }

  function editar(pessoa) {
    setEditandoId(pessoa.id)
    setForm({
      nome: pessoa.nome,
      email: pessoa.email ?? '',
      senha: '',
      papel: pessoa.papel,
      ativo: pessoa.ativo,
      turmaIds: acessos.filter((a) => a.perfil_id === pessoa.id).map((a) => a.turma_id),
    })
    setMensagem(null)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  function cancelar() {
    setEditandoId(null)
    setForm(formVazio)
  }

  async function atualizarPessoa(nome) {
    // Quem edita a si mesmo não pode mudar o próprio papel nem se bloquear (evita ficar sem acesso)
    const dados = ehEu ? { nome } : { nome, papel: form.papel, ativo: form.ativo }

    const { error: erroPerfil } = await supabase.from('perfis').update(dados).eq('id', editandoId)
    if (erroPerfil) {
      console.error(erroPerfil)
      throw new Error('Não foi possível salvar os dados da pessoa.')
    }

    if (form.papel === 'catequista') {
      const atuais = acessos.filter((a) => a.perfil_id === editandoId).map((a) => a.turma_id)
      const adicionar = form.turmaIds.filter((id) => !atuais.includes(id))
      const remover = atuais.filter((id) => !form.turmaIds.includes(id))

      if (remover.length > 0) {
        const { error: erroRemover } = await supabase
          .from('turmas_catequistas')
          .delete()
          .eq('perfil_id', editandoId)
          .in('turma_id', remover)
        if (erroRemover) {
          console.error(erroRemover)
          throw new Error('Não foi possível atualizar as turmas.')
        }
      }

      if (adicionar.length > 0) {
        const { error: erroAdicionar } = await supabase
          .from('turmas_catequistas')
          .insert(adicionar.map((turma_id) => ({ perfil_id: editandoId, turma_id })))
        if (erroAdicionar) {
          console.error(erroAdicionar)
          throw new Error('Não foi possível atualizar as turmas.')
        }
      }
    }

    if (form.senha) {
      await chamarFuncao({ acao: 'redefinir_senha', usuarioId: editandoId, senha: form.senha })
    }
  }

  async function salvar(e) {
    e.preventDefault()
    const nome = form.nome.trim()

    if (nome.length < 2) {
      setMensagem({ tipo: 'erro', texto: 'Informe o nome da pessoa.' })
      return
    }
    if (!editandoId && (!form.email.trim() || form.senha.length < 8)) {
      setMensagem({ tipo: 'erro', texto: 'Informe o e-mail e uma senha com pelo menos 8 caracteres.' })
      return
    }
    if (editandoId && form.senha && form.senha.length < 8) {
      setMensagem({ tipo: 'erro', texto: 'A nova senha precisa ter pelo menos 8 caracteres.' })
      return
    }

    setSalvando(true)
    setMensagem(null)

    try {
      if (editandoId) {
        await atualizarPessoa(nome)
        setMensagem({ tipo: 'ok', texto: 'Dados atualizados.' })
      } else {
        await chamarFuncao({
          acao: 'criar',
          nome,
          email: form.email.trim(),
          senha: form.senha,
          papel: form.papel,
          turmaIds: form.papel === 'catequista' ? form.turmaIds : [],
        })
        setMensagem({
          tipo: 'ok',
          texto: `Conta criada. Passe o e-mail e a senha para ${nome}.`,
        })
      }

      cancelar()
      await carregar()
    } catch (erro) {
      console.error(erro)
      setMensagem({ tipo: 'erro', texto: erro.message })
    }

    setSalvando(false)
  }

  if (carregando) return <p>Carregando...</p>

  const nomeDaTurma = Object.fromEntries(turmas.map((t) => [t.id, t.nome]))
  // Aparecem as turmas ativas e, ao editar, as arquivadas que a pessoa já tinha
  const turmasParaMarcar = turmas.filter((t) => t.ativa || form.turmaIds.includes(t.id))

  return (
    <section>
      <h1>Equipe</h1>

      <form className="cartao form-grid" onSubmit={salvar}>
        <strong className="cartao-titulo largura-total">
          {editandoId ? 'Editar pessoa' : 'Nova pessoa'}
        </strong>

        <label className="largura-total">
          Nome
          <input value={form.nome} onChange={(e) => atualizar('nome', e.target.value)} required />
        </label>

        <label className="largura-total">
          E-mail (usado para entrar)
          <input
            type="email"
            autoComplete="off"
            value={form.email}
            disabled={Boolean(editandoId)}
            onChange={(e) => atualizar('email', e.target.value)}
            required={!editandoId}
          />
        </label>

        <label>
          {editandoId ? 'Nova senha (vazio mantém a atual)' : 'Senha provisória'}
          <input
            type="password"
            autoComplete="new-password"
            value={form.senha}
            onChange={(e) => atualizar('senha', e.target.value)}
            required={!editandoId}
          />
        </label>

        <label>
          Papel
          <select
            value={form.papel}
            disabled={ehEu}
            onChange={(e) => atualizar('papel', e.target.value)}
          >
            <option value="catequista">Catequista</option>
            <option value="coordenador">Coordenador</option>
          </select>
        </label>

        {editandoId && !ehEu && (
          <label className="check-linha largura-total">
            <input
              type="checkbox"
              checked={form.ativo}
              onChange={(e) => atualizar('ativo', e.target.checked)}
            />
            Acesso ativo (desmarque para bloquear a entrada)
          </label>
        )}

        {form.papel === 'catequista' ? (
          <fieldset className="largura-total">
            <legend>Turmas liberadas</legend>
            {turmasParaMarcar.length === 0 ? (
              <small>Nenhuma turma ativa. Crie uma na tela Turmas.</small>
            ) : (
              <div className="checks">
                {turmasParaMarcar.map((t) => (
                  <label key={t.id} className="check-linha">
                    <input
                      type="checkbox"
                      checked={form.turmaIds.includes(t.id)}
                      onChange={() => alternarTurma(t.id)}
                    />
                    {t.nome}
                    {t.ativa ? '' : ' (arquivada)'}
                  </label>
                ))}
              </div>
            )}
          </fieldset>
        ) : (
          <p className="largura-total">
            <small>Coordenadores enxergam todas as turmas, sem precisar liberar uma a uma.</small>
          </p>
        )}

        <div className="acoes largura-total">
          <button type="submit" disabled={salvando}>
            {salvando ? 'Salvando...' : editandoId ? 'Salvar alterações' : 'Criar conta'}
          </button>
          {editandoId && (
            <button type="button" onClick={cancelar}>
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

      <h2>Pessoas com acesso ({pessoas.length})</h2>

      <ul className="lista">
        {pessoas.map((p) => {
          const nomes = acessos
            .filter((a) => a.perfil_id === p.id)
            .map((a) => nomeDaTurma[a.turma_id])
            .filter(Boolean)
          const resumo =
            p.papel === 'coordenador'
              ? 'Todas as turmas'
              : nomes.length > 0
                ? nomes.join(', ')
                : 'Nenhuma turma liberada'

          return (
            <li key={p.id} className={p.ativo ? 'lista-item' : 'lista-item inativo'}>
              <div>
                <span className="lista-nome">
                  {p.nome}
                  {p.id === usuario?.id ? ' (você)' : ''}
                </span>
                <small>{[p.email, resumo].filter(Boolean).join(' · ')}</small>
              </div>
              <div className="acoes">
                <span className={p.papel === 'coordenador' ? 'etiqueta etiqueta-coord' : 'etiqueta'}>
                  {p.papel === 'coordenador' ? 'Coordenador' : 'Catequista'}
                </span>
                {!p.ativo && <span className="etiqueta">Bloqueado</span>}
                <button
                  type="button"
                  className="botao-pequeno"
                  onClick={() => editar(p)}
                  aria-label={`Editar ${p.nome}`}
                >
                  Editar
                </button>
              </div>
            </li>
          )
        })}
      </ul>
    </section>
  )
}