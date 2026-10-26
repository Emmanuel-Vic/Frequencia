// Lê uma lista de catequizandos colada na tela ou enviada em arquivo (.csv ou .txt).
//
// Formato: um catequizando por linha. Pode ser só o nome, ou colunas separadas
// por TAB (o que o Excel e o Google Planilhas geram ao copiar) ou por ponto e vírgula:
//   Nome ; Data de nascimento ; Responsável ; Telefone

export const LIMITE_LINHAS = 300

// Compara nomes sem diferenciar maiúsculas, acentos e espaços repetidos
export function normalizarNome(nome) {
  return nome
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim()
}

const CABECALHOS = ['nome', 'nome completo', 'catequizando', 'catequizandos', 'aluno', 'alunos']

// Aceita 25/12/2012 ou 2012-12-25. Devolve { data } ou { erro: true }
function converterData(valor) {
  const br = valor.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})$/)
  const iso = valor.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/)

  let dia, mes, ano
  if (br) {
    ;[, dia, mes, ano] = br.map(Number)
  } else if (iso) {
    ;[, ano, mes, dia] = iso.map(Number)
  } else {
    return { erro: true }
  }

  const d = new Date(ano, mes - 1, dia)
  const existe = d.getFullYear() === ano && d.getMonth() === mes - 1 && d.getDate() === dia
  if (!existe || ano < 1900 || d > new Date()) return { erro: true }

  return { data: `${ano}-${String(mes).padStart(2, '0')}-${String(dia).padStart(2, '0')}` }
}

export function lerLista(texto) {
  const linhas = texto.replace(/^\uFEFF/, '').split(/\r?\n/)
  const resultado = []
  let primeira = true

  linhas.forEach((bruta, indice) => {
    if (!bruta.trim()) return

    const separador = bruta.includes('\t') ? '\t' : bruta.includes(';') ? ';' : null
    const colunas = (separador ? bruta.split(separador) : [bruta]).map((c) =>
      c.trim().replace(/^"(.*)"$/, '$1').trim()
    )

    // Ignora a linha de títulos, se houver (ex.: "Nome;Nascimento;...")
    if (primeira) {
      primeira = false
      if (CABECALHOS.includes(normalizarNome(colunas[0]))) return
    }

    const nome = colunas[0].replace(/\s+/g, ' ')
    const avisos = []
    let data_nascimento = null

    if (colunas[1]) {
      const convertida = converterData(colunas[1])
      if (convertida.erro) avisos.push('Data de nascimento inválida (será ignorada)')
      else data_nascimento = convertida.data
    }

    let erro = null
    if (nome.length < 2) erro = 'Nome muito curto'
    else if (nome.length > 120) erro = 'Nome muito longo'

    resultado.push({
      linha: indice + 1,
      nome,
      data_nascimento,
      responsavel: colunas[2] || null,
      telefone: colunas[3] || null,
      avisos,
      erro,
    })
  })

  return resultado
}

// Arquivos CSV do Excel em português costumam vir em Windows-1252, não em UTF-8
export async function lerArquivoTexto(arquivo) {
  const bytes = await arquivo.arrayBuffer()
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(bytes)
  } catch {
    return new TextDecoder('windows-1252').decode(bytes)
  }
}