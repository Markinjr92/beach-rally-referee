import { useCallback, useEffect, useState } from 'react';
import type { User } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2, Pencil, Search, Shield, UserCog } from 'lucide-react';

interface ManagedUser extends User {
  user_metadata: Record<string, any>;
}

const formatDateTime = (value?: string | null) => {
  if (!value) return 'Nunca';
  const date = new Date(value);
  return new Intl.DateTimeFormat('pt-BR', {
    dateStyle: 'short',
    timeStyle: 'short',
  }).format(date);
};

export const AdminUserManagement = () => {
  const [users, setUsers] = useState<ManagedUser[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedUser, setSelectedUser] = useState<ManagedUser | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [editForm, setEditForm] = useState({
    email: '',
    name: '',
    phone: '',
  });
  const { toast } = useToast();

  const fetchUsers = useCallback(async (query?: string) => {
    setIsLoading(true);
    const { data, error } = await supabase.functions.invoke<{ users?: ManagedUser[] }>('admin-user-management', {
      body: {
        action: query ? 'search' : 'list',
        query,
      },
    });

    if (error) {
      console.error('Erro ao buscar usuários', error);
      toast({
        title: 'Erro ao buscar usuários',
        description: error.message,
        variant: 'destructive',
      });
      setUsers([]);
    } else {
      setUsers(data?.users ?? []);
    }

    setIsLoading(false);
  }, [toast]);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  const openEditDialog = (user: ManagedUser) => {
    setSelectedUser(user);
    setEditForm({
      email: user.email ?? '',
      name: (user.user_metadata?.name as string) ?? (user.user_metadata?.full_name as string) ?? '',
      phone: (user.user_metadata?.phone as string) ?? '',
    });
    setIsDialogOpen(true);
  };

  const handleUpdateUser = async () => {
    if (!selectedUser) return;

    setIsSaving(true);
    const { error, data } = await supabase.functions.invoke<{ user: ManagedUser }>('admin-user-management', {
      body: {
        action: 'update',
        userId: selectedUser.id,
        updates: {
          email: editForm.email,
          user_metadata: {
            ...selectedUser.user_metadata,
            name: editForm.name,
            full_name: editForm.name,
            phone: editForm.phone,
          },
        },
      },
    });

    if (error || !data?.user) {
      console.error('Erro ao atualizar usuário', error);
      toast({
        title: 'Erro ao salvar',
        description: error?.message ?? 'Não foi possível atualizar o usuário.',
        variant: 'destructive',
      });
    } else {
      const updatedUser = data.user;
      setUsers((prev) => prev.map((user) => (user.id === updatedUser.id ? updatedUser : user)));
      toast({
        title: 'Usuário atualizado',
        description: 'As informações foram salvas com sucesso.',
      });
      setIsDialogOpen(false);
    }

    setIsSaving(false);
  };

  const handleResetPassword = async (user: ManagedUser) => {
    const newPassword = window.prompt(`Defina uma nova senha para ${user.email}`);
    if (!newPassword) {
      return;
    }

    const { error } = await supabase.functions.invoke('admin-user-management', {
      body: {
        action: 'reset_password',
        userId: user.id,
        newPassword,
      },
    });

    if (error) {
      console.error('Erro ao resetar senha', error);
      toast({
        title: 'Erro ao resetar senha',
        description: error.message,
        variant: 'destructive',
      });
    } else {
      toast({
        title: 'Senha redefinida',
        description: `A senha de ${user.email} foi atualizada.`,
      });
    }
  };

  const onSearchSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    await fetchUsers(searchTerm.trim() || undefined);
  };

  return (
    <Card className="bg-white">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Shield className="h-5 w-5" />
          Administração de Usuários
        </CardTitle>
        <CardDescription>
          Pesquise, edite e redefina a senha dos usuários do sistema
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <form onSubmit={onSearchSubmit} className="flex flex-col gap-3 sm:flex-row">
          <div className="flex-1">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                className="pl-10"
                placeholder="Buscar por email ou nome"
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
              />
            </div>
          </div>
          <div className="flex gap-2">
            <Button type="submit" disabled={isLoading}>
              {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Buscar'}
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setSearchTerm('');
                fetchUsers();
              }}
            >
              Limpar
            </Button>
          </div>
        </form>

        {isLoading && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Carregando usuários...
          </div>
        )}

        {users.length === 0 && !isLoading ? (
          <Alert>
            <AlertDescription>Nenhum usuário encontrado para o filtro informado.</AlertDescription>
          </Alert>
        ) : (
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Email</TableHead>
                  <TableHead>Nome</TableHead>
                  <TableHead>Último acesso</TableHead>
                  <TableHead className="hidden lg:table-cell">Criado em</TableHead>
                  <TableHead>Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {users.map((user) => (
                  <TableRow key={user.id}>
                    <TableCell className="font-medium">{user.email}</TableCell>
                    <TableCell>
                      {user.user_metadata?.name || user.user_metadata?.full_name || '-'}
                      {user.user_metadata?.role && (
                        <div className="mt-1">
                          <Badge variant="secondary" className="uppercase text-xs">
                            {user.user_metadata.role as string}
                          </Badge>
                        </div>
                      )}
                    </TableCell>
                    <TableCell>{formatDateTime(user.last_sign_in_at)}</TableCell>
                    <TableCell className="hidden lg:table-cell">{formatDateTime(user.created_at)}</TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-2">
                        <Button variant="outline" size="sm" onClick={() => openEditDialog(user)}>
                          <Pencil className="h-3.5 w-3.5 mr-2" />
                          Editar
                        </Button>
                        <Button variant="secondary" size="sm" onClick={() => handleResetPassword(user)}>
                          <UserCog className="h-3.5 w-3.5 mr-2" />
                          Resetar Senha
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

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Editar usuário</DialogTitle>
            <DialogDescription>Atualize as informações básicas deste usuário.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={editForm.email}
                onChange={(event) => setEditForm((prev) => ({ ...prev, email: event.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="name">Nome</Label>
              <Input
                id="name"
                value={editForm.name}
                onChange={(event) => setEditForm((prev) => ({ ...prev, name: event.target.value }))}
                placeholder="Nome completo"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="phone">Telefone</Label>
              <Input
                id="phone"
                value={editForm.phone}
                onChange={(event) => setEditForm((prev) => ({ ...prev, phone: event.target.value }))}
                placeholder="(00) 00000-0000"
              />
            </div>
          </div>
          <DialogFooter className="flex flex-col sm:flex-row sm:justify-end sm:space-x-2">
            <Button variant="outline" type="button" onClick={() => setIsDialogOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleUpdateUser} disabled={isSaving}>
              {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Salvar alterações'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
};
