import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { supabase } from "@/integrations/supabase/client";
import { Loader2 } from "lucide-react";

const userSchema = z.object({
  name: z.string().min(1, "Nome é obrigatório"),
  email: z.string().email("Email inválido"),
  password: z.string().min(6, "Mínimo 6 caracteres").optional(),
  roleIds: z.array(z.string()),
  isActive: z.boolean().default(true),
});

type UserFormData = z.infer<typeof userSchema>;

type Role = {
  id: string;
  name: string;
  description: string | null;
};

type UserFormDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userId?: string;
  userData?: {
    name: string;
    email: string;
    roles: string[];
    isActive?: boolean;
  };
  onSuccess: () => void;
};

export const UserFormDialog = ({
  open,
  onOpenChange,
  userId,
  userData,
  onSuccess,
}: UserFormDialogProps) => {
  const [roles, setRoles] = useState<Role[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const isEdit = !!userId;

  const form = useForm<UserFormData>({
    resolver: zodResolver(userSchema),
    defaultValues: {
      name: "",
      email: "",
      password: "",
      roleIds: [],
      isActive: true,
    },
  });

  useEffect(() => {
    const fetchRoles = async () => {
      const { data } = await supabase.from("roles").select("*").order("name");
      if (data) setRoles(data);
    };
    void fetchRoles();
  }, []);

  useEffect(() => {
    if (userData && isEdit) {
      // Buscar role IDs
      const fetchUserRoles = async () => {
        const { data: userRoles } = await supabase
          .from("user_roles")
          .select("role_id")
          .eq("user_id", userId);
        
        const roleIds = userRoles?.map(ur => ur.role_id) || [];
        
        form.reset({
          name: userData.name,
          email: userData.email,
          password: "",
          roleIds,
          isActive: userData.isActive ?? true,
        });
      };
      void fetchUserRoles();
    } else {
      form.reset({
        name: "",
        email: "",
        password: "",
        roleIds: [],
        isActive: true,
      });
    }
  }, [userData, isEdit, userId, form]);

  const onSubmit = async (data: UserFormData) => {
    setIsSubmitting(true);
    try {
      const functionName = isEdit ? "admin-update-user" : "admin-create-user";
      const body = isEdit
        ? {
            userId,
            name: data.name,
            email: data.email,
            roleIds: data.roleIds,
            isActive: data.isActive,
          }
        : {
            email: data.email,
            password: data.password,
            name: data.name,
            roleIds: data.roleIds,
          };

      const { data: result, error } = await supabase.functions.invoke(functionName, { body });

      if (error || !result?.ok) {
        throw new Error(result?.message || "Erro ao processar");
      }

      onSuccess();
      onOpenChange(false);
    } catch (error) {
      console.error("Erro:", error);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Editar Usuário" : "Criar Usuário"}</DialogTitle>
          <DialogDescription>
            {isEdit ? "Atualize as informações do usuário" : "Adicione um novo usuário ao sistema"}
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Nome</FormLabel>
                  <FormControl>
                    <Input {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="email"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Email</FormLabel>
                  <FormControl>
                    <Input type="email" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            {!isEdit && (
              <FormField
                control={form.control}
                name="password"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Senha</FormLabel>
                    <FormControl>
                      <Input type="password" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}
            <FormField
              control={form.control}
              name="isActive"
              render={({ field }) => (
                <FormItem className="flex items-center space-x-2">
                  <FormControl>
                    <Checkbox
                      checked={field.value}
                      onCheckedChange={field.onChange}
                    />
                  </FormControl>
                  <FormLabel className="!mt-0">Usuário ativo</FormLabel>
                </FormItem>
              )}
            />
            <div className="space-y-2">
              <FormLabel>Permissões</FormLabel>
              <div className="space-y-2 max-h-40 overflow-y-auto border rounded p-2">
                {roles.map((role) => (
                  <FormField
                    key={role.id}
                    control={form.control}
                    name="roleIds"
                    render={({ field }) => (
                      <FormItem className="flex items-center space-x-2">
                        <FormControl>
                          <Checkbox
                            checked={field.value.includes(role.id)}
                            onCheckedChange={(checked) => {
                              const newValue = checked
                                ? [...field.value, role.id]
                                : field.value.filter((id) => id !== role.id);
                              field.onChange(newValue);
                            }}
                          />
                        </FormControl>
                        <FormLabel className="!mt-0 font-normal">
                          {role.name}
                          {role.description && (
                            <span className="text-xs text-muted-foreground ml-1">
                              ({role.description})
                            </span>
                          )}
                        </FormLabel>
                      </FormItem>
                    )}
                  />
                ))}
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {isEdit ? "Salvar" : "Criar"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
};
