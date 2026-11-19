import type { GlossaryEntry } from './types'
import { entries as groupA } from './A'
import { entries as groupB } from './B'
import { entries as groupC } from './C'
import { entries as groupD } from './D'
import { entries as groupG } from './G'
import { entries as groupF } from './F'
import { entries as groupH } from './H'
import { entries as groupI } from './I'
import { entries as groupJ } from './J'
import { entries as groupK } from './K'
import { entries as groupE } from './E'

export const entriesByGroup: Record<string, GlossaryEntry[]> = {
  "A": groupA,
  "B": groupB,
  "C": groupC,
  "D": groupD,
  "G": groupG,
  "F": groupF,
  "H": groupH,
  "I": groupI,
  "J": groupJ,
  "K": groupK,
  "E": groupE,
}
