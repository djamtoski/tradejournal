"use client";

/**
 * Adapted from Watermelon UI "file-upload-2" (registry.watermelon.sh).
 * Re-skinned to the journal design system: hairline border, 10px radius,
 * no stripes or glow, lucide icons, single-file mode for broker exports.
 */

import React, { useCallback, useRef, useState } from "react";
import { FileSpreadsheet, Upload, X } from "lucide-react";
import { cn } from "@/lib/utils";

export interface FileUploadProps
  extends Omit<React.HTMLAttributes<HTMLDivElement>, "onDrop"> {
  onFilesAdded?: (files: File[]) => void;
  onFileRemove?: () => void;
  accept?: string;
  hint?: string;
  /** Main prompt in the empty drop area. */
  title?: string;
  /** The currently selected file, if any. */
  file?: File | null;
}

export function FileUpload({
  onFilesAdded,
  onFileRemove,
  accept,
  hint,
  title = "Drop your broker export here",
  file,
  className,
  ...props
}: FileUploadProps) {
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDragOver = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragging(false);
      if (e.dataTransfer.files?.length) onFilesAdded?.(Array.from(e.dataTransfer.files));
    },
    [onFilesAdded],
  );

  const handleFileSelect = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      if (e.target.files?.length) onFilesAdded?.(Array.from(e.target.files));
      if (fileInputRef.current) fileInputRef.current.value = "";
    },
    [onFilesAdded],
  );

  if (file) {
    return (
      <div
        className={cn(
          "flex items-center gap-3 rounded-[10px] border border-border bg-card px-4 py-3",
          className,
        )}
        {...props}
      >
        <span className="grid size-9 place-items-center rounded-md bg-muted text-muted-foreground">
          <FileSpreadsheet className="size-4" strokeWidth={1.5} />
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-[13px] font-medium text-foreground">{file.name}</p>
          <p className="num text-[12px] text-faint">{formatFileSize(file.size)}</p>
        </div>
        <button
          type="button"
          onClick={onFileRemove}
          className="grid size-7 place-items-center rounded-md text-faint transition-colors hover:bg-muted hover:text-foreground"
          aria-label="Remove file"
        >
          <X className="size-4" strokeWidth={1.5} />
        </button>
      </div>
    );
  }

  return (
    <div
      role="button"
      tabIndex={0}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      onClick={() => fileInputRef.current?.click()}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          fileInputRef.current?.click();
        }
      }}
      className={cn(
        "group flex min-h-[200px] cursor-pointer flex-col items-center justify-center gap-3 rounded-[10px] border border-dashed bg-card px-6 text-center transition-colors duration-150 outline-none focus-visible:border-primary",
        isDragging ? "border-primary bg-primary/5" : "border-input hover:bg-muted/50",
        className,
      )}
      {...props}
    >
      <input
        type="file"
        ref={fileInputRef}
        className="hidden"
        accept={accept}
        onChange={handleFileSelect}
      />
      <span
        className={cn(
          "grid size-10 place-items-center rounded-full bg-muted transition-colors",
          isDragging ? "text-primary" : "text-muted-foreground group-hover:text-foreground",
        )}
      >
        <Upload className="size-[18px]" strokeWidth={1.5} />
      </span>
      <div>
        <p className="text-[14px] text-foreground">
          {title}{" "}
          <span className="text-muted-foreground">or click to browse</span>
        </p>
        {hint && <p className="mt-1 text-[12px] text-faint">{hint}</p>}
      </div>
    </div>
  );
}

function formatFileSize(bytes: number) {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / k ** i).toFixed(1))} ${sizes[i]}`;
}
