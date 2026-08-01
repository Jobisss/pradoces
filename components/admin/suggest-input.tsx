'use client'

import { useRef, useState } from 'react'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

/**
 * Autocomplete "que aprende" (D-04) — input livre + sugestões vindas de uma
 * Server Action, sem restringir a escolha ao que já existe (o valor digitado
 * é o que vale, a lista é só atalho). Usado por mercado (marca/mercado) e
 * produto (categoria).
 */
export function SuggestInput({
  id,
  name,
  label,
  value,
  onChange,
  fetchSuggestions,
}: {
  id: string
  name?: string
  label: string
  value: string
  onChange: (v: string) => void
  fetchSuggestions: (prefix: string) => Promise<string[]>
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
    <div className="relative space-y-1.5">
      <Label htmlFor={id}>{label}</Label>
      <Input
        id={id}
        name={name}
        value={value}
        onChange={(e) => handleChange(e.target.value)}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        autoComplete="off"
      />
      {open && suggestions.length > 0 && (
        <ul className="absolute z-10 mt-1 w-full rounded-lg border border-border bg-popover shadow-md">
          {suggestions.map((s) => (
            <li key={s}>
              <button
                type="button"
                className="block w-full px-3 py-2 text-left text-sm hover:bg-muted"
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
