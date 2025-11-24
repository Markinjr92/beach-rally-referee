import { useEffect, useMemo } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Activity, Trophy, Users, Settings, Shield, Gamepad2, BarChart3 } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { Link } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useUserRoles } from "@/hooks/useUserRoles";
import { useAccessExpiration } from "@/hooks/useAccessExpiration";
import { LoginForm } from "@/components/auth/LoginForm";
import { UserMenu } from "@/components/auth/UserMenu";
// Logos VB Jukin
const VB_JUKIN_LOGO = "https://i.postimg.cc/SQHJ2c0V/vb-jukin-logo.png"; // Logo com imagem e escrito
const VB_JUKIN_LOGO_TEXT_ONLY = "https://i.postimg.cc/NFZYK85C/vb-jukin-logo-sem-imagem.png"; // Logo só com escrito

type Role = "atleta" | "publico" | "arbitro" | "admin_sistema" | "organizador";

type ModuleDefinition = {
  key: string;
  title: string;
  description: string;
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
    to: "/tournament-info",
    icon: Trophy,
    roles: ["atleta", "arbitro", "organizador", "admin_sistema"],
    iconClass: "text-yellow-300",
  },
  {
    key: "live-matches",
    title: "Jogos ao vivo",
    description: "Veja todos os confrontos em andamento agora mesmo",
    to: "/live",
    icon: Activity,
    roles: ["publico", "atleta", "arbitro", "organizador", "admin_sistema"],
    iconClass: "text-emerald-300",
  },
  {
    key: "organizer-tools",
    title: "Gestão do Torneio",
    description: "Edite horários, duplas e detalhes das partidas",
    to: "/tournaments",
    icon: Settings,
    roles: ["organizador", "admin_sistema"],
    iconClass: "text-sky-300",
  },
  {
    key: "arbitration",
    title: "Mesa de Arbitragem",
    description: "Controle completo do jogo em tempo real",
    to: "/referee",
    icon: Users,
    roles: ["arbitro", "admin_sistema"],
    iconClass: "text-blue-200",
  },
  {
    key: "admin-users",
    title: "Gerenciar Usuários",
    description: "Acesse a administração e gerencie perfis do sistema",
    to: "/admin/users",
    icon: Shield,
    roles: ["admin_sistema"],
    iconClass: "text-rose-200",
  },
  {
    key: "dashboard",
    title: "Dashboard",
    description: "Estatísticas gerais e métricas do sistema",
    to: "/dashboard",
    icon: BarChart3,
    roles: ["admin_sistema"],
    iconClass: "text-indigo-300",
  },
  {
    key: "casual-matches",
    title: "Jogos Avulsos Arbitragem",
    description: "Crie e gerencie jogos avulsos sem necessidade de torneio",
    to: "/casual-matches",
    icon: Gamepad2,
    roles: ["atleta", "arbitro", "organizador", "admin_sistema", "publico"],
    iconClass: "text-purple-300",
  },
];

const Index = () => {
  const { user, loading, signOut } = useAuth();
  const { roles, loading: rolesLoading, error: rolesError } = useUserRoles(user, loading);
  const { isExpired, expiresAt, daysRemaining, loading: accessLoading } = useAccessExpiration(user, loading);

  const isAdmin = roles.includes("admin_sistema");
  const accessibleModules = useMemo(
    () =>
      MODULE_DEFINITIONS.filter((module) =>
        isAdmin || module.roles.some((role) => roles.includes(role))
      ),
    [isAdmin, roles]
  );

  useEffect(() => {
    if (!user) {
      console.log("[Index] Nenhum usuário autenticado - exibindo tela de login");
      return;
    }

    console.log("[Index] Perfis e módulos acessíveis para o usuário", {
      userId: user.id,
      email: user.email,
      roles,
      accessibleModules: accessibleModules.map((module) => module.key),
    });
  }, [user, roles, accessibleModules]);

  if (loading || (user && rolesLoading) || (user && accessLoading)) {
    return (
      <div className="min-h-screen bg-gradient-ocean flex items-center justify-center">
        <div className="text-white text-xl">Carregando...</div>
      </div>
    );
  }

  // Verificar se o acesso está expirado
  if (user && isExpired) {
    return (
      <div className="min-h-screen bg-gradient-ocean flex items-center justify-center px-4">
        <Card className="w-full max-w-md bg-white/10 border-white/20 text-white">
          <CardHeader>
            <CardTitle className="text-2xl font-bold text-red-400">Acesso Expirado</CardTitle>
            <CardDescription className="text-white/80">
              Seu período de acesso de 15 dias expirou.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-white/90 mb-4">
              Para continuar usando o sistema, entre em contato com o administrador para renovar seu acesso.
            </p>
            <Button
              onClick={async () => {
                await signOut();
              }}
              className="w-full"
            >
              Fazer Logout
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-ocean">
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-8 lg:mb-12">
          {!user ? (
            <div className="flex items-center gap-4">
              <img 
                src={VB_JUKIN_LOGO} 
                alt="VB Jukin" 
                className="h-20 lg:h-28 w-auto object-contain"
              />
            </div>
          ) : (
            <div className="flex items-center gap-4">
              <img 
                src={VB_JUKIN_LOGO} 
                alt="VB Jukin" 
                className="h-16 lg:h-24 w-auto object-contain"
              />
            </div>
          )}
          {user && <UserMenu />}
        </div>

        {!user ? (
          /* Login Section */
          <div className="max-w-7xl mx-auto">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-12 items-center">
              {/* Left: Login Card */}
              <div>
            <LoginForm />
          </div>
              
              {/* Right: Info Section */}
              <div className="text-white space-y-6">
                <div>
                  <h2 className="text-3xl lg:text-4xl font-bold mb-4">
                    Plataforma completa para gestão e transmissão de jogos
                  </h2>
                  <p className="text-lg lg:text-xl opacity-90">
                    Sistema profissional de arbitragem e acompanhamento de vôlei de praia
                  </p>
              </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-8">
                  <div className="bg-white/10 rounded-lg p-6 backdrop-blur-sm border border-white/20">
                    <div className="text-3xl mb-3">🏐</div>
                    <h3 className="font-semibold text-lg mb-2">Controle Completo</h3>
                    <p className="opacity-80 text-sm">
                      Pontuação em tempo real, rotação automática e controle de timeouts
                    </p>
                </div>
                  
                  <div className="bg-white/10 rounded-lg p-6 backdrop-blur-sm border border-white/20">
                    <div className="text-3xl mb-3">📊</div>
                    <h3 className="font-semibold text-lg mb-2">Estatísticas Avançadas</h3>
                    <p className="opacity-80 text-sm">
                      Histórico de eventos, relatórios detalhados e análise de desempenho
                    </p>
                </div>
                  
                  <div className="bg-white/10 rounded-lg p-6 backdrop-blur-sm border border-white/20">
                    <div className="text-3xl mb-3">📺</div>
                    <h3 className="font-semibold text-lg mb-2">Múltiplas Visualizações</h3>
                    <p className="opacity-80 text-sm">
                      Placar para atletas, tela para torcida e mesa de arbitragem
                    </p>
            </div>

                  <div className="bg-white/10 rounded-lg p-6 backdrop-blur-sm border border-white/20">
                    <div className="text-3xl mb-3">⚡</div>
                    <h3 className="font-semibold text-lg mb-2">Tempo Real</h3>
                    <p className="opacity-80 text-sm">
                      Sincronização instantânea e atualizações em tempo real para todos os dispositivos
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <>
            {/* Aviso de acesso próximo de expirar */}
            {user && !isExpired && daysRemaining !== null && daysRemaining <= 3 && daysRemaining > 0 && (
              <div className="max-w-2xl mx-auto mb-6">
                <Alert className="bg-yellow-500/10 text-white border-yellow-400/40">
                  <AlertTitle>Atenção: Acesso próximo de expirar</AlertTitle>
                  <AlertDescription>
                    Seu acesso expira em {daysRemaining} {daysRemaining === 1 ? 'dia' : 'dias'}. 
                    Entre em contato com o administrador para renovar.
                  </AlertDescription>
                </Alert>
              </div>
            )}
            
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
                    <Link
                      to={module.to}
                      key={module.key}
                      className="group focus:outline-none focus-visible:ring-2 focus-visible:ring-white/70 rounded-xl"
                    >
                      <Card className="bg-white/10 border-white/20 text-white transition-colors group-hover:bg-white/20">
                        <CardHeader className="text-center">
                          <Icon className={`mx-auto mb-4 ${module.iconClass}`} size={40} />
                          <CardTitle>{module.title}</CardTitle>
                          <CardDescription className="text-white/80">
                            {module.description}
                          </CardDescription>
                        </CardHeader>
                        <CardContent>
                          <p className="text-sm text-white/70">
                            Clique para abrir este módulo.
                          </p>
                        </CardContent>
                      </Card>
                    </Link>
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
          </>
        )}
      </div>
    </div>
  );
};

export default Index;