'use client'

import { useActionState, useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'
import { salvarMargemGlobal, type ConfigActionState } from '@/lib/actions/config'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectValue } from '@/components/ui/select'
import {
  FormLayout,
  FormSection,
  Field,
  FieldRow,
  AdminInput,
  AdminSelectTrigger,
  InputWithSuffix,
  ToggleRow,
  FormAlert,
  FormActions,
} from '@/components/admin/form'

const initialState: ConfigActionState = {}

const PIX_TIPO_LABEL: Record<string, string> = {
  CPF: 'CPF',
  CNPJ: 'CNPJ',
  EMAIL: 'Email',
  TELEFONE: 'Telefone',
  ALEATORIA: 'Chave aleatória',
}

/**
 * O que muda na hora vs. o que fica congelado — a distinção mais importante
 * dessa tela, e que antes não estava escrita em lugar nenhum.
 */
const CONSEQUENCIAS = [
  'A margem mínima vale pra todo produto sem mínima própria — a home recalcula os avisos na hora.',
  'Pontos por real de lucro só valem pra vendas daqui pra frente. Saldo já creditado não muda — quem juntou pontos na regra antiga (por valor gasto) continua com eles.',
  'A devolução muda o preço em pontos de TODO item de resgate na hora, porque ele é calculado a partir do custo atual do doce.',
  'Taxa de entrega e Pix ficam congelados em cada reserva no momento em que ela é feita.',
]

type AjustesFormProps = {
  margemAtual: string
  pontosPorRealAtual: string
  devolucaoAtual: string
  pontosExpiracaoAtual: string
  janelaCancelamentoAtual: string
  taxaEntregaAtual: string
  entregaAtivaAtual: boolean
  pixAtivoAtual: boolean
  pixTipoChaveAtual: string
  pixChaveAtual: string
  pixNomeBeneficiarioAtual: string
  pixCidadeAtual: string
}

export function AjustesForm({
  margemAtual,
  pontosPorRealAtual,
  devolucaoAtual,
  pontosExpiracaoAtual,
  janelaCancelamentoAtual,
  taxaEntregaAtual,
  entregaAtivaAtual,
  pixAtivoAtual,
  pixTipoChaveAtual,
  pixChaveAtual,
  pixNomeBeneficiarioAtual,
  pixCidadeAtual,
}: AjustesFormProps) {
  const [state, formAction, pending] = useActionState(salvarMargemGlobal, initialState)
  const toastedFor = useRef<string | undefined>(undefined)
  const [pixTipoChave, setPixTipoChave] = useState(pixTipoChaveAtual)

  useEffect(() => {
    if (state.ok && state.message && toastedFor.current !== state.message) {
      toastedFor.current = state.message
      toast(state.message)
    }
  }, [state.ok, state.message])

  const rail = (
    <div className="flex flex-col gap-2.5 rounded-xl bg-card p-5 ring-1 ring-foreground/10 shadow-doce-baixa">
      <span className="text-[11px] font-semibold uppercase tracking-[0.09em] text-muted-foreground">
        O que muda na hora
      </span>
      {CONSEQUENCIAS.map((texto, i) => (
        <p
          key={i}
          className={`text-[13px] leading-relaxed text-muted-foreground ${i > 0 ? 'border-t border-border pt-2.5' : ''}`}
        >
          {texto}
        </p>
      ))}
    </div>
  )

  return (
    <form action={formAction} noValidate>
      <FormLayout rail={rail}>
        {state.error && <FormAlert title="Não deu pra salvar os ajustes" detail={state.error} />}

        <FormSection title="Preço e margem">
          <Field
            label="Margem mínima padrão"
            htmlFor="margemMinimaPadrao"
            className="sm:max-w-64"
            hint={`Abaixo disso o produto ganha aviso vermelho na lista e na home. Hoje: ${Number(margemAtual)}%.`}
          >
            <InputWithSuffix
              id="margemMinimaPadrao"
              name="margemMinimaPadrao"
              inputMode="decimal"
              defaultValue={margemAtual}
              suffix="%"
              required
            />
          </Field>
        </FormSection>

        <FormSection
          title="Pontos"
          hint="Ponto é lastreado no LUCRO da venda, não no valor. Um doce de margem ruim dá menos ponto que um de margem boa pelo mesmo preço — é assim que o programa se paga."
        >
          <Field
            label="De cada R$ 1 de lucro, quanto volta como brinde?"
            htmlFor="pontosDevolucaoPercent"
            className="sm:max-w-md"
            hint={`É o único botão do preço de resgate: um doce que custa R$ 3,00 pra fazer sai por ${Math.ceil(300 / Number(devolucaoAtual))} pontos. Quanto maior a porcentagem, mais barato o brinde e mais rápido o cliente resgata.`}
          >
            <InputWithSuffix
              id="pontosDevolucaoPercent"
              name="pontosDevolucaoPercent"
              inputMode="decimal"
              defaultValue={devolucaoAtual}
              suffix="%"
              required
            />
          </Field>

          <FieldRow>
            <Field
              label="Pontos por real de lucro"
              htmlFor="pontosPorReal"
              hint={`R$ 1,00 de lucro vira ${Number(pontosPorRealAtual)} ponto(s). Mexe aqui só pra mudar a escala do número que a cliente vê — não muda o quanto ela ganha de verdade.`}
            >
              <InputWithSuffix
                id="pontosPorReal"
                name="pontosPorReal"
                inputMode="decimal"
                defaultValue={pontosPorRealAtual}
                suffix="pts"
                required
              />
            </Field>
            <Field
              label="Pontos expiram em"
              htmlFor="pontosExpiracaoMeses"
              hint="Contado a partir de cada crédito."
            >
              <InputWithSuffix
                id="pontosExpiracaoMeses"
                name="pontosExpiracaoMeses"
                inputMode="numeric"
                defaultValue={pontosExpiracaoAtual}
                suffix="meses"
                required
              />
            </Field>
            <Field
              label="Janela pra cancelar"
              htmlFor="janelaCancelamentoHoras"
              hint="Depois disso a cliente não cancela sozinha."
            >
              <InputWithSuffix
                id="janelaCancelamentoHoras"
                name="janelaCancelamentoHoras"
                inputMode="numeric"
                defaultValue={janelaCancelamentoAtual}
                suffix="horas"
                required
              />
            </Field>
          </FieldRow>
        </FormSection>

        <FormSection title="Entrega">
          <ToggleRow
            name="entregaAtiva"
            label="Aceitar entrega"
            hint="Quando desligado, a vitrine só oferece retirada. Taxa fixa pra cidade toda."
            defaultChecked={entregaAtivaAtual}
          />
          <Field
            label="Taxa de entrega (R$)"
            htmlFor="taxaEntregaPadrao"
            className="sm:max-w-64"
            hint="Congelada em cada reserva — mudar aqui não altera pedidos já feitos."
          >
            <AdminInput
              id="taxaEntregaPadrao"
              name="taxaEntregaPadrao"
              inputMode="decimal"
              defaultValue={taxaEntregaAtual}
              required
            />
          </Field>
        </FormSection>

        <FormSection
          title="Pix"
          hint="Aparece no comprovante da reserva. O QR já vem com o valor exato — mas a confirmação do pagamento continua manual, no WhatsApp."
        >
          <ToggleRow
            name="pixAtivo"
            label="Mostrar Pix no comprovante"
            hint="Desligado, a combinação de pagamento fica só no WhatsApp."
            defaultChecked={pixAtivoAtual}
          />

          <FieldRow>
            <Field label="Tipo de chave" htmlFor="pixTipoChave-trigger" className="sm:max-w-56">
              <input type="hidden" name="pixTipoChave" value={pixTipoChave} />
              <Select value={pixTipoChave} onValueChange={setPixTipoChave}>
                <AdminSelectTrigger id="pixTipoChave-trigger">
                  <SelectValue placeholder="Escolhe o tipo" />
                </AdminSelectTrigger>
                <SelectContent>
                  {Object.entries(PIX_TIPO_LABEL).map(([valor, label]) => (
                    <SelectItem key={valor} value={valor}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Chave" htmlFor="pixChave">
              <AdminInput id="pixChave" name="pixChave" defaultValue={pixChaveAtual} />
            </Field>
          </FieldRow>

          <FieldRow>
            <Field
              label="Nome do beneficiário"
              htmlFor="pixNomeBeneficiario"
              hint="Como está no banco, sem acentos, até 25 caracteres — limite do padrão Pix."
            >
              <AdminInput
                id="pixNomeBeneficiario"
                name="pixNomeBeneficiario"
                maxLength={25}
                defaultValue={pixNomeBeneficiarioAtual}
              />
            </Field>
            <Field
              label="Cidade do beneficiário"
              htmlFor="pixCidade"
              hint="Sem acentos, até 15 caracteres — limite do padrão Pix."
            >
              <AdminInput
                id="pixCidade"
                name="pixCidade"
                maxLength={15}
                defaultValue={pixCidadeAtual}
              />
            </Field>
          </FieldRow>
        </FormSection>

        <FormActions note="Nada aqui apaga dado — só muda o comportamento daqui pra frente.">
          <Button type="submit" className="h-12 px-6 text-base" disabled={pending}>
            {pending ? 'Salvando...' : 'Salvar ajustes'}
          </Button>
        </FormActions>
      </FormLayout>
    </form>
  )
}
