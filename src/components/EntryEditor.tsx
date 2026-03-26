import { useState, useEffect } from "react";
import { getEntry, editEntry, insertEntry } from "../lib/pass";
import PasswordGenerator from "./PasswordGenerator";

interface EntryEditorProps {
  entryName: string | null;
  onSaved: (name: string) => void;
  onCancel: () => void;
}

export default function EntryEditor({
  entryName,
  onSaved,
  onCancel,
}: EntryEditorProps) {
  const [name, setName] = useState(entryName || "");
  const [content, setContent] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showGenerator, setShowGenerator] = useState(false);

  const isNew = entryName === null;

  useEffect(() => {
    if (!isNew && entryName) {
      setLoading(true);
      getEntry(entryName)
        .then((raw) => {
          setContent(raw.trimEnd());
          setLoading(false);
        })
        .catch((err) => {
          setError(String(err));
          setLoading(false);
        });
    }
  }, [entryName, isNew]);

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (showGenerator) return;
      if (e.key === "Escape") {
        onCancel();
      }
      if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        handleSave();
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onCancel, name, content, showGenerator]);

  async function handleSave() {
    if (!name.trim()) {
      setError("Entry name is required");
      return;
    }
    if (!content.trim()) {
      setError("Content is required");
      return;
    }

    setLoading(true);
    setError(null);
    try {
      if (isNew) {
        await insertEntry(name.trim(), content);
      } else {
        await editEntry(name.trim(), content);
      }
      onSaved(name.trim());
    } catch (err) {
      setError(String(err));
      setLoading(false);
    }
  }

  if (loading && !isNew)
    return <div className="p-[15px] text-xs text-dim">Loading entry...</div>;

  return (
    <div className="flex flex-1 flex-col overflow-y-auto bg-surface rounded-xl p-[30px]">
      <div className="mb-[15px] text-base font-semibold text-neon leading-[30px]">
        {isNew ? "New Entry" : `Edit: ${entryName}`}
      </div>

      {error && <div className="mb-[15px] text-xs text-danger">{error}</div>}

      {isNew && (
        <div className="mb-[15px]">
          <label className="mb-[7.5px] block text-[11px] uppercase tracking-wide text-dim leading-[15px]">
            Entry Path
          </label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="folder/entry-name"
            autoFocus
            className="w-full rounded border border-datum-border bg-bg px-[7.5px] py-[7.5px] font-mono text-[13px] text-text outline-none leading-[15px] focus:border-neon"
          />
        </div>
      )}

      <div className="mb-[15px]">
        <div className="mb-[7.5px] flex items-center gap-[7.5px]">
          <label className="block text-[11px] uppercase tracking-wide text-dim leading-[15px]">
            Content
          </label>
          <button
            type="button"
            className="rounded border border-datum-border bg-datum-bg px-2 py-[3.75px] font-mono text-[10px] text-text transition hover:bg-hover"
            onClick={() => setShowGenerator(true)}
          >
            Generate
          </button>
        </div>
        <textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder={"password-here\nusername: user@example.com\nurl: https://example.com\nnotes: some notes"}
          autoFocus={!isNew}
          className="min-h-[200px] w-full resize-y rounded border border-datum-border bg-bg px-[7.5px] py-[7.5px] font-mono text-[13px] text-text outline-none leading-[15px] focus:border-neon"
        />
      </div>

      <div className="mt-[7.5px] flex gap-[7.5px]">
        <button
          className="rounded border border-neon bg-neon px-[7.5px] py-[7.5px] font-mono text-xs font-semibold text-bg transition hover:opacity-85 disabled:opacity-50"
          onClick={handleSave}
          disabled={loading}
        >
          {loading ? "Saving..." : "Save"}
        </button>
        <button
          className="rounded border border-datum-border bg-datum-bg px-[7.5px] py-[7.5px] font-mono text-xs text-text transition hover:bg-hover"
          onClick={onCancel}
        >
          Cancel
        </button>
      </div>

      {showGenerator && (
        <PasswordGenerator
          currentPassword={content.split("\n")[0]}
          onApply={(newPassword) => {
            const lines = content.split("\n");
            lines[0] = newPassword;
            setContent(lines.join("\n"));
            setShowGenerator(false);
          }}
          onCancel={() => setShowGenerator(false)}
        />
      )}
    </div>
  );
}
