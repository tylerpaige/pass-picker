import {
  useState,
  useEffect,
  useMemo,
  useRef,
  useCallback,
  type ReactNode,
} from "react";
import {
  getEntry,
  editEntry,
  insertEntry,
  renameEntry,
  copyToClipboard,
} from "../lib/pass";
import PathTree from "./PathTree";

interface EntryEditorProps {
  entryName: string | null;
  initialPath?: string;
  folderSuggestions?: string[];
  onSaved: (name: string) => void;
  onCancel: () => void;
}

type FieldId =
  | "path"
  | "current"
  | "password"
  | "length"
  | "special"
  | "attributes";

function generatePassword(length: number, specialChars: string): string {
  const lower = "abcdefghijklmnopqrstuvwxyz";
  const upper = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
  const digits = "0123456789";
  const charsets = [lower, upper, digits, specialChars];
  const pool = charsets.join("");

  if (pool.length === 0) return "";

  const arr = new Uint32Array(length);
  crypto.getRandomValues(arr);

  const result: string[] = [];

  for (let i = 0; i < charsets.length; i++) {
    const cs = charsets[i];
    if (cs.length > 0) {
      result.push(cs[arr[i] % cs.length]);
    }
  }

  for (let i = result.length; i < length; i++) {
    result.push(pool[arr[i] % pool.length]);
  }

  const shuffleArr = new Uint32Array(result.length);
  crypto.getRandomValues(shuffleArr);
  for (let i = result.length - 1; i > 0; i--) {
    const j = shuffleArr[i] % (i + 1);
    [result[i], result[j]] = [result[j], result[i]];
  }

  return result.join("");
}

function splitContent(raw: string): { password: string; attributes: string } {
  const lines = raw.split("\n");
  const password = lines[0] ?? "";
  const attributes = lines.slice(1).join("\n").replace(/^\n+/, "");
  return { password, attributes };
}

function joinContent(password: string, attributes: string): string {
  const attrs = attributes.trimEnd();
  if (!attrs) return password;
  return `${password}\n${attrs}`;
}

export default function EntryEditor({
  entryName,
  initialPath = "",
  folderSuggestions = [],
  onSaved,
  onCancel,
}: EntryEditorProps) {
  const isNew = entryName === null;

  const [name, setName] = useState(entryName || initialPath || "");
  const [currentPassword, setCurrentPassword] = useState("");
  const [password, setPassword] = useState("");
  const [attributes, setAttributes] = useState("");
  const [length, setLength] = useState(12);
  const [specialChars, setSpecialChars] = useState("!@#$%^&*()_");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [suggestionIndex, setSuggestionIndex] = useState(-1);
  const [focusedField, setFocusedField] = useState<FieldId | null>(
    isNew ? "path" : "password"
  );
  const pathInputRef = useRef<HTMLInputElement>(null);
  const suggestionsRef = useRef<HTMLDivElement>(null);
  const fieldRefs = useRef<Partial<Record<FieldId, HTMLElement | null>>>({});

  const fieldOrder = useMemo((): FieldId[] => {
    return isNew
      ? ["path", "password", "length", "special", "attributes"]
      : ["path", "current", "password", "length", "special", "attributes"];
  }, [isNew]);

  function setFieldRef(id: FieldId) {
    return (el: HTMLElement | null) => {
      fieldRefs.current[id] = el;
    };
  }

  function focusField(id: FieldId) {
    setFocusedField(id);
    if (id !== "path") {
      setShowSuggestions(false);
      setSuggestionIndex(-1);
    }
    requestAnimationFrame(() => {
      fieldRefs.current[id]?.focus();
    });
  }

  const regenerate = useCallback(() => {
    setPassword(generatePassword(length, specialChars));
  }, [length, specialChars]);

  useEffect(() => {
    if (!isNew && entryName) {
      setLoading(true);
      getEntry(entryName)
        .then((raw) => {
          const { password: pw, attributes: attrs } = splitContent(
            raw.trimEnd()
          );
          setCurrentPassword(pw);
          setAttributes(attrs);
          setLoading(false);
        })
        .catch((err) => {
          setError(String(err));
          setLoading(false);
        });
    }
  }, [entryName, isNew]);

  const filteredSuggestions = useMemo(() => {
    if (!name) return folderSuggestions.slice(0, 8);
    const lower = name.toLowerCase();
    return folderSuggestions
      .filter(
        (folder) => folder.toLowerCase().includes(lower) && folder !== name
      )
      .sort((a, b) => {
        const aStarts = a.toLowerCase().startsWith(lower) ? 0 : 1;
        const bStarts = b.toLowerCase().startsWith(lower) ? 0 : 1;
        return aStarts - bStarts || a.localeCompare(b);
      })
      .slice(0, 8);
  }, [folderSuggestions, name]);

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        if (showSuggestions) {
          setShowSuggestions(false);
          return;
        }
        onCancel();
        return;
      }
      if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        handleSave();
        return;
      }

      if (e.key === "ArrowDown" || e.key === "ArrowUp") {
        // Let path suggestions own arrow keys while open
        if (
          focusedField === "path" &&
          showSuggestions &&
          filteredSuggestions.length > 0
        ) {
          return;
        }

        e.preventDefault();
        const current =
          focusedField && fieldOrder.includes(focusedField)
            ? focusedField
            : fieldOrder[0];
        const idx = fieldOrder.indexOf(current);
        const nextIdx =
          e.key === "ArrowDown"
            ? Math.min(idx + 1, fieldOrder.length - 1)
            : Math.max(idx - 1, 0);
        if (nextIdx !== idx) {
          focusField(fieldOrder[nextIdx]);
        }
      }
    }
    window.addEventListener("keydown", handleKeyDown, true);
    return () => window.removeEventListener("keydown", handleKeyDown, true);
  });

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (
        suggestionsRef.current &&
        !suggestionsRef.current.contains(e.target as Node) &&
        pathInputRef.current &&
        !pathInputRef.current.contains(e.target as Node)
      ) {
        setShowSuggestions(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  async function handleSave() {
    const finalName = name.trim().replace(/\/+$/, "");
    if (!finalName) {
      setError("Entry name is required");
      return;
    }

    const finalPassword = password.trim() || currentPassword;
    if (!finalPassword) {
      setError("Password is required");
      return;
    }

    const content = joinContent(finalPassword, attributes);

    setLoading(true);
    setError(null);
    try {
      if (isNew) {
        await insertEntry(finalName, content);
      } else {
        const original = entryName ?? "";
        if (finalName !== original) {
          await renameEntry(original, finalName);
        }
        await editEntry(finalName, content);
      }
      onSaved(finalName);
    } catch (err) {
      setError(String(err));
      setLoading(false);
    }
  }

  function applySuggestion(folder: string) {
    setName(folder);
    setShowSuggestions(false);
    setSuggestionIndex(-1);
    pathInputRef.current?.focus();
  }

  const theme = isNew
    ? {
        bg: "bg-[var(--color-new-bg)]",
        input: "bg-[var(--color-new-input)]",
        label: "text-[var(--color-new-label)]",
        text: "text-[var(--color-new-text)]",
        muted: "text-[var(--color-new-label)]",
        focus: "bg-[var(--color-new-field-focus)]",
        rule: "bg-[var(--color-new-field-rule)]",
      }
    : {
        bg: "bg-[var(--color-edit-bg)]",
        input: "bg-[var(--color-edit-input)]",
        label: "text-[var(--color-edit-label)]",
        text: "text-[var(--color-edit-text)]",
        muted: "text-[var(--color-edit-label)]",
        focus: "bg-[var(--color-edit-field-focus)]",
        rule: "bg-[var(--color-edit-field-rule)]",
      };

  const contextLabel = isNew ? "new file at..." : "editing...";
  const inputClass = `w-full rounded-md ${theme.input} px-3 py-2.5 font-mono text-[14px] ${theme.text} outline-none`;

  if (loading && !isNew && !currentPassword) {
    return (
      <div className={`fixed inset-0 z-50 flex flex-col ${theme.bg} ${theme.text}`}>
        <div className="p-10 text-sm opacity-60">Loading entry...</div>
      </div>
    );
  }

  return (
    <div className={`fixed inset-0 z-50 flex flex-col ${theme.bg} ${theme.text}`}>
      <div data-tauri-drag-region className="drag-region h-10 shrink-0" />

      <div className="no-drag absolute right-6 top-4 flex items-center gap-5">
        <button
          type="button"
          className={`font-mono text-[15px] ${theme.muted} transition hover:opacity-100 opacity-80`}
          onClick={onCancel}
          disabled={loading}
        >
          Cancel
        </button>
        <button
          type="button"
          className={`font-mono text-[15px] ${theme.muted} transition hover:opacity-100 opacity-80 disabled:opacity-40`}
          onClick={handleSave}
          disabled={loading}
        >
          {loading ? "Saving..." : "Save"}
        </button>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-6 pb-10 pt-4 sm:px-10">
        <div className="mb-8">
          <div className={`mb-4 font-mono text-[13px] ${theme.muted}`}>
            {contextLabel}
          </div>
          <PathTree
            path={name.trim() || "folder/entry-name"}
            className={`text-[22px] leading-[1.45] ${theme.text} ${
              !name.trim() ? "opacity-40" : ""
            }`}
          />
        </div>

        <div className="flex flex-col">
          {error && (
            <div className="text-sm text-red-300">{error}</div>
          )}

          <FormField
            label="Entry Path"
            focused={focusedField === "path"}
            showRuleAbove={false}
            coverRuleBelow
            theme={theme}
            className={
              showSuggestions && filteredSuggestions.length > 0
                ? "z-30"
                : undefined
            }
          >
            <div className="relative">
              <input
                ref={(el) => {
                  pathInputRef.current = el;
                  fieldRefs.current.path = el;
                }}
                type="text"
                value={name}
                spellCheck={false}
                autoCorrect="off"
                autoCapitalize="off"
                onChange={(e) => {
                  setName(e.target.value);
                  setShowSuggestions(true);
                  setSuggestionIndex(-1);
                }}
                onFocus={() => {
                  setFocusedField("path");
                  setShowSuggestions(true);
                }}
                onBlur={() => setFocusedField((f) => (f === "path" ? null : f))}
                onKeyDown={(e) => {
                  if (!showSuggestions || filteredSuggestions.length === 0)
                    return;
                  if (e.key === "ArrowDown") {
                    e.preventDefault();
                    e.stopPropagation();
                    setSuggestionIndex((prev) =>
                      Math.min(prev + 1, filteredSuggestions.length - 1)
                    );
                  } else if (e.key === "ArrowUp") {
                    e.preventDefault();
                    e.stopPropagation();
                    setSuggestionIndex((prev) => Math.max(prev - 1, -1));
                  } else if (e.key === "Enter" && suggestionIndex >= 0) {
                    e.preventDefault();
                    applySuggestion(filteredSuggestions[suggestionIndex]);
                  } else if (e.key === "Tab" && suggestionIndex >= 0) {
                    e.preventDefault();
                    applySuggestion(filteredSuggestions[suggestionIndex]);
                  } else if (e.key === "Escape" && showSuggestions) {
                    e.preventDefault();
                    e.stopPropagation();
                    setShowSuggestions(false);
                  }
                }}
                placeholder="folder/entry-name"
                autoFocus={isNew}
                className={`${inputClass} placeholder:opacity-40`}
              />
              {showSuggestions && filteredSuggestions.length > 0 && (
                <div
                  ref={suggestionsRef}
                  className={`absolute left-0 right-0 top-full z-50 mt-1 overflow-hidden rounded-md ${theme.input} shadow-lg`}
                >
                  {filteredSuggestions.map((folder, i) => (
                    <button
                      key={folder}
                      type="button"
                      className={`block w-full px-3 py-2 text-left font-mono text-[13px] ${
                        i === suggestionIndex
                          ? "bg-white/10"
                          : "hover:bg-white/5"
                      }`}
                      onMouseDown={(e) => {
                        e.preventDefault();
                        applySuggestion(folder);
                      }}
                    >
                      {folder}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </FormField>

          {!isNew && (
            <FormField
              label="Current Password"
              focused={focusedField === "current"}
              showRuleAbove
              coverRuleBelow
              ruleCoveredByPrevious={focusedField === "path"}
              theme={theme}
            >
              <input
                ref={setFieldRef("current")}
                type="text"
                readOnly
                value={currentPassword}
                onFocus={() => setFocusedField("current")}
                onBlur={() =>
                  setFocusedField((f) => (f === "current" ? null : f))
                }
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.metaKey && !e.ctrlKey) {
                    e.preventDefault();
                    void copyToClipboard(currentPassword);
                    setTimeout(() => void copyToClipboard(""), 45000);
                  }
                }}
                className={inputClass}
              />
            </FormField>
          )}

          <FormField
            label="new password"
            focused={
              focusedField === "password" ||
              focusedField === "length" ||
              focusedField === "special"
            }
            showRuleAbove
            coverRuleBelow
            ruleCoveredByPrevious={
              focusedField === "path" || focusedField === "current"
            }
            theme={theme}
          >
            <div className="flex flex-col gap-4">
              <input
                ref={setFieldRef("password")}
                type="text"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                onFocus={() => setFocusedField("password")}
                onBlur={() =>
                  setFocusedField((f) => (f === "password" ? null : f))
                }
                autoFocus={!isNew}
                className={inputClass}
              />

              <div className="flex flex-col gap-2">
                <div className="flex items-center gap-2">
                  <span>Generate with length: </span>
                  <div
                    className={`inline-flex items-center gap-0.5 rounded-md ${theme.input} ${theme.text}`}
                    onFocusCapture={() => setFocusedField("length")}
                    onBlurCapture={(e) => {
                      if (!e.currentTarget.contains(e.relatedTarget as Node)) {
                        setFocusedField((f) => (f === "length" ? null : f));
                      }
                    }}
                  >
                    <button
                      type="button"
                      tabIndex={-1}
                      className="px-2 py-1 opacity-70 hover:opacity-100"
                      onClick={() =>
                        setLength((n) => Math.max(4, n - 1))
                      }
                      aria-label="Decrease length"
                    >
                      −
                    </button>
                    <input
                      ref={setFieldRef("length")}
                      type="number"
                      min={4}
                      max={64}
                      value={length}
                      onChange={(e) => {
                        const v = Math.max(
                          4,
                          Math.min(64, Number(e.target.value) || 4)
                        );
                        setLength(v);
                      }}
                      className={`w-8 bg-transparent py-1 text-center font-mono text-[13px] ${theme.text} outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none`}
                    />
                    <button
                      type="button"
                      tabIndex={-1}
                      className="px-2 py-1 opacity-70 hover:opacity-100"
                      onClick={() =>
                        setLength((n) => Math.min(64, n + 1))
                      }
                      aria-label="Increase length"
                    >
                      +
                    </button>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span>with special characters:</span>
                  <input
                    ref={setFieldRef("special")}
                    type="text"
                    value={specialChars}
                    onChange={(e) => setSpecialChars(e.target.value)}
                    onFocus={() => setFocusedField("special")}
                    onBlur={() =>
                      setFocusedField((f) => (f === "special" ? null : f))
                    }
                    className={`flex-1 ${inputClass}`}
                  />
                </div>
                <div className="flex items-center gap-2">

                  <button
                    type="button"
                    className={`rounded-md ${theme.input} px-2.5 py-2.5 font-mono text-sm opacity-70 hover:opacity-100`}
                    onClick={regenerate}
                    title="Generate password"
                  >
                    Generate
                  </button>
                </div>
              </div>
            </div>
          </FormField>

          <FormField
            label="Additional attributes"
            focused={focusedField === "attributes"}
            showRuleAbove
            ruleCoveredByPrevious={
              focusedField === "password" ||
              focusedField === "length" ||
              focusedField === "special"
            }
            theme={theme}
          >
            <textarea
              ref={setFieldRef("attributes")}
              value={attributes}
              onChange={(e) => setAttributes(e.target.value)}
              onFocus={() => setFocusedField("attributes")}
              onBlur={() =>
                setFocusedField((f) => (f === "attributes" ? null : f))
              }
              placeholder={
                "username: user@example.com\nurl: https://example.com"
              }
              rows={5}
              className={`${inputClass} min-h-[120px] resize-y leading-relaxed`}
            />
          </FormField>
        </div>
      </div>
    </div>
  );
}

function FormField({
  label,
  children,
  focused,
  showRuleAbove,
  coverRuleBelow = false,
  ruleCoveredByPrevious = false,
  theme,
  className = "",
}: {
  label: string;
  children: ReactNode;
  focused: boolean;
  showRuleAbove: boolean;
  coverRuleBelow?: boolean;
  ruleCoveredByPrevious?: boolean;
  theme: {
    label: string;
    focus: string;
    rule: string;
  };
  className?: string;
}) {
  const hideRule = focused || ruleCoveredByPrevious;

  return (
    <div className={`relative flex flex-col ${className}`}>
      {/* Expand highlight outside the content box; bleed down to cover next rule */}
      {focused && (
        <div
          aria-hidden
          className={`pointer-events-none absolute -left-4 -right-4 top-0 z-0 ${theme.focus}`}
          style={{ bottom: coverRuleBelow ? -6 : 0 }}
        />
      )}
      {showRuleAbove && (
        <div
          className={`relative z-[1] h-[6px] ${
            hideRule ? "bg-transparent" : theme.rule
          }`}
        />
      )}
      <div className="relative z-[1] flex flex-col gap-2 py-5">
        <span className={`font-mono text-[13px] ${theme.label}`}>{label}</span>
        {children}
      </div>
    </div>
  );
}
