"use client";

import { useId, useState, type ChangeEvent, type DragEvent } from "react";
import { ImagePlus, Music, X } from "lucide-react";

import { cn } from "@/lib/utils/cn";

interface FileDropProps {
  files: File[];
  onChange: (files: File[]) => void;
  multiple?: boolean;
  accept?: string;
  maxFiles?: number;
  variant?: "image" | "audio";
  label?: string;
}

export function FileDrop({
  files,
  onChange,
  multiple = false,
  accept,
  maxFiles,
  variant = "image",
  label,
}: FileDropProps) {
  const id = useId();
  const [dragging, setDragging] = useState(false);

  function handleFiles(list: FileList | null) {
    if (!list || !list.length) return;
    const incoming = Array.from(list);
    const next = multiple ? [...files, ...incoming] : incoming.slice(0, 1);
    onChange(maxFiles ? next.slice(0, maxFiles) : next);
  }

  function onInputChange(e: ChangeEvent<HTMLInputElement>) {
    handleFiles(e.target.files);
    e.target.value = "";
  }

  function onDragOver(e: DragEvent<HTMLLabelElement>) {
    e.preventDefault();
    setDragging(true);
  }

  function onDrop(e: DragEvent<HTMLLabelElement>) {
    e.preventDefault();
    setDragging(false);
    handleFiles(e.dataTransfer.files);
  }

  const Icon = variant === "audio" ? Music : ImagePlus;
  const hint =
    label ??
    (variant === "audio"
      ? "Arraste um MP3 ou clique para selecionar"
      : multiple
      ? `Arraste imagens ou clique${maxFiles ? ` (até ${maxFiles})` : ""}`
      : "Arraste uma imagem ou clique para selecionar");

  return (
    <div>
      <label
        htmlFor={id}
        onDragOver={onDragOver}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
        className={cn(
          "flex cursor-pointer flex-col items-center justify-center gap-2 rounded-[12px] border-2 border-dashed border-white/15 bg-[rgba(15,15,35,0.6)] px-4 py-8 text-center transition-all duration-200",
          "hover:border-accent/40 hover:bg-accent/5",
          dragging && "border-accent bg-accent/10",
        )}
      >
        <Icon className="h-7 w-7 text-ink-dim" />
        <div className="text-sm font-medium text-ink-muted">{hint}</div>
        <input
          id={id}
          type="file"
          className="sr-only"
          multiple={multiple}
          accept={accept}
          onChange={onInputChange}
        />
      </label>
      {files.length > 0 && (
        <ul className="mt-3 space-y-1.5">
          {files.map((f, i) => (
            <li
              key={`${f.name}-${i}`}
              className="flex items-center justify-between gap-2 rounded-md bg-white/[0.04] px-3 py-2 text-xs"
            >
              <span className="truncate text-ink-soft">{f.name}</span>
              <button
                type="button"
                onClick={() => onChange(files.filter((_, j) => j !== i))}
                className="rounded p-1 text-ink-dim hover:bg-white/10 hover:text-ink"
                aria-label="Remover"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
