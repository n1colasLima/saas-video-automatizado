"use client";

import { type InputHTMLAttributes, type TextareaHTMLAttributes, forwardRef } from "react";

import { cn } from "@/lib/utils/cn";

const baseInput =
  "w-full rounded-[10px] border border-white/10 bg-[rgba(15,15,35,0.6)] px-3.5 py-2.5 text-[15px] text-ink placeholder:text-ink-deep transition-all duration-200 focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/30";

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(
  ({ className, ...props }, ref) => (
    <input ref={ref} className={cn(baseInput, className)} {...props} />
  ),
);
Input.displayName = "Input";

export const Textarea = forwardRef<
  HTMLTextAreaElement,
  TextareaHTMLAttributes<HTMLTextAreaElement>
>(({ className, ...props }, ref) => (
  <textarea
    ref={ref}
    className={cn(baseInput, "min-h-[88px] resize-y leading-relaxed", className)}
    {...props}
  />
));
Textarea.displayName = "Textarea";

export function Label({
  children,
  htmlFor,
  hint,
}: {
  children: React.ReactNode;
  htmlFor?: string;
  hint?: React.ReactNode;
}) {
  return (
    <label htmlFor={htmlFor} className="mb-2 block">
      <span className="text-[13px] font-medium text-ink-soft">{children}</span>
      {hint && <span className="block text-xs text-ink-dim mt-1">{hint}</span>}
    </label>
  );
}
