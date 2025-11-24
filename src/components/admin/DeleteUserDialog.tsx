import { useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, AlertTriangle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

type DeleteUserDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userId: string;
  userName: string;
  userEmail: string;
  onSuccess: () => void;
};

export const DeleteUserDialog = ({
  open,
  onOpenChange,
  userId,
  userName,
  userEmail,
  onSuccess,
}: DeleteUserDialogProps) => {
  const [isDeleting, setIsDeleting] = useState(false);
  const { toast } = useToast();

  const handleDelete = async () => {
    setIsDeleting(true);
    try {
      const { data: result, error } = await supabase.functions.invoke("admin-delete-user", {
        body: {
          userId,
        },
      });

      if (error || !result?.ok) {
        throw new Error(result?.message || "Erro ao excluir usuário");
      }

      toast({
        title: "Usuário excluído",
        description: "O usuário foi excluído com sucesso.",
      });

      onSuccess();
      onOpenChange(false);
    } catch (error: any) {
      console.error("Erro ao excluir usuário:", error);
      toast({
        title: "Erro ao excluir usuário",
        description: error.message || "Não foi possível excluir o usuário.",
        variant: "destructive",
      });
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-destructive" />
            Excluir Usuário
          </DialogTitle>
          <DialogDescription>
            Esta ação não pode ser desfeita. O usuário será permanentemente excluído do sistema.
          </DialogDescription>
        </DialogHeader>
        <div className="py-4">
          <div className="space-y-2">
            <p className="text-sm font-medium">Você está prestes a excluir:</p>
            <div className="rounded-lg border bg-muted p-3 space-y-1">
              <p className="text-sm font-semibold">{userName || "Sem nome"}</p>
              <p className="text-sm text-muted-foreground">{userEmail}</p>
            </div>
            <p className="text-sm text-muted-foreground">
              Todos os dados relacionados a este usuário serão removidos permanentemente.
            </p>
          </div>
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={isDeleting}>
            Cancelar
          </Button>
          <Button type="button" variant="destructive" onClick={handleDelete} disabled={isDeleting}>
            {isDeleting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Excluir Usuário
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

