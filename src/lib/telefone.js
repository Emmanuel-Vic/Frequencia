// Monta links de ligação e de WhatsApp a partir de um telefone brasileiro digitado de qualquer jeito.

function soDigitos(valor) {
  return String(valor ?? '').replace(/\D/g, '')
}

// Devolve o número com o código do Brasil (55), ou null se não parecer um telefone válido
export function normalizarTelefone(valor) {
  const d = soDigitos(valor)
  if (d.startsWith('55') && (d.length === 12 || d.length === 13)) return d
  if (d.length === 10 || d.length === 11) return `55${d}`
  return null
}

export function linkLigar(valor) {
  const numero = normalizarTelefone(valor)
  return numero ? `tel:+${numero}` : null
}

export function linkWhatsApp(valor, mensagem = '') {
  const numero = normalizarTelefone(valor)
  if (!numero) return null
  return `https://wa.me/${numero}${mensagem ? `?text=${encodeURIComponent(mensagem)}` : ''}`
}