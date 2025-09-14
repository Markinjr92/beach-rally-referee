import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Trophy, Users, Monitor, Eye, Settings } from "lucide-react";
import { Link } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { LoginForm } from "@/components/auth/LoginForm";
import { UserMenu } from "@/components/auth/UserMenu";
import { PasswordResetPanel } from "@/components/admin/PasswordResetPanel";

const Index = () => {
  const { user, loading } = useAuth();

  if (loading) {
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
              <p className="text-2xl mb-8 opacity-90">
                Sistema completo para gestão e transmissão de jogos de vôlei de praia
              </p>
              <div className="flex flex-wrap gap-4 justify-center">
                <Link to="/tournaments">
                  <Button size="lg" className="bg-white text-primary hover:bg-white/90">
                    <Trophy className="mr-2" size={20} />
                    Ver Torneios
                  </Button>
                </Link>
              </div>
            </div>

            {/* Features Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-16">
              <Card className="bg-white/10 border-white/20 text-white hover:bg-white/20 transition-colors">
                <CardHeader className="text-center">
                  <Trophy className="mx-auto mb-4 text-yellow-300" size={40} />
                  <CardTitle>Torneios</CardTitle>
                  <CardDescription className="text-white/80">
                    Gerencie torneios e acompanhe jogos em andamento
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <Link to="/tournaments">
                    <Button variant="outline" className="w-full text-white border-white hover:bg-white/20">
                      Acessar
                    </Button>
                  </Link>
                </CardContent>
              </Card>

              <Card className="bg-white/10 border-white/20 text-white hover:bg-white/20 transition-colors">
                <CardHeader className="text-center">
                  <Settings className="mx-auto mb-4 text-blue-300" size={40} />
                  <CardTitle>Mesa de Arbitragem</CardTitle>
                  <CardDescription className="text-white/80">
                    Controle completo do jogo em tempo real
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <Link to="/referee/game-1">
                    <Button variant="outline" className="w-full text-white border-white hover:bg-white/20">
                      Demo
                    </Button>
                  </Link>
                </CardContent>
              </Card>

              <Card className="bg-white/10 border-white/20 text-white hover:bg-white/20 transition-colors">
                <CardHeader className="text-center">
                  <Monitor className="mx-auto mb-4 text-green-300" size={40} />
                  <CardTitle>Placar Oficial</CardTitle>
                  <CardDescription className="text-white/80">
                    Visualização limpa para atletas e árbitros
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <Link to="/scoreboard/game-1">
                    <Button variant="outline" className="w-full text-white border-white hover:bg-white/20">
                      Ver Demo
                    </Button>
                  </Link>
                </CardContent>
              </Card>

              <Card className="bg-white/10 border-white/20 text-white hover:bg-white/20 transition-colors">
                <CardHeader className="text-center">
                  <Eye className="mx-auto mb-4 text-purple-300" size={40} />
                  <CardTitle>Visão da Torcida</CardTitle>
                  <CardDescription className="text-white/80">
                    Experiência rica com estatísticas e patrocinadores
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <Link to="/spectator/game-1">
                    <Button variant="outline" className="w-full text-white border-white hover:bg-white/20">
                      Ver Demo
                    </Button>
                  </Link>
                </CardContent>
              </Card>
            </div>

            {/* Admin Panel */}
            <div className="mb-16">
              <PasswordResetPanel />
            </div>

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