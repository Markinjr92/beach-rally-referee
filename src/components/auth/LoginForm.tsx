import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/components/ui/use-toast';
import { LogIn, UserPlus, Loader2, AlertCircle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { ResetPasswordDialog } from './ResetPasswordDialog';

export const LoginForm = () => {
  const { signIn, signUp } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [checkingCpf, setCheckingCpf] = useState(false);
  const [cpfExists, setCpfExists] = useState<{ exists: boolean; email?: string; name?: string } | null>(null);
  const [showResetDialog, setShowResetDialog] = useState(false);
  
  // Login form state
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  
  // Signup form state
  const [signupEmail, setSignupEmail] = useState('');
  const [signupPassword, setSignupPassword] = useState('');
  const [signupName, setSignupName] = useState('');
  const [signupCpf, setSignupCpf] = useState('');
  const [signupPhone, setSignupPhone] = useState('');

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    
    await signIn(loginEmail, loginPassword);
    
    setLoading(false);
  };

  const handleCpfBlur = async () => {
    const cpfNumbers = signupCpf.replace(/\D/g, '');
    
    if (!cpfNumbers || cpfNumbers.length !== 11) {
      setCpfExists(null);
      return;
    }

    setCheckingCpf(true);
    try {
      const { data, error } = await supabase.functions.invoke('check-cpf-exists', {
        body: { cpf: cpfNumbers },
      });

      if (error) {
        console.error('Erro ao verificar CPF:', error);
        setCpfExists(null);
        return;
      }

      if (data?.exists) {
        setCpfExists({
          exists: true,
          email: data.email,
          name: data.name,
        });
      } else {
        setCpfExists({ exists: false });
      }
    } catch (error) {
      console.error('Erro ao verificar CPF:', error);
      setCpfExists(null);
    } finally {
      setCheckingCpf(false);
    }
  };

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Remover máscaras antes de enviar (apenas números)
    const cpfNumbers = signupCpf.replace(/\D/g, '');
    const phoneNumbers = signupPhone.replace(/\D/g, '');
    
    // Validação de CPF e telefone
    if (!cpfNumbers || cpfNumbers.length !== 11) {
      toast({
        title: 'CPF inválido',
        description: 'CPF deve conter 11 dígitos',
        variant: 'destructive',
      });
      return;
    }
    if (!phoneNumbers || phoneNumbers.length < 10) {
      toast({
        title: 'Telefone inválido',
        description: 'Telefone deve conter pelo menos 10 dígitos',
        variant: 'destructive',
      });
      return;
    }

    // Verificar se CPF já existe
    if (cpfExists?.exists) {
      toast({
        title: 'CPF já cadastrado',
        description: 'Este CPF já possui cadastro no sistema.',
        variant: 'destructive',
      });
      return;
    }

    // Se não verificou ainda, verificar agora
    if (cpfExists === null) {
      await handleCpfBlur();
      // Aguardar um pouco para o estado atualizar
      await new Promise(resolve => setTimeout(resolve, 500));
      
      // Verificar novamente após a verificação
      const cpfNumbersCheck = signupCpf.replace(/\D/g, '');
      const { data: checkData } = await supabase.functions.invoke('check-cpf-exists', {
        body: { cpf: cpfNumbersCheck },
      });

      if (checkData?.exists) {
        setCpfExists({
          exists: true,
          email: checkData.email,
          name: checkData.name,
        });
        toast({
          title: 'CPF já cadastrado',
          description: 'Este CPF já possui cadastro no sistema.',
          variant: 'destructive',
        });
        return;
      }
    }
    
    setLoading(true);
    
    const result = await signUp(signupEmail, signupPassword, signupName, cpfNumbers, phoneNumbers);
    
    if (!result.error) {
      // Limpar formulário após sucesso
      setSignupEmail('');
      setSignupPassword('');
      setSignupName('');
      setSignupCpf('');
      setSignupPhone('');
      setCpfExists(null);
    }
    
    setLoading(false);
  };

  return (
    <Card className="w-full max-w-md mx-auto bg-card/80 backdrop-blur-sm border-border/50">
      <CardHeader className="text-center">
        <CardTitle className="text-2xl font-bold">Acesso ao Sistema</CardTitle>
        <CardDescription>
          Entre ou cadastre-se para acessar o sistema de vôlei de praia
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="login" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="login">Entrar</TabsTrigger>
            <TabsTrigger value="signup">Cadastrar</TabsTrigger>
          </TabsList>
          
          <TabsContent value="login">
            <form onSubmit={handleLogin} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="login-email">Email</Label>
                <Input
                  id="login-email"
                  type="email"
                  value={loginEmail}
                  onChange={(e) => setLoginEmail(e.target.value)}
                  placeholder="seu@email.com"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="login-password">Senha</Label>
                <Input
                  id="login-password"
                  type="password"
                  value={loginPassword}
                  onChange={(e) => setLoginPassword(e.target.value)}
                  placeholder="Digite sua senha"
                  required
                />
              </div>
              <Button 
                type="submit" 
                className="w-full" 
                disabled={loading}
              >
                {loading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Entrando...
                  </>
                ) : (
                  <>
                    <LogIn className="mr-2 h-4 w-4" />
                    Entrar
                  </>
                )}
              </Button>
            </form>
          </TabsContent>
          
          <TabsContent value="signup">
            <form onSubmit={handleSignup} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="signup-name">Nome</Label>
                <Input
                  id="signup-name"
                  type="text"
                  value={signupName}
                  onChange={(e) => setSignupName(e.target.value)}
                  placeholder="Seu nome completo"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="signup-email">Email</Label>
                <Input
                  id="signup-email"
                  type="email"
                  value={signupEmail}
                  onChange={(e) => setSignupEmail(e.target.value)}
                  placeholder="seu@email.com"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="signup-password">Senha</Label>
                <Input
                  id="signup-password"
                  type="password"
                  value={signupPassword}
                  onChange={(e) => setSignupPassword(e.target.value)}
                  placeholder="Crie uma senha"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="signup-cpf">CPF <span className="text-red-500">*</span></Label>
                <Input
                  id="signup-cpf"
                  type="text"
                  value={signupCpf}
                  onChange={(e) => {
                    const value = e.target.value.replace(/\D/g, '');
                    if (value.length <= 11) {
                      // Aplicar máscara de CPF
                      let masked = value;
                      if (value.length > 9) {
                        masked = value.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
                      } else if (value.length > 6) {
                        masked = value.replace(/(\d{3})(\d{3})(\d{0,3})/, '$1.$2.$3');
                      } else if (value.length > 3) {
                        masked = value.replace(/(\d{3})(\d{0,3})/, '$1.$2');
                      }
                      setSignupCpf(masked);
                      // Limpar estado de verificação quando CPF muda
                      if (cpfExists) {
                        setCpfExists(null);
                      }
                    }
                  }}
                  onBlur={handleCpfBlur}
                  placeholder="000.000.000-00"
                  maxLength={14}
                  required
                  className={cpfExists?.exists ? 'border-red-500' : ''}
                />
                {checkingCpf && (
                  <p className="text-xs text-muted-foreground">Verificando CPF...</p>
                )}
                {cpfExists?.exists && (
                  <Alert className="bg-yellow-500/10 text-white border-yellow-400/40">
                    <AlertCircle className="h-4 w-4" />
                    <AlertTitle>CPF já cadastrado</AlertTitle>
                    <AlertDescription className="text-sm">
                      Este CPF já possui cadastro com o email: <strong>{cpfExists.email}</strong>
                      <br />
                      <Button
                        type="button"
                        variant="link"
                        className="p-0 h-auto text-yellow-400 hover:text-yellow-300 underline mt-1"
                        onClick={() => setShowResetDialog(true)}
                      >
                        Esqueceu a senha? Clique aqui para resetar
                      </Button>
                    </AlertDescription>
                  </Alert>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="signup-phone">Telefone <span className="text-red-500">*</span></Label>
                <Input
                  id="signup-phone"
                  type="text"
                  value={signupPhone}
                  onChange={(e) => {
                    const value = e.target.value.replace(/\D/g, '');
                    if (value.length <= 11) {
                      // Aplicar máscara de telefone
                      let masked = value;
                      if (value.length >= 11) {
                        masked = value.replace(/(\d{2})(\d{5})(\d{4})/, '($1) $2-$3');
                      } else if (value.length >= 7) {
                        masked = value.replace(/(\d{2})(\d{4})(\d{0,4})/, '($1) $2-$3');
                      } else if (value.length >= 3) {
                        masked = value.replace(/(\d{2})(\d{0,5})/, '($1) $2');
                      }
                      setSignupPhone(masked);
                    }
                  }}
                  placeholder="(00) 00000-0000"
                  maxLength={15}
                  required
                />
              </div>
              <Button 
                type="submit" 
                className="w-full" 
                disabled={loading}
              >
                {loading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Cadastrando...
                  </>
                ) : (
                  <>
                    <UserPlus className="mr-2 h-4 w-4" />
                    Cadastrar
                  </>
                )}
              </Button>
            </form>
          </TabsContent>
        </Tabs>
      </CardContent>
      
      {cpfExists?.exists && cpfExists.email && (
        <ResetPasswordDialog
          open={showResetDialog}
          onOpenChange={setShowResetDialog}
          email={cpfExists.email}
        />
      )}
    </Card>
  );
};