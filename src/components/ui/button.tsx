"use client";

import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils/cn";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 rounded-md font-semibold transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent disabled:pointer-events-none disabled:opacity-50",
  {
    variants: {
      variant: {
        primary:
          "bg-gradient-to-br from-accent to-accent-dark text-white shadow-[0_4px_16px_rgba(225,29,72,0.35),inset_0_1px_0_rgba(255,255,255,0.15)] hover:brightness-110",
        secondary:
          "bg-white/5 border border-white/10 text-ink hover:bg-white/10",
        ghost: "text-ink-muted hover:bg-white/5 hover:text-ink",
        nav: "justify-start text-ink-muted hover:bg-white/5 hover:text-ink",
      },
      size: {
        md: "h-11 px-5 text-sm",
        lg: "h-12 px-6 text-[15px]",
        sm: "h-9 px-3 text-xs",
      },
    },
    defaultVariants: { variant: "primary", size: "md" },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return (
      <Comp
        ref={ref}
        className={cn(buttonVariants({ variant, size, className }))}
        {...props}
      />
    );
  },
);
Button.displayName = "Button";
