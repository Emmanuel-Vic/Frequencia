import { useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'
import { lerLista, lerArquivoTexto, normalizarNome, LIMITE_LINHAS } from '../lib/importar'

const ROTULO = {
  novo: 'Novo',
  existente: 'Já cadastrado',
  repetido: 'Repetido na lista',
  invalido: 'Inválido',
}

// Cadastra vários catequizandos de uma vez a partir de uma lista colada ou de um arquivo
export default function ImportarLista({ turmas, todos, aoImportar }) {
  const [turmaId, setTurmaId] = useState('')
  const [texto, setTexto] = useState('')
  const [enviando, setEnviando] = useState(false)
  const [mensagem, setMensagem] = useState(null) // { tipo: 'ok' | 'erro', texto }

  const ativas = turmas.filter((t) => t.ativa)
  // Se existe só uma turma ativa, ela já vem escolhida
  const turmaEscolhida = turmaId || (ativas.length === 1 ? ativas[0].id : '')

  // Confere cada linha: nova, já cadastrada na turma, repetida na própria lista ou inválida
  const linhas = useMemo(() => {
    const existentes = new Set(
      todos
        .filter((c) => c.ativo && c.turma_id === turmaEscolhida)
        .map((c) => normalizarNome(c.nome))
    )
    const vistos = new Set()

    return lerLista(texto).map((l) => {
      if (l.erro) return { ...l, situacao: 'invalido' }
      const chave = normalizarNome(l.nome)
      if (existentes.has(chave)) return { ...l, situacao: 'existente' }
      if (vistos.has(chave)) return { ...l, situacao: 'repetido' }
      vistos.add(chave)
      return { ...l, situacao: 'novo' }
    })
  }, [texto, todos, turmaEscolhida])

  const novos = linhas.filter((l) => l.situacao === 'novo')
  const ignorados = linhas.length - novos.length
  const excedeu = linhas.length > LIMITE_LINHAS

  async function escolherArquivo(e) {
    const arquivo = e.target.files?.[0]
    e.target.value = '' // permite escolher o mesmo arquivo de novo
    if (!arquivo) return

    if (arquivo.size > 1024 * 1024) {
      setMensagem({ tipo: 'erro', texto: 'Arquivo grande demais (máximo 1 MB).' })
      return
    }

    setTexto(await lerArquivoTexto(arquivo))
    setMensagem(null)
  }

  async function importar() {
    if (!turmaEscolhida || novos.length === 0 || excedeu) return

    setEnviando(true)
    setMensagem(null)

    // Um único envio: ou entram todos, ou nenhum
    const { error } = await supabase.from('catequizandos').insert(
      novos.map((l) => ({
        nome: l.nome,
        data_nascimento: l.data_nascimento,
        responsavel: l.responsavel,
        telefone: l.telefone,
        turma_id: turmaEscolhida,
      }))
    )

    setEnviando(false)

    if (error) {
      console.error(error)
      setMensagem({ tipo: 'erro', texto: 'Erro ao importar. Nenhum nome foi cadastrado. Tente de novo.' })
      return
    }

    setTexto('')
    setMensagem({
      tipo: 'ok',
      texto: `${novos.length} ${novos.length === 1 ? 'catequizando importado' : 'catequizandos importados'}.`,
    })
    aoImportar()
  }

  return (
    <details className="cartao importar">
      <summary>Importar lista de nomes</summary>

      <div className="importar-corpo">
        <label>
          Turma que vai receber os nomes
          <select value={turmaEscolhida} onChange={(e) => setTurmaId(e.target.value)}>
            <option value="">Selecione a turma</option>
            {ativas.map((t) => (
              <option key={t.id} value={t.id}>
                {t.nome}
              </option>
            ))}
          </select>
        </label>

        <label>
          Cole os nomes, um por linha
          <textarea
            rows={7}
            spellCheck={false}
            value={texto}
            onChange={(e) => {
              setTexto(e.target.value)
              setMensagem(null)
            }}
            placeholder={
              'Maria da Silva\nJoão Pedro Souza\n\nOu cole direto do Excel, com as colunas:\nNome | Nascimento | Responsável | Telefone'
            }
          />
        </label>

        <label>
          Ou envie um arquivo (.csv ou .txt)
          <input type="file" accept=".csv,.txt,text/csv,text/plain" onChange={escolherArquivo} />
        </label>

        <small>
          Colunas opcionais, separadas por TAB (copiado do Excel) ou ponto e vírgula: nome,
          nascimento (25/12/2012), responsável e telefone. Planilhas .xlsx: copie as células e cole
          aqui.
        </small>

        {linhas.length > 0 && (
          <>
            <p className="importar-resumo">
              {novos.length} para importar
              {ignorados > 0 ? ` · ${ignorados} ignorados` : ''}
            </p>

            {excedeu && (
              <p className="msg msg-erro">
                A lista tem {linhas.length} linhas. O máximo é {LIMITE_LINHAS} por vez; divida em
                partes.
              </p>
            )}

            <ul className="previa">
              {linhas.map((l) => (
                <li key={l.linha} className={l.situacao === 'novo' ? 'previa-linha' : 'previa-linha ignorada'}>
                  <span>
                    {l.nome || '(vazio)'}
                    {l.avisos.map((a) => (
                      <small key={a} className="previa-aviso">
                        {' '}
                        {a}
                      </small>
                    ))}
                  </span>
                  <span className={l.situacao === 'novo' ? 'etiqueta etiqueta-coord' : 'etiqueta'}>
                    {l.erro ?? ROTULO[l.situacao]}
                  </span>
                </li>
              ))}
            </ul>
          </>
        )}

        {mensagem && (
          <p className={`msg msg-${mensagem.tipo}`} role="status">
            {mensagem.texto}
          </p>
        )}

        <button
          type="button"
          className="botao-primario"
          onClick={importar}
          disabled={enviando || !turmaEscolhida || novos.length === 0 || excedeu}
        >
          {enviando
            ? 'Importando...'
            : novos.length > 0
              ? `Importar ${novos.length} ${novos.length === 1 ? 'catequizando' : 'catequizandos'}`
              : 'Importar'}
        </button>

        {!turmaEscolhida && linhas.length > 0 && (
          <small>Escolha a turma para conferir quem já está cadastrado.</small>
        )}
      </div>
    </details>
  )
}