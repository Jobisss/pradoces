'use client'

import { useRef, useState } from 'react'
import { cn } from '@/lib/utils'
import { AdminInput } from '@/components/admin/form'

/**
 * Autocomplete "que aprende" (D-04) — input livre + sugestões vindas de uma
 * Server Action, sem restringir a escolha ao que já existe (o valor digitado
 * é o que vale, a lista é só atalho). Usado por mercado (marca/mercado) e
 * produto (categoria).
 *
 * Renderiza SÓ o controle: o rótulo e a dica ficam por conta do `Field` que
 * envolve, pra não ter dois sistemas de rótulo no mesmo formulário.
 */
export function SuggestInput({
  id,
  name,
  value,
  onChange,
  fetchSuggestions,
  placeholder,
  className,
}: {
  id: string
  name?: string
  value: string
  onChange: (v: string) => void
  fetchSuggestions: (prefix: string) => Promise<string[]>
  placeholder?: string
  className?: string
}) {
  const [suggestions, setSuggestions] = useState<string[]>([])
  const [open, setOpen] = useState(false)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  function handleChange(v: string) {
    onChange(v)
    if (debounceRef.current) clearTimeout(debounceRef.current)
    if (!v.trim()) {
      setSuggestions([])
      return
    }
    debounceRef.current = setTimeout(() => {
      fetchSuggestions(v.trim()).then(setSuggestions)
    }, 250)
  }

  return (
    <div className={cn('relative', className)}>
      <AdminInput
        id={id}
        name={name}
        value={value}
        placeholder={placeholder}
        onChange={(e) => handleChange(e.target.value)}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        autoComplete="off"
      />
      {open && suggestions.length > 0 && (
        <ul className="absolute z-20 mt-1 w-full overflow-hidden rounded-[10px] border border-border bg-popover shadow-doce">
          {suggestions.map((s) => (
            <li key={s}>
              <button
                type="button"
                className="block w-full px-3.5 py-2.5 text-left text-sm hover:bg-muted"
                onMouseDown={(e) => {
                  e.preventDefault()
                  onChange(s)
                  setOpen(false)
                }}
              >
                {s}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
