import { Routes, Route, NavLink, Outlet } from 'react-router-dom'
import { useAuth } from './lib/auth-context'
import RotaPrivada from './components/RotaPrivada'
import Login from './pages/Login'
import Chamada from './pages/Chamada'
import Catequizandos from './pages/Catequizandos'
import Turmas from './pages/Turmas'
import Equipe from './pages/Equipe'
import Relatorio from './pages/Relatorio'

// Cabeçalho + navegação, usados por todas as telas depois do login
function Layout() {
  const { ehCoordenador, sair } = useAuth()

  return (
    <>
      <header className="topo">
        <div className="topo-conteudo">
          <div className="topo-linha">
            <span className="marca">Frequência da Catequese</span>
            <button type="button" className="botao-pequeno" onClick={sair}>
              Sair
            </button>
          </div>
          <nav>
            <NavLink to="/" end>
              Chamada
            </NavLink>
            <NavLink to="/catequizandos">Catequizandos</NavLink>
            {ehCoordenador && <NavLink to="/turmas">Turmas</NavLink>}
            {ehCoordenador && <NavLink to="/equipe">Equipe</NavLink>}
            <NavLink to="/relatorio">Relatório</NavLink>
          </nav>
        </div>
      </header>

      <main>
        <Outlet />
      </main>
    </>
  )
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />

      <Route element={<RotaPrivada />}>
        <Route element={<Layout />}>
          <Route path="/" element={<Chamada />} />
          <Route path="/catequizandos" element={<Catequizandos />} />
          <Route path="/relatorio" element={<Relatorio />} />

          <Route element={<RotaPrivada somenteCoordenador />}>
            <Route path="/turmas" element={<Turmas />} />
            <Route path="/equipe" element={<Equipe />} />
          </Route>
        </Route>
      </Route>
    </Routes>
  )
}