import { useEffect, useMemo, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { supabase } from '@/integrations/supabase/client'
import { Tables } from '@/integrations/supabase/types'
import { useToast } from '@/components/ui/use-toast'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'

type Tournament = Tables<'tournaments'>
type Team = Tables<'teams'>
type Match = Tables<'matches'>

export default function TournamentDetailDB() {
  const { tournamentId } = useParams()
  const { toast } = useToast()
  const [tournament, setTournament] = useState<Tournament | null>(null)
  const [teams, setTeams] = useState<Team[]>([])
  const [matches, setMatches] = useState<Match[]>([])
  const [teamForm, setTeamForm] = useState({ name: '', player_a: '', player_b: '' })
  const [matchForm, setMatchForm] = useState({ teamA: '', teamB: '', scheduled_at: '' })

  useEffect(() => {
    const load = async () => {
      if (!tournamentId) return
      const { data: t, error: te } = await supabase.from('tournaments').select('*').eq('id', tournamentId).single()
      if (te) { toast({ title: 'Erro ao carregar torneio', description: te.message }); return }
      setTournament(t)

      const { data: reg, error: re } = await supabase.from('tournament_teams').select('teams(*)').eq('tournament_id', tournamentId)
      if (re) { toast({ title: 'Erro ao carregar equipes', description: re.message }) }
      setTeams((reg || []).map((r: any) => r.teams as Team).filter(Boolean))

      const { data: m, error: me } = await supabase.from('matches').select('*').eq('tournament_id', tournamentId).order('scheduled_at', { ascending: true })
      if (me) { toast({ title: 'Erro ao carregar jogos', description: me.message }) }
      setMatches(m || [])
    }
    load()
  }, [tournamentId])

  const teamOptions = useMemo(() => teams.map(t => ({ value: t.id, label: t.name })), [teams])

  if (!tournament) return (
    <div className="min-h-screen bg-background flex items-center justify-center">
      <p className="text-sm text-muted-foreground">Torneio não encontrado</p>
    </div>
  )

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-6 space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold">{tournament.name}</h1>
          <Link to="/tournaments"><Button variant="outline">Voltar</Button></Link>
        </div>

        <div className="grid gap-6 md:grid-cols-3">
          <Card>
            <CardHeader><CardTitle>Informações</CardTitle></CardHeader>
            <CardContent>
              <div className="text-sm space-y-1">
                <div><span className="text-muted-foreground">Local:</span> {tournament.location || '-'}</div>
                <div><span className="text-muted-foreground">Datas:</span> {tournament.start_date || '-'} — {tournament.end_date || '-'}</div>
                <div><span className="text-muted-foreground">Categoria:</span> {tournament.category || '-'}</div>
                <div><span className="text-muted-foreground">Modalidade:</span> {tournament.modality || '-'}</div>
              </div>
            </CardContent>
          </Card>

          <Card className="md:col-span-2">
            <CardHeader><CardTitle>Equipes</CardTitle></CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div className="grid md:grid-cols-2 gap-2">
                  {teams.map(team => (
                    <div key={team.id} className="flex items-center justify-between p-3 border rounded-lg">
                      <div>
                        <div className="font-medium">{team.name}</div>
                        <div className="text-xs text-muted-foreground">{team.player_a} / {team.player_b}</div>
                      </div>
                      <div className="flex gap-2">
                        <Button size="sm" variant="outline" onClick={async () => {
                          // Delete matches involving this team in this tournament, then unlink and delete team
                          await supabase.from('matches').delete().eq('tournament_id', tournament.id).or(`team_a_id.eq.${team.id},team_b_id.eq.${team.id}`)
                          await supabase.from('tournament_teams').delete().eq('tournament_id', tournament.id).eq('team_id', team.id)
                          await supabase.from('teams').delete().eq('id', team.id)
                          const { data: reg } = await supabase.from('tournament_teams').select('teams(*)').eq('tournament_id', tournament.id)
                          setTeams((reg || []).map((r: any) => r.teams as Team).filter(Boolean))
                          toast({ title: 'Dupla removida' })
                        }}>Excluir</Button>
                      </div>
                    </div>
                  ))}
                  {teams.length === 0 && <p className="text-sm text-muted-foreground">Nenhuma equipe.</p>}
                </div>
                <div className="grid md:grid-cols-4 gap-2">
                  <Input placeholder="Nome da dupla" value={teamForm.name} onChange={(e) => setTeamForm({ ...teamForm, name: e.target.value })} />
                  <Input placeholder="Jogador A" value={teamForm.player_a} onChange={(e) => setTeamForm({ ...teamForm, player_a: e.target.value })} />
                  <Input placeholder="Jogador B" value={teamForm.player_b} onChange={(e) => setTeamForm({ ...teamForm, player_b: e.target.value })} />
                  <Button onClick={async () => {
                    if (!teamForm.name || !teamForm.player_a || !teamForm.player_b) { toast({ title: 'Preencha a dupla' }); return }
                    const { data: team, error: terr } = await supabase.from('teams').insert({ name: teamForm.name, player_a: teamForm.player_a, player_b: teamForm.player_b }).select('*').single()
                    if (terr) { toast({ title: 'Erro ao criar', description: terr.message }); return }
                    const { error: rerr } = await supabase.from('tournament_teams').insert({ tournament_id: tournament.id, team_id: team.id })
                    if (rerr) { toast({ title: 'Erro ao vincular', description: rerr.message }); return }
                    const { data: reg } = await supabase.from('tournament_teams').select('teams(*)').eq('tournament_id', tournament.id)
                    setTeams((reg || []).map((r: any) => r.teams as Team).filter(Boolean))
                    setTeamForm({ name: '', player_a: '', player_b: '' })
                    toast({ title: 'Dupla adicionada' })
                  }}>Adicionar</Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader><CardTitle>Jogos</CardTitle></CardHeader>
          <CardContent>
            <div className="space-y-3">
              {matches.map(m => {
                const a = teams.find(t => t.id === m.team_a_id)
                const b = teams.find(t => t.id === m.team_b_id)
                return (
                  <div key={m.id} className="flex items-center justify-between p-3 border rounded-lg">
                    <div className="flex items-center gap-3">
                      <Badge variant="outline">{m.phase || 'Jogo'}</Badge>
                      <div className="font-medium">{a?.name || 'Equipe A'} vs {b?.name || 'Equipe B'}</div>
                      <div className="text-xs text-muted-foreground">{m.status}</div>
                    </div>
                    <div className="flex gap-2">
                      <Select value={m.status || 'scheduled'} onValueChange={async (v) => {
                        await supabase.from('matches').update({ status: v }).eq('id', m.id)
                        setMatches(prev => prev.map(x => x.id === m.id ? { ...x, status: v } : x))
                      }}>
                        <SelectTrigger className="w-[150px] bg-background"><SelectValue placeholder="Status" /></SelectTrigger>
                        <SelectContent className="bg-background border border-border">
                          <SelectItem value="scheduled">Pendente</SelectItem>
                          <SelectItem value="in_progress">Em andamento</SelectItem>
                          <SelectItem value="completed">Finalizado</SelectItem>
                          <SelectItem value="canceled">Cancelado</SelectItem>
                        </SelectContent>
                      </Select>
                      <Link to={`/referee/${m.id}`}><Button size="sm">Mesa</Button></Link>
                      <Link to={`/scoreboard/${m.id}`}><Button size="sm" variant="outline">Placar</Button></Link>
                      <Link to={`/spectator/${m.id}`}><Button size="sm" variant="outline">Torcida</Button></Link>
                      <Button size="sm" variant="destructive" onClick={async () => {
                        if (!confirm('Remover este jogo?')) return;
                        const { error } = await supabase.from('matches').delete().eq('id', m.id)
                        if (error) { toast({ title: 'Erro ao excluir jogo', description: error.message }); return }
                        setMatches(prev => prev.filter(x => x.id !== m.id))
                        toast({ title: 'Jogo removido' })
                      }}>Excluir</Button>
                    </div>
                  </div>
                )
              })}
              {matches.length === 0 && <p className="text-sm text-muted-foreground">Nenhum jogo.</p>}

              <div className="grid md:grid-cols-4 gap-2 pt-2">
                <Select value={matchForm.teamA} onValueChange={v => setMatchForm({ ...matchForm, teamA: v })}>
                  <SelectTrigger className="bg-background"><SelectValue placeholder="Equipe A" /></SelectTrigger>
                  <SelectContent className="bg-background border border-border">
                    {teamOptions.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
                  </SelectContent>
                </Select>
                <Select value={matchForm.teamB} onValueChange={v => setMatchForm({ ...matchForm, teamB: v })}>
                  <SelectTrigger className="bg-background"><SelectValue placeholder="Equipe B" /></SelectTrigger>
                  <SelectContent className="bg-background border border-border">
                    {teamOptions.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
                  </SelectContent>
                </Select>
                <Input type="datetime-local" value={matchForm.scheduled_at} onChange={(e) => setMatchForm({ ...matchForm, scheduled_at: e.target.value })} />
                <Button onClick={async () => {
                  if (!matchForm.teamA || !matchForm.teamB || matchForm.teamA === matchForm.teamB) { toast({ title: 'Selecione equipes diferentes' }); return }
                  const { error } = await supabase.from('matches').insert({
                    tournament_id: tournament.id,
                    team_a_id: matchForm.teamA,
                    team_b_id: matchForm.teamB,
                    scheduled_at: matchForm.scheduled_at || null,
                    status: 'scheduled'
                  })
                  if (error) { toast({ title: 'Erro ao criar jogo', description: error.message }); return }
                  const { data: m } = await supabase.from('matches').select('*').eq('tournament_id', tournament.id).order('scheduled_at', { ascending: true })
                  setMatches(m || [])
                  setMatchForm({ teamA: '', teamB: '', scheduled_at: '' })
                  toast({ title: 'Jogo criado' })
                }}>Criar jogo</Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
