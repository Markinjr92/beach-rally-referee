import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/lib/utils"

const scoreButtonVariants = cva(
  "inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground hover:bg-primary/90",
        team: "bg-team-a text-white hover:bg-team-a/90 font-bold text-lg",
        teamB: "bg-team-b text-white hover:bg-team-b/90 font-bold text-lg",
        serving: "bg-serving text-white hover:bg-serving/90",
        timeout: "bg-timeout text-white hover:bg-timeout/90",
        scoreboard: "bg-gradient-scoreboard text-score-text hover:opacity-90 shadow-scoreboard",
        undo: "bg-muted text-muted-foreground hover:bg-muted/80",
      },
      size: {
        default: "h-10 px-4 py-2",
        sm: "h-9 rounded-md px-3",
        lg: "h-14 rounded-md px-8 text-lg",
        xl: "h-20 rounded-lg px-12 text-xl font-bold",
        score: "h-24 w-24 rounded-xl text-3xl font-bold",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

export interface ScoreButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof scoreButtonVariants> {}

const ScoreButton = React.forwardRef<HTMLButtonElement, ScoreButtonProps>(
  ({ className, variant, size, ...props }, ref) => {
    return (
      <button
        className={cn(scoreButtonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    )
  }
)
ScoreButton.displayName = "ScoreButton"

export { ScoreButton, scoreButtonVariants }