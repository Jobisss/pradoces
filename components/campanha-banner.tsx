export function CampanhaBanner({ texto }: { texto: string }) {
  return (
    <div className="bg-primary px-4 py-2 text-center text-sm font-medium text-primary-foreground">{texto}</div>
  )
}
