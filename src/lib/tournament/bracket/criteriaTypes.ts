export type BracketMatchDescriptor = {
  label: string
  description: string
  phaseOverride?: string
}

export type BracketSection = {
  phase: string
  matches: BracketMatchDescriptor[]
}

export type BracketCriteria = {
  title: string
  sections: BracketSection[]
}
