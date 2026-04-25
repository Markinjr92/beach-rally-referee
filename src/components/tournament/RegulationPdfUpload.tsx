import { useRef, useState } from 'react'
import { FileText, Loader2, Trash2, Upload, X } from 'lucide-react'

import { supabase } from '@/integrations/supabase/client'
import { Button } from '@/components/ui/button'
import { useToast } from '@/components/ui/use-toast'

const STORAGE_BUCKET = 'tournament-regulations'
const MAX_PDF_BYTES = 10 * 1024 * 1024 // 10 MB
const MAX_TEXT_CHARS = 120_000 // ~30k tokens, com folga para Gemini (1M) e teto p/ Groq/OpenAI

interface RegulationPdfUploadProps {
  tournamentId: string
  initialUrl?: string | null
  initialFilename?: string | null
  initialUploadedAt?: string | null
  initialTextLength?: number | null
  onChange?: (data: {
    url: string | null
    filename: string | null
    uploadedAt: string | null
    textLength: number
  }) => void
}

interface RegulationState {
  url: string | null
  filename: string | null
  uploadedAt: string | null
  textLength: number
}

interface PdfExtractionResult {
  text: string
  pagesWithText: number
  totalPages: number
}

let workerPortConfigured = false

async function extractPdfText(file: File): Promise<PdfExtractionResult> {
  const pdfjs = await import('pdfjs-dist')

  if (!workerPortConfigured) {
    // Vite empacota o worker como blob inline (?worker&inline). Nao depende do servidor
    // servir arquivos .mjs com o MIME correto (problema comum em hospedagens diversas).
    const PdfWorker = (await import('pdfjs-dist/build/pdf.worker.min.mjs?worker&inline')).default
    pdfjs.GlobalWorkerOptions.workerPort = new PdfWorker()
    workerPortConfigured = true
  }

  const arrayBuffer = await file.arrayBuffer()
  const loadingTask = pdfjs.getDocument({
    data: new Uint8Array(arrayBuffer),
    isEvalSupported: false,
    useSystemFonts: true,
  })

  const pdf = await loadingTask.promise

  const pages: string[] = []
  let pagesWithText = 0
  for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber++) {
    const page = await pdf.getPage(pageNumber)
    const content = await page.getTextContent()
    const pageText = content.items
      .map((item: unknown) => {
        if (item && typeof item === 'object' && 'str' in item) {
          return String((item as { str: string }).str ?? '')
        }
        return ''
      })
      .join(' ')
      .replace(/\s+/g, ' ')
      .trim()
    if (pageText.length > 10) {
      pagesWithText++
    }
    pages.push(pageText)
    page.cleanup()
  }

  await pdf.destroy()

  const text = pages
    .filter((p) => p.length > 0)
    .join('\n\n')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim()

  return { text, pagesWithText, totalPages: pdf.numPages }
}

export function RegulationPdfUpload({
  tournamentId,
  initialUrl,
  initialFilename,
  initialUploadedAt,
  initialTextLength,
  onChange,
}: RegulationPdfUploadProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const { toast } = useToast()
  const [state, setState] = useState<RegulationState>({
    url: initialUrl ?? null,
    filename: initialFilename ?? null,
    uploadedAt: initialUploadedAt ?? null,
    textLength: initialTextLength ?? 0,
  })
  const [busy, setBusy] = useState(false)
  const [progress, setProgress] = useState<string | null>(null)

  const triggerPicker = () => {
    if (busy) return
    inputRef.current?.click()
  }

  const handleFile = async (file: File) => {
    if (file.type !== 'application/pdf' && !file.name.toLowerCase().endsWith('.pdf')) {
      toast({
        title: 'Arquivo invalido',
        description: 'Envie um arquivo PDF.',
        variant: 'destructive',
      })
      return
    }
    if (file.size > MAX_PDF_BYTES) {
      toast({
        title: 'Arquivo muito grande',
        description: `Tamanho maximo permitido: ${(MAX_PDF_BYTES / 1024 / 1024).toFixed(0)} MB.`,
        variant: 'destructive',
      })
      return
    }

    setBusy(true)
    try {
      setProgress('Extraindo texto do PDF...')
      let extraction: PdfExtractionResult
      try {
        extraction = await extractPdfText(file)
      } catch (extractError) {
        console.error('Falha ao extrair texto do PDF', extractError)
        const message = extractError instanceof Error ? extractError.message : 'Erro desconhecido'
        toast({
          title: 'Nao foi possivel extrair texto do PDF',
          description: `Detalhes tecnicos: ${message}`,
          variant: 'destructive',
        })
        return
      }

      let text = extraction.text
      let truncated = false
      if (text.length > MAX_TEXT_CHARS) {
        text = text.slice(0, MAX_TEXT_CHARS)
        truncated = true
      }

      if (text.trim().length < 50) {
        toast({
          title: 'PDF sem texto extraivel',
          description:
            extraction.totalPages > 0 && extraction.pagesWithText === 0
              ? 'O arquivo parece ser apenas imagem (escaneado). Use um PDF com texto selecionavel.'
              : 'O arquivo parece estar vazio.',
          variant: 'destructive',
        })
        return
      }

      setProgress('Enviando arquivo para o servidor...')
      const path = `${tournamentId}/regulamento.pdf`
      const { error: uploadError } = await supabase.storage
        .from(STORAGE_BUCKET)
        .upload(path, file, {
          contentType: 'application/pdf',
          upsert: true,
          cacheControl: '3600',
        })
      if (uploadError) {
        throw new Error(uploadError.message)
      }

      const { data: publicUrlData } = supabase.storage.from(STORAGE_BUCKET).getPublicUrl(path)
      const publicUrl = publicUrlData?.publicUrl ?? null
      const uploadedAt = new Date().toISOString()

      setProgress('Salvando regulamento no torneio...')
      const { error: updateError } = await supabase
        .from('tournaments')
        .update({
          regulation_pdf_url: publicUrl,
          regulation_text: text,
          regulation_filename: file.name,
          regulation_uploaded_at: uploadedAt,
        })
        .eq('id', tournamentId)
      if (updateError) {
        throw new Error(updateError.message)
      }

      const next: RegulationState = {
        url: publicUrl,
        filename: file.name,
        uploadedAt,
        textLength: text.length,
      }
      setState(next)
      onChange?.(next)

      toast({
        title: 'Regulamento salvo',
        description: truncated
          ? `Texto truncado em ${MAX_TEXT_CHARS.toLocaleString('pt-BR')} caracteres para o agente de IA.`
          : `${text.length.toLocaleString('pt-BR')} caracteres de texto extraidos.`,
      })
    } catch (error) {
      console.error('Erro ao salvar regulamento', error)
      toast({
        title: 'Erro ao salvar regulamento',
        description: error instanceof Error ? error.message : 'Erro desconhecido',
        variant: 'destructive',
      })
    } finally {
      setBusy(false)
      setProgress(null)
      if (inputRef.current) inputRef.current.value = ''
    }
  }

  const handleRemove = async () => {
    if (busy) return
    if (!confirm('Remover o regulamento atual? O agente de IA deixara de responder enquanto nao houver outro PDF.')) {
      return
    }
    setBusy(true)
    try {
      const path = `${tournamentId}/regulamento.pdf`
      await supabase.storage.from(STORAGE_BUCKET).remove([path])
      const { error: updateError } = await supabase
        .from('tournaments')
        .update({
          regulation_pdf_url: null,
          regulation_text: null,
          regulation_filename: null,
          regulation_uploaded_at: null,
        })
        .eq('id', tournamentId)
      if (updateError) {
        throw new Error(updateError.message)
      }
      const next: RegulationState = { url: null, filename: null, uploadedAt: null, textLength: 0 }
      setState(next)
      onChange?.(next)
      toast({ title: 'Regulamento removido' })
    } catch (error) {
      console.error('Erro ao remover regulamento', error)
      toast({
        title: 'Erro ao remover regulamento',
        description: error instanceof Error ? error.message : 'Erro desconhecido',
        variant: 'destructive',
      })
    } finally {
      setBusy(false)
    }
  }

  const formattedUploadedAt = state.uploadedAt
    ? new Date(state.uploadedAt).toLocaleString('pt-BR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      })
    : null

  return (
    <div className="space-y-3">
      <h3 className="text-lg font-semibold flex items-center gap-2">
        <FileText size={20} />
        Regulamento (PDF)
      </h3>
      <p className="text-sm text-white/70">
        Envie o regulamento em PDF. O texto sera extraido e usado pelo agente de IA para responder duvidas dos espectadores.
      </p>

      <input
        ref={inputRef}
        type="file"
        accept="application/pdf"
        className="hidden"
        onChange={(event) => {
          const file = event.target.files?.[0]
          if (file) void handleFile(file)
        }}
      />

      {state.url ? (
        <div className="rounded-lg border border-white/20 bg-white/5 p-3 space-y-2">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <FileText size={18} className="text-emerald-300 shrink-0" />
                <a
                  href={state.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm font-medium text-white underline decoration-dotted hover:text-emerald-200 truncate"
                  title={state.filename ?? 'regulamento.pdf'}
                >
                  {state.filename ?? 'regulamento.pdf'}
                </a>
              </div>
              <div className="mt-1 text-xs text-white/60 space-y-0.5">
                {formattedUploadedAt && <div>Enviado em {formattedUploadedAt}</div>}
                {state.textLength > 0 && (
                  <div>{state.textLength.toLocaleString('pt-BR')} caracteres extraidos</div>
                )}
              </div>
            </div>
            <Button
              size="sm"
              variant="outline"
              onClick={handleRemove}
              disabled={busy}
              aria-label="Remover regulamento"
              className="border-red-400/50 bg-red-500/10 text-red-100 hover:bg-red-500/20"
            >
              <Trash2 size={14} className="sm:mr-1" />
              <span className="hidden sm:inline">Remover</span>
            </Button>
          </div>
        </div>
      ) : (
        <div className="rounded-lg border border-dashed border-white/30 bg-white/5 p-4 text-sm text-white/60">
          Nenhum regulamento enviado ainda. Apos enviar, o agente de IA ficara disponivel na pagina publica do torneio.
        </div>
      )}

      <div className="flex items-center gap-2">
        <Button
          onClick={triggerPicker}
          disabled={busy}
          className="bg-emerald-400/90 text-slate-900 hover:bg-emerald-300"
        >
          {busy ? (
            <Loader2 className="h-4 w-4 sm:mr-2 animate-spin" />
          ) : (
            <Upload className="h-4 w-4 sm:mr-2" />
          )}
          <span className="hidden sm:inline">{state.url ? 'Substituir PDF' : 'Enviar PDF'}</span>
        </Button>
        {progress && (
          <span className="text-xs text-white/70 inline-flex items-center gap-2">
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
            {progress}
          </span>
        )}
        {!busy && state.url && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              if (state.url) window.open(state.url, '_blank', 'noopener,noreferrer')
            }}
            className="border-white/30 bg-white/10 text-white hover:bg-white/20"
          >
            Abrir PDF
            <X className="hidden" />
          </Button>
        )}
      </div>
    </div>
  )
}
