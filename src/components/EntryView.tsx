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
  const [revealed, setRevealed] = useState<Set<number>>(new Set());
  const [copiedField, setCopiedField] = useState<number | null>(null);
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
    setRevealed(new Set());
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
      { key: "password", value: entry.password, hidden: true },
      ...entry.fields,
    ];
  }, [entry]);

  async function handleCopy(index: number) {
    const field = fields[index];
    if (!field) return;
    await copyToClipboard(field.value);
    setCopiedField(index);
    setTimeout(() => setCopiedField(null), 2000);
    if (field.hidden) {
      setTimeout(() => copyToClipboard(""), 45000);
    }
  }

  function toggleReveal(index: number) {
    setRevealed((prev) => {
      const next = new Set(prev);
      if (next.has(index)) next.delete(index);
      else next.add(index);
      return next;
    });
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
        handleCopy(focusedFieldIndex);
        return;
      }

      const key = e.key.toLowerCase();
      switch (key) {
        case "c": {
          e.preventDefault();
          handleCopy(focusedFieldIndex);
          break;
        }
        case "r": {
          e.preventDefault();
          // Reveal the focused secret field, falling back to the password
          toggleReveal(fields[focusedFieldIndex]?.hidden ? focusedFieldIndex : 0);
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
          {fields.map((field, fieldIndex) => (
            <FieldBlock
              key={fieldIndex}
              label={field.key}
              focused={focused && focusedFieldIndex === fieldIndex}
              copied={copiedField === fieldIndex}
              showRuleAbove={fieldIndex > 0}
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
                handleCopy(fieldIndex);
              }}
            >
              {field.hidden ? (
                <>
                  <span className="min-w-0 font-mono text-[15px] tracking-widest text-[var(--color-datum-text)] [overflow-wrap:anywhere]">
                    {revealed.has(fieldIndex)
                      ? field.value
                      : "\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022"}
                  </span>
                  <div className="ml-auto flex items-center gap-1.5">
                    {fieldIndex === 0 && (
                      <IconButton
                        onClick={() => setShowGenerator(true)}
                        title="Regenerate password (g)"
                      >
                        {"\u21BB"}
                      </IconButton>
                    )}
                    <IconButton
                      onClick={() => toggleReveal(fieldIndex)}
                      title={revealed.has(fieldIndex) ? "Hide (r)" : "Reveal (r)"}
                    >
                      {revealed.has(fieldIndex) ? "\u25C9" : "\u25CE"}
                    </IconButton>
                  </div>
                </>
              ) : (
                <span className="min-w-0 font-mono text-[15px] text-[var(--color-datum-text)] [overflow-wrap:anywhere]">
                  {field.value}
                </span>
              )}
            </FieldBlock>
          ))}
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
              setRevealed(new Set());
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

function IconButton({
  children,
  onClick,
  title,
}: {
  children: ReactNode;
  onClick: () => void;
  title: string;
}) {
  return (
    <button
      type="button"
      className="-my-1 flex h-7 w-7 items-center justify-center rounded font-mono text-[20px] leading-none text-[var(--color-datum-text)]/70 hover:text-[var(--color-datum-text)]"
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      title={title}
    >
      {children}
    </button>
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
      onClick={onClick}
      className={`relative flex cursor-pointer flex-col transition-colors ${
        focused ? "z-10 bg-[var(--color-field-focus)]" : "bg-transparent"
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
          <span className="font-mono text-[13px] text-[var(--color-field-label)]">
            {label}
          </span>
          {copied && (
            <span className="font-mono text-[11px] text-[var(--color-surface-muted)]">
              copied
            </span>
          )}
        </div>
        <div className="flex w-full min-w-0 items-center gap-2 rounded-xl bg-[var(--color-datum-bg)] px-4 py-3 text-left">
          {children}
        </div>
      </div>
    </div>
  );
}
