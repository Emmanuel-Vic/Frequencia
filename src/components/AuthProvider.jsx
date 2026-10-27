import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { AuthContext } from '../lib/auth-context'

export default function AuthProvider({ children }) {
  // undefined = ainda não sabemos; null = sem login
  const [sessao, setSessao] = useState(undefined)
  const [perfilCarregado, setPerfilCarregado] = useState(null) // { id, dados }

  // 1) Acompanha o login (inclusive ao abrir o app já logado)
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSessao(data.session))

    // Aqui só atualizamos o estado; consultas ao banco ficam no efeito abaixo
    const { data } = supabase.auth.onAuthStateChange((_evento, novaSessao) => {
      setSessao(novaSessao)
    })

    return () => data.subscription.unsubscribe()
  }, [])

  const usuarioId = sessao?.user?.id ?? null

  // 2) Busca o perfil (nome e papel) de quem está logado
  useEffect(() => {
    if (!usuarioId) return
    let cancelado = false

    supabase
      .from('perfis')
      .select('nome, papel, ativo')
      .eq('id', usuarioId)
      .maybeSingle()
      .then(({ data, error }) => {
        if (cancelado) return
        if (error) console.error(error)
        setPerfilCarregado({ id: usuarioId, dados: data ?? null })
      })

    return () => {
      cancelado = true
    }
  }, [usuarioId])

  const perfil = usuarioId && perfilCarregado?.id === usuarioId ? perfilCarregado.dados : null
  const carregando =
    sessao === undefined || (usuarioId !== null && perfilCarregado?.id !== usuarioId)

  const valor = {
    usuario: sessao?.user ?? null,
    perfil,
    ehCoordenador: perfil?.papel === 'coordenador' && perfil?.ativo === true,
    carregando,
    sair: () => {
      // Apaga os rascunhos de chamada deste aparelho, para não aparecerem para a próxima pessoa
      try {
        Object.keys(localStorage)
          .filter((k) => k.startsWith('rascunho-chamada:'))
          .forEach((k) => localStorage.removeItem(k))
      } catch {
        // armazenamento bloqueado: segue com a saída normal
      }
      return supabase.auth.signOut()
    },
  }

  return <AuthContext.Provider value={valor}>{children}</AuthContext.Provider>
}