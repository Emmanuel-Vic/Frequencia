import { Routes, Route, NavLink } from 'react-router-dom'
import Chamada from './pages/Chamada'
import Catequizandos from './pages/Catequizandos'
import Turmas from './pages/Turmas'
import Relatorio from './pages/Relatorio'

export default function App() {
  return (
    <>
      <header className="topo">
        <div className="topo-conteudo">
          <span className="marca">Frequência da Catequese</span>
          <nav>
            <NavLink to="/" end>
              Chamada
            </NavLink>
            <NavLink to="/catequizandos">Catequizandos</NavLink>
            <NavLink to="/turmas">Turmas</NavLink>
            <NavLink to="/relatorio">Relatório</NavLink>
          </nav>
        </div>
      </header>

      <main>
        <Routes>
          <Route path="/" element={<Chamada />} />
          <Route path="/catequizandos" element={<Catequizandos />} />
          <Route path="/turmas" element={<Turmas />} />
          <Route path="/relatorio" element={<Relatorio />} />
        </Routes>
      </main>
    </>
  )
}