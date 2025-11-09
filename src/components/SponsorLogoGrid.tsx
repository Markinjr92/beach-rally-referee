import { cn } from "@/lib/utils";

interface SponsorLogoGridProps {
  logos: string[];
  title?: string;
  layout?: "grid" | "row";
  className?: string;
  logoWrapperClassName?: string;
  logoClassName?: string;
}

export function SponsorLogoGrid({
  logos,
  title,
  layout = "grid",
  className,
  logoWrapperClassName,
  logoClassName
}: SponsorLogoGridProps) {
  if (!logos || logos.length === 0) {
    return null;
  }

  const containerClass =
    layout === "row"
      ? "flex flex-wrap items-center justify-center gap-3"
      : "grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3";

  return (
    <div className={cn("space-y-3", layout === "row" ? "w-full" : undefined)}>
      {title && (
        <p className="text-xs font-semibold uppercase tracking-wide text-white/70">{title}</p>
      )}
      <div className={cn(containerClass, className)}>
        {logos.map((logo, index) => (
          <div
            key={`${logo}-${index}`}
            className={cn(
              "flex h-16 w-full items-center justify-center rounded-xl border border-white/15 bg-white/10 p-3 shadow-sm backdrop-blur-sm",
              layout === "row" ? "max-w-[140px]" : undefined,
              logoWrapperClassName
            )}
          >
            <img
              src={logo}
              alt={`Patrocinador ${index + 1}`}
              className={cn("h-full w-full object-contain", logoClassName)}
            />
          </div>
        ))}
      </div>
    </div>
  );
}
