import { useMemo } from 'react'
import { Link, Navigate } from 'react-router-dom'
import { Database, ListChecks } from 'lucide-react'

import { useAuth } from '@/hooks/useAuth'
import { useUserRoles } from '@/hooks/useUserRoles'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

const SystemData = () => {
  const { user, loading: authLoading } = useAuth()
  const { roles, loading: rolesLoading } = useUserRoles(user, authLoading)

  const isAdminSistema = useMemo(() => roles.includes('admin_sistema'), [roles])

  if (authLoading || rolesLoading) {
    return (
      <div className="min-h-screen bg-gradient-ocean flex items-center justify-center">
        <div className="text-white text-xl">Carregando dados do sistema...</div>
      </div>
    )
  }

  if (!user || !isAdminSistema) {
    return <Navigate to="/" replace />
  }

  return (
    <div className="min-h-screen bg-gradient-ocean">
      <div className="container mx-auto px-4 py-8 space-y-6">
        <div className="flex items-center gap-3 text-white">
          <Database className="h-8 w-8 text-cyan-200" />
          <div>
            <h1 className="text-3xl font-bold">Dados do Sistema</h1>
            <p className="text-white/80">Ferramentas administrativas para consulta e exportação.</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          <Link
            to="/system-data/all-games"
            className="group focus:outline-none focus-visible:ring-2 focus-visible:ring-white/70 rounded-xl"
          >
            <Card className="bg-white/10 border-white/20 text-white transition-colors group-hover:bg-white/20 h-full">
              <CardHeader>
                <ListChecks className="h-10 w-10 text-emerald-300 mb-2" />
                <CardTitle>TODOS JOGOS</CardTitle>
                <CardDescription className="text-white/80">
                  Busque partidas de todos os torneios, filtre por período e exporte em Excel.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-white/70">Clique para abrir o painel.</p>
              </CardContent>
            </Card>
          </Link>
        </div>
      </div>
    </div>
  )
}

export default SystemData
