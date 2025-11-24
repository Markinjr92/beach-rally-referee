import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { useAuth } from '@/hooks/useAuth';
import { useAccessExpiration } from '@/hooks/useAccessExpiration';
import { useToast } from '@/components/ui/use-toast';
import { ArrowLeft, Save, User, Calendar, AlertCircle, CheckCircle2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

export default function UserProfile() {
  const { user, loading: authLoading } = useAuth();
  const { isExpired, expiresAt, daysRemaining, loading: accessLoading } = useAccessExpiration(user, authLoading);
  const { toast } = useToast();
  const navigate = useNavigate();

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [cpf, setCpf] = useState('');
  const [phone, setPhone] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!user) {
      navigate('/');
      return;
    }

    const loadUserData = async () => {
      setLoading(true);
      try {
        const { data, error } = await supabase
          .from('users')
          .select('name, email, cpf, phone')
          .eq('id', user.id)
          .single();

        if (error) {
          console.error('Erro ao carregar dados do usuário:', error);
          toast({
            title: 'Erro ao carregar dados',
            description: error.message,
            variant: 'destructive',
          });
        } else if (data) {
          setName(data.name || '');
          setEmail(data.email || '');
          setCpf(data.cpf || '');
          setPhone(data.phone || '');
        }
      } catch (error) {
        console.error('Erro ao carregar dados:', error);
        toast({
          title: 'Erro ao carregar dados',
          description: 'Não foi possível carregar as informações do perfil.',
          variant: 'destructive',
        });
      } finally {
        setLoading(false);
      }
    };

    loadUserData();
  }, [user, navigate, toast]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!user) return;

    // Remover máscaras antes de salvar
    const cpfNumbers = cpf.replace(/\D/g, '');
    const phoneNumbers = phone.replace(/\D/g, '');

    // Validação
    if (cpfNumbers && cpfNumbers.length !== 11) {
      toast({
        title: 'CPF inválido',
        description: 'O CPF deve conter 11 dígitos.',
        variant: 'destructive',
      });
      return;
    }

    if (phoneNumbers && phoneNumbers.length < 10) {
      toast({
        title: 'Telefone inválido',
        description: 'O telefone deve conter pelo menos 10 dígitos.',
        variant: 'destructive',
      });
      return;
    }

    setSaving(true);
    try {
      const { error } = await supabase
        .from('users')
        .update({
          name: name.trim() || null,
          cpf: cpfNumbers || null,
          phone: phoneNumbers || null,
        })
        .eq('id', user.id);

      if (error) {
        console.error('Erro ao atualizar perfil:', error);
        toast({
          title: 'Erro ao salvar',
          description: error.message || 'Não foi possível atualizar o perfil.',
          variant: 'destructive',
        });
      } else {
        toast({
          title: 'Perfil atualizado',
          description: 'Suas informações foram salvas com sucesso.',
        });
      }
    } catch (error) {
      console.error('Erro ao atualizar perfil:', error);
      toast({
        title: 'Erro ao salvar',
        description: 'Ocorreu um erro inesperado ao atualizar o perfil.',
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  if (authLoading || loading) {
    return (
      <div className="min-h-screen bg-gradient-ocean flex items-center justify-center">
        <div className="text-white text-xl">Carregando...</div>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  // Formatar CPF para exibição
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

  // Formatar telefone para exibição
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

  return (
    <div className="min-h-screen bg-gradient-ocean">
      <div className="container mx-auto px-4 py-8">
        <div className="mb-8">
          <Link to="/">
            <Button variant="ghost" className="mb-4 text-white hover:bg-white/10">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Voltar
            </Button>
          </Link>
          <div>
            <h1 className="text-4xl font-bold text-white mb-2">Perfil e Configurações</h1>
            <p className="text-white/80">
              Gerencie suas informações pessoais e visualize o status do seu acesso
            </p>
          </div>
        </div>

        <div className="grid gap-6 md:grid-cols-2">
          {/* Informações do Perfil */}
          <Card className="bg-white/10 border-white/20 text-white">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <User className="h-5 w-5" />
                Informações Pessoais
              </CardTitle>
              <CardDescription className="text-white/70">
                Atualize seus dados de cadastro
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Nome</Label>
                  <Input
                    id="name"
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Seu nome completo"
                    className="bg-white/10 border-white/30 text-white placeholder:text-white/50"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    value={email}
                    disabled
                    className="bg-white/5 border-white/20 text-white/50 cursor-not-allowed"
                  />
                  <p className="text-xs text-white/60">
                    O email não pode ser alterado
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="cpf">CPF</Label>
                  <Input
                    id="cpf"
                    type="text"
                    value={cpf}
                    onChange={(e) => {
                      const formatted = formatCpf(e.target.value);
                      setCpf(formatted);
                    }}
                    placeholder="000.000.000-00"
                    maxLength={14}
                    className="bg-white/10 border-white/30 text-white placeholder:text-white/50"
                  />
                  <p className="text-xs text-white/60">
                    Preencha seu CPF para completar o cadastro
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="phone">Telefone</Label>
                  <Input
                    id="phone"
                    type="text"
                    value={phone}
                    onChange={(e) => {
                      const formatted = formatPhone(e.target.value);
                      setPhone(formatted);
                    }}
                    placeholder="(00) 00000-0000"
                    maxLength={15}
                    className="bg-white/10 border-white/30 text-white placeholder:text-white/50"
                  />
                  <p className="text-xs text-white/60">
                    Preencha seu telefone para completar o cadastro
                  </p>
                </div>

                <Button
                  type="submit"
                  disabled={saving}
                  className="w-full border-slate-400/50 bg-slate-600/60 text-white font-semibold hover:bg-slate-600/80 hover:border-slate-400/70"
                >
                  {saving ? (
                    <>
                      <Save className="mr-2 h-4 w-4 animate-spin" />
                      Salvando...
                    </>
                  ) : (
                    <>
                      <Save className="mr-2 h-4 w-4" />
                      Salvar Alterações
                    </>
                  )}
                </Button>
              </form>
            </CardContent>
          </Card>

          {/* Status do Acesso */}
          <Card className="bg-white/10 border-white/20 text-white">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Calendar className="h-5 w-5" />
                Status do Acesso
              </CardTitle>
              <CardDescription className="text-white/70">
                Informações sobre seu período de acesso ao sistema
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {accessLoading ? (
                <div className="text-center py-8 text-white/60">
                  Carregando informações...
                </div>
              ) : (
                <>
                  {isExpired ? (
                    <Alert className="bg-red-500/10 text-white border-red-400/40">
                      <AlertCircle className="h-4 w-4" />
                      <AlertTitle>Acesso Expirado</AlertTitle>
                      <AlertDescription>
                        Seu período de acesso de 15 dias expirou. Entre em contato com o administrador para renovar seu acesso.
                      </AlertDescription>
                    </Alert>
                  ) : expiresAt === null ? (
                    <Alert className="bg-green-500/10 text-white border-green-400/40">
                      <CheckCircle2 className="h-4 w-4" />
                      <AlertTitle>Acesso Vitalício</AlertTitle>
                      <AlertDescription>
                        Seu acesso ao sistema não possui data de expiração.
                      </AlertDescription>
                    </Alert>
                  ) : (
                    <>
                      <Alert className={daysRemaining !== null && daysRemaining <= 3 
                        ? "bg-yellow-500/10 text-white border-yellow-400/40"
                        : "bg-blue-500/10 text-white border-blue-400/40"
                      }>
                        <AlertCircle className="h-4 w-4" />
                        <AlertTitle>
                          {daysRemaining !== null && daysRemaining <= 3 
                            ? "Acesso próximo de expirar"
                            : "Acesso Temporário"
                          }
                        </AlertTitle>
                        <AlertDescription>
                          {daysRemaining !== null && daysRemaining > 0 ? (
                            <>
                              Seu acesso expira em <strong>{daysRemaining} {daysRemaining === 1 ? 'dia' : 'dias'}</strong>.
                              {daysRemaining <= 3 && (
                                <span className="block mt-2">
                                  Entre em contato com o administrador para renovar seu acesso.
                                </span>
                              )}
                            </>
                          ) : (
                            'Seu acesso expirou.'
                          )}
                        </AlertDescription>
                      </Alert>

                      {expiresAt && (
                        <div className="space-y-2">
                          <div className="flex justify-between items-center p-3 rounded-lg bg-white/5 border border-white/10">
                            <span className="text-sm text-white/70">Data de Expiração:</span>
                            <span className="text-sm font-medium text-white">
                              {new Date(expiresAt).toLocaleDateString('pt-BR', {
                                day: '2-digit',
                                month: '2-digit',
                                year: 'numeric',
                              })}
                            </span>
                          </div>
                          {daysRemaining !== null && daysRemaining > 0 && (
                            <div className="flex justify-between items-center p-3 rounded-lg bg-white/5 border border-white/10">
                              <span className="text-sm text-white/70">Dias Restantes:</span>
                              <span className={`text-sm font-bold ${
                                daysRemaining <= 3 ? 'text-yellow-400' : 'text-green-400'
                              }`}>
                                {daysRemaining} {daysRemaining === 1 ? 'dia' : 'dias'}
                              </span>
                            </div>
                          )}
                        </div>
                      )}
                    </>
                  )}
                </>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

