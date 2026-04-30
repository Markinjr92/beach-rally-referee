import { useMemo, useState } from 'react'
import { Link, Navigate } from 'react-router-dom'
import { ArrowLeft, Database, ListChecks, Rocket } from 'lucide-react'

import { useAuth } from '@/hooks/useAuth'
import { useUserRoles } from '@/hooks/useUserRoles'
import { useToast } from '@/hooks/use-toast'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

const SystemData = () => {
  const { user, loading: authLoading } = useAuth()
  const { roles, loading: rolesLoading } = useUserRoles(user, authLoading)
  const { toast } = useToast()
  const [deploying, setDeploying] = useState(false)

  const isAdminSistema = useMemo(() => roles.includes('admin_sistema'), [roles])
  const deployWebhookUrl = import.meta.env.VITE_DEPLOY_WEBHOOK_URL as string | undefined
  const deployToken = import.meta.env.VITE_DEPLOY_WEBHOOK_TOKEN as string | undefined

  const handleDeploy = async () => {
    if (!deployWebhookUrl) {
      toast({
        title: 'Deploy não configurado',
        description: 'Defina VITE_DEPLOY_WEBHOOK_URL para habilitar o deploy.',
        variant: 'destructive',
      })
      return
    }

    setDeploying(true)

    try {
      const response = await fetch(deployWebhookUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(deployToken ? { Authorization: `Bearer ${deployToken}` } : {}),
        },
        body: JSON.stringify({
          source: 'system-data-admin',
          action: 'deploy-beach-rally.sh',
        }),
      })

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`)
      }

      toast({
        title: 'Deploy acionado',
        description: 'O comando deploy-beach-rally.sh foi solicitado com sucesso.',
      })
    } catch (error) {
      toast({
        title: 'Falha ao acionar deploy',
        description: error instanceof Error ? error.message : 'Erro inesperado.',
        variant: 'destructive',
      })
    } finally {
      setDeploying(false)
    }
  }

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
        <Link to="/">
          <Button
            variant="ghost"
            className="bg-white/10 border border-white/20 text-white hover:bg-white/20 hover:text-white backdrop-blur-md"
          >
            <ArrowLeft size={18} />
            Voltar
          </Button>
        </Link>

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

          <Card className="bg-white/10 border-white/20 text-white h-full">
            <CardHeader>
              <Rocket className="h-10 w-10 text-cyan-300 mb-2" />
              <CardTitle>DEPLOY MAIN (LOCAL)</CardTitle>
              <CardDescription className="text-white/80">
                Aciona o endpoint de deploy no servidor para executar o script deploy-beach-rally.sh.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-sm text-white/70">
                Disponível apenas para administrador do sistema.
              </p>
              <Button
                onClick={handleDeploy}
                disabled={deploying}
                className="w-full bg-cyan-500 hover:bg-cyan-400 text-slate-900 font-semibold"
              >
                {deploying ? 'Executando deploy...' : 'Rodar deploy da main'}
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}

export default SystemData
