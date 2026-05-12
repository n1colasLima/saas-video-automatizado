import { cn } from "@/lib/utils/cn";

export function ProgressBar({
  value,
  className,
}: {
  value: number;
  className?: string;
}) {
  const pct = Math.min(100, Math.max(0, value || 0));
  return (
    <div
      className={cn(
        "h-1.5 w-full overflow-hidden rounded-full bg-white/[0.06]",
        className,
      )}
    >
      <div
        className="h-full bg-[linear-gradient(90deg,#E11D48,#FB7185)] transition-[width] duration-300"
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}
