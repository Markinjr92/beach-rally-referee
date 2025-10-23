import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Trophy, Users, Monitor, Eye, Settings } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { Link } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useUserRoles } from "@/hooks/useUserRoles";
import { LoginForm } from "@/components/auth/LoginForm";
import { UserMenu } from "@/components/auth/UserMenu";
import { PasswordResetPanel } from "@/components/admin/PasswordResetPanel";
import { AdminUserManagement } from "@/components/admin/AdminUserManagement";

type Role = "atleta" | "publico" | "arbitro" | "admin_sistema" | "organizador";

type ModuleDefinition = {
  key: string;
  title: string;
  description: string;
  actionLabel: string;
  to: string;
  icon: LucideIcon;
  roles: Role[];
  iconClass: string;
};

const MODULE_DEFINITIONS: ModuleDefinition[] = [
  {
    key: "tournament-info",
    title: "Informações do Torneio",
    description: "Consulte jogos, placares e tabelas atualizadas",
    actionLabel: "Acessar",
    to: "/tournaments",
    icon: Trophy,
    roles: ["atleta", "organizador", "admin_sistema"],
    iconClass: "text-yellow-300",
  },
  {
    key: "organizer-tools",
    title: "Gestão do Torneio",
    description: "Edite horários, duplas e detalhes das partidas",
    actionLabel: "Gerenciar",
    to: "/tournaments",
    icon: Settings,
    roles: ["organizador", "admin_sistema"],
    iconClass: "text-sky-300",
  },
  {
    key: "arbitration",
    title: "Mesa de Arbitragem",
    description: "Controle completo do jogo em tempo real",
    actionLabel: "Abrir",
    to: "/referee/game-1",
    icon: Users,
    roles: ["arbitro", "admin_sistema"],
    iconClass: "text-blue-200",
  },
  {
    key: "scoreboard",
    title: "Placar Oficial",
    description: "Visualização limpa para transmissões oficiais",
    actionLabel: "Ver Placar",
    to: "/scoreboard/game-1",
    icon: Monitor,
    roles: ["publico", "admin_sistema"],
    iconClass: "text-green-300",
  },
  {
    key: "spectator",
    title: "Visão da Torcida",
    description: "Experiência imersiva com estatísticas e patrocinadores",
    actionLabel: "Abrir Visão",
    to: "/spectator/game-1",
    icon: Eye,
    roles: ["publico", "admin_sistema"],
    iconClass: "text-purple-300",
  },
];

const Index = () => {
  const { user, loading } = useAuth();
  const { roles, loading: rolesLoading, error: rolesError } = useUserRoles(user, loading);

  const isAdmin = roles.includes("admin_sistema");
  const accessibleModules = MODULE_DEFINITIONS.filter((module) =>
    isAdmin || module.roles.some((role) => roles.includes(role))
  );
  const heroActions = accessibleModules.slice(0, 3);

  if (loading || (user && rolesLoading)) {
    return (
      <div className="min-h-screen bg-gradient-ocean flex items-center justify-center">
        <div className="text-white text-xl">Carregando...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-ocean">
      <div className="container mx-auto px-4 py-12">
        {/* Header with user menu */}
        <div className="flex justify-end mb-8">
          {user && <UserMenu />}
        </div>

        {!user ? (
          /* Login Section */
          <div className="max-w-md mx-auto mb-16">
            <div className="text-center text-white mb-8">
              <div className="flex items-center justify-center gap-4 mb-6">
                <Trophy className="text-yellow-300" size={48} />
                <h1 className="text-4xl font-bold">Vôlei de Praia Pro</h1>
              </div>
              <p className="text-xl opacity-90">
                Sistema completo para gestão e transmissão de jogos de vôlei de praia
              </p>
            </div>
            <LoginForm />
          </div>
        ) : (
          <>
            {/* Hero Section */}
            <div className="text-center text-white mb-16">
              <div className="flex items-center justify-center gap-4 mb-6">
                <Trophy className="text-yellow-300" size={48} />
                <h1 className="text-5xl font-bold">Vôlei de Praia Pro</h1>
              </div>
              {roles.length > 0 && (
                <div className="flex flex-wrap gap-2 justify-center mb-6">
                  {roles.map((role) => (
                    <Badge
                      key={role}
                      variant="outline"
                      className="bg-white/10 text-white border-white/20 uppercase tracking-wide"
                    >
                      {role.replace("_", " ").toUpperCase()}
                    </Badge>
                  ))}
                </div>
              )}
              <p className="text-2xl mb-8 opacity-90">
                {isAdmin
                  ? "Selecione um módulo ou acesse as ferramentas administrativas."
                  : "Escolha um dos módulos disponíveis para o seu perfil."}
              </p>
              <div className="flex flex-wrap gap-4 justify-center">
                {heroActions.length > 0 ? (
                  heroActions.map((module) => {
                    const Icon = module.icon;
                    return (
                      <Link to={module.to} key={module.key}>
                        <Button size="lg" className="bg-white text-primary hover:bg-white/90">
                          <Icon className="mr-2" size={20} />
                          {module.actionLabel}
                        </Button>
                      </Link>
                    );
                  })
                ) : (
                  <div className="text-white/80 text-lg">
                    Nenhum módulo disponível para o seu perfil no momento.
                  </div>
                )}
              </div>
            </div>

            {/* Roles error */}
            {rolesError && (
              <div className="max-w-2xl mx-auto mb-10">
                <Alert variant="destructive" className="bg-red-500/10 text-white border-red-400/40">
                  <AlertTitle>Não foi possível carregar os módulos</AlertTitle>
                  <AlertDescription>
                    {rolesError} — tente recarregar a página ou contacte o administrador.
                  </AlertDescription>
                </Alert>
              </div>
            )}

            {/* Modules Grid */}
            {accessibleModules.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 mb-16">
                {accessibleModules.map((module) => {
                  const Icon = module.icon;
                  return (
                    <Card
                      key={module.key}
                      className="bg-white/10 border-white/20 text-white hover:bg-white/20 transition-colors"
                    >
                      <CardHeader className="text-center">
                        <Icon className={`mx-auto mb-4 ${module.iconClass}`} size={40} />
                        <CardTitle>{module.title}</CardTitle>
                        <CardDescription className="text-white/80">
                          {module.description}
                        </CardDescription>
                      </CardHeader>
                      <CardContent>
                        <Link to={module.to}>
                          <Button variant="outline" className="w-full text-white border-white hover:bg-white/20">
                            {module.actionLabel}
                          </Button>
                        </Link>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            ) : (
              !rolesError && (
                <div className="mb-16">
                  <Card className="bg-white/10 border-white/20 text-white">
                    <CardHeader>
                      <CardTitle>Nenhum módulo habilitado</CardTitle>
                      <CardDescription className="text-white/80">
                        Seu perfil ainda não possui módulos liberados. Entre em contato com o administrador
                        do sistema para solicitar acesso.
                      </CardDescription>
                    </CardHeader>
                  </Card>
                </div>
              )
            )}

            {/* Admin Panel */}
            {isAdmin && (
              <div className="mb-16 space-y-6 lg:space-y-0 lg:grid lg:grid-cols-[minmax(0,1fr)] lg:gap-6 xl:grid-cols-[minmax(0,1fr),minmax(0,2fr)]">
                <div className="flex justify-center lg:justify-start">
                  <PasswordResetPanel />
                </div>
                <AdminUserManagement />
              </div>
            )}

            {/* Features List */}
            <div className="text-center text-white">
              <h2 className="text-3xl font-bold mb-8">Funcionalidades Principais</h2>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-8 text-left">
                <div>
                  <h3 className="text-xl font-semibold mb-4">🏐 Controle Completo</h3>
                  <ul className="space-y-2 opacity-90">
                    <li>• Pontuação em tempo real</li>
                    <li>• Sistema de rotação automática</li>
                    <li>• Controle de timeouts</li>
                    <li>• Troca de quadra automática</li>
                  </ul>
                </div>
                <div>
                  <h3 className="text-xl font-semibold mb-4">📊 Estatísticas Avançadas</h3>
                  <ul className="space-y-2 opacity-90">
                    <li>• Classificação de pontos</li>
                    <li>• Histórico de eventos</li>
                    <li>• Desfazer/Refazer ações</li>
                    <li>• Relatórios detalhados</li>
                  </ul>
                </div>
                <div>
                  <h3 className="text-xl font-semibold mb-4">📺 Múltiplas Visualizações</h3>
                  <ul className="space-y-2 opacity-90">
                    <li>• Placar para atletas</li>
                    <li>• Tela para torcida</li>
                    <li>• Mesa de arbitragem</li>
                    <li>• Integração de patrocinadores</li>
                  </ul>
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default Index;