import { useState, useEffect } from "react";
import { getEntry, parseEntry, copyToClipboard, deleteEntry } from "../lib/pass";
import type { ParsedEntry } from "../lib/pass";
import OtpDisplay from "./OtpDisplay";

interface EntryViewProps {
  entryName: string;
  onEdit: () => void;
  onDeleted: () => void;
}

export default function EntryView({
  entryName,
  onEdit,
  onDeleted,
}: EntryViewProps) {
  const [entry, setEntry] = useState<ParsedEntry | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);

  useEffect(() => {
    setLoading(true);
    setError(null);
    setShowPassword(false);
    setConfirmDelete(false);
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

  async function handleCopy(field: string, value: string) {
    await copyToClipboard(value);
    setCopiedField(field);
    setTimeout(() => setCopiedField(null), 2000);

    // Auto-clear clipboard after 45s for password
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

  if (loading) return <div className="loading">Decrypting...</div>;
  if (error) return <div className="error">{error}</div>;
  if (!entry) return null;

  return (
    <div className="entry-view">
      <div className="entry-header">
        <div className="entry-name">{entryName}</div>
        <div className="entry-actions">
          <button className="btn" onClick={onEdit}>
            Edit
          </button>
          <button
            className={`btn ${confirmDelete ? "btn-danger" : ""}`}
            onClick={handleDelete}
          >
            {confirmDelete ? "Confirm Delete" : "Delete"}
          </button>
        </div>
      </div>

      <div className="field-row">
        <span className="field-label">Password</span>
        <span className="field-value password">
          {showPassword ? entry.password : "\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022"}
        </span>
        <button
          className="btn btn-small btn-icon"
          onClick={() => setShowPassword(!showPassword)}
          title={showPassword ? "Hide" : "Reveal"}
        >
          {showPassword ? "\u25C9" : "\u25CE"}
        </button>
        <button
          className={`btn btn-small ${copiedField === "password" ? "copied" : ""}`}
          onClick={() => handleCopy("password", entry.password)}
        >
          {copiedField === "password" ? "Copied" : "Copy"}
        </button>
      </div>

      {Object.entries(entry.fields).map(([key, value]) => (
        <div className="field-row" key={key}>
          <span className="field-label">{key}</span>
          <span className="field-value">{value}</span>
          <button
            className={`btn btn-small ${copiedField === key ? "copied" : ""}`}
            onClick={() => handleCopy(key, value)}
          >
            {copiedField === key ? "Copied" : "Copy"}
          </button>
        </div>
      ))}

      <OtpDisplay entryName={entryName} />
    </div>
  );
}
