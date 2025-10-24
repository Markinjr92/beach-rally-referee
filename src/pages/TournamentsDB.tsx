import { useEffect, useMemo, useState } from "react"
import { Link } from "react-router-dom"
import { ArrowLeft, Calendar, MapPin, Plus, Trophy } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { useToast } from "@/components/ui/use-toast"
import { supabase } from "@/integrations/supabase/client"
import { Tables } from "@/integrations/supabase/types"
import { cn } from "@/lib/utils"
import { useAuth } from "@/hooks/useAuth"

type Tournament = Tables<'tournaments'>

export default function TournamentsDB() {
  const [tournaments, setTournaments] = useState<Tournament[]>([])
  const [statusFilter, setStatusFilter] = useState<'active' | 'completed' | 'all'>('active')
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState({
    name: "",
    location: "",
    start: "",
    end: "",
    category: "",
    modality: "",
    hasStatistics: true,
  })
  const { toast } = useToast()
  const { user } = useAuth()

  useEffect(() => {
    const load = async () => {
      const { data, error } = await supabase.from('tournaments').select('*').order('created_at', { ascending: false })
      if (error) toast({ title: 'Erro ao carregar torneios', description: error.message })
      setTournaments(data || [])
    }
    load()
  }, [toast])

  const createTournament = async () => {
    if (!user) {
      toast({ title: "Faça login para criar um torneio" })
      return
    }
    if (!form.name) {
      toast({ title: "Informe o nome do torneio" })
      return
    }
    const { error } = await supabase.from("tournaments").insert({
      name: form.name,
      location: form.location || null,
      start_date: form.start || null,
      end_date: form.end || null,
      category: form.category || null,
      modality: form.modality || null,
      status: "active",
      has_statistics: form.hasStatistics,
      created_by: user.id,
    })
    if (error) {
      toast({ title: "Erro ao criar", description: error.message })
      return
    }
    const { data } = await supabase
      .from("tournaments")
      .select("*")
      .order("created_at", { ascending: false })
    setTournaments(data || [])
    setOpen(false)
    setForm({ name: "", location: "", start: "", end: "", category: "", modality: "", hasStatistics: true })
    toast({ title: "Torneio criado" })
  }

  const filteredTournaments = useMemo(() => {
    return tournaments.filter((tournament) => {
      if (statusFilter === 'completed') return tournament.status === 'completed'
      if (statusFilter === 'all') return true
      return tournament.status !== 'completed'
    })
  }, [statusFilter, tournaments])

  return (
    <div className="min-h-screen bg-gradient-ocean text-white">
      <div className="container mx-auto px-4 py-12">
        <div className="mb-12 flex flex-col gap-6">
          <div className="flex items-center justify-between gap-4">
            <Link to="/">
              <Button
                variant="ghost"
                className="bg-white/10 border border-white/20 text-white hover:bg-white/20 hover:text-white backdrop-blur-md"
              >
                <ArrowLeft size={18} />
                Voltar
              </Button>
            </Link>
            <div className="hidden md:flex items-center gap-2 text-white/70">
              <Trophy className="text-yellow-300" size={20} />
              <span>Gestão completa dos seus torneios oficiais</span>
            </div>
          </div>

          <div className="text-center space-y-6">
            <div className="inline-flex items-center gap-3 px-6 py-3 rounded-full bg-white/10 border border-white/20 backdrop-blur-lg">
              <Trophy className="text-yellow-300" size={28} />
              <div className="text-left">
                <p className="text-xs uppercase tracking-[0.3em] text-white/60">Circuito profissional</p>
                <h1 className="text-3xl sm:text-4xl font-semibold">Central de Torneios</h1>
              </div>
            </div>
            <p className="text-lg text-white/80 max-w-2xl mx-auto">
              Crie novas etapas, visualize informações e mantenha a organização da temporada com um visual inspirado na arena principal.
            </p>
          </div>
        </div>

        <div className="mb-12 flex flex-wrap gap-4 justify-center">
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button className="flex items-center gap-2 bg-white/15 border border-white/20 text-white hover:bg-white/25">
                <Plus size={20} />
                Criar Novo Torneio
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-md bg-slate-900/80 text-white border-white/20 backdrop-blur-xl">
              <DialogHeader>
                <DialogTitle className="text-2xl font-semibold">Criar Novo Torneio</DialogTitle>
                <DialogDescription className="text-white/70">
                  Preencha as informações do torneio
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <Label className="text-white">Nome</Label>
                  <Input
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    className="bg-white/10 border-white/20 text-white placeholder:text-white/60 focus-visible:ring-white/60"
                    placeholder="Ex: Campeonato Brasileiro 2024"
                  />
                </div>
                <div>
                  <Label className="text-white">Local</Label>
                  <Input
                    value={form.location}
                    onChange={(e) => setForm({ ...form, location: e.target.value })}
                    className="bg-white/10 border-white/20 text-white placeholder:text-white/60 focus-visible:ring-white/60"
                    placeholder="Ex: Copacabana, Rio de Janeiro"
                  />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <Label className="text-white">Início</Label>
                    <Input
                      type="date"
                      value={form.start}
                      onChange={(e) => setForm({ ...form, start: e.target.value })}
                      className="bg-white/10 border-white/20 text-white placeholder:text-white/60 focus-visible:ring-white/60"
                    />
                  </div>
                  <div>
                    <Label className="text-white">Fim</Label>
                    <Input
                      type="date"
                      value={form.end}
                      onChange={(e) => setForm({ ...form, end: e.target.value })}
                      className="bg-white/10 border-white/20 text-white placeholder:text-white/60 focus-visible:ring-white/60"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <Label className="text-white">Categoria</Label>
                    <Select value={form.category} onValueChange={(value) => setForm({ ...form, category: value })}>
                      <SelectTrigger className="bg-white/10 border-white/20 text-white focus:ring-white/60 focus:ring-offset-0">
                        <SelectValue placeholder="Selecione a categoria" />
                      </SelectTrigger>
                      <SelectContent className="bg-slate-900/90 text-white border-white/20">
                        <SelectItem value="M" className="focus:bg-white/10 focus:text-white">
                          Masculino
                        </SelectItem>
                        <SelectItem value="F" className="focus:bg-white/10 focus:text-white">
                          Feminino
                        </SelectItem>
                        <SelectItem value="Misto" className="focus:bg-white/10 focus:text-white">Misto</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className="text-white">Modalidade</Label>
                    <Select value={form.modality} onValueChange={(value) => setForm({ ...form, modality: value })}>
                      <SelectTrigger className="bg-white/10 border-white/20 text-white focus:ring-white/60 focus:ring-offset-0">
                        <SelectValue placeholder="Selecione a modalidade" />
                      </SelectTrigger>
                      <SelectContent className="bg-slate-900/90 text-white border-white/20">
                        <SelectItem value="dupla" className="focus:bg-white/10 focus:text-white">Dupla</SelectItem>
                        <SelectItem value="quarteto" className="focus:bg-white/10 focus:text-white">Quarteto</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="flex items-center justify-between gap-4 rounded-lg border border-white/15 bg-white/5 px-4 py-3">
                  <div className="space-y-1">
                    <Label className="text-white">Registrar estatísticas</Label>
                    <p className="text-xs text-white/60">
                      Controle detalhado de pontos por categoria durante as partidas.
                    </p>
                  </div>
                  <Switch
                    checked={form.hasStatistics}
                    onCheckedChange={(checked) => setForm({ ...form, hasStatistics: checked })}
                    className="data-[state=checked]:bg-yellow-400"
                  />
                </div>
                <div className="flex gap-2 justify-end pt-4">
                  <Button
                    variant="ghost"
                    onClick={() => setOpen(false)}
                    className="bg-white/5 border border-white/20 text-white hover:bg-white/15"
                  >
                    Cancelar
                  </Button>
                  <Button onClick={createTournament} className="bg-yellow-400/90 text-slate-900 hover:bg-yellow-300">
                    Criar
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
          <div className="flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-4 py-2 text-sm text-white/80">
            <span className="text-white/70">Filtrar por status:</span>
            <Select value={statusFilter} onValueChange={(value) => setStatusFilter(value as 'active' | 'completed' | 'all')}>
              <SelectTrigger className="w-[160px] border-white/30 bg-white/5 text-white focus:ring-white/60 focus:ring-offset-0">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent className="border-white/20 bg-slate-900/90 text-white">
                <SelectItem value="active" className="focus:bg-white/10 focus:text-white">
                  Ativos
                </SelectItem>
                <SelectItem value="completed" className="focus:bg-white/10 focus:text-white">
                  Finalizados
                </SelectItem>
                <SelectItem value="all" className="focus:bg-white/10 focus:text-white">
                  Todos
                </SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {filteredTournaments.map((tournament) => {
            const statusStyles =
              tournament.status === "active"
                ? "bg-emerald-400/15 text-emerald-50 border-emerald-200/40"
                : tournament.status === "completed"
                ? "bg-white/10 text-white border-white/20"
                : "bg-amber-400/15 text-amber-50 border-amber-200/40"

            return (
              <Card
                key={tournament.id}
                className="bg-white/10 border-white/20 text-white backdrop-blur-xl transition-all hover:bg-white/15 hover:-translate-y-1"
              >
                <CardHeader>
                  <div className="flex items-start justify-between gap-4">
                    <div className="space-y-2">
                      <CardTitle className="text-2xl font-semibold leading-tight">{tournament.name}</CardTitle>
                      <CardDescription className="flex items-center gap-2 text-white/70">
                        <MapPin size={16} className="text-white/60" />
                        {tournament.location || "Local a definir"}
                      </CardDescription>
                      <CardDescription className="flex items-center gap-2 text-white/70">
                        <Calendar size={16} className="text-white/60" />
                        {tournament.start_date ? new Date(tournament.start_date).toLocaleDateString("pt-BR") : "-"}
                        <span className="text-white/40">até</span>
                        {tournament.end_date ? new Date(tournament.end_date).toLocaleDateString("pt-BR") : "-"}
                      </CardDescription>
                    </div>
                    <Badge variant="outline" className={cn("uppercase tracking-wide", statusStyles)}>
                      {tournament.status === "active"
                        ? "Ativo"
                        : tournament.status === "completed"
                        ? "Finalizado"
                        : "Em breve"}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="flex items-center gap-2 text-sm text-white/70">
                      <Trophy size={16} className="text-yellow-300" />
                      <span>Torneio oficial</span>
                    </div>

                    <div className="flex flex-wrap gap-2">
                      <Link to={`/tournament/${tournament.id}`} className="flex-1 min-w-[140px]">
                        <Button className="w-full bg-yellow-400/90 text-slate-900 hover:bg-yellow-300">Ver Torneio</Button>
                      </Link>
                      {tournament.status !== 'completed' && (
                        <Button
                          variant="outline"
                          size="sm"
                          className="flex items-center gap-1 border-white/40 bg-white/10 text-white hover:bg-white/20"
                          onClick={async () => {
                            if (!confirm('Finalizar este torneio?')) return
                            const { error } = await supabase
                              .from('tournaments')
                              .update({ status: 'completed' })
                              .eq('id', tournament.id)
                            if (error) {
                              toast({ title: 'Erro ao finalizar', description: error.message })
                              return
                            }
                            setTournaments((prev) =>
                              prev.map((item) =>
                                item.id === tournament.id ? { ...item, status: 'completed' } : item
                              )
                            )
                            toast({ title: 'Torneio finalizado' })
                          }}
                        >
                          Finalizar
                        </Button>
                      )}
                      <Button
                        variant="ghost"
                        size="sm"
                        className="flex items-center gap-1 bg-white/10 border border-white/20 text-white hover:bg-white/20"
                        onClick={async () => {
                          if (!confirm("Tem certeza que deseja apagar este torneio? Esta ação removerá jogos e inscrições."))
                            return
                          const { error } = await supabase.from("tournaments").delete().eq("id", tournament.id)
                          if (error) {
                            toast({ title: "Erro ao deletar", description: error.message })
                            return
                          }
                          setTournaments((prev) => prev.filter((x) => x.id !== tournament.id))
                          toast({ title: "Torneio removido" })
                        }}
                      >
                        Excluir
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>

        {filteredTournaments.length === 0 && (
          <div className="text-center py-16">
            <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full border border-dashed border-white/40 bg-white/10">
              <Trophy className="text-yellow-300" size={40} />
            </div>
            <h3 className="text-2xl font-semibold text-white mb-2">Nenhum torneio encontrado</h3>
            <p className="text-white/70 max-w-xl mx-auto">
              Ajuste o filtro de status ou crie um novo torneio para iniciar o planejamento da temporada.
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
