"use client";

import { forwardRef, type ButtonHTMLAttributes } from "react";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils/cn";

const buttonStyles = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-[11px] font-semibold transition-all duration-200 outline-none focus-visible:ring-2 focus-visible:ring-accent/60 disabled:opacity-50 disabled:cursor-not-allowed",
  {
    variants: {
      variant: {
        primary:
          "bg-[linear-gradient(135deg,#E11D48_0%,#BE123C_100%)] text-white shadow-[0_4px_16px_rgba(225,29,72,0.35),inset_0_1px_0_rgba(255,255,255,0.15)] hover:brightness-105 hover:shadow-[0_6px_24px_rgba(225,29,72,0.5)]",
        secondary:
          "bg-white/5 text-ink border border-white/10 hover:bg-white/10",
        ghost: "bg-transparent text-ink-muted hover:bg-white/5 hover:text-ink",
        danger:
          "bg-red-500/15 text-red-300 border border-red-500/30 hover:bg-red-500/25",
      },
      size: {
        sm: "h-9 px-3 text-[13px]",
        md: "h-11 px-5 text-[14px]",
        lg: "h-12 px-6 text-[15px]",
      },
    },
    defaultVariants: { variant: "primary", size: "md" },
  },
);

export interface ButtonProps
  extends ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonStyles> {}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, ...props }, ref) => (
    <button
      ref={ref}
      className={cn(buttonStyles({ variant, size }), className)}
      {...props}
    />
  ),
);
Button.displayName = "Button";
