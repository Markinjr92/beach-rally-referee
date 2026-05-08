import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowLeft, ClipboardCheck, RefreshCw, Send } from 'lucide-react'

import { supabase } from '@/integrations/supabase/client'
import { Tables } from '@/integrations/supabase/types'
import { useAuth } from '@/hooks/useAuth'
import { useUserRoles } from '@/hooks/useUserRoles'
import { useToast } from '@/components/ui/use-toast'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Textarea } from '@/components/ui/textarea'
import { formatDateShortPtBr, formatDateTimePtBr } from '@/utils/date'

type TournamentOption = Pick<Tables<'tournaments'>, 'id' | 'name' | 'status' | 'start_date' | 'end_date'>
type TeamSummary = Pick<Tables<'teams'>, 'id' | 'name'>
type MatchAssignment = Tables<'match_assignments'>

type MatchWithTeams = Tables<'matches'> & {
  team_a: TeamSummary | null
  team_b: TeamSummary | null
}

type AssignmentRpcResult = {
  success?: boolean
  error?: string
  created_count?: number
  existing_count?: number
}

const statusLabels: Record<string, string> = {
  scheduled: 'Agendado',
  in_progress: 'Em andamento',
  completed: 'Finalizado',
  canceled: 'Cancelado',
}

const assignmentStatusLabels: Record<string, string> = {
  active: 'Liberado',
  revoked: 'Revogado',
}

const splitEmails = (value: string) =>
  Array.from(
    new Set(
      value
        .split(/[\s,;]+/)
        .map((email) => email.trim().toLowerCase())
        .filter(Boolean),
    ),
  )

const MatchAssignments = () => {
  const { user, loading: authLoading } = useAuth()
  const { roles, loading: rolesLoading } = useUserRoles(user, authLoading)
  const { toast } = useToast()

  const [tournaments, setTournaments] = useState<TournamentOption[]>([])
  const [selectedTournamentId, setSelectedTournamentId] = useState<string>('')
  const [matches, setMatches] = useState<MatchWithTeams[]>([])
  const [assignments, setAssignments] = useState<MatchAssignment[]>([])
  const [selectedMatchIds, setSelectedMatchIds] = useState<string[]>([])
  const [emailText, setEmailText] = useState('')
  const [loading, setLoading] = useState(true)
  const [matchesLoading, setMatchesLoading] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [permissionLoading, setPermissionLoading] = useState(true)
  const [canManageByPermission, setCanManageByPermission] = useState(false)

  const canManageAssignments = useMemo(
    () => canManageByPermission || roles.includes('admin_sistema') || roles.includes('organizador'),
    [canManageByPermission, roles],
  )

  const assignmentsByMatchId = useMemo(() => {
    return assignments.reduce<Record<string, MatchAssignment[]>>((acc, assignment) => {
      acc[assignment.match_id] = acc[assignment.match_id] || []
      acc[assignment.match_id].push(assignment)
      return acc
    }, {})
  }, [assignments])

  useEffect(() => {
    const loadPermission = async () => {
      if (!user) {
        setCanManageByPermission(false)
        setPermissionLoading(false)
        return
      }

      setPermissionLoading(true)
      const { data, error } = await supabase.rpc('user_has_permission', {
        user_uuid: user.id,
        permission_name: 'tournament.manage',
      })

      if (error) {
        setCanManageByPermission(false)
      } else {
        setCanManageByPermission(Boolean(data))
      }

      setPermissionLoading(false)
    }

    if (!authLoading) {
      void loadPermission()
    }
  }, [authLoading, user])

  useEffect(() => {
    const loadTournaments = async () => {
      if (!user || !canManageAssignments) {
        setLoading(false)
        return
      }

      setLoading(true)
      const { data, error } = await supabase
        .from('tournaments')
        .select('id, name, status, start_date, end_date')
        .order('start_date', { ascending: false })

      if (error) {
        toast({ title: 'Erro ao carregar torneios', description: error.message })
        setTournaments([])
      } else {
        const tournamentData = (data || []) as TournamentOption[]
        setTournaments(tournamentData)
        setSelectedTournamentId((current) => current || tournamentData[0]?.id || '')
      }

      setLoading(false)
    }

    if (!authLoading && !rolesLoading && !permissionLoading) {
      void loadTournaments()
    }
  }, [authLoading, canManageAssignments, permissionLoading, rolesLoading, toast, user])

  const loadTournamentMatches = useCallback(async () => {
    if (!selectedTournamentId) {
      setMatches([])
      setAssignments([])
      return
    }

    setMatchesLoading(true)
    setSelectedMatchIds([])

    const { data: matchData, error: matchError } = await supabase
      .from('matches')
      .select(`*, team_a:teams!matches_team_a_id_fkey(id, name), team_b:teams!matches_team_b_id_fkey(id, name)`)
      .eq('tournament_id', selectedTournamentId)
      .order('scheduled_at', { ascending: true })

    if (matchError) {
      toast({ title: 'Erro ao carregar jogos', description: matchError.message })
      setMatches([])
      setAssignments([])
      setMatchesLoading(false)
      return
    }

    const parsedMatches = ((matchData || []) as MatchWithTeams[]).map((match) => ({
      ...match,
      team_a: match.team_a ?? null,
      team_b: match.team_b ?? null,
    }))
    setMatches(parsedMatches)

    const matchIds = parsedMatches.map((match) => match.id)
    if (matchIds.length === 0) {
      setAssignments([])
      setMatchesLoading(false)
      return
    }

    const { data: assignmentData, error: assignmentError } = await supabase
      .from('match_assignments')
      .select('*')
      .in('match_id', matchIds)
      .order('assigned_at', { ascending: false })

    if (assignmentError) {
      toast({ title: 'Erro ao carregar liberações', description: assignmentError.message })
      setAssignments([])
    } else {
      setAssignments((assignmentData || []) as MatchAssignment[])
    }

    setMatchesLoading(false)
  }, [selectedTournamentId, toast])

  useEffect(() => {
    if (selectedTournamentId) {
      void loadTournamentMatches()
    }
  }, [loadTournamentMatches, selectedTournamentId])

  const toggleMatchSelection = (matchId: string) => {
    const match = matches.find((item) => item.id === matchId)
    if (match && ['completed', 'canceled'].includes(match.status || 'scheduled')) {
      return
    }

    setSelectedMatchIds((current) =>
      current.includes(matchId)
        ? current.filter((id) => id !== matchId)
        : [...current, matchId],
    )
  }

  const handleAssign = async () => {
    const emails = splitEmails(emailText)
    const assignableSelectedMatchIds = selectedMatchIds.filter((matchId) => {
      const match = matches.find((item) => item.id === matchId)
      return match && !['completed', 'canceled'].includes(match.status || 'scheduled')
    })

    if (assignableSelectedMatchIds.length === 0) {
      toast({ title: 'Selecione ao menos um jogo' })
      return
    }

    if (emails.length === 0) {
      toast({ title: 'Informe ao menos um email de árbitro' })
      return
    }

    setSubmitting(true)
    const { data, error } = await supabase.rpc('assign_referee_to_matches', {
      p_match_ids: assignableSelectedMatchIds,
      p_referee_emails: emails,
    })

    setSubmitting(false)

    if (error) {
      toast({ title: 'Erro ao liberar jogos', description: error.message })
      return
    }

    const result = data as AssignmentRpcResult | null
    if (!result?.success) {
      toast({
        title: 'Não foi possível liberar os jogos',
        description: result?.error || 'A operação não retornou sucesso.',
      })
      return
    }

    toast({
      title: 'Jogos liberados',
      description: `${result.created_count || 0} nova(s) liberação(ões), ${result.existing_count || 0} já existente(s).`,
    })
    setEmailText('')
    setSelectedMatchIds([])
    await loadTournamentMatches()
  }

  if (authLoading || rolesLoading || permissionLoading || loading) {
    return (
      <div className="min-h-screen bg-gradient-ocean flex items-center justify-center text-white">
        Carregando...
      </div>
    )
  }

  if (!user || !canManageAssignments) {
    return (
      <div className="min-h-screen bg-gradient-ocean text-white">
        <div className="container mx-auto px-4 py-10">
          <Card className="bg-white/10 border-white/20 text-white">
            <CardHeader>
              <CardTitle>Acesso restrito</CardTitle>
              <CardDescription className="text-white/75">
                Apenas administradores e organizadores podem liberar jogos para árbitros.
              </CardDescription>
            </CardHeader>
          </Card>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-ocean text-white">
      <div className="container mx-auto px-4 py-10 space-y-6">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <Link to="/" className="w-fit">
            <Button variant="ghost" className="bg-white/10 border border-white/20 text-white hover:bg-white/20 hover:text-white">
              <ArrowLeft size={18} />
              Início
            </Button>
          </Link>
          <div className="text-left md:text-right">
            <h1 className="text-3xl font-semibold">Liberação de Jogos</h1>
            <p className="mt-1 text-sm text-white/70">Fase 1 da integração com o Referee Jukin offline</p>
          </div>
        </div>

        <Alert className="border-sky-300/40 bg-sky-500/15 text-sky-50">
          <ClipboardCheck className="h-4 w-4" />
          <AlertTitle>Escopo atual</AlertTitle>
          <AlertDescription>
            Esta tela apenas libera partidas para emails de árbitros e prepara o recebimento de placar final por RPC.
          </AlertDescription>
        </Alert>

        <Card className="bg-slate-900/60 border border-white/20 text-white backdrop-blur-xl">
          <CardHeader>
            <CardTitle>Selecionar torneio e árbitros</CardTitle>
            <CardDescription className="text-white/70">
              Marque os jogos abaixo e informe emails separados por vírgula, espaço ou quebra de linha.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(280px,420px)]">
            <div className="space-y-2">
              <span className="text-sm font-medium text-white/70">Torneio</span>
              <Select value={selectedTournamentId} onValueChange={setSelectedTournamentId}>
                <SelectTrigger className="bg-white/10 border-white/30 text-white">
                  <SelectValue placeholder="Selecione um torneio" />
                </SelectTrigger>
                <SelectContent className="bg-slate-950/95 border border-white/20 text-white">
                  {tournaments.map((tournament) => (
                    <SelectItem key={tournament.id} value={tournament.id}>
                      {tournament.name} · {formatDateShortPtBr(tournament.start_date)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <span className="text-sm font-medium text-white/70">Emails dos árbitros</span>
              <Textarea
                value={emailText}
                onChange={(event) => setEmailText(event.target.value)}
                placeholder="arbitro@email.com&#10;outro@email.com"
                className="min-h-[96px] border-white/30 bg-white/10 text-white placeholder:text-white/50"
              />
              <Button
                onClick={handleAssign}
                disabled={submitting || selectedMatchIds.length === 0}
                className="w-full bg-yellow-400 text-slate-950 hover:bg-yellow-300"
              >
                <Send size={16} />
                {submitting ? 'Liberando...' : `Liberar ${selectedMatchIds.length} jogo(s)`}
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-slate-900/60 border border-white/20 text-white backdrop-blur-xl">
          <CardHeader className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <CardTitle>Jogos e liberações</CardTitle>
              <CardDescription className="text-white/70">
                {matches.length} jogo(s) encontrado(s) no torneio selecionado.
              </CardDescription>
            </div>
            <Button
              variant="outline"
              onClick={() => void loadTournamentMatches()}
              disabled={matchesLoading}
              className="border-white/30 bg-white/10 text-white hover:bg-white/20 hover:text-white"
            >
              <RefreshCw size={16} />
              Atualizar
            </Button>
          </CardHeader>
          <CardContent>
            {matchesLoading ? (
              <div className="py-10 text-center text-white/70">Carregando jogos...</div>
            ) : matches.length === 0 ? (
              <div className="py-10 text-center text-white/70">Nenhum jogo encontrado para este torneio.</div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="border-white/10 hover:bg-white/5">
                      <TableHead className="w-[56px] text-white/70">Sel.</TableHead>
                      <TableHead className="text-white/70">Jogo</TableHead>
                      <TableHead className="text-white/70">Agenda</TableHead>
                      <TableHead className="text-white/70">Status</TableHead>
                      <TableHead className="text-white/70">Liberado para</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {matches.map((match) => {
                      const matchAssignments = assignmentsByMatchId[match.id] || []
                      const isSelected = selectedMatchIds.includes(match.id)
                      const isAssignable = !['completed', 'canceled'].includes(match.status || 'scheduled')
                      return (
	                        <TableRow key={match.id} className="border-white/10 hover:bg-white/5">
	                          <TableCell>
	                            <Checkbox
	                              checked={isSelected}
                              disabled={!isAssignable}
	                              onCheckedChange={() => toggleMatchSelection(match.id)}
	                              aria-label={`Selecionar ${match.team_a?.name || 'Equipe A'} contra ${match.team_b?.name || 'Equipe B'}`}
	                              className="border-white/50 data-[state=checked]:bg-yellow-400 data-[state=checked]:text-slate-950"
	                            />
	                          </TableCell>
                          <TableCell className="min-w-[260px]">
                            <div className="font-medium text-white">
                              {match.team_a?.name || 'Equipe A'} vs {match.team_b?.name || 'Equipe B'}
                            </div>
                            <div className="mt-1 flex flex-wrap gap-2 text-xs text-white/60">
                              <span>{match.phase || 'Jogo'}</span>
                              {match.court && <span>Quadra {match.court}</span>}
                            </div>
                          </TableCell>
                          <TableCell className="min-w-[180px] text-white/75">
                            {formatDateTimePtBr(match.scheduled_at, { fallback: 'Horário a definir' })}
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline" className="border-white/40 text-white">
                              {statusLabels[match.status || 'scheduled'] || match.status || 'Agendado'}
                            </Badge>
                            {!isAssignable && (
                              <div className="mt-2 text-xs text-white/50">
                                Não liberável
                              </div>
                            )}
                          </TableCell>
                          <TableCell className="min-w-[260px]">
                            {matchAssignments.length === 0 ? (
                              <span className="text-sm text-white/50">Sem liberação</span>
                            ) : (
                              <div className="flex flex-wrap gap-2">
                                {matchAssignments.map((assignment) => (
                                  <Badge
                                    key={assignment.id}
                                    variant="secondary"
                                    className="bg-white/10 text-white hover:bg-white/10"
                                  >
                                    {assignment.referee_email} · {assignmentStatusLabels[assignment.status] || assignment.status}
                                  </Badge>
                                ))}
                              </div>
                            )}
                          </TableCell>
                        </TableRow>
                      )
                    })}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

export default MatchAssignments
