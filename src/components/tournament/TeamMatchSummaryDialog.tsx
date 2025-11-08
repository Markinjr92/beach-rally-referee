import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Badge } from '@/components/ui/badge'
import { formatDateTimePtBr } from '@/utils/date'
import type { TeamMatchSummaryEntry } from '@/utils/teamMatchSummary'

const outcomeStyles: Record<TeamMatchSummaryEntry['outcome'], string> = {
  win: 'text-emerald-300',
  loss: 'text-rose-300',
  pending: 'text-white/70',
}

const outcomeLabels: Record<TeamMatchSummaryEntry['outcome'], string> = {
  win: 'Vitória',
  loss: 'Derrota',
  pending: 'Resultado parcial',
}

type TeamMatchSummaryDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  teamName: string
  summaries: TeamMatchSummaryEntry[]
}

export const TeamMatchSummaryDialog = ({ open, onOpenChange, teamName, summaries }: TeamMatchSummaryDialogProps) => {
  const hasMatches = summaries.length > 0

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-slate-950/95 border border-white/15 text-white backdrop-blur-xl sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="text-xl font-semibold">Resumo de jogos — {teamName}</DialogTitle>
          <DialogDescription className="text-white/70">
            Confira rapidamente todos os confrontos registrados para validar os resultados da tabela.
          </DialogDescription>
        </DialogHeader>
        <ScrollArea className="max-h-[60vh] pr-3">
          <div className="space-y-3">
            {!hasMatches && (
              <p className="text-sm text-white/70">Nenhum jogo registrado para esta equipe até o momento.</p>
            )}
            {summaries.map((entry) => {
              const outcomeClass = outcomeStyles[entry.outcome]
              const outcomeLabel = outcomeLabels[entry.outcome]
              const setsLabel = entry.sets.length > 0 ? entry.sets.map((set) => set.label).join(' • ') : null
              const phaseParts = [entry.phase, entry.round].filter(Boolean)
              const phaseLabel = phaseParts.join(' • ')
              const matchLabel = entry.label ?? phaseLabel ?? 'Partida'
              const scheduledLabel = entry.scheduledAt
                ? formatDateTimePtBr(entry.scheduledAt, { fallback: 'A definir' })
                : 'Horário a definir'

              let resultSummary = entry.resultLabel
              if (entry.outcome !== 'pending' && entry.status === 'completed') {
                resultSummary = `${outcomeLabel} ${entry.resultLabel}`
              } else if (entry.outcome === 'pending' && entry.status === 'in_progress') {
                resultSummary = `${outcomeLabel}: ${entry.resultLabel}`
              }

              return (
                <div
                  key={entry.matchId}
                  className="rounded-lg border border-white/10 bg-white/5 p-3 transition hover:border-white/20"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="space-y-1">
                      <div className="text-xs uppercase tracking-[0.2em] text-white/60">{matchLabel}</div>
                      <div className="text-sm font-semibold text-white">vs {entry.opponentName}</div>
                      <div className="text-xs text-white/60">
                        {scheduledLabel}
                        {entry.court ? ` • Quadra ${entry.court}` : ''}
                      </div>
                    </div>
                    <Badge variant="outline" className={`border-white/20 bg-white/10 ${outcomeClass}`}>
                      {entry.status === 'completed' || entry.status === 'in_progress'
                        ? resultSummary
                        : entry.statusLabel}
                    </Badge>
                  </div>
                  <div className="mt-2 space-y-1 text-xs text-white/70">
                    {phaseLabel && <div>Fase: {phaseLabel}</div>}
                    {entry.status !== 'completed' && <div>Status: {entry.statusLabel}</div>}
                    {setsLabel && (
                      <div>
                        Sets: <span className="font-medium text-white">{setsLabel}</span>
                      </div>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  )
}
