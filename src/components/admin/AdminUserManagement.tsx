import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Loader2, RefreshCw, Shield, UserPlus, Edit, KeyRound } from "lucide-react";
import { UserFormDialog } from "./UserFormDialog";
import { ResetPasswordDialog } from "./ResetPasswordDialog";

type AdminListUser = {
  user_id: string;
  email: string | null;
  name: string | null;
  roles: string[];
  is_active?: boolean;
};

type AdminUserManagementResponse = {
  ok: boolean;
  users?: AdminListUser[];
  message?: string;
};

export const AdminUserManagement = () => {
  const [users, setUsers] = useState<AdminListUser[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [showUserDialog, setShowUserDialog] = useState(false);
  const [showPasswordDialog, setShowPasswordDialog] = useState(false);
  const [selectedUser, setSelectedUser] = useState<AdminListUser | null>(null);
  const { toast } = useToast();

  const handleError = useCallback(
    (message?: string) => {
      const friendlyMessage = "Não foi possível carregar os usuários. Verifique CORS/Autenticação.";
      setErrorMessage(message ?? friendlyMessage);
      toast({
        title: "Erro ao carregar usuários",
        description: friendlyMessage,
        variant: "destructive",
      });
    },
    [toast],
  );

  const fetchUsers = useCallback(async () => {
    setIsLoading(true);
    setErrorMessage(null);

    const { data, error } = await supabase.functions.invoke<AdminUserManagementResponse>(
      "admin-user-management",
      {
        body: { action: "list-users" },
      },
    );

    if (error) {
      console.error("Erro ao chamar a função admin-user-management", error);
      handleError(error.message);
      setUsers([]);
      setIsLoading(false);
      return;
    }

    if (!data?.ok || !Array.isArray(data.users)) {
      console.error("Resposta inesperada da função admin-user-management", data);
      handleError(data?.message);
      setUsers([]);
      setIsLoading(false);
      return;
    }

    // Normalize API response: ensure we always have user_id for keys/edit/reset
    const apiUsers = (data.users as any[]) ?? [];
    const normalizedUsers: AdminListUser[] = apiUsers.map((u) => ({
      user_id: u.user_id ?? u.id,
      email: u.email ?? null,
      name: u.name ?? null,
      roles: Array.isArray(u.roles) ? u.roles : [],
      is_active: typeof u.is_active === "boolean" ? u.is_active : true,
    }));

    setUsers(normalizedUsers);
    setIsLoading(false);
  }, [handleError]);

  const handleCreateUser = () => {
    setSelectedUser(null);
    setShowUserDialog(true);
  };

  const handleEditUser = (user: AdminListUser) => {
    setSelectedUser(user);
    setShowUserDialog(true);
  };

  const handleResetPassword = (user: AdminListUser) => {
    setSelectedUser(user);
    setShowPasswordDialog(true);
  };

  const handleSuccess = () => {
    toast({
      title: "Sucesso",
      description: "Operação realizada com sucesso",
    });
    void fetchUsers();
  };

  useEffect(() => {
    void fetchUsers();
  }, [fetchUsers]);

  return (
    <>
      <Card className="bg-white">
        <CardHeader className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5" />
              Administração de Usuários
            </CardTitle>
            <CardDescription>
              Gerencie usuários, permissões e senhas do sistema.
            </CardDescription>
          </div>
          <div className="flex gap-2">
            <Button type="button" onClick={handleCreateUser}>
              <UserPlus className="mr-2 h-4 w-4" />
              Criar Usuário
            </Button>
            <Button type="button" variant="outline" onClick={() => void fetchUsers()} disabled={isLoading}>
              {isLoading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <RefreshCw className="h-4 w-4" />
              )}
            </Button>
          </div>
        </CardHeader>
      <CardContent className="space-y-4">
        {errorMessage && (
          <Alert variant="destructive">
            <AlertDescription>{errorMessage}</AlertDescription>
          </Alert>
        )}

        {isLoading ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Carregando usuários...
          </div>
        ) : users.length === 0 ? (
          <Alert>
            <AlertDescription>Nenhum usuário encontrado.</AlertDescription>
          </Alert>
        ) : (
          <div className="overflow-x-auto rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Email</TableHead>
                  <TableHead>Nome</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Perfis</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {users.map((user, index) => (
                  <TableRow key={user.user_id || user.email || String(index)}>
                    <TableCell className="font-medium">{user.email ?? "-"}</TableCell>
                    <TableCell>{user.name ?? "-"}</TableCell>
                    <TableCell>
                      <Badge variant={user.is_active ? "default" : "secondary"}>
                        {user.is_active ? "Ativo" : "Inativo"}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {user.roles.length === 0 ? (
                        <Badge variant="outline" className="uppercase text-xs text-muted-foreground">
                          sem roles
                        </Badge>
                      ) : (
                        <div className="flex flex-wrap gap-1">
                          {user.roles.map((role, index) => (
                            <Badge key={`${role}-${index}`} variant="secondary" className="uppercase text-xs">
                              {role}
                            </Badge>
                          ))}
                        </div>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleEditUser(user)}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleResetPassword(user)}
                        >
                          <KeyRound className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>

    <UserFormDialog
      open={showUserDialog}
      onOpenChange={setShowUserDialog}
      userId={selectedUser?.user_id}
      userData={selectedUser ? {
        name: selectedUser.name || "",
        email: selectedUser.email || "",
        roles: selectedUser.roles,
        isActive: selectedUser.is_active,
      } : undefined}
      onSuccess={handleSuccess}
    />

    <ResetPasswordDialog
      open={showPasswordDialog}
      onOpenChange={setShowPasswordDialog}
      userId={selectedUser?.user_id || ""}
      userName={selectedUser?.name || selectedUser?.email || ""}
      onSuccess={handleSuccess}
    />
    </>
  );
};
