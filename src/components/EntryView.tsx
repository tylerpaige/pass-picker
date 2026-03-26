import { useState, useEffect, useRef, useMemo } from "react";
import { getEntry, parseEntry, copyToClipboard, deleteEntry, renameEntry } from "../lib/pass";
import type { ParsedEntry } from "../lib/pass";
import OtpDisplay from "./OtpDisplay";

interface EntryViewProps {
  entryName: string;
  onEdit: () => void;
  onDeleted: () => void;
  onRenamed: (newName: string) => void;
  focused: boolean;
}

export default function EntryView({
  entryName,
  onEdit,
  onDeleted,
  onRenamed,
  focused,
}: EntryViewProps) {
  const [entry, setEntry] = useState<ParsedEntry | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [focusedFieldIndex, setFocusedFieldIndex] = useState(0);
  const fieldRefs = useRef<Map<number, HTMLElement>>(new Map());

  // Editable name state
  const [isEditingName, setIsEditingName] = useState(false);
  const [editedName, setEditedName] = useState(entryName);
  const nameInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setLoading(true);
    setError(null);
    setShowPassword(false);
    setConfirmDelete(false);
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

  async function handleDelete() {
    if (!confirmDelete) {
      setConfirmDelete(true);
      return;
    }
    try {
      await deleteEntry(entryName);
      onDeleted();
    } catch (err) {
      setError(String(err));
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

  // Auto-scroll focused field
  useEffect(() => {
    if (focused && focusedFieldIndex >= 0) {
      const el = fieldRefs.current.get(focusedFieldIndex);
      el?.scrollIntoView({ block: "nearest" });
    }
  }, [focused, focusedFieldIndex]);

  // Keyboard handler for field navigation
  useEffect(() => {
    if (!focused || fields.length === 0) return;

    function handleKeyDown(e: KeyboardEvent) {
      // Don't intercept when editing name
      if (isEditingName) return;

      switch (e.key) {
        case "ArrowDown": {
          e.preventDefault();
          setFocusedFieldIndex((prev) => Math.min(prev + 1, fields.length - 1));
          break;
        }
        case "ArrowUp": {
          e.preventDefault();
          setFocusedFieldIndex((prev) => Math.max(prev - 1, 0));
          break;
        }
        case "Enter": {
          e.preventDefault();
          const field = fields[focusedFieldIndex];
          if (field) handleCopy(field.key, field.value);
          break;
        }
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [focused, fields, focusedFieldIndex, isEditingName]);

  if (loading) return <div className="p-[15px] text-xs text-dim">Decrypting...</div>;
  if (error) return <div className="p-[15px] text-xs text-danger">{error}</div>;
  if (!entry) return null;

  return (
    <div className="flex-1 overflow-y-auto bg-surface rounded-xl p-[30px]">
      <div className="mb-[15px] flex items-center justify-between">
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
            className="break-all text-lg font-semibold text-neon bg-transparent border-b border-neon outline-none leading-[30px] flex-1 mr-[15px]"
          />
        ) : (
          <div
            className="break-all text-lg font-semibold text-neon cursor-pointer leading-[30px] hover:border-b hover:border-neon/30"
            onClick={startEditingName}
            title="Click to rename"
          >
            {entryName}
          </div>
        )}
        <div className="flex gap-[7.5px]">
          <button
            className="rounded border border-datum-border bg-datum-bg px-[7.5px] py-[7.5px] font-mono text-xs text-text transition hover:bg-hover"
            onClick={onEdit}
          >
            Edit
          </button>
          <button
            className={`rounded border px-[7.5px] py-[7.5px] font-mono text-xs transition ${
              confirmDelete
                ? "border-danger text-danger hover:bg-danger hover:text-bg"
                : "border-datum-border bg-datum-bg text-text hover:bg-hover"
            }`}
            onClick={handleDelete}
          >
            {confirmDelete ? "Confirm Delete" : "Delete"}
          </button>
        </div>
      </div>

      {/* Password field */}
      <div
        ref={(el) => {
          if (el) fieldRefs.current.set(0, el);
          else fieldRefs.current.delete(0);
        }}
        className={`mb-[7.5px] flex items-center gap-[7.5px] rounded-md border border-datum-border bg-datum-bg px-[15px] py-[7.5px] ${
          focused && focusedFieldIndex === 0 ? "ring-1 ring-neon" : ""
        }`}
      >
        <span className="min-w-[80px] text-[11px] uppercase tracking-wide text-dim leading-[15px]">
          Password
        </span>
        <span className="flex-1 break-all text-base tracking-widest text-text leading-[30px]">
          {showPassword ? entry.password : "\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022"}
        </span>
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

      {/* Other fields */}
      {Object.entries(entry.fields).map(([key, value], i) => {
        const fieldIndex = i + 1;
        return (
          <div
            key={key}
            ref={(el) => {
              if (el) fieldRefs.current.set(fieldIndex, el);
              else fieldRefs.current.delete(fieldIndex);
            }}
            className={`mb-[7.5px] flex items-center gap-[7.5px] rounded-md border border-datum-border bg-datum-bg px-[15px] py-[7.5px] ${
              focused && focusedFieldIndex === fieldIndex ? "ring-1 ring-neon" : ""
            }`}
          >
            <span className="min-w-[80px] text-[11px] uppercase tracking-wide text-dim leading-[15px]">
              {key}
            </span>
            <span className="flex-1 break-all text-text leading-[15px]">{value}</span>
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
    </div>
  );
}
