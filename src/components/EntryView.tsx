import { useState, useEffect, useRef, useMemo, type ReactNode } from "react";
import {
  getEntry,
  parseEntry,
  copyToClipboard,
  renameEntry,
  editEntry,
} from "../lib/pass";
import type { ParsedEntry } from "../lib/pass";
import PathTree from "./PathTree";
import OtpDisplay from "./OtpDisplay";
import PasswordGenerator from "./PasswordGenerator";

interface EntryViewProps {
  entryName: string;
  onRenamed: (newName: string) => void;
  focused: boolean;
  onRequestEdit: () => void;
  onPathSegmentClick?: (path: string) => void;
}

export default function EntryView({
  entryName,
  onRenamed,
  focused,
  onRequestEdit,
  onPathSegmentClick,
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
          setShowPassword((v) => !v);
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
  }, [
    focused,
    fields,
    focusedFieldIndex,
    isEditingName,
    onRequestEdit,
    showGenerator,
  ]);

  if (loading) {
    return (
      <div className="h-full overflow-y-auto px-4 py-2">
        <div className="text-xs text-[var(--color-surface-muted)]">
          Decrypting...
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="h-full overflow-y-auto px-4 py-2">
        <div className="text-xs text-danger">{error}</div>
      </div>
    );
  }

  if (!entry) return null;

  const extraFields = Object.entries(entry.fields);

  return (
    <div className="relative flex h-full min-h-0 flex-col">
      <div className="min-h-0 flex-1 overflow-y-auto pb-6 pt-2">
        <div className="mb-6 px-4">
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
              className="w-full bg-transparent font-mono text-[15px] leading-[1.45] text-[var(--color-entry-title)] outline-none"
            />
          ) : (
            <div
              className="cursor-default"
              onDoubleClick={startEditingName}
              title="Double-click to rename"
            >
              <PathTree
                path={entryName}
                className="text-[15px] leading-[1.45] text-[var(--color-entry-title)]"
                onSegmentClick={onPathSegmentClick}
              />
            </div>
          )}
        </div>

        <div className="flex flex-col">
          <FieldBlock
            label="password"
            focused={focused && focusedFieldIndex === 0}
            copied={copiedField === "password"}
            showRuleAbove={false}
            coverRuleBelow
            fieldRef={(el) => {
              if (el) fieldRefs.current.set(0, el);
              else fieldRefs.current.delete(0);
            }}
            onClick={() => {
              setFocusedFieldIndex(0);
              handleCopy("password", entry.password);
            }}
          >
            <span className="font-mono text-[15px] tracking-widest text-[var(--color-datum-text)]">
              {showPassword
                ? entry.password
                : "\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022"}
            </span>
            <div className="ml-auto flex items-center gap-1.5">
              <button
                type="button"
                className="rounded px-1.5 py-0.5 font-mono text-xs text-[var(--color-datum-text)]/70 hover:text-[var(--color-datum-text)]"
                onClick={(e) => {
                  e.stopPropagation();
                  setShowGenerator(true);
                }}
                title="Regenerate password (g)"
              >
                {"\u21BB"}
              </button>
              <button
                type="button"
                className="rounded px-1.5 py-0.5 font-mono text-xs text-[var(--color-datum-text)]/70 hover:text-[var(--color-datum-text)]"
                onClick={(e) => {
                  e.stopPropagation();
                  setShowPassword(!showPassword);
                }}
                title={showPassword ? "Hide (r)" : "Reveal (r)"}
              >
                {showPassword ? "\u25C9" : "\u25CE"}
              </button>
            </div>
          </FieldBlock>

          {extraFields.map(([key, value], i) => {
            const fieldIndex = i + 1;
            return (
              <FieldBlock
                key={key}
                label={key}
                focused={focused && focusedFieldIndex === fieldIndex}
                copied={copiedField === key}
                showRuleAbove
                coverRuleBelow
                ruleCoveredByPrevious={
                  focused && focusedFieldIndex === fieldIndex - 1
                }
                fieldRef={(el) => {
                  if (el) fieldRefs.current.set(fieldIndex, el);
                  else fieldRefs.current.delete(fieldIndex);
                }}
                onClick={() => {
                  setFocusedFieldIndex(fieldIndex);
                  handleCopy(key, value);
                }}
              >
                <span className="font-mono text-[15px] text-[var(--color-datum-text)]">
                  {value}
                </span>
              </FieldBlock>
            );
          })}
        </div>

        <OtpDisplay
          entryName={entryName}
          showRuleAbove
          ruleCoveredByPrevious={
            focused && focusedFieldIndex === fields.length - 1
          }
        />
      </div>

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

function FieldBlock({
  label,
  children,
  focused,
  copied,
  onClick,
  fieldRef,
  showRuleAbove = false,
  coverRuleBelow = false,
  ruleCoveredByPrevious = false,
}: {
  label: string;
  children: ReactNode;
  focused?: boolean;
  copied?: boolean;
  onClick?: () => void;
  fieldRef?: (el: HTMLElement | null) => void;
  showRuleAbove?: boolean;
  coverRuleBelow?: boolean;
  ruleCoveredByPrevious?: boolean;
}) {
  return (
    <div
      ref={fieldRef}
      className={`relative flex flex-col transition-colors ${
        focused ? "bg-[var(--color-field-focus)]" : "bg-transparent"
      }`}
      style={
        focused && coverRuleBelow
          ? { marginBottom: -6, paddingBottom: 6 }
          : undefined
      }
    >
      {showRuleAbove && (
        <div
          className={`h-[6px] ${
            focused
              ? "bg-[var(--color-field-focus)]"
              : ruleCoveredByPrevious
                ? "bg-transparent"
                : "bg-[var(--color-field-rule)]"
          }`}
        />
      )}
      <div className="flex flex-col gap-2 px-4 py-5">
        <div className="flex items-baseline justify-between">
          <span className="font-mono text-[13px] text-[var(--color-surface-muted)]">
            {label}
          </span>
          {copied && (
            <span className="font-mono text-[11px] text-[var(--color-surface-muted)]">
              copied
            </span>
          )}
        </div>
        <button
          type="button"
          onClick={onClick}
          className="flex w-full items-center gap-2 rounded-xl bg-[var(--color-datum-bg)] px-4 py-3 text-left"
        >
          {children}
        </button>
      </div>
    </div>
  );
}
