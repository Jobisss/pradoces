/**
 * SAZON-01/02 — campanhas hardcoded de propósito (sem editor WYSIWYG, anti-
 * feature confirmada na pesquisa). Janela usa "MM-DD" fixo (não calcula
 * Páscoa/Dia das Mães de verdade, que são datas móveis) — aproximação
 * deliberada pro v1, larga o suficiente pra cobrir a data real na maioria
 * dos anos. Ajustar aqui manualmente se algum ano cair fora da janela.
 */

export type CampanhaId = 'pascoa' | 'maes' | 'junina' | 'criancas' | 'natal'

export type Paleta = {
  primary: string
  primaryForeground: string
  secondary: string
  secondaryForeground: string
  accent: string
  accentForeground: string
  background: string
}

export type CampanhaDef = {
  id: CampanhaId
  nome: string
  bannerTexto: string
  /** "MM-DD" inclusive, não cruza virada de ano. */
  janela: { inicio: string; fim: string }
  paleta: Paleta
}

export const CAMPANHAS: CampanhaDef[] = [
  {
    id: 'pascoa',
    nome: 'Páscoa',
    bannerTexto: 'Doces de Páscoa — encomenda com antecedência! 🐰🍫',
    janela: { inicio: '03-15', fim: '04-20' },
    paleta: {
      primary: '#C9A0DC',
      primaryForeground: '#3D2452',
      secondary: '#FFF6D9',
      secondaryForeground: '#6B3E26',
      accent: '#F3D9FF',
      accentForeground: '#3D2452',
      background: '#FBF3FF',
    },
  },
  {
    id: 'maes',
    nome: 'Dia das Mães',
    bannerTexto: 'Um docinho especial pra quem é mãe de coração 💗',
    janela: { inicio: '04-21', fim: '05-14' },
    paleta: {
      primary: '#E8A0BC',
      primaryForeground: '#5A1F35',
      secondary: '#FFFFFF',
      secondaryForeground: '#6B3E26',
      accent: '#FFD1E0',
      accentForeground: '#5A1F35',
      background: '#FFF0F5',
    },
  },
  {
    id: 'junina',
    nome: 'Festa Junina',
    bannerTexto: 'Chegou a época de doce de festa junina! 🌽🔥',
    janela: { inicio: '06-01', fim: '06-30' },
    paleta: {
      primary: '#D2691E',
      primaryForeground: '#FFF8E7',
      secondary: '#FFF8E7',
      secondaryForeground: '#6B3E26',
      accent: '#F4A460',
      accentForeground: '#4A2E0A',
      background: '#FFF3E0',
    },
  },
  {
    id: 'criancas',
    nome: 'Dia das Crianças',
    bannerTexto: 'Doces coloridos pra alegrar o Dia das Crianças 🎈',
    janela: { inicio: '10-01', fim: '10-12' },
    paleta: {
      primary: '#4FC3F7',
      primaryForeground: '#0D3C52',
      secondary: '#FFFFFF',
      secondaryForeground: '#6B3E26',
      accent: '#FFEB3B',
      accentForeground: '#4A3F00',
      background: '#E8F8FF',
    },
  },
  {
    id: 'natal',
    nome: 'Natal',
    bannerTexto: 'Doces de Natal — garanta os seus até esgotar! 🎄',
    janela: { inicio: '12-01', fim: '12-25' },
    paleta: {
      primary: '#B23A2E',
      primaryForeground: '#FFF5F5',
      secondary: '#FFFFFF',
      secondaryForeground: '#6B3E26',
      accent: '#2E7D4F',
      accentForeground: '#FFFFFF',
      background: '#FFF5F5',
    },
  },
]

function hojeMMDDSaoPaulo(agora: Date): string {
  const partes = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Sao_Paulo',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(agora)
  const mapa = Object.fromEntries(partes.map((p) => [p.type, p.value]))
  return `${mapa.month}-${mapa.day}`
}

/** SAZON-03/04 — campanha vigente pela data de hoje em America/Sao_Paulo, ou null se nenhuma. */
export function campanhaAtiva(agora: Date = new Date()): CampanhaDef | null {
  const hoje = hojeMMDDSaoPaulo(agora)
  return CAMPANHAS.find((c) => hoje >= c.janela.inicio && hoje <= c.janela.fim) ?? null
}
