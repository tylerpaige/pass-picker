import { useState, useEffect, useRef, useMemo } from "react";
import {
  getEntry,
  parseEntry,
  copyToClipboard,
  renameEntry,
  editEntry,
} from "../lib/pass";
import type { ParsedEntry } from "../lib/pass";
import { titleCaseFieldLabel } from "../lib/strings";
import OtpDisplay from "./OtpDisplay";
import PasswordGenerator from "./PasswordGenerator";

interface EntryViewProps {
  entryName: string;
  onRenamed: (newName: string) => void;
  focused: boolean;
  onRequestEdit: () => void;
}

export default function EntryView({
  entryName,
  onRenamed,
  focused,
  onRequestEdit,
}: EntryViewProps) {
  const [entry, setEntry] = useState<ParsedEntry | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [focusedFieldIndex, setFocusedFieldIndex] = useState(0);
  const fieldRefs = useRef<Map<number, HTMLElement>>(new Map());

  const [isEditingName, setIsEditingName] = useState(false);
  const [editedName, setEditedName] = useState(entryName);
  const [showGenerator, setShowGenerator] = useState(false);
  const nameInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setEditedName(entryName);
  }, [entryName]);

  useEffect(() => {
    setLoading(true);
    setError(null);
    setShowPassword(false);
    setShowGenerator(false);
    setFocusedFieldIndex(0);
    getEntry(entryName)
      .then((raw) => {
        setEntry(parseEntry(raw));
        setLoading(false);
      })
      .catch((err) => {
        setError(String(err));
        setLoading(false);
      });
  }, [entryName]);

  const fields = useMemo(() => {
    if (!entry) return [];
    return [
      { key: "password", value: entry.password },
      ...Object.entries(entry.fields).map(([key, value]) => ({ key, value })),
    ];
  }, [entry]);

  async function handleCopy(field: string, value: string) {
    await copyToClipboard(value);
    setCopiedField(field);
    setTimeout(() => setCopiedField(null), 2000);
    if (field === "password") {
      setTimeout(() => copyToClipboard(""), 45000);
    }
  }

  function startEditingName() {
    setEditedName(entryName);
    setIsEditingName(true);
    setTimeout(() => nameInputRef.current?.focus(), 0);
  }

  async function commitRename() {
    const trimmed = editedName.trim();
    if (!trimmed || trimmed === entryName) {
      setIsEditingName(false);
      setEditedName(entryName);
      return;
    }
    try {
      await renameEntry(entryName, trimmed);
      setIsEditingName(false);
      onRenamed(trimmed);
    } catch (err) {
      setError(String(err));
      setIsEditingName(false);
      setEditedName(entryName);
    }
  }

  function cancelRename() {
    setIsEditingName(false);
    setEditedName(entryName);
  }

  useEffect(() => {
    if (focused && focusedFieldIndex >= 0) {
      const el = fieldRefs.current.get(focusedFieldIndex);
      el?.scrollIntoView({ block: "nearest" });
    }
  }, [focused, focusedFieldIndex]);

  useEffect(() => {
    if (!focused || fields.length === 0) return;

    function handleKeyDown(e: KeyboardEvent) {
      if (isEditingName || showGenerator) return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;

      // Don't steal keystrokes from search or other inputs
      const tag = (e.target as HTMLElement | null)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;

      if (e.key === "ArrowDown") {
        e.preventDefault();
        setFocusedFieldIndex((prev) => Math.min(prev + 1, fields.length - 1));
        return;
      }

      if (e.key === "ArrowUp") {
        e.preventDefault();
        setFocusedFieldIndex((prev) => Math.max(prev - 1, 0));
        return;
      }

      if (e.key === "Enter") {
        e.preventDefault();
        const field = fields[focusedFieldIndex];
        if (field) handleCopy(field.key, field.value);
        return;
      }

      const key = e.key.toLowerCase();
      switch (key) {
        case "c": {
          e.preventDefault();
          const field = fields[focusedFieldIndex];
          if (field) handleCopy(field.key, field.value);
          break;
        }
        case "r": {
          e.preventDefault();
          setShowPassword(true);
          break;
        }
        case "g": {
          e.preventDefault();
          setShowGenerator(true);
          break;
        }
        case "e": {
          e.preventDefault();
          onRequestEdit();
          break;
        }
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [focused, fields, focusedFieldIndex, isEditingName, onRequestEdit, showGenerator]);

  const contentClass =
    "min-h-0 flex-1 overflow-y-auto rounded-xl bg-surface p-[30px]";

  if (loading) {
    return (
      <div className={contentClass}>
        <div className="text-xs text-dim">Decrypting...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={contentClass}>
        <div className="text-xs text-danger">{error}</div>
      </div>
    );
  }

  if (!entry) return null;

  return (
    <div className={contentClass}>
      <div className="mb-[26px]">
        {isEditingName ? (
          <input
            ref={nameInputRef}
            type="text"
            value={editedName}
            onChange={(e) => setEditedName(e.target.value)}
            onBlur={commitRename}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                commitRename();
              }
              if (e.key === "Escape") {
                e.preventDefault();
                cancelRename();
              }
            }}
            className="w-full break-all border-b border-neon bg-transparent text-[22px] font-semibold leading-[34px] text-neon font-mono outline-none"
          />
        ) : (
          <div
            className="block w-full cursor-pointer break-all border-b border-transparent font-mono text-[22px] leading-[34px] text-neon transition-colors hover:border-neon/30"
            onClick={startEditingName}
            title="Click to rename"
          >
            {entryName}
          </div>
        )}
      </div>

      <div
        ref={(el) => {
          if (el) fieldRefs.current.set(0, el);
          else fieldRefs.current.delete(0);
        }}
        className={`mb-[10px] flex items-center gap-[10px] rounded-md border border-datum-border bg-datum-bg px-[18px] py-[10px] ${
          focused && focusedFieldIndex === 0 ? "ring-1 ring-neon" : ""
        }`}
      >
        <span className="min-w-[80px] text-[11px] font-normal leading-tight tracking-wide text-dim">
          {titleCaseFieldLabel("password")}
        </span>
        <span className="flex-1 break-all font-mono text-base leading-[30px] tracking-widest text-text">
          {showPassword
            ? entry.password
            : "\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022"}
        </span>

        <button
          type="button"
          className="rounded border border-datum-border bg-surface px-2 py-[3.75px] font-mono text-sm leading-[15px] text-text transition hover:bg-hover"
          onClick={() => setShowGenerator(true)}
          title="Regenerate password"
        >
          {"\u21BB"}
        </button>
        <button
          className="rounded border border-datum-border bg-surface px-2 py-[3.75px] font-mono text-sm leading-[15px] text-text transition hover:bg-hover"
          onClick={() => setShowPassword(!showPassword)}
          title={showPassword ? "Hide" : "Reveal"}
        >
          {showPassword ? "\u25C9" : "\u25CE"}
        </button>
        <button
          className={`rounded border px-2 py-[3.75px] font-mono text-[11px] leading-[15px] transition ${
            copiedField === "password"
              ? "border-neon text-neon"
              : "border-datum-border bg-surface text-text hover:bg-hover"
          }`}
          onClick={() => handleCopy("password", entry.password)}
        >
          {copiedField === "password" ? "Copied" : "Copy"}
        </button>
      </div>

      {Object.entries(entry.fields).map(([key, value], i) => {
        const fieldIndex = i + 1;
        return (
          <div
            key={key}
            ref={(el) => {
              if (el) fieldRefs.current.set(fieldIndex, el);
              else fieldRefs.current.delete(fieldIndex);
            }}
            className={`mb-[10px] flex items-center gap-[10px] rounded-md border border-datum-border bg-datum-bg px-[18px] py-[10px] ${
              focused && focusedFieldIndex === fieldIndex
                ? "ring-1 ring-neon"
                : ""
            }`}
          >
            <span className="min-w-[80px] text-[11px] font-normal leading-tight tracking-wide text-dim">
              {titleCaseFieldLabel(key)}
            </span>
            <span className="flex-1 break-all font-mono text-text leading-[15px]">
              {value}
            </span>
            <button
              className={`rounded border px-2 py-[3.75px] font-mono text-[11px] leading-[15px] transition ${
                copiedField === key
                  ? "border-neon text-neon"
                  : "border-datum-border bg-surface text-text hover:bg-hover"
              }`}
              onClick={() => handleCopy(key, value)}
            >
              {copiedField === key ? "Copied" : "Copy"}
            </button>
          </div>
        );
      })}

      <OtpDisplay entryName={entryName} />

      {showGenerator && (
        <PasswordGenerator
          currentPassword={entry.password}
          onApply={async (newPassword) => {
            try {
              const lines = entry.raw.split("\n");
              lines[0] = newPassword;
              const updatedRaw = lines.join("\n");
              await editEntry(entryName, updatedRaw);
              setEntry(parseEntry(updatedRaw));
              setShowPassword(false);
              setShowGenerator(false);
              setError(null);
            } catch (err) {
              setError(String(err));
              setShowGenerator(false);
            }
          }}
          onCancel={() => setShowGenerator(false)}
        />
      )}
    </div>
  );
}
