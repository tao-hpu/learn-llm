import bigramCss from './bigram.css?raw'
import { boot as bootBigram } from './bigram.boot.js'
import bigramRaw from './bigram.json'
import postCss from './posttraining.css?raw'
import { boot as bootPost } from './posttraining.boot.js'
import postRaw from './posttraining.json'
import rlvrCss from './rlvr-grpo.css?raw'
import { boot as bootRlvr } from './rlvr-grpo.boot.js'
import rlvrRaw from './rlvr-grpo.json'
import { expandTerms } from '../lib/expandTerms'

export interface ChapterSpec {
  slug: string
  css: string
  boot: (root: HTMLElement) => () => void
  hpHtml: string
  panelsHtml: string
}

function make(
  slug: string,
  css: string,
  boot: ChapterSpec['boot'],
  raw: { hpHtml: string; panelsHtml: string },
): ChapterSpec {
  return {
    slug,
    css,
    boot,
    hpHtml: expandTerms(raw.hpHtml),
    panelsHtml: expandTerms(raw.panelsHtml),
  }
}

export const specs: Record<string, ChapterSpec> = {
  bigram: make('bigram', bigramCss, bootBigram, bigramRaw),
  posttraining: make('posttraining', postCss, bootPost, postRaw),
  'rlvr-grpo': make('rlvr-grpo', rlvrCss, bootRlvr, rlvrRaw),
}

export function specFor(slug: string): ChapterSpec | undefined {
  return specs[slug]
}
