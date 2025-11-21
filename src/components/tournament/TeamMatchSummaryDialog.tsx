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
      <DialogContent className="border border-slate-300/30 bg-gradient-to-br from-slate-800 via-slate-700 to-slate-800 text-white backdrop-blur-xl sm:max-w-lg shadow-[0_40px_80px_rgba(15,23,42,0.45)]">
        <DialogHeader>
          <DialogTitle className="text-xl font-semibold text-white">Resumo de jogos — {teamName}</DialogTitle>
          <DialogDescription className="text-slate-200/90">
            Confira rapidamente todos os confrontos registrados para validar os resultados da tabela.
          </DialogDescription>
        </DialogHeader>
        <ScrollArea className="max-h-[60vh] pr-3">
          <div className="space-y-3">
            {!hasMatches && (
              <p className="text-sm text-slate-200/90">Nenhum jogo registrado para esta equipe até o momento.</p>
            )}
            {summaries.map((entry) => {
              const outcomeClass = outcomeStyles[entry.outcome]
              const outcomeLabel = outcomeLabels[entry.outcome]
              const setsLabel = entry.sets.length > 0 ? entry.sets.map((set) => set.label).join(' • ') : null
              const phaseLabel = entry.phase ?? 'Partida'
              const isCompleted = entry.status === 'completed'
              const isInProgress = entry.status === 'in_progress'
              
              // Para jogos finalizados, não mostrar horário
              const scheduledLabel = isCompleted 
                ? null 
                : entry.scheduledAt
                  ? formatDateTimePtBr(entry.scheduledAt, { fallback: 'A definir' })
                  : 'Horário a definir'

              let resultSummary = entry.resultLabel
              if (entry.outcome !== 'pending' && isCompleted) {
                resultSummary = `${outcomeLabel} ${entry.resultLabel}`
              } else if (entry.outcome === 'pending' && isInProgress) {
                resultSummary = `${outcomeLabel}: ${entry.resultLabel}`
              }

              return (
                <div
                  key={entry.matchId}
                  className="rounded-lg border border-slate-400/40 bg-slate-700/40 p-3 transition hover:border-slate-400/60 hover:bg-slate-700/50"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="space-y-1 flex-1">
                      <div className="text-xs uppercase tracking-[0.2em] text-slate-300/70">{phaseLabel}</div>
                      <div className="text-sm font-semibold text-white">vs {entry.opponentName}</div>
                      {!isCompleted && scheduledLabel && (
                        <div className="text-xs text-slate-200/80">
                          {scheduledLabel}
                          {entry.court ? ` • Quadra ${entry.court}` : ''}
                        </div>
                      )}
                      {isCompleted && entry.court && (
                        <div className="text-xs text-slate-200/80">
                          Quadra {entry.court}
                        </div>
                      )}
                    </div>
                    <Badge variant="outline" className={`border-slate-400/50 bg-slate-600/40 ${outcomeClass} flex-shrink-0`}>
                      {isCompleted || isInProgress
                        ? resultSummary
                        : entry.statusLabel}
                    </Badge>
                  </div>
                  {isCompleted && (
                    <div className="mt-3 space-y-2">
                      {/* Placar em sets */}
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-semibold text-slate-200/90">Placar em sets:</span>
                        <span className="text-sm font-bold text-white">
                          {entry.setsWonTeam} x {entry.setsWonOpponent}
                        </span>
                      </div>
                      {/* Placar por set */}
                      {setsLabel && (
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-semibold text-slate-200/90">Placar por set:</span>
                          <span className="text-sm font-medium text-white">{setsLabel}</span>
                        </div>
                      )}
                    </div>
                  )}
                  {!isCompleted && (
                    <div className="mt-2 space-y-1 text-xs text-slate-200/80">
                      {phaseLabel && <div>Fase: {phaseLabel}</div>}
                      {entry.status !== 'completed' && <div>Status: {entry.statusLabel}</div>}
                      {setsLabel && isInProgress && (
                        <div>
                          Sets: <span className="font-medium text-white">{setsLabel}</span>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  )
}
