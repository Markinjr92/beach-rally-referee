import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import { Activity, ArrowLeft, Clock3, ShieldAlert, Stethoscope } from 'lucide-react'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { unitPatients } from '@/data/unitPatients'

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

const formatDate = (iso: string) => {
  const date = new Date(iso)
  return new Intl.DateTimeFormat('pt-BR', {
    hour: '2-digit',
    minute: '2-digit',
  }).format(date)
}

const UnitDashboard = () => {
  const highlightedPatients = useMemo(() => unitPatients.slice(0, 2), [])

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      <div className="container mx-auto px-4 py-10 space-y-10">
        <header className="flex flex-col gap-6">
          <div className="flex items-center justify-between gap-4">
            <Link to="/">
              <Button
                variant="ghost"
                className="bg-white/10 border border-white/10 text-white hover:bg-white/20 hover:text-white"
              >
                <ArrowLeft size={18} />
                Voltar
              </Button>
            </Link>
            <div className="hidden sm:flex items-center gap-3 text-white/70">
              <ShieldAlert className="text-cyan-300" size={24} />
              <span>Central de acompanhamento da unidade</span>
            </div>
          </div>

          <div className="space-y-3 text-center">
            <div className="mx-auto inline-flex items-center gap-3 rounded-full border border-white/10 bg-white/10 px-6 py-3 backdrop-blur">
              <Activity className="h-6 w-6 text-cyan-300" />
              <div className="text-left">
                <p className="text-xs uppercase tracking-[0.4em] text-white/60">UTI Adulto</p>
                <h1 className="text-3xl font-semibold sm:text-4xl">Monitoramento de Pacientes</h1>
              </div>
            </div>
            <p className="mx-auto max-w-2xl text-sm text-white/80 sm:text-base">
              Informações resumidas dos leitos críticos da unidade. Selecione um paciente para visualizar detalhes clínicos e planos terapêuticos.
            </p>
          </div>
        </header>

        <section className="grid gap-6 md:grid-cols-2">
          {highlightedPatients.map((patient) => {
            const config = severityConfig[patient.severity]
            return (
              <Card key={patient.id} className="bg-slate-900/60 border border-white/10 text-white">
                <CardHeader className="flex flex-row items-start justify-between gap-4">
                  <div>
                    <CardTitle className="text-2xl font-semibold">{patient.name}</CardTitle>
                    <p className="text-sm text-white/70">Leito {patient.bed}</p>
                  </div>
                  <Badge className={config.className}>{config.label}</Badge>
                </CardHeader>
                <CardContent className="space-y-4 text-sm text-white/80">
                  <div className="flex flex-wrap items-center gap-3">
                    <span className="inline-flex items-center gap-2">
                      <Stethoscope className="h-4 w-4" />
                      {patient.diagnosis}
                    </span>
                    <span className="inline-flex items-center gap-2">
                      <Clock3 className="h-4 w-4" />
                      Última atualização às {formatDate(patient.lastUpdate)}
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-2 text-xs text-white/60">
                    <span>Equipe: {patient.attendingTeam}</span>
                    {patient.isolation && <span>• Isolamento: {patient.isolation}</span>}
                  </div>
                  <Link
                    to={`/unit/patient/${patient.id}`}
                    className="inline-flex w-full items-center justify-center rounded-md bg-cyan-500/90 px-4 py-2 text-sm font-medium text-slate-950 transition hover:bg-cyan-400"
                  >
                    Ver detalhes
                  </Link>
                </CardContent>
              </Card>
            )
          })}
        </section>

        <section className="space-y-4">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <h2 className="text-xl font-semibold">Pacientes internados</h2>
            <p className="text-sm text-white/60">
              A tabela adapta o conteúdo para manter a leitura confortável em qualquer resolução.
            </p>
          </div>
          <Card className="bg-slate-900/60 border border-white/10 text-white">
            <CardContent className="p-0">
              <Table className="text-xs sm:text-sm">
                <TableHeader>
                  <TableRow className="bg-white/5">
                    <TableHead className="w-[45%] sm:w-[30%]">Paciente</TableHead>
                    <TableHead className="hidden sm:table-cell">Leito</TableHead>
                    <TableHead className="hidden md:table-cell">Diagnóstico</TableHead>
                    <TableHead className="hidden lg:table-cell">Equipe responsável</TableHead>
                    <TableHead className="text-right">Prioridade</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {unitPatients.map((patient) => {
                    const config = severityConfig[patient.severity]
                    return (
                      <TableRow key={patient.id} className="border-white/5">
                        <TableCell className="align-top">
                          <div className="flex flex-col gap-1">
                            <span className="text-sm font-medium text-white sm:text-base">{patient.name}</span>
                            <span className="text-xs text-white/60 sm:hidden">
                              Leito {patient.bed} · {patient.diagnosis}
                            </span>
                            <span className="text-xs text-white/40 md:hidden">
                              Atualizado às {formatDate(patient.lastUpdate)}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell className="hidden sm:table-cell align-top text-white/80">{patient.bed}</TableCell>
                        <TableCell className="hidden md:table-cell align-top text-white/80">
                          <span className="block max-w-[18rem] truncate" title={patient.diagnosis}>
                            {patient.diagnosis}
                          </span>
                        </TableCell>
                        <TableCell className="hidden lg:table-cell align-top text-white/70">
                          <span className="block max-w-[20rem] truncate" title={patient.attendingTeam}>
                            {patient.attendingTeam}
                          </span>
                        </TableCell>
                        <TableCell className="flex flex-col items-end gap-1 text-right">
                          <Badge className={config.className}>{config.label}</Badge>
                          <span className="text-xs text-white/40 hidden sm:block">
                            Atualização: {formatDate(patient.lastUpdate)}
                          </span>
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </section>
      </div>
    </div>
  )
}

export default UnitDashboard
