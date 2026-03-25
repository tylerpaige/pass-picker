import { useState, useEffect } from "react";
import { getEntry, editEntry, insertEntry } from "../lib/pass";

interface EntryEditorProps {
  entryName: string | null; // null = new entry mode
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
    return <div className="loading">Loading entry...</div>;

  return (
    <div className="editor">
      <div className="editor-title">
        {isNew ? "New Entry" : `Edit: ${entryName}`}
      </div>

      {error && <div className="error">{error}</div>}

      {isNew && (
        <div className="editor-field">
          <label>Entry Path</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="folder/entry-name"
            autoFocus
          />
        </div>
      )}

      <div className="editor-field">
        <label>Content</label>
        <textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder={"password-here\nusername: user@example.com\nurl: https://example.com\nnotes: some notes"}
          autoFocus={!isNew}
        />
      </div>

      <div className="editor-actions">
        <button
          className="btn btn-primary"
          onClick={handleSave}
          disabled={loading}
        >
          {loading ? "Saving..." : "Save"}
        </button>
        <button className="btn" onClick={onCancel}>
          Cancel
        </button>
      </div>
    </div>
  );
}
