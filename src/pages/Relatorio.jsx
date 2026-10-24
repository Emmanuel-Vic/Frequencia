import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'
import './Relatorio.css'

const TAMANHO_PAGINA = 1000 // limite padrão de linhas por consulta no Supabase

// Busca todas as presenças da turma (paginando, porque passar de 1000 linhas é comum)
async function buscarPresencas(turmaId, de, ate) {
  const todas = []

  for (let inicio = 0; ; inicio += TAMANHO_PAGINA) {
    let consulta = supabase
      .from('presencas')
      .select('catequizando_id, status, encontros!inner(turma_id, data)')
      .eq('encontros.turma_id', turmaId)
      .order('id')
      .range(inicio, inicio + TAMANHO_PAGINA - 1)

    if (de) consulta = consulta.gte('encontros.data', de)
    if (ate) consulta = consulta.lte('encontros.data', ate)

    const { data, error } = await consulta
    if (error) return { error }

    todas.push(...data)
    if (data.length < TAMANHO_PAGINA) break
  }

  return { data: todas }
}

export default function Relatorio() {
  const [turmas, setTurmas] = useState([])
  const [turmaId, setTurmaId] = useState('')
  const [de, setDe] = useState('')
  const [ate, setAte] = useState('')
  const [minimo, setMinimo] = useState(75) // frequência mínima exigida (%)
  const [justificadaConta, setJustificadaConta] = useState(false)
  const [ordem, setOrdem] = useState('frequencia') // 'frequencia' | 'nome'

  const [bruto, setBruto] = useState([]) // contagens por aluno, antes do cálculo do percentual
  const [totalEncontros, setTotalEncontros] = useState(0)
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState(null)

  // 1) Carrega as turmas
  useEffect(() => {
    async function carregarTurmas() {
      const { data, error } = await supabase
        .from('turmas')
        .select('id, nome')
        .eq('ativa', true)
        .order('nome')

      if (error) {
        console.error(error)
        setErro('Não foi possível carregar as turmas.')
        setCarregando(false)
        return
      }

      setTurmas(data)
      if (data.length > 0) setTurmaId(data[0].id)
      else setCarregando(false)
    }
    carregarTurmas()
  }, [])

  // 2) Carrega alunos, encontros e presenças da turma (e do período, se informado)
  useEffect(() => {
    if (!turmaId) return
    let cancelado = false

    async function carregarRelatorio() {
      setCarregando(true)
      setErro(null)

      let consultaEncontros = supabase
        .from('encontros')
        .select('id', { count: 'exact', head: true })
        .eq('turma_id', turmaId)
      if (de) consultaEncontros = consultaEncontros.gte('data', de)
      if (ate) consultaEncontros = consultaEncontros.lte('data', ate)

      const [resAlunos, resEncontros, resPresencas] = await Promise.all([
        supabase
          .from('catequizandos')
          .select('id, nome')
          .eq('turma_id', turmaId)
          .eq('ativo', true)
          .order('nome'),
        consultaEncontros,
        buscarPresencas(turmaId, de, ate),
      ])

      if (cancelado) return

      const falha = resAlunos.error ?? resEncontros.error ?? resPresencas.error
      if (falha) {
        console.error(falha)
        setErro('Não foi possível carregar o relatório.')
        setCarregando(false)
        return
      }

      // Conta presente/falta/justificada de cada aluno
      const contagem = Object.fromEntries(
        resAlunos.data.map((a) => [
          a.id,
          { id: a.id, nome: a.nome, presentes: 0, faltas: 0, justificadas: 0 },
        ])
      )

      for (const p of resPresencas.data) {
        const c = contagem[p.catequizando_id]
        if (!c) continue // aluno inativo ou de outra turma
        if (p.status === 'presente') c.presentes += 1
        else if (p.status === 'falta') c.faltas += 1
        else if (p.status === 'justificada') c.justificadas += 1
      }

      setBruto(Object.values(contagem))
      setTotalEncontros(resEncontros.count ?? 0)
      setCarregando(false)
    }

    carregarRelatorio()
    return () => {
      cancelado = true
    }
  }, [turmaId, de, ate])

  // 3) Calcula percentuais (recalcula na hora ao mudar o limite ou a regra das justificadas)
  const linhas = useMemo(() => {
    const calculadas = bruto.map((a) => {
      // Só conta os encontros em que o aluno tem registro (quem entrou depois não é penalizado)
      const registros = a.presentes + a.faltas + a.justificadas
      const validas = a.presentes + (justificadaConta ? a.justificadas : 0)
      const percentual = registros > 0 ? (validas / registros) * 100 : null
      return {
        ...a,
        registros,
        percentual,
        abaixo: percentual !== null && percentual < minimo,
      }
    })

    return calculadas.sort((x, y) => {
      if (ordem === 'nome') return x.nome.localeCompare(y.nome, 'pt-BR')
      // menor frequência primeiro; quem não tem registro vai para o fim
      if (x.percentual === null) return 1
      if (y.percentual === null) return -1
      return x.percentual - y.percentual
    })
  }, [bruto, minimo, justificadaConta, ordem])

  const comRegistro = linhas.filter((l) => l.percentual !== null)
  const media =
    comRegistro.length > 0
      ? comRegistro.reduce((soma, l) => soma + l.percentual, 0) / comRegistro.length
      : null
  const abaixoDoMinimo = linhas.filter((l) => l.abaixo).length

  if (!carregando && turmas.length === 0) {
    return (
      <section className="relatorio">
        <h1>Relatório de frequência</h1>
        {erro ? (
          <p className="relatorio-erro">{erro}</p>
        ) : (
          <p>Nenhuma turma cadastrada.</p>
        )}
      </section>
    )
  }

  return (
    <section className="relatorio">
      <h1>Relatório de frequência</h1>

      <div className="relatorio-filtros">
        <label>
          Turma
          <select value={turmaId} onChange={(e) => setTurmaId(e.target.value)}>
            {turmas.map((t) => (
              <option key={t.id} value={t.id}>
                {t.nome}
              </option>
            ))}
          </select>
        </label>

        <div className="relatorio-periodo">
          <label>
            De
            <input type="date" value={de} onChange={(e) => setDe(e.target.value)} />
          </label>
          <label>
            Até
            <input type="date" value={ate} onChange={(e) => setAte(e.target.value)} />
          </label>
        </div>

        <label>
          Frequência mínima (%)
          <input
            type="number"
            min="0"
            max="100"
            value={minimo}
            onChange={(e) => setMinimo(Number(e.target.value))}
          />
        </label>

        <label className="relatorio-check">
          <input
            type="checkbox"
            checked={justificadaConta}
            onChange={(e) => setJustificadaConta(e.target.checked)}
          />
          Contar faltas justificadas como presença
        </label>

        <label>
          Ordenar por
          <select value={ordem} onChange={(e) => setOrdem(e.target.value)}>
            <option value="frequencia">Menor frequência primeiro</option>
            <option value="nome">Nome</option>
          </select>
        </label>
      </div>

      {erro && <p className="relatorio-erro">{erro}</p>}

      {carregando ? (
        <p>Carregando...</p>
      ) : linhas.length === 0 ? (
        <p>Esta turma não tem catequizandos ativos.</p>
      ) : (
        <>
          <div className="relatorio-resumo">
            <div>
              <strong>{totalEncontros}</strong>
              <span>encontros</span>
            </div>
            <div>
              <strong>{media === null ? '–' : `${media.toFixed(0)}%`}</strong>
              <span>média da turma</span>
            </div>
            <div>
              <strong>{abaixoDoMinimo}</strong>
              <span>abaixo de {minimo}%</span>
            </div>
          </div>

          {totalEncontros === 0 && (
            <p className="relatorio-aviso">
              Nenhum encontro registrado neste período. Faça uma chamada para gerar dados.
            </p>
          )}

          <ul className="relatorio-lista">
            {linhas.map((l) => (
              <li key={l.id} className={l.abaixo ? 'aluno-linha abaixo' : 'aluno-linha'}>
                <div className="aluno-topo">
                  <span className="aluno-nome">{l.nome}</span>
                  <span className="aluno-percentual">
                    {l.percentual === null ? 'Sem registros' : `${l.percentual.toFixed(0)}%`}
                  </span>
                </div>

                {l.percentual !== null && (
                  <div
                    className="barra"
                    role="progressbar"
                    aria-valuenow={Math.round(l.percentual)}
                    aria-valuemin={0}
                    aria-valuemax={100}
                  >
                    <div className="barra-preenchida" style={{ width: `${l.percentual}%` }} />
                  </div>
                )}

                <div className="aluno-detalhe">
                  {l.presentes} presenças, {l.faltas} faltas, {l.justificadas} justificadas
                  {l.abaixo && <strong className="aluno-alerta"> Abaixo do mínimo</strong>}
                </div>
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  )
}