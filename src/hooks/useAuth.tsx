import { createContext, useContext, useEffect, useState } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';

interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
  signUp: (email: string, password: string, name: string, cpf: string, phone: string) => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Set up auth state listener FIRST
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        setSession(session);
        setUser(session?.user ?? null);
        setLoading(false);
      }
    );

    // THEN check for existing session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const toError = (error: unknown): Error => {
    if (error instanceof Error) {
      return error;
    }
    return new Error('Unexpected error');
  };

  const signIn = async (email: string, password: string) => {
    try {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      
      if (error) {
        toast({
          title: "Erro no login",
          description: error.message,
          variant: "destructive",
        });
      } else {
        toast({
          title: "Login realizado com sucesso",
          description: "Bem-vindo de volta!",
        });
      }

      return { error };
    } catch (error: unknown) {
      const mappedError = toError(error);
      toast({
        title: "Erro no login",
        description: "Ocorreu um erro inesperado",
        variant: "destructive",
      });
      return { error: mappedError };
    }
  };

  const signUp = async (email: string, password: string, name: string, cpf: string, phone: string) => {
    try {
      const redirectUrl = `${window.location.origin}/`;
      
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: redirectUrl,
          data: {
            name: name,
            cpf: cpf,
            phone: phone,
          }
        }
      });
      
      if (error) {
        if (error.message.includes('User already registered')) {
          toast({
            title: "Usuário já cadastrado",
            description: "Este email já está em uso. Tente fazer login.",
            variant: "destructive",
          });
        } else {
          toast({
            title: "Erro no cadastro",
            description: error.message,
            variant: "destructive",
          });
        }
      } else {
        toast({
          title: "Cadastro realizado",
          description: "Sua conta foi criada com sucesso! Você já pode fazer login.",
        });
      }
      
      return { error };
    } catch (error: unknown) {
      const mappedError = toError(error);
      toast({
        title: "Erro no cadastro",
        description: "Ocorreu um erro inesperado",
        variant: "destructive",
      });
      return { error: mappedError };
    }
  };

  const signOut = async () => {
    try {
      // Tentar fazer logout no servidor
      const { error } = await supabase.auth.signOut({ scope: 'local' });
      
      // Sempre limpar a sessão localmente, mesmo se houver erro no servidor
      setSession(null);
      setUser(null);
      
      // Limpar storage local também
      await supabase.auth.signOut({ scope: 'local' }).catch(() => {
        // Ignorar erros ao limpar localmente
      });
      
      if (error) {
        console.warn("Erro ao fazer logout no servidor, mas sessão local foi limpa:", error);
        toast({
          title: "Logout realizado",
          description: "Sessão local encerrada. Se o problema persistir, limpe o cache do navegador.",
        });
      } else {
        toast({
          title: "Logout realizado",
          description: "Até logo!",
        });
      }
    } catch (error: unknown) {
      // Em caso de erro, ainda assim limpar a sessão local
      setSession(null);
      setUser(null);
      
      // Tentar limpar o storage
      try {
        // Limpar todas as chaves relacionadas ao Supabase auth
        const keysToRemove: string[] = [];
        for (let i = 0; i < localStorage.length; i++) {
          const key = localStorage.key(i);
          if (key && (key.includes('supabase.auth') || key.includes('sb-'))) {
            keysToRemove.push(key);
          }
        }
        keysToRemove.forEach(key => localStorage.removeItem(key));
      } catch (e) {
        // Ignorar erros ao limpar storage
      }
      
      const mappedError = toError(error);
      console.error("Erro no logout:", mappedError);
      toast({
        title: "Logout realizado",
        description: "Sessão local encerrada. Se necessário, limpe o cache do navegador.",
      });
    }
  };

  const value = {
    user,
    session,
    loading,
    signIn,
    signUp,
    signOut,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};