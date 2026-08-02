import { SorteioForm } from '@/components/admin/sorteio-form'

export default function NovoSorteioPage() {
  return (
    <div className="space-y-6">
      <h1 className="font-display text-3xl font-semibold">Novo sorteio</h1>
      <SorteioForm />
    </div>
  )
}
