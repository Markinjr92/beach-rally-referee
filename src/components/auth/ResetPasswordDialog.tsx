import { useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/components/ui/use-toast';
import { Loader2, Lock } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

interface ResetPasswordDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  email: string;
}

export const ResetPasswordDialog = ({ open, onOpenChange, email }: ResetPasswordDialogProps) => {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState<'credentials' | 'password'>('credentials');
  
  // Credentials step
  const [cpf, setCpf] = useState('');
  const [phone, setPhone] = useState('');
  
  // Password step
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const formatCpf = (value: string) => {
    const numbers = value.replace(/\D/g, '');
    if (numbers.length <= 11) {
      if (numbers.length > 9) {
        return numbers.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
      } else if (numbers.length > 6) {
        return numbers.replace(/(\d{3})(\d{3})(\d{0,3})/, '$1.$2.$3');
      } else if (numbers.length > 3) {
        return numbers.replace(/(\d{3})(\d{0,3})/, '$1.$2');
      }
    }
    return numbers;
  };

  const formatPhone = (value: string) => {
    const numbers = value.replace(/\D/g, '');
    if (numbers.length <= 11) {
      if (numbers.length >= 11) {
        return numbers.replace(/(\d{2})(\d{5})(\d{4})/, '($1) $2-$3');
      } else if (numbers.length >= 7) {
        return numbers.replace(/(\d{2})(\d{4})(\d{0,4})/, '($1) $2-$3');
      } else if (numbers.length >= 3) {
        return numbers.replace(/(\d{2})(\d{0,5})/, '($1) $2');
      }
    }
    return numbers;
  };

  const handleValidateCredentials = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const cpfNumbers = cpf.replace(/\D/g, '');
    const phoneNumbers = phone.replace(/\D/g, '');

    if (!cpfNumbers || cpfNumbers.length !== 11) {
      toast({
        title: 'CPF inválido',
        description: 'O CPF deve conter 11 dígitos.',
        variant: 'destructive',
      });
      return;
    }

    if (!phoneNumbers || phoneNumbers.length < 10) {
      toast({
        title: 'Telefone inválido',
        description: 'O telefone deve conter pelo menos 10 dígitos.',
        variant: 'destructive',
      });
      return;
    }

    setLoading(true);
    try {
      // Validar credenciais (a validação real será feita no reset)
      // Por enquanto, apenas avançar para o próximo passo
      setStep('password');
    } catch (error) {
      console.error('Erro ao validar credenciais:', error);
      toast({
        title: 'Erro',
        description: 'Não foi possível validar as credenciais.',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();

    if (newPassword.length < 8) {
      toast({
        title: 'Senha inválida',
        description: 'A senha deve ter no mínimo 8 caracteres.',
        variant: 'destructive',
      });
      return;
    }

    if (newPassword !== confirmPassword) {
      toast({
        title: 'Senhas não conferem',
        description: 'As senhas informadas não são iguais.',
        variant: 'destructive',
      });
      return;
    }

    setLoading(true);
    try {
      const cpfNumbers = cpf.replace(/\D/g, '');
      const phoneNumbers = phone.replace(/\D/g, '');

      const { data, error } = await supabase.functions.invoke('reset-password-by-credentials', {
        body: {
          email: email.toLowerCase(),
          cpf: cpfNumbers,
          phone: phoneNumbers,
          newPassword,
        },
      });

      if (error) {
        throw new Error(error.message || 'Erro ao resetar senha');
      }

      if (!data?.ok) {
        throw new Error(data?.message || 'Erro ao resetar senha');
      }

      toast({
        title: 'Senha resetada',
        description: 'Sua senha foi alterada com sucesso. Você já pode fazer login.',
      });

      // Fechar dialog e resetar formulário
      onOpenChange(false);
      setStep('credentials');
      setCpf('');
      setPhone('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (error: any) {
      console.error('Erro ao resetar senha:', error);
      toast({
        title: 'Erro ao resetar senha',
        description: error.message || 'Não foi possível resetar a senha. Verifique os dados informados.',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    if (!loading) {
      onOpenChange(false);
      // Resetar formulário ao fechar
      setTimeout(() => {
        setStep('credentials');
        setCpf('');
        setPhone('');
        setNewPassword('');
        setConfirmPassword('');
      }, 200);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="bg-gradient-to-br from-slate-800 via-slate-700 to-slate-800 border-slate-300/30 text-white">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Lock className="h-5 w-5" />
            Resetar Senha
          </DialogTitle>
          <DialogDescription className="text-slate-200/90">
            {step === 'credentials' 
              ? 'Confirme seus dados para resetar a senha'
              : 'Defina sua nova senha'}
          </DialogDescription>
        </DialogHeader>

        {step === 'credentials' ? (
          <form onSubmit={handleValidateCredentials} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="reset-email" className="text-slate-200/90">Email</Label>
              <Input
                id="reset-email"
                type="email"
                value={email}
                disabled
                className="bg-slate-600/60 border-slate-400/50 text-white/50 cursor-not-allowed"
              />
              <p className="text-xs text-slate-400">Email cadastrado: {email}</p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="reset-cpf" className="text-slate-200/90">CPF <span className="text-red-400">*</span></Label>
              <Input
                id="reset-cpf"
                type="text"
                value={cpf}
                onChange={(e) => {
                  const formatted = formatCpf(e.target.value);
                  setCpf(formatted);
                }}
                placeholder="000.000.000-00"
                maxLength={14}
                required
                className="bg-slate-600/60 border-slate-400/50 text-white placeholder:text-white/50"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="reset-phone" className="text-slate-200/90">Telefone <span className="text-red-400">*</span></Label>
              <Input
                id="reset-phone"
                type="text"
                value={phone}
                onChange={(e) => {
                  const formatted = formatPhone(e.target.value);
                  setPhone(formatted);
                }}
                placeholder="(00) 00000-0000"
                maxLength={15}
                required
                className="bg-slate-600/60 border-slate-400/50 text-white placeholder:text-white/50"
              />
            </div>

            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={handleClose}
                disabled={loading}
                className="flex-1 border-slate-400/50 bg-slate-600/40 text-white hover:bg-slate-600/60"
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                disabled={loading}
                className="flex-1 border-slate-400/50 bg-slate-600/60 text-white font-semibold hover:bg-slate-600/80 hover:border-slate-400/70"
              >
                {loading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Validando...
                  </>
                ) : (
                  'Continuar'
                )}
              </Button>
            </div>
          </form>
        ) : (
          <form onSubmit={handleResetPassword} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="new-password" className="text-slate-200/90">Nova Senha <span className="text-red-400">*</span></Label>
              <Input
                id="new-password"
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Mínimo 8 caracteres"
                required
                minLength={8}
                className="bg-slate-600/60 border-slate-400/50 text-white placeholder:text-white/50"
              />
              <p className="text-xs text-slate-400">A senha deve ter no mínimo 8 caracteres</p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="confirm-password" className="text-slate-200/90">Confirmar Senha <span className="text-red-400">*</span></Label>
              <Input
                id="confirm-password"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Digite a senha novamente"
                required
                minLength={8}
                className="bg-slate-600/60 border-slate-400/50 text-white placeholder:text-white/50"
              />
            </div>

            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setStep('credentials')}
                disabled={loading}
                className="flex-1 border-slate-400/50 bg-slate-600/40 text-white hover:bg-slate-600/60"
              >
                Voltar
              </Button>
              <Button
                type="submit"
                disabled={loading}
                className="flex-1 border-slate-400/50 bg-slate-600/60 text-white font-semibold hover:bg-slate-600/80 hover:border-slate-400/70"
              >
                {loading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Resetando...
                  </>
                ) : (
                  'Resetar Senha'
                )}
              </Button>
            </div>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
};

