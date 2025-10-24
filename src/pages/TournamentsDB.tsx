import { useEffect, useState } from "react"
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
import { useToast } from "@/components/ui/use-toast"
import { supabase } from "@/integrations/supabase/client"
import { Tables } from "@/integrations/supabase/types"
import { cn } from "@/lib/utils"

type Tournament = Tables<'tournaments'>

export default function TournamentsDB() {
  const [tournaments, setTournaments] = useState<Tournament[]>([])
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState({ name: "", location: "", start: "", end: "", category: "", modality: "" })
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
    setForm({ name: "", location: "", start: "", end: "", category: "", modality: "" })
    toast({ title: "Torneio criado" })
  }

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
                    <Input
                      value={form.category}
                      onChange={(e) => setForm({ ...form, category: e.target.value })}
                      placeholder="M/F/Misto"
                      className="bg-white/10 border-white/20 text-white placeholder:text-white/60 focus-visible:ring-white/60"
                    />
                  </div>
                  <div>
                    <Label className="text-white">Modalidade</Label>
                    <Input
                      value={form.modality}
                      onChange={(e) => setForm({ ...form, modality: e.target.value })}
                      placeholder="dupla"
                      className="bg-white/10 border-white/20 text-white placeholder:text-white/60 focus-visible:ring-white/60"
                    />
                  </div>
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
        </div>

        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {tournaments.map((tournament) => {
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

        {tournaments.length === 0 && (
          <div className="text-center py-16">
            <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full border border-dashed border-white/40 bg-white/10">
              <Trophy className="text-yellow-300" size={40} />
            </div>
            <h3 className="text-2xl font-semibold text-white mb-2">Nenhum torneio cadastrado</h3>
            <p className="text-white/70 max-w-xl mx-auto">
              Crie um novo torneio para iniciar o planejamento da temporada e mantenha todas as etapas organizadas em um só lugar.
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
