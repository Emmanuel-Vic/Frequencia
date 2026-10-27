import { useId, useState } from 'react'

// Campo de senha com botão para mostrar e ocultar o que foi digitado (digitar senha no celular erra muito)
export default function CampoSenha({ rotulo, value, onChange, autoComplete, required = false }) {
  const id = useId()
  const [visivel, setVisivel] = useState(false)

  return (
    <div className="campo">
      <label htmlFor={id}>{rotulo}</label>
      <div className="campo-senha">
        <input
          id={id}
          type={visivel ? 'text' : 'password'}
          value={value}
          onChange={onChange}
          autoComplete={autoComplete}
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          required={required}
        />
        <button type="button" onClick={() => setVisivel((v) => !v)} aria-pressed={visivel}>
          {visivel ? 'Ocultar' : 'Mostrar'}
        </button>
      </div>
    </div>
  )
}