import { useEffect, useRef } from "react";

interface SearchBarProps {
  value: string;
  onChange: (value: string) => void;
  onSubmit?: () => void;
  onArrowDown?: () => void;
  /** When true, open/focus the input (Cmd+K). */
  active?: boolean;
  onActiveChange?: (active: boolean) => void;
  compact?: boolean;
}

export default function SearchBar({
  value,
  onChange,
  onSubmit,
  onArrowDown,
  active = false,
  onActiveChange,
  compact = false,
}: SearchBarProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && (e.key === "k" || e.key === "f")) {
        e.preventDefault();
        onActiveChange?.(true);
        requestAnimationFrame(() => inputRef.current?.focus());
      }
      if (e.key === "Escape" && document.activeElement === inputRef.current) {
        onChange("");
        inputRef.current?.blur();
        onActiveChange?.(false);
      }
      if (e.key === "Enter" && document.activeElement === inputRef.current) {
        e.preventDefault();
        inputRef.current?.blur();
        onSubmit?.();
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onChange, onSubmit, onActiveChange]);

  useEffect(() => {
    if (active) inputRef.current?.focus();
  }, [active]);

  if (compact && !active && !value) {
    return (
      <button
        type="button"
        className="font-mono text-[12px] text-[var(--color-sidebar-controls)]/80 transition hover:text-[var(--color-sidebar-controls)]"
        onClick={() => {
          onActiveChange?.(true);
          requestAnimationFrame(() => inputRef.current?.focus());
        }}
      >
        search (cmd+k)
      </button>
    );
  }

  return (
    <input
      ref={inputRef}
      type="text"
      placeholder="search..."
      value={value}
      onChange={(e) => onChange(e.target.value)}
      onBlur={() => {
        if (!value) onActiveChange?.(false);
      }}
      onKeyDown={(e) => {
        if (e.key === "ArrowDown") {
          e.preventDefault();
          inputRef.current?.blur();
          onArrowDown?.();
        }
      }}
      className="w-full bg-transparent font-mono text-[12px] text-[var(--color-sidebar-controls)] outline-none placeholder:text-[var(--color-sidebar-controls)]/50"
    />
  );
}
