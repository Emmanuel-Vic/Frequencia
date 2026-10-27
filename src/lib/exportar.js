// Baixa o relatório de frequência em CSV (abre no Excel) ou em PDF.

function formatarData(iso) {
  return iso ? iso.split('-').reverse().join('/') : ''
}

function descreverPeriodo(de, ate) {
  if (de && ate) return `${formatarData(de)} a ${formatarData(ate)}`
  if (de) return `a partir de ${formatarData(de)}`
  if (ate) return `até ${formatarData(ate)}`
  return 'Todos os encontros'
}

function situacao(linha) {
  if (linha.percentual === null) return 'Sem registros'
  return linha.abaixo ? 'Abaixo do mínimo' : 'Regular'
}

// Ex.: frequencia-crisma-1-2026-10-25.pdf (sem acentos nem espaços)
function nomeDoArquivo(turma, extensao) {
  const limpo =
    turma
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '') || 'turma'

  const d = new Date()
  const mes = String(d.getMonth() + 1).padStart(2, '0')
  const dia = String(d.getDate()).padStart(2, '0')
  return `frequencia-${limpo}-${d.getFullYear()}-${mes}-${dia}.${extensao}`
}

function baixarArquivo(blob, nome) {
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = nome
  document.body.appendChild(link)
  link.click()
  link.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

// ---------- CSV ----------

function celula(valor) {
  let texto = String(valor ?? '')
  // Evita que o Excel trate um nome como fórmula (ex.: começando com "=")
  if (/^[=+\-@\t\r]/.test(texto)) texto = `'${texto}`
  return /[";\r\n]/.test(texto) ? `"${texto.replace(/"/g, '""')}"` : texto
}

export function baixarCsv({
  turma,
  de,
  ate,
  minimo,
  justificadaConta,
  totalEncontros,
  media,
  abaixoDoMinimo,
  linhas,
}) {
  const tabela = [
    ['Relatório de frequência'],
    ['Turma', turma],
    ['Período', descreverPeriodo(de, ate)],
    ['Encontros no período', totalEncontros],
    ['Média da turma (%)', media === null ? '' : Math.round(media)],
    ['Frequência mínima (%)', minimo],
    ['Catequizandos abaixo do mínimo', abaixoDoMinimo],
    ['Faltas justificadas contam como presença', justificadaConta ? 'Sim' : 'Não'],
    [],
    ['Catequizando', 'Presenças', 'Faltas', 'Justificadas', 'Frequência (%)', 'Situação'],
    ...linhas.map((l) => [
      l.nome,
      l.presentes,
      l.faltas,
      l.justificadas,
      l.percentual === null ? '' : Math.round(l.percentual),
      situacao(l),
    ]),
  ]

  // Ponto e vírgula + BOM: o Excel em português abre com as colunas e os acentos certos
  const texto = tabela.map((linha) => linha.map(celula).join(';')).join('\r\n')
  const blob = new Blob(['\uFEFF' + texto], { type: 'text/csv;charset=utf-8' })
  baixarArquivo(blob, nomeDoArquivo(turma, 'csv'))
}

// ---------- PDF ----------

async function gerarPdf({
  turma,
  de,
  ate,
  minimo,
  justificadaConta,
  totalEncontros,
  media,
  abaixoDoMinimo,
  linhas,
}) {
  // Carregado só quando o botão é usado, para não pesar na abertura do app
  const [{ jsPDF }, { default: autoTable }] = await Promise.all([
    import('jspdf'),
    import('jspdf-autotable'),
  ])

  const doc = new jsPDF({ unit: 'mm', format: 'a4' })
  const margem = 14
  const larguraUtil = doc.internal.pageSize.getWidth() - margem * 2

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(16)
  doc.text('Relatório de frequência', margem, 18)

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(10)

  const info = [
    `Turma: ${turma}`,
    `Período: ${descreverPeriodo(de, ate)}`,
    `Encontros: ${totalEncontros}  -  Média da turma: ${media === null ? '-' : `${Math.round(media)}%`}`,
    `Frequência mínima: ${minimo}%  -  Abaixo do mínimo: ${abaixoDoMinimo}`,
    `Faltas justificadas ${justificadaConta ? 'contam' : 'não contam'} como presença`,
  ]

  let y = 26
  for (const texto of info) {
    const partes = doc.splitTextToSize(texto, larguraUtil)
    doc.text(partes, margem, y)
    y += partes.length * 5 + 1
  }

  autoTable(doc, {
    startY: y + 2,
    margin: { left: margem, right: margem },
    head: [['Catequizando', 'Presenças', 'Faltas', 'Justificadas', 'Frequência', 'Situação']],
    body: linhas.map((l) => [
      l.nome,
      l.presentes,
      l.faltas,
      l.justificadas,
      l.percentual === null ? '-' : `${Math.round(l.percentual)}%`,
      situacao(l),
    ]),
    styles: { font: 'helvetica', fontSize: 9, cellPadding: 2 },
    headStyles: { fillColor: [36, 80, 143], textColor: 255 },
    columnStyles: {
      1: { halign: 'center' },
      2: { halign: 'center' },
      3: { halign: 'center' },
      4: { halign: 'center' },
    },
    // Quem está abaixo do mínimo fica destacado em vermelho claro
    didParseCell: (dados) => {
      if (dados.section === 'body' && linhas[dados.row.index]?.abaixo) {
        dados.cell.styles.fillColor = [251, 229, 227]
        dados.cell.styles.textColor = [122, 29, 24]
      }
    },
  })

  // Rodapé com data de geração e número da página
  const total = doc.getNumberOfPages()
  const largura = doc.internal.pageSize.getWidth()
  const altura = doc.internal.pageSize.getHeight()
  const geradoEm = new Date().toLocaleString('pt-BR')

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8)
  doc.setTextColor(120)
  for (let i = 1; i <= total; i++) {
    doc.setPage(i)
    doc.text(`Gerado em ${geradoEm}  -  Página ${i} de ${total}`, largura - margem, altura - 8, {
      align: 'right',
    })
  }

  return { blob: doc.output('blob'), nome: nomeDoArquivo(turma, 'pdf') }
}

export async function baixarPdf(dados) {
  const { blob, nome } = await gerarPdf(dados)
  baixarArquivo(blob, nome)
}

// O menu de compartilhar do celular (WhatsApp, e-mail...) só existe em alguns navegadores
export function suportaCompartilhar() {
  try {
    const teste = new File([''], 'teste.pdf', { type: 'application/pdf' })
    return Boolean(navigator.canShare && navigator.share && navigator.canShare({ files: [teste] }))
  } catch {
    return false
  }
}

export async function compartilharPdf(dados) {
  const { blob, nome } = await gerarPdf(dados)
  const arquivo = new File([blob], nome, { type: 'application/pdf' })

  try {
    await navigator.share({ files: [arquivo], title: 'Relatório de frequência' })
  } catch (erro) {
    if (erro.name === 'AbortError') return // a pessoa fechou o menu de compartilhar
    baixarArquivo(blob, nome) // não deu para compartilhar: baixa o arquivo
  }
}