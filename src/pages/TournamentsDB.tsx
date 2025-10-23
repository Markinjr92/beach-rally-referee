import { useEffect, useState } from 'react'
import { supabase } from '@/integrations/supabase/client'
import { Tables } from '@/integrations/supabase/types'
import { Link } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { useToast } from '@/components/ui/use-toast'

type Tournament = Tables<'tournaments'>

export default function TournamentsDB() {
  const [tournaments, setTournaments] = useState<Tournament[]>([])
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState({ name: '', location: '', start: '', end: '', category: '', modality: '' })
  const { toast } = useToast()

  useEffect(() => {
    const load = async () => {
      const { data, error } = await supabase.from('tournaments').select('*').order('created_at', { ascending: false })
      if (error) toast({ title: 'Erro ao carregar torneios', description: error.message })
      setTournaments(data || [])
    }
    load()
  }, [])

  const createTournament = async () => {
    if (!form.name) { toast({ title: 'Informe o nome do torneio' }); return }
    const { error } = await supabase.from('tournaments').insert({
      name: form.name,
      location: form.location || null,
      start_date: form.start || null,
      end_date: form.end || null,
      category: form.category || null,
      modality: form.modality || null,
      status: 'active'
    })
    if (error) { toast({ title: 'Erro ao criar', description: error.message }); return }
    const { data } = await supabase.from('tournaments').select('*').order('created_at', { ascending: false })
    setTournaments(data || [])
    setOpen(false)
    setForm({ name: '', location: '', start: '', end: '', category: '', modality: '' })
    toast({ title: 'Torneio criado' })
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold">Torneios</h1>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button>Novo Torneio</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Criar Novo Torneio</DialogTitle>
                <DialogDescription>Preencha as informações do torneio</DialogDescription>
              </DialogHeader>
              <div className="space-y-3">
                <div>
                  <Label>Nome</Label>
                  <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
                </div>
                <div>
                  <Label>Local</Label>
                  <Input value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label>Início</Label>
                    <Input type="date" value={form.start} onChange={(e) => setForm({ ...form, start: e.target.value })} />
                  </div>
                  <div>
                    <Label>Fim</Label>
                    <Input type="date" value={form.end} onChange={(e) => setForm({ ...form, end: e.target.value })} />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label>Categoria</Label>
                    <Input placeholder="M/F/Misto" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} />
                  </div>
                  <div>
                    <Label>Modalidade</Label>
                    <Input placeholder="dupla" value={form.modality} onChange={(e) => setForm({ ...form, modality: e.target.value })} />
                  </div>
                </div>
                <div className="flex gap-2 justify-end">
                  <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
                  <Button onClick={createTournament}>Criar</Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </div>
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {tournaments.map(t => (
            <Card key={t.id}>
              <CardHeader>
                <CardTitle>{t.name}</CardTitle>
                <CardDescription>{t.location || '-'}</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-between gap-2">
                  <Badge variant={t.status === 'active' ? 'default' : 'secondary'}>{t.status || 'upcoming'}</Badge>
                  <Link to={`/tournament/${t.id}`}><Button size="sm">Abrir</Button></Link>
                  <Button size="sm" variant="outline" onClick={async () => {
                    if (!confirm('Tem certeza que deseja apagar este torneio? Esta ação removerá jogos e inscrições.')) return;
                    const { error } = await supabase.from('tournaments').delete().eq('id', t.id)
                    if (error) { toast({ title: 'Erro ao deletar', description: error.message }); return }
                    setTournaments(prev => prev.filter(x => x.id !== t.id))
                    toast({ title: 'Torneio removido' })
                  }}>Excluir</Button>
                </div>
              </CardContent>
            </Card>
          ))}
          {tournaments.length === 0 && (
            <p className="text-sm text-muted-foreground">Nenhum torneio cadastrado.</p>
          )}
        </div>
      </div>
    </div>
  )
}
