import type { ReactNode } from 'react'

export interface GlossaryEntry {
  id: string
  titleText: string
  def: string
  title: ReactNode
  body: ReactNode
}
