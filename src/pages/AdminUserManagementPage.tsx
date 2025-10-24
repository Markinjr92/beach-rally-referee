import { useEffect } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useUserRoles } from "@/hooks/useUserRoles";
import { LoginForm } from "@/components/auth/LoginForm";
import { UserMenu } from "@/components/auth/UserMenu";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { AdminUserManagement } from "@/components/admin/AdminUserManagement";

const AdminUserManagementPage = () => {
  const { user, loading } = useAuth();
  const {
    roles,
    loading: rolesLoading,
    error: rolesError,
    refresh,
  } = useUserRoles(user, loading);

  useEffect(() => {
    if (user && !loading && !rolesLoading && roles.length === 0) {
      refresh();
    }
  }, [loading, rolesLoading, roles.length, refresh, user]);

  const isAdmin = roles.includes("admin_sistema");

  if (loading || rolesLoading) {
    return (
      <div className="min-h-screen bg-gradient-ocean flex items-center justify-center">
        <div className="text-white text-xl">Carregando...</div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-gradient-ocean flex items-center justify-center px-4">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle>Faça login para acessar a administração</CardTitle>
            <CardDescription>
              É necessário estar autenticado com uma conta administrativa.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <LoginForm />
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="min-h-screen bg-gradient-ocean flex items-center justify-center px-4">
        <Card className="w-full max-w-lg bg-white/10 border-white/20 text-white">
          <CardHeader>
            <CardTitle>Acesso restrito</CardTitle>
            <CardDescription className="text-white/80">
              Você não possui permissão para acessar a administração de usuários.
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-ocean">
      <div className="container mx-auto px-4 py-12 space-y-10">
        <div className="flex flex-col gap-6 text-white">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <Link to="/tournaments" className="w-fit">
              <Button
                variant="ghost"
                className="bg-white/10 border border-white/20 text-white hover:bg-white/20 hover:text-white backdrop-blur-md"
              >
                <ArrowLeft className="mr-2" size={18} />
                Voltar
              </Button>
            </Link>
            <div className="self-start lg:self-auto">
              <UserMenu />
            </div>
          </div>
          <div>
            <h1 className="text-4xl font-bold text-white">Administração de Usuários</h1>
            <p className="text-white/80 text-lg mt-2">
              Visualize os usuários do sistema e confirme se as permissões estão configuradas corretamente.
            </p>
          </div>
        </div>

        {rolesError && (
          <Alert variant="destructive" className="bg-red-500/10 text-white border-red-400/40">
            <AlertTitle>Erro ao carregar permissões</AlertTitle>
            <AlertDescription>{rolesError}</AlertDescription>
          </Alert>
        )}

        <div className="grid gap-6">
          <AdminUserManagement />
        </div>
      </div>
    </div>
  );
};

export default AdminUserManagementPage;
