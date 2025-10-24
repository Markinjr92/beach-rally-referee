import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Loader2, RefreshCw, Shield } from "lucide-react";

type AdminListUser = {
  user_id: string;
  email: string | null;
  name: string | null;
  roles: string[];
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

    setUsers(data.users);
    setIsLoading(false);
  }, [handleError]);

  useEffect(() => {
    void fetchUsers();
  }, [fetchUsers]);

  return (
    <Card className="bg-white">
      <CardHeader className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            Administração de Usuários
          </CardTitle>
          <CardDescription>
            Visualize os usuários cadastrados e suas permissões principais.
          </CardDescription>
        </div>
        <Button type="button" variant="outline" onClick={() => void fetchUsers()} disabled={isLoading}>
          {isLoading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <span className="flex items-center">
              <RefreshCw className="mr-2 h-4 w-4" />
              Atualizar
            </span>
          )}
        </Button>
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
                  <TableHead>Perfis</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {users.map((user) => (
                  <TableRow key={user.user_id}>
                    <TableCell className="font-medium">{user.email ?? "-"}</TableCell>
                    <TableCell>{user.name ?? "-"}</TableCell>
                    <TableCell>
                      {user.roles.length === 0 ? (
                        <Badge variant="outline" className="uppercase text-xs text-muted-foreground">
                          sem roles
                        </Badge>
                      ) : (
                        <div className="flex flex-wrap gap-1">
                          {user.roles.map((role) => (
                            <Badge key={role} variant="secondary" className="uppercase text-xs">
                              {role}
                            </Badge>
                          ))}
                        </div>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
