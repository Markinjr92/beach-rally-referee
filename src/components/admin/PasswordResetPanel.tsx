import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Shield, AlertTriangle } from 'lucide-react';

export const PasswordResetPanel = () => {
  const [newPassword, setNewPassword] = useState('admin');
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const { toast } = useToast();

  const handleResetAllPasswords = async () => {
    if (!newPassword.trim()) {
      toast({
        title: "Erro",
        description: "Por favor, insira uma nova senha",
        variant: "destructive"
      });
      return;
    }

    setIsLoading(true);
    setResult(null);

    try {
      const { data, error } = await supabase.functions.invoke('reset-all-passwords', {
        body: { newPassword }
      });

      if (error) {
        console.error('Error calling reset function:', error);
        toast({
          title: "Erro",
          description: error.message || "Falha ao resetar senhas",
          variant: "destructive"
        });
        return;
      }

      setResult(data);
      toast({
        title: "Sucesso",
        description: `Senhas resetadas para ${data.successful?.length || 0} usuários`,
      });

    } catch (error: any) {
      console.error('Unexpected error:', error);
      toast({
        title: "Erro",
        description: "Erro inesperado ao resetar senhas",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Card className="w-full max-w-md mx-auto">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Shield className="h-5 w-5" />
          Reset de Senhas em Massa
        </CardTitle>
        <CardDescription>
          Resetar a senha de todos os usuários do sistema
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <Alert>
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            <strong>Atenção:</strong> Esta ação afetará todos os usuários do sistema. 
            Use apenas em ambiente de desenvolvimento.
          </AlertDescription>
        </Alert>

        <div className="space-y-2">
          <Label htmlFor="newPassword">Nova Senha Padrão</Label>
          <Input
            id="newPassword"
            type="text"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            placeholder="Digite a nova senha padrão"
          />
        </div>

        <Button 
          onClick={handleResetAllPasswords}
          disabled={isLoading}
          className="w-full"
          variant="destructive"
        >
          {isLoading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Resetando...
            </>
          ) : (
            'Resetar Todas as Senhas'
          )}
        </Button>

        {result && (
          <Alert>
            <AlertDescription>
              <div className="space-y-2">
                <p><strong>Resultado:</strong></p>
                <p>✅ Sucessos: {result.successful?.length || 0}</p>
                <p>❌ Falhas: {result.failed?.length || 0}</p>
                <p>📊 Total processado: {result.totalProcessed || 0}</p>
                
                {result.failed?.length > 0 && (
                  <details className="mt-2">
                    <summary className="cursor-pointer text-sm text-muted-foreground">
                      Ver falhas
                    </summary>
                    <div className="mt-1 space-y-1">
                      {result.failed.map((failure: any, index: number) => (
                        <p key={index} className="text-xs text-destructive">
                          {failure.email}: {failure.error}
                        </p>
                      ))}
                    </div>
                  </details>
                )}
              </div>
            </AlertDescription>
          </Alert>
        )}
      </CardContent>
    </Card>
  );
};