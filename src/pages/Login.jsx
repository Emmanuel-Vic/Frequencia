import { useState } from 'react'
import { Navigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/auth-context'
import CampoSenha from '../components/CampoSenha'

export default function Login() {
  const { usuario, carregando } = useAuth()
  const [email, setEmail] = useState('')
  const [senha, setSenha] = useState('')
  const [entrando, setEntrando] = useState(false)
  const [erro, setErro] = useState(null)

  // Já está logado: vai direto para a chamada
  if (!carregando && usuario) return <Navigate to="/" replace />

  async function entrar(e) {
    e.preventDefault()
    setEntrando(true)
    setErro(null)

    const { error } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password: senha,
    })

    if (error) {
      console.error(error)
      setErro('E-mail ou senha incorretos.')
      setEntrando(false)
    }
    // Em caso de sucesso, o AuthProvider percebe o login e esta tela redireciona sozinha
  }

  return (
    <main className="login-pagina">
      <h1>Frequência da Catequese</h1>

      <form className="cartao login-form" onSubmit={entrar}>
        <label>
          E-mail
          <input
            type="email"
            inputMode="email"
            autoComplete="username"
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
        </label>

        <CampoSenha
          rotulo="Senha"
          autoComplete="current-password"
          value={senha}
          onChange={(e) => setSenha(e.target.value)}
          required
        />

        <button type="submit" disabled={entrando}>
          {entrando ? 'Entrando...' : 'Entrar'}
        </button>
      </form>

      {erro && (
        <p className="msg msg-erro" role="alert">
          {erro}
        </p>
      )}

      <p>
        <small>Esqueceu a senha? Peça à coordenação para redefinir.</small>
      </p>
    </main>
  )
}