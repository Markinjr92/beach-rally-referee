import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Loader2, RefreshCw, Shield, UserPlus, Edit, KeyRound, Trash2 } from "lucide-react";
import { UserFormDialog } from "./UserFormDialog";
import { ResetPasswordDialog } from "./ResetPasswordDialog";
import { DeleteUserDialog } from "./DeleteUserDialog";

type AdminListUser = {
  user_id: string;
  email: string | null;
  name: string | null;
  roles: string[];
  is_active?: boolean;
  access_expires_at?: string | null;
};

export const AdminUserManagement = () => {
  const [users, setUsers] = useState<AdminListUser[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [showUserDialog, setShowUserDialog] = useState(false);
  const [showPasswordDialog, setShowPasswordDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
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

    // Verificar se há sessão antes de carregar dados
    const { data: { session }, error: sessionError } = await supabase.auth.getSession();
    
    if (sessionError || !session) {
      console.error("Erro de sessão:", sessionError);
      handleError("Você precisa estar autenticado para acessar esta página. Por favor, faça login novamente.");
      setUsers([]);
      setIsLoading(false);
      return;
    }

    const { data: hasPermission, error: permissionError } = await supabase.rpc("user_has_permission", {
      user_uuid: session.user.id,
      permission_name: "user.manage",
    });

    if (permissionError || !hasPermission) {
      console.error("Erro ao validar permissão de administração", permissionError);
      handleError("Você não tem permissão para acessar esta funcionalidade.");
      setUsers([]);
      setIsLoading(false);
      return;
    }

    const { data: usersData, error: usersError } = await supabase
      .from("users")
      .select("id, email, name, is_active, access_expires_at")
      .order("email", { ascending: true });

    if (usersError) {
      console.error("Erro ao carregar usuários:", usersError);
      handleError(usersError.message);
      setUsers([]);
      setIsLoading(false);
      return;
    }

    const { data: userRoles, error: rolesError } = await supabase
      .from("user_roles")
      .select("user_id, roles(name)");

    if (rolesError) {
      console.error("Erro ao carregar roles dos usuários:", rolesError);
      handleError(rolesError.message);
      setUsers([]);
      setIsLoading(false);
      return;
    }

    const rolesByUser = new Map<string, string[]>();

    for (const row of userRoles ?? []) {
      const roleData = row.roles as { name?: string } | { name?: string }[] | null;
      const roleName = Array.isArray(roleData) ? roleData[0]?.name : roleData?.name;
      if (!roleName) continue;

      const existing = rolesByUser.get(row.user_id) ?? [];
      if (!existing.includes(roleName)) {
        existing.push(roleName);
        rolesByUser.set(row.user_id, existing);
      }
    }

    const normalizedUsers: AdminListUser[] = (usersData ?? []).map((user) => ({
      user_id: user.id,
      email: user.email ?? null,
      name: user.name ?? null,
      roles: rolesByUser.get(user.id) ?? [],
      is_active: typeof user.is_active === "boolean" ? user.is_active : true,
      access_expires_at: user.access_expires_at ?? null,
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

  const handleDeleteUser = (user: AdminListUser) => {
    setSelectedUser(user);
    setShowDeleteDialog(true);
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
                  <TableHead>Acesso</TableHead>
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
                      {user.access_expires_at ? (
                        <Badge variant={new Date(user.access_expires_at) < new Date() ? "destructive" : "secondary"}>
                          {new Date(user.access_expires_at) < new Date()
                            ? "Expirado"
                            : `Até ${new Date(user.access_expires_at).toLocaleDateString("pt-BR")}`}
                        </Badge>
                      ) : (
                        <Badge variant="default">Permanente</Badge>
                      )}
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
                          title="Editar usuário"
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleResetPassword(user)}
                          title="Redefinir senha"
                        >
                          <KeyRound className="h-4 w-4" />
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleDeleteUser(user)}
                          title="Excluir usuário"
                          className="text-destructive hover:text-destructive hover:bg-destructive/10"
                        >
                          <Trash2 className="h-4 w-4" />
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
        accessExpiresAt: selectedUser.access_expires_at,
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

    <DeleteUserDialog
      open={showDeleteDialog}
      onOpenChange={setShowDeleteDialog}
      userId={selectedUser?.user_id || ""}
      userName={selectedUser?.name || ""}
      userEmail={selectedUser?.email || ""}
      onSuccess={handleSuccess}
    />
    </>
  );
};
