import { useEffect, useRef, useState } from 'react'
import { Bot, Loader2, Send, Sparkles, User as UserIcon } from 'lucide-react'

import { supabase } from '@/integrations/supabase/client'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { useToast } from '@/components/ui/use-toast'
import { useChatRateLimit } from '@/hooks/useChatRateLimit'

interface TournamentChatBotProps {
  tournamentId: string
  tournamentName: string
}

interface ChatMessage {
  id: string
  role: 'assistant' | 'user'
  content: string
}

const QUESTION_LIMIT = 5

const buildWelcomeMessage = (tournamentName: string): ChatMessage => ({
  id: 'welcome',
  role: 'assistant',
  content: `Ola! Sou o assistente do torneio ${tournamentName}. Posso responder duvidas sobre o regulamento, jogos, horarios, equipes e classificacao. Pergunte a vontade (limite de ${QUESTION_LIMIT} perguntas neste dispositivo).`,
})

export function TournamentChatBot({ tournamentId, tournamentName }: TournamentChatBotProps) {
  const { toast } = useToast()
  const { used, remaining, limit, canAsk, recordQuestion } = useChatRateLimit({
    tournamentId,
    limit: QUESTION_LIMIT,
  })

  const [open, setOpen] = useState(false)
  const [messages, setMessages] = useState<ChatMessage[]>([buildWelcomeMessage(tournamentName)])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)

  const scrollRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    setMessages([buildWelcomeMessage(tournamentName)])
  }, [tournamentName])

  useEffect(() => {
    if (!scrollRef.current) return
    scrollRef.current.scrollTop = scrollRef.current.scrollHeight
  }, [messages, loading, open])

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const question = input.trim()
    if (!question || loading) return

    if (!canAsk) {
      toast({
        title: 'Limite atingido',
        description: `Voce ja fez ${limit} perguntas neste dispositivo.`,
        variant: 'destructive',
      })
      return
    }

    if (question.length > 500) {
      toast({
        title: 'Pergunta muito longa',
        description: 'Use ate 500 caracteres por pergunta.',
        variant: 'destructive',
      })
      return
    }

    const userMessage: ChatMessage = {
      id: `u-${Date.now()}`,
      role: 'user',
      content: question,
    }
    setMessages((prev) => [...prev, userMessage])
    setInput('')
    setLoading(true)

    const history = messages
      .filter((m) => m.id !== 'welcome')
      .slice(-6)
      .map(({ role, content }) => ({ role, content }))

    try {
      const { data, error } = await supabase.functions.invoke('tournament-ai-chat', {
        body: { tournamentId, question, history },
      })

      if (error) {
        throw new Error(error.message)
      }

      const payload = data as { ok?: boolean; answer?: string; message?: string } | null
      if (!payload || payload.ok === false || !payload.answer) {
        throw new Error(payload?.message || 'Falha ao obter resposta do assistente.')
      }

      recordQuestion()

      setMessages((prev) => [
        ...prev,
        {
          id: `a-${Date.now()}`,
          role: 'assistant',
          content: payload.answer ?? '',
        },
      ])
    } catch (err) {
      console.error('Erro ao chamar tournament-ai-chat', err)
      toast({
        title: 'Nao foi possivel responder',
        description: err instanceof Error ? err.message : 'Erro desconhecido',
        variant: 'destructive',
      })
      setMessages((prev) => [
        ...prev,
        {
          id: `err-${Date.now()}`,
          role: 'assistant',
          content: 'Tive um problema para responder agora. Tente novamente em instantes.',
        },
      ])
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      <Button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Abrir assistente do torneio"
        className={cn(
          'fixed bottom-5 right-5 z-40 h-14 w-14 rounded-full p-0 shadow-xl',
          'bg-emerald-400/95 text-slate-900 hover:bg-emerald-300',
          'sm:h-16 sm:w-16',
        )}
      >
        <Sparkles className="h-6 w-6 sm:h-7 sm:w-7" />
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md sm:max-w-lg p-0 overflow-hidden gap-0 border-white/10 bg-slate-900 text-white">
          <DialogHeader className="border-b border-white/10 px-4 py-3 space-y-1">
            <DialogTitle className="flex items-center gap-2 text-white">
              <Bot className="h-5 w-5 text-emerald-300" />
              Assistente do Torneio
            </DialogTitle>
            <DialogDescription className="text-white/70 text-xs">
              Respostas baseadas no regulamento e nos dados deste torneio. Restam {remaining} de {limit} perguntas neste dispositivo.
            </DialogDescription>
          </DialogHeader>

          <div
            ref={scrollRef}
            className="h-[50vh] sm:h-[55vh] overflow-y-auto px-4 py-3 space-y-3 bg-slate-900"
          >
            {messages.map((message) => (
              <div
                key={message.id}
                className={cn(
                  'flex gap-2 text-sm',
                  message.role === 'user' ? 'justify-end' : 'justify-start',
                )}
              >
                {message.role === 'assistant' && (
                  <div className="mt-0.5 h-7 w-7 shrink-0 rounded-full bg-emerald-400/20 flex items-center justify-center">
                    <Bot className="h-4 w-4 text-emerald-300" />
                  </div>
                )}
                <div
                  className={cn(
                    'max-w-[80%] rounded-2xl px-3 py-2 whitespace-pre-wrap leading-relaxed',
                    message.role === 'user'
                      ? 'bg-emerald-400/90 text-slate-900 rounded-tr-sm'
                      : 'bg-white/10 text-white rounded-tl-sm',
                  )}
                >
                  {message.content}
                </div>
                {message.role === 'user' && (
                  <div className="mt-0.5 h-7 w-7 shrink-0 rounded-full bg-white/10 flex items-center justify-center">
                    <UserIcon className="h-4 w-4 text-white/80" />
                  </div>
                )}
              </div>
            ))}
            {loading && (
              <div className="flex items-center gap-2 text-xs text-white/70">
                <Loader2 className="h-4 w-4 animate-spin" />
                Pensando...
              </div>
            )}
          </div>

          <form
            onSubmit={handleSubmit}
            className="border-t border-white/10 p-3 flex flex-col gap-2 bg-slate-950/40"
          >
            {!canAsk && (
              <div className="text-xs text-amber-300">
                Voce atingiu o limite de {limit} perguntas neste dispositivo.
              </div>
            )}
            <div className="flex gap-2">
              <Input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder={canAsk ? 'Pergunte algo sobre o torneio...' : 'Limite atingido'}
                disabled={!canAsk || loading}
                maxLength={500}
                className="bg-white/10 border-white/20 text-white placeholder:text-white/50"
              />
              <Button
                type="submit"
                disabled={!canAsk || loading || !input.trim()}
                className="bg-emerald-400/90 text-slate-900 hover:bg-emerald-300"
                aria-label="Enviar pergunta"
              >
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              </Button>
            </div>
            <div className="flex items-center justify-between text-[11px] text-white/50">
              <span>Usadas {used} de {limit}</span>
              <span>Maximo 500 caracteres por pergunta</span>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </>
  )
}
