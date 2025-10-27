export type VitalSign = {
  label: string
  value: string
  status?: 'normal' | 'warning' | 'critical'
  note?: string
}

export type PrescribedAntibiotic = {
  name: string
  dose: string
  frequency: string
  route: string
  startDate?: string
}

export type UnitPatient = {
  id: string
  name: string
  age: number
  bed: string
  diagnosis: string
  isolation?: string
  attendingTeam: string
  severity: 'alta' | 'moderada' | 'estavel'
  lastUpdate: string
  admissionDate: string
  vitalSigns: VitalSign[]
  antibiotics: PrescribedAntibiotic[]
  allergies?: string[]
  notes?: string
}
