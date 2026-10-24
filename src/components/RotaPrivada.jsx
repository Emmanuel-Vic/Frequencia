import { Navigate, Outlet } from 'react-router-dom'
import { useAuth } from '../lib/auth-context'

// Protege um grupo de rotas: só entra quem está logado (e, se pedido, é coordenador)
export default function RotaPrivada({ somenteCoordenador = false }) {
  const { usuario, perfil, ehCoordenador, carregando, sair } = useAuth()

  if (carregando) {
    return (
      <main>
        <p>Carregando...</p>
      </main>
    )
  }

  if (!usuario) return <Navigate to="/login" replace />

  // Logou, mas a coordenação ainda não criou/ativou o perfil
  if (!perfil || !perfil.ativo) {
    return (
      <main className="login-pagina">
        <div className="cartao">
          <h1>Acesso não liberado</h1>
          <p>Sua conta ainda não tem permissão para usar o sistema. Fale com a coordenação.</p>
          <button type="button" onClick={sair}>
            Sair
          </button>
        </div>
      </main>
    )
  }

  if (somenteCoordenador && !ehCoordenador) return <Navigate to="/" replace />

  return <Outlet />
}