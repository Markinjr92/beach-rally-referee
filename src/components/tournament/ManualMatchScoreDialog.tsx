import { useEffect, useMemo, useState } from 'react'
import { Loader2, Minus, Plus, Trophy } from 'lucide-react'

import { Tables } from '@/integrations/supabase/types'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  clearManualMatchScore,
  ManualSetScore,
  saveManualMatchScore,
  validateManualSets,
} from '@/utils/saveManualMatchScore'

type Match = Tables<'matches'>
type MatchScore = Tables<'match_scores'>

type ManualMatchScoreDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  match: Match | null
  teamAName: string
  teamBName: string
  existingScores: MatchScore[]
  onSaved: () => void
}

type SetDraft = {
  setNumber: number
  teamAPoints: string
  teamBPoints: string
}

function scoresToDrafts(scores: MatchScore[], maxSets: number): SetDraft[] {
  if (scores.length) {
    return scores
      .slice()
      .sort((a, b) => a.set_number - b.set_number)
      .map((score) => ({
        setNumber: score.set_number,
        teamAPoints: String(score.team_a_points),
        teamBPoints: String(score.team_b_points),
      }))
  }

  return [{ setNumber: 1, teamAPoints: '', teamBPoints: '' }]
}

export function ManualMatchScoreDialog({
  open,
  onOpenChange,
  match,
  teamAName,
  teamBName,
  existingScores,
  onSaved,
}: ManualMatchScoreDialogProps) {
  const maxSets = match?.best_of ?? 3
  const [sets, setSets] = useState<SetDraft[]>([])
  const [isSaving, setIsSaving] = useState(false)
  const [isClearing, setIsClearing] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!open || !match) return
    setSets(scoresToDrafts(existingScores, maxSets))
    setError(null)
  }, [open, match, existingScores, maxSets])

  const parsedSets = useMemo((): ManualSetScore[] => {
    return sets
      .filter((set) => set.teamAPoints.trim() !== '' || set.teamBPoints.trim() !== '')
      .map((set) => ({
        setNumber: set.setNumber,
        teamAPoints: Number.parseInt(set.teamAPoints, 10) || 0,
        teamBPoints: Number.parseInt(set.teamBPoints, 10) || 0,
      }))
  }, [sets])

  const previewError = match ? validateManualSets(parsedSets, match.best_of ?? maxSets) : null

  const updateSet = (index: number, patch: Partial<SetDraft>) => {
    setSets((prev) => prev.map((set, i) => (i === index ? { ...set, ...patch } : set)))
    setError(null)
  }

  const addSet = () => {
    if (sets.length >= maxSets) return
    setSets((prev) => [
      ...prev,
      { setNumber: prev.length + 1, teamAPoints: '', teamBPoints: '' },
    ])
  }

  const removeSet = (index: number) => {
    if (sets.length <= 1) return
    setSets((prev) =>
      prev
        .filter((_, i) => i !== index)
        .map((set, i) => ({ ...set, setNumber: i + 1 })),
    )
  }

  const handleSave = async () => {
    if (!match) return
    setIsSaving(true)
    setError(null)

    const result = await saveManualMatchScore(match, teamAName, teamBName, parsedSets)
    setIsSaving(false)

    if (!result.success) {
      setError(result.error)
      return
    }

    onSaved()
    onOpenChange(false)
  }

  const handleClear = async () => {
    if (!match) return
    setIsClearing(true)
    setError(null)

    const result = await clearManualMatchScore(match.id)
    setIsClearing(false)

    if (!result.success) {
      setError(result.error)
      return
    }

    onSaved()
    onOpenChange(false)
  }

  if (!match) return null

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg border-white/20 bg-slate-950 text-white">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Trophy className="h-5 w-5 text-amber-300" />
            Lançar placar manual
          </DialogTitle>
          <DialogDescription className="text-white/70">
            {teamAName} × {teamBName} — melhor de {maxSets}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {sets.map((set, index) => (
            <div
              key={set.setNumber}
              className="grid grid-cols-[auto_1fr_auto_1fr_auto] items-end gap-2 rounded-lg border border-white/10 bg-white/5 p-3"
            >
              <Label className="pb-2 text-xs text-white/60">Set {set.setNumber}</Label>
              <div className="space-y-1">
                <Label className="text-xs text-white/50 truncate">{teamAName}</Label>
                <Input
                  type="number"
                  min={0}
                  inputMode="numeric"
                  value={set.teamAPoints}
                  onChange={(e) => updateSet(index, { teamAPoints: e.target.value })}
                  className="bg-white/10 border-white/20 text-white"
                  placeholder="0"
                />
              </div>
              <span className="pb-2 text-center text-white/40">×</span>
              <div className="space-y-1">
                <Label className="text-xs text-white/50 truncate">{teamBName}</Label>
                <Input
                  type="number"
                  min={0}
                  inputMode="numeric"
                  value={set.teamBPoints}
                  onChange={(e) => updateSet(index, { teamBPoints: e.target.value })}
                  className="bg-white/10 border-white/20 text-white"
                  placeholder="0"
                />
              </div>
              {sets.length > 1 && (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => removeSet(index)}
                  className="text-white/50 hover:text-red-300 hover:bg-red-500/10"
                  aria-label={`Remover set ${set.setNumber}`}
                >
                  <Minus className="h-4 w-4" />
                </Button>
              )}
            </div>
          ))}

          {sets.length < maxSets && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={addSet}
              className="w-full border-white/20 bg-white/5 text-white hover:bg-white/10"
            >
              <Plus className="h-4 w-4 mr-2" />
              Adicionar set
            </Button>
          )}

          {previewError && parsedSets.length > 0 && (
            <p className="text-sm text-amber-200">{previewError}</p>
          )}
          {error && <p className="text-sm text-red-300">{error}</p>}
        </div>

        <DialogFooter className="flex-col gap-2 sm:flex-row sm:justify-between">
          <Button
            type="button"
            variant="outline"
            onClick={handleClear}
            disabled={isSaving || isClearing || !existingScores.length}
            className="border-red-500/40 bg-red-500/10 text-red-200 hover:bg-red-500/20"
          >
            {isClearing ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Limpar placar'}
          </Button>
          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              className="border-white/20 text-white hover:bg-white/10"
            >
              Cancelar
            </Button>
            <Button
              type="button"
              onClick={handleSave}
              disabled={isSaving || isClearing || parsedSets.length === 0}
              className="bg-emerald-500 text-white hover:bg-emerald-600"
            >
              {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Salvar placar'}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
