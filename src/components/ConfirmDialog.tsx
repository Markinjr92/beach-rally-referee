import { ReactNode, useMemo, useState } from 'react'

import { Button, type ButtonProps } from '@/components/ui/button'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import { cn } from '@/lib/utils'

type ConfirmDialogProps = {
  title: string
  description?: ReactNode
  trigger?: ReactNode
  confirmText?: string
  cancelText?: string
  onConfirm?: () => void | Promise<void>
  onCancel?: () => void
  confirmVariant?: ButtonProps['variant']
  confirmClassName?: string
  cancelClassName?: string
  destructive?: boolean
  open?: boolean
  onOpenChange?: (open: boolean) => void
}

export function ConfirmDialog({
  title,
  description,
  trigger,
  confirmText = 'Confirmar',
  cancelText = 'Cancelar',
  onConfirm,
  onCancel,
  confirmVariant = 'default',
  confirmClassName,
  cancelClassName,
  destructive = false,
  open,
  onOpenChange,
}: ConfirmDialogProps) {
  const [internalOpen, setInternalOpen] = useState(false)
  const [isProcessing, setIsProcessing] = useState(false)

  const isControlled = typeof open === 'boolean'
  const dialogOpen = isControlled ? open : internalOpen

  const setOpen = (value: boolean) => {
    if (!isControlled) {
      setInternalOpen(value)
    }
    onOpenChange?.(value)
  }

  const handleClose = () => {
    if (isProcessing) return
    setOpen(false)
  }

  const handleConfirm = async () => {
    if (!onConfirm) {
      setOpen(false)
      return
    }
    try {
      setIsProcessing(true)
      await onConfirm()
      setOpen(false)
    } finally {
      setIsProcessing(false)
    }
  }

  const cancelButtonVariant = useMemo<ButtonProps['variant']>(() => (destructive ? 'secondary' : 'outline'), [destructive])

  return (
    <AlertDialog open={dialogOpen} onOpenChange={setOpen}>
      {trigger ? <AlertDialogTrigger asChild>{trigger}</AlertDialogTrigger> : null}
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          {description ? <AlertDialogDescription>{description}</AlertDialogDescription> : null}
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel asChild>
            <Button
              type="button"
              variant={cancelButtonVariant}
              className={cn('w-full', cancelClassName)}
              disabled={isProcessing}
              onClick={() => {
                onCancel?.()
                handleClose()
              }}
            >
              {cancelText}
            </Button>
          </AlertDialogCancel>
          <AlertDialogAction asChild>
            <Button
              type="button"
              variant={destructive ? 'destructive' : confirmVariant}
              onClick={handleConfirm}
              disabled={isProcessing}
              className={cn('w-full', confirmClassName)}
            >
              {isProcessing ? 'Processando...' : confirmText}
            </Button>
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
