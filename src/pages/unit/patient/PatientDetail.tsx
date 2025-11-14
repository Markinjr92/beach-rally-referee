import { Link, useParams } from 'react-router-dom'
import { ArrowLeft, CalendarDays, HeartPulse, Pill, Shield } from 'lucide-react'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { unitPatients } from '@/data/unitPatients'
import type { VitalSign } from '@/types/unit'

const severityConfig = {
  alta: {
    label: 'Alta prioridade',
    className: 'bg-red-500/10 text-red-400 border border-red-500/20',
  },
  moderada: {
    label: 'Monitorar',
    className: 'bg-yellow-500/10 text-yellow-300 border border-yellow-500/20',
  },
  estavel: {
    label: 'Estável',
    className: 'bg-emerald-500/10 text-emerald-300 border border-emerald-500/20',
  },
}

const getVitalGridClass = (count: number) => {
  if (count <= 1) return 'grid-cols-1'
  if (count === 2) return 'grid-cols-1 sm:grid-cols-2'
  return 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3'
}

const getStatusBadge = (status?: VitalSign['status']) => {
  if (status === 'critical') return 'bg-red-500/15 text-red-300 border border-red-400/30'
  if (status === 'warning') return 'bg-yellow-500/15 text-yellow-200 border border-yellow-400/30'
  if (status === 'normal') return 'bg-emerald-500/15 text-emerald-300 border border-emerald-400/30'
  return 'bg-white/5 text-white/80 border border-white/10'
}

const formatDate = (iso: string) =>
  new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  }).format(new Date(iso))

const PatientDetail = () => {
  const { patientId } = useParams<{ patientId: string }>()
  const patient = unitPatients.find((item) => item.id === patientId)

  if (!patient) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-950 text-white">
        <div className="space-y-6 text-center">
          <h1 className="text-3xl font-semibold">Paciente não encontrado</h1>
          <Link to="/unit">
            <Button className="bg-cyan-500/90 text-slate-950 hover:bg-cyan-400">Voltar para a unidade</Button>
          </Link>
        </div>
      </div>
    )
  }

  const severity = severityConfig[patient.severity]
  const vitalGridClass = getVitalGridClass(patient.vitalSigns.length)

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      <div className="container mx-auto px-4 py-10 space-y-10">
        <header className="flex flex-col gap-6">
          <div className="flex items-center justify-between gap-4">
            <Link to="/unit">
              <Button
                variant="ghost"
                className="bg-white/10 border border-white/10 text-white hover:bg-white/20 hover:text-white"
              >
                <ArrowLeft size={18} />
                Voltar
              </Button>
            </Link>
            <Badge className={severity.className}>{severity.label}</Badge>
          </div>

          <div className="space-y-2">
            <h1 className="text-3xl font-semibold sm:text-4xl">{patient.name}</h1>
            <div className="flex flex-wrap items-center gap-3 text-sm text-white/70">
              <span className="inline-flex items-center gap-2">
                <Shield className="h-4 w-4" /> Leito {patient.bed}
              </span>
              <span className="inline-flex items-center gap-2">
                <HeartPulse className="h-4 w-4" /> {patient.diagnosis}
              </span>
              <span className="inline-flex items-center gap-2">
                <CalendarDays className="h-4 w-4" /> Internado desde {formatDate(patient.admissionDate)}
              </span>
            </div>
          </div>
        </header>

        <section className="grid gap-6 lg:grid-cols-[2fr,1fr]">
          <Card className="bg-slate-900/60 border border-white/10 text-white">
            <CardHeader>
              <CardTitle className="text-lg font-semibold">Plano assistencial</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 text-sm text-white/80">
              <p>
                Equipe responsável: <span className="text-white">{patient.attendingTeam}</span>
              </p>
              {patient.allergies && patient.allergies.length > 0 && (
                <p>
                  Alergias registradas: <span className="text-white">{patient.allergies.join(', ')}</span>
                </p>
              )}
              {patient.notes && <p>{patient.notes}</p>}
            </CardContent>
          </Card>

          <Card className="bg-slate-900/60 border border-white/10 text-white">
            <CardHeader>
              <CardTitle className="text-lg font-semibold">Últimas atualizações</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm text-white/80">
              <p>
                <span className="text-white">Horário:</span> {new Date(patient.lastUpdate).toLocaleTimeString('pt-BR', {
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </p>
              <p>
                <span className="text-white">Turno:</span> Assistencial
              </p>
              <p>
                <span className="text-white">Observações:</span> sinais vitais dentro do esperado para o período.
              </p>
            </CardContent>
          </Card>
        </section>

        <section className="space-y-4">
          <Card className="bg-slate-900/70 border border-white/10 text-white">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="inline-flex items-center gap-2 text-xl">
                  <HeartPulse className="h-5 w-5" /> Sinais Vitais
                </CardTitle>
                <span className="text-sm text-white/60">Atualizado às {new Date(patient.lastUpdate).toLocaleTimeString('pt-BR', {
                  hour: '2-digit',
                  minute: '2-digit',
                })}</span>
              </div>
            </CardHeader>
            <CardContent>
              <div className={`grid gap-4 ${vitalGridClass}`}>
                {patient.vitalSigns.map((vital) => (
                  <div
                    key={vital.label}
                    className="rounded-lg border border-white/10 bg-white/5 p-4 text-sm text-white/80"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <p className="font-medium text-white">{vital.label}</p>
                      {vital.status && <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${getStatusBadge(vital.status)}`}>{vital.status}</span>}
                    </div>
                    <p className="mt-1 text-lg font-semibold text-white">{vital.value}</p>
                    {vital.note && <p className="mt-2 text-xs text-white/60">{vital.note}</p>}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </section>

        <section>
          <Card className="bg-slate-900/70 border border-white/10 text-white">
            <CardHeader>
              <CardTitle className="inline-flex items-center gap-2 text-xl">
                <Pill className="h-5 w-5" /> Antibióticos Prescritos
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm text-white/80">
              {patient.antibiotics.length === 0 ? (
                <p>Nenhum antibiótico prescrito no momento.</p>
              ) : (
                patient.antibiotics.map((antibiotic) => (
                  <div
                    key={`${antibiotic.name}-${antibiotic.route}-${antibiotic.frequency}`}
                    className="rounded-lg border border-white/10 bg-white/5 p-4"
                  >
                    <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                      <p className="text-base font-semibold text-white">{antibiotic.name}</p>
                      <span className="text-xs uppercase tracking-wide text-white/50">{antibiotic.route}</span>
                    </div>
                    <div className="mt-2 flex flex-wrap gap-4 text-sm">
                      <span>
                        <strong className="text-white">Dose:</strong> {antibiotic.dose}
                      </span>
                      <span>
                        <strong className="text-white">Frequência:</strong> {antibiotic.frequency}
                      </span>
                      {antibiotic.startDate && (
                        <span>
                          <strong className="text-white">Iniciado em:</strong> {formatDate(antibiotic.startDate)}
                        </span>
                      )}
                    </div>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </section>

        <footer className="flex justify-center">
          <Link to="/unit">
            <Button className="bg-cyan-500/90 text-slate-950 hover:bg-cyan-400">Voltar para a unidade</Button>
          </Link>
        </footer>
      </div>
    </div>
  )
}

export default PatientDetail
