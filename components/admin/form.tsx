'use client'

import * as React from 'react'
import { TriangleAlert, Check, type LucideIcon } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { SelectTrigger } from '@/components/ui/select'

/**
 * Peças de formulário do painel admin.
 *
 * Client module de propósito: todos os seis formulários já são client
 * components (useActionState / react-hook-form / useState), e várias peças
 * aqui recebem handler.
 *
 * O que muda em relação ao que existia:
 * - controle de 44px em vez dos 32px padrão do shadcn (a clientela é 50+ e os
 *   botões do admin já eram 44 — só os campos tinham ficado para trás);
 * - erro em vermelho de verdade: `state.error` saía como `text-muted-foreground`,
 *   do tamanho do corpo, e passava despercebido;
 * - campos numa superfície branca, igual às listagens, em vez de flutuando
 *   no creme.
 */

/* ------------------------------------------------------------- estrutura */

/** Formulário à esquerda, trilho de números à direita (some no mobile). */
export function FormLayout({
  children,
  rail,
}: {
  children: React.ReactNode
  rail?: React.ReactNode
}) {
  return (
    <div className="flex flex-col items-start gap-6 xl:flex-row">
      <div className="flex w-full min-w-0 flex-col gap-4">{children}</div>
      {rail && (
        <aside className="flex w-full shrink-0 flex-col gap-4 xl:w-80">{rail}</aside>
      )}
    </div>
  )
}

export function FormSection({
  title,
  hint,
  children,
}: {
  title: string
  hint?: string
  children: React.ReactNode
}) {
  return (
    <section className="flex flex-col gap-[18px] rounded-xl bg-card px-6 pb-6 pt-[22px] ring-1 ring-foreground/10 shadow-doce-baixa">
      <div className="space-y-0.5">
        <h2 className="text-[17px] font-semibold tracking-tight">{title}</h2>
        {hint && <p className="max-w-[62ch] text-[13px] leading-normal text-muted-foreground">{hint}</p>}
      </div>
      {children}
    </section>
  )
}

/** Linha de campos que quebra no mobile. */
export function FieldRow({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={cn('flex flex-col gap-4 sm:flex-row', className)}>{children}</div>
}

/* ---------------------------------------------------------------- campos */

/** Altura/tipografia de controle do admin — usar em vez do Input cru. */
export const CONTROL = 'h-11 rounded-[10px] text-base md:text-[15px]'

export function AdminInput({ className, ...props }: React.ComponentProps<typeof Input>) {
  return <Input className={cn(CONTROL, className)} {...props} />
}

export function AdminTextarea({ className, ...props }: React.ComponentProps<typeof Textarea>) {
  return <Textarea className={cn('min-h-20 rounded-[10px] text-base md:text-[15px]', className)} {...props} />
}

export function AdminSelectTrigger({
  className,
  ...props
}: React.ComponentProps<typeof SelectTrigger>) {
  return <SelectTrigger className={cn(CONTROL, 'w-full', className)} {...props} />
}

export function Field({
  label,
  hint,
  error,
  optional,
  htmlFor,
  className,
  children,
}: {
  label: React.ReactNode
  hint?: React.ReactNode
  error?: React.ReactNode
  optional?: boolean
  htmlFor?: string
  className?: string
  children: React.ReactNode
}) {
  return (
    <div className={cn('flex min-w-0 flex-1 flex-col gap-[7px]', className)}>
      <label htmlFor={htmlFor} className="flex items-center gap-2 text-sm font-semibold">
        {label}
        {optional && <span className="text-xs font-medium text-caramelo">opcional</span>}
      </label>
      {children}
      {error ? (
        <span className="flex items-start gap-1.5 text-[13px] text-destructive">
          <TriangleAlert className="mt-0.5 size-3.5 shrink-0" aria-hidden />
          {error}
        </span>
      ) : hint ? (
        <span className="text-[13px] leading-snug text-muted-foreground">{hint}</span>
      ) : null}
    </div>
  )
}

/** Sufixo colado no campo (un, g, %, dias) sem virar outro input. */
export function InputWithSuffix({
  suffix,
  className,
  ...props
}: React.ComponentProps<typeof Input> & { suffix: string }) {
  return (
    <div className="relative">
      <AdminInput className={cn('pr-14', className)} {...props} />
      <span className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
        {suffix}
      </span>
    </div>
  )
}

/**
 * Escolha entre 2 e 3 opções como cartão, não `<select>`: as alternativas
 * ficam visíveis sem abrir nada, e o alvo de toque passa a ser o cartão
 * inteiro. Um radio nativo por baixo — funciona com FormData e com RHF.
 */
export function OptionCards({
  name,
  options,
  value,
  defaultValue,
  onChange,
  disabled,
}: {
  name: string
  options: Array<{ value: string; title: string; hint?: string }>
  value?: string
  defaultValue?: string
  onChange?: (value: string) => void
  disabled?: boolean
}) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row">
      {options.map((opt) => (
        <label
          key={opt.value}
          className={cn(
            'flex flex-1 cursor-pointer items-start gap-3 rounded-xl border p-3.5 transition-colors',
            'has-[:checked]:border-transparent has-[:checked]:bg-muted has-[:checked]:ring-2 has-[:checked]:ring-primary',
            'border-border bg-card hover:bg-muted/40',
            disabled && 'pointer-events-none opacity-60'
          )}
        >
          <input
            type="radio"
            name={name}
            value={opt.value}
            defaultChecked={value === undefined ? defaultValue === opt.value : undefined}
            checked={value === undefined ? undefined : value === opt.value}
            onChange={onChange ? () => onChange(opt.value) : undefined}
            disabled={disabled}
            className="peer sr-only"
          />
          <span
            aria-hidden
            className="mt-0.5 flex size-[18px] shrink-0 items-center justify-center rounded-full border-[1.5px] border-caramelo peer-checked:border-foreground peer-checked:bg-foreground peer-checked:[&>span]:opacity-100"
          >
            <span className="size-1.5 rounded-full bg-card opacity-0" />
          </span>
          <span className="min-w-0 space-y-0.5">
            <span className="block text-sm font-semibold">{opt.title}</span>
            {opt.hint && (
              <span className="block text-[13px] leading-snug text-muted-foreground">{opt.hint}</span>
            )}
          </span>
        </label>
      ))}
    </div>
  )
}

/** Liga/desliga com a consequência escrita ao lado, não um checkbox solto. */
export function ToggleRow({
  name,
  label,
  hint,
  defaultChecked,
  checked,
  onChange,
}: {
  name: string
  label: string
  hint: string
  defaultChecked?: boolean
  checked?: boolean
  onChange?: (checked: boolean) => void
}) {
  return (
    <label className="flex cursor-pointer items-start justify-between gap-5 rounded-xl bg-background p-4">
      <span className="space-y-0.5">
        <span className="block text-sm font-semibold">{label}</span>
        <span className="block text-[13px] leading-snug text-muted-foreground">{hint}</span>
      </span>
      <input
        type="checkbox"
        name={name}
        value="on"
        defaultChecked={checked === undefined ? defaultChecked : undefined}
        checked={checked}
        onChange={onChange ? (e) => onChange(e.target.checked) : undefined}
        className="peer sr-only"
      />
      <span
        aria-hidden
        className="flex h-[26px] w-[46px] shrink-0 items-center rounded-full bg-caramelo p-[3px] transition-colors peer-checked:bg-foreground peer-checked:[&>span]:translate-x-5"
      >
        <span className="size-5 rounded-full bg-card transition-transform" />
      </span>
    </label>
  )
}

/* --------------------------------------------------------------- avisos */

/** Erro do servidor. Antes saía como texto cinza no meio do formulário. */
export function FormAlert({ title, detail }: { title: string; detail?: React.ReactNode }) {
  return (
    <div
      role="alert"
      className="flex items-start gap-3 rounded-xl border border-destructive/20 bg-destructive/[0.07] p-4"
    >
      <TriangleAlert className="mt-0.5 size-[18px] shrink-0 text-destructive" aria-hidden />
      <div className="space-y-0.5">
        <p className="text-sm font-semibold text-destructive">{title}</p>
        {detail && <p className="text-[13px] leading-snug text-muted-foreground">{detail}</p>}
      </div>
    </div>
  )
}

/* ---------------------------------------------------------------- trilho */

/** O número que o formulário está construindo — antes era rodapé cinza. */
export function CostCard({
  label,
  value,
  sub,
  tone = 'default',
  icon: Icon,
  rows,
  children,
}: {
  label: string
  value: React.ReactNode
  sub?: React.ReactNode
  tone?: 'default' | 'ok' | 'danger'
  icon?: LucideIcon
  rows?: Array<{ label: string; value: React.ReactNode; tone?: 'default' | 'warn' | 'ok' | 'danger' }>
  children?: React.ReactNode
}) {
  return (
    <div className="flex flex-col gap-3.5 rounded-xl bg-card p-5 ring-1 ring-foreground/10 shadow-doce-baixa">
      <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.09em] text-muted-foreground">
        {Icon && <Icon className="size-3.5 text-caramelo" aria-hidden />}
        {label}
      </div>
      <div className="space-y-0.5">
        <p
          className={cn(
            'text-3xl font-semibold leading-none tracking-tight tabular-nums',
            tone === 'ok' && 'text-success',
            tone === 'danger' && 'text-destructive'
          )}
        >
          {value}
        </p>
        {sub && <p className="text-[13px] text-muted-foreground">{sub}</p>}
      </div>
      {rows && rows.length > 0 && (
        <dl className="flex flex-col border-t border-border">
          {rows.map((r, i) => (
            <div
              key={r.label}
              className={cn(
                'flex items-baseline justify-between gap-3 py-2.5',
                i < rows.length - 1 && 'border-b border-border'
              )}
            >
              <dt className="text-[13px] text-muted-foreground">{r.label}</dt>
              <dd
                className={cn(
                  'text-sm font-medium tabular-nums',
                  r.tone === 'warn' && 'text-warn',
                  r.tone === 'ok' && 'text-success',
                  r.tone === 'danger' && 'text-destructive'
                )}
              >
                {r.value}
              </dd>
            </div>
          ))}
        </dl>
      )}
      {children}
    </div>
  )
}

export function RailNote({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2.5 rounded-[11px] bg-caramelo/20 p-3.5 text-[13px] leading-snug text-warn">
      <TriangleAlert className="size-4 shrink-0" aria-hidden />
      <span>{children}</span>
    </div>
  )
}

/** O botão desabilitado não diz por quê. Esta lista diz. */
export function Checklist({
  items,
}: {
  items: Array<{ ok: boolean; label: React.ReactNode }>
}) {
  return (
    <div className="flex flex-col gap-2 rounded-xl bg-card px-5 py-[18px] ring-1 ring-foreground/10 shadow-doce-baixa">
      <span className="text-[11px] font-semibold uppercase tracking-[0.09em] text-muted-foreground">
        Pra poder salvar
      </span>
      <ul className="flex flex-col">
        {items.map((item, i) => (
          <li key={i} className="flex items-start gap-2.5 py-2">
            {item.ok ? (
              <span className="mt-px flex size-[18px] shrink-0 items-center justify-center rounded-full bg-success/[0.12]">
                <Check className="size-3 text-success" strokeWidth={2.6} aria-hidden />
              </span>
            ) : (
              <span
                className="mt-px size-[18px] shrink-0 rounded-full border-[1.5px] border-dashed border-caramelo"
                aria-hidden
              />
            )}
            <span
              className={cn(
                'text-[13px] leading-snug',
                item.ok ? 'text-muted-foreground' : 'text-foreground'
              )}
            >
              {item.label}
            </span>
          </li>
        ))}
      </ul>
    </div>
  )
}

/* ---------------------------------------------------------------- ações */

/** Régua de ação: a nota explica a consequência de salvar. */
export function FormActions({
  note,
  children,
}: {
  note?: React.ReactNode
  children: React.ReactNode
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-4 rounded-xl bg-card px-5 py-4 ring-1 ring-foreground/10 shadow-doce-baixa">
      {note ? (
        <p className="max-w-[52ch] text-[13px] leading-snug text-muted-foreground">{note}</p>
      ) : (
        <span />
      )}
      <div className="flex shrink-0 items-center gap-2.5">{children}</div>
    </div>
  )
}
