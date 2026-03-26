import { useEffect, useRef } from "react";

interface SearchBarProps {
  value: string;
  onChange: (value: string) => void;
  onSubmit?: () => void;
  onArrowDown?: () => void;
}

export default function SearchBar({
  value,
  onChange,
  onSubmit,
  onArrowDown,
}: SearchBarProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        inputRef.current?.focus();
      }
      if (e.key === "Escape" && document.activeElement === inputRef.current) {
        onChange("");
        inputRef.current?.blur();
      }
      if (e.key === "Enter" && document.activeElement === inputRef.current) {
        e.preventDefault();
        inputRef.current?.blur();
        onSubmit?.();
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onChange, onSubmit]);

  return (
    <input
      ref={inputRef}
      type="text"
      placeholder="Search... (Cmd+K)"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      onKeyDown={(e) => {
        if (e.key === "ArrowDown") {
          e.preventDefault();
          inputRef.current?.blur();
          onArrowDown?.();
        }
      }}
      className="w-full rounded border border-sidebar-text/30 bg-black/20 px-[7.5px] py-[7.5px] font-mono text-xs text-sidebar-text outline-none placeholder:text-sidebar-text/50 focus:border-sidebar-text/60"
    />
  );
}
