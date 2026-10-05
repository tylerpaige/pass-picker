import { useState, useEffect, useCallback } from "react";

interface PasswordGeneratorProps {
  currentPassword: string;
  onApply: (password: string) => void;
  onCancel: () => void;
}

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

export default function PasswordGenerator({
  currentPassword,
  onApply,
  onCancel,
}: PasswordGeneratorProps) {
  const [length, setLength] = useState(20);
  const [specialChars, setSpecialChars] = useState("!@#$%^&*()_");
  const [newPassword, setNewPassword] = useState("");

  const regenerate = useCallback(() => {
    setNewPassword(generatePassword(length, specialChars));
  }, [length, specialChars]);

  useEffect(() => {
    regenerate();
  }, [regenerate]);

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.stopPropagation();
        onCancel();
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onCancel]);

  const inputClass =
    "w-full rounded-md bg-[var(--color-edit-input)] px-3 py-2.5 font-mono text-[14px] text-[var(--color-edit-text)] outline-none";

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col bg-[var(--color-edit-bg)] text-[var(--color-edit-text)]"
      onClick={(e) => {
        if (e.target === e.currentTarget) onCancel();
      }}
    >
      <div data-tauri-drag-region className="drag-region h-10 shrink-0" />

      <div className="no-drag absolute right-6 top-4 flex items-center gap-5">
        <button
          type="button"
          className="font-mono text-[15px] text-[var(--color-edit-label)] transition hover:text-[var(--color-edit-text)]"
          onClick={onCancel}
        >
          Cancel
        </button>
        <button
          type="button"
          className="font-mono text-[15px] text-[var(--color-edit-label)] transition hover:text-[var(--color-edit-text)]"
          onClick={() => onApply(newPassword)}
        >
          Save
        </button>
      </div>

      <div className="flex min-h-0 flex-1 gap-12 overflow-y-auto px-10 pb-10 pt-4">
        <div className="min-w-0 flex-1">
          <div className="mb-4 font-mono text-[13px] text-[var(--color-edit-label)]">
            regenerate password...
          </div>
        </div>

        <div className="flex min-w-0 flex-[1.15] flex-col gap-5">
          <label className="flex flex-col gap-2">
            <span className="font-mono text-[13px] text-[var(--color-edit-label)]">
              Current Password
            </span>
            <input
              type="text"
              readOnly
              value={currentPassword}
              className={inputClass}
            />
          </label>

          <label className="flex flex-col gap-2">
            <span className="font-mono text-[13px] text-[var(--color-edit-label)]">
              New Password
            </span>
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                autoFocus
                className={`flex-1 ${inputClass}`}
              />
              <button
                type="button"
                className="rounded-md bg-[var(--color-edit-input)] px-2.5 py-2.5 font-mono text-sm opacity-70 hover:opacity-100"
                onClick={regenerate}
                title="Regenerate"
              >
                {"\u21BB"}
              </button>
            </div>
          </label>

          <div className="flex flex-col gap-2">
            <span className="font-mono text-[13px] text-[var(--color-edit-label)]">
              Password Length
            </span>
            <div className="flex items-center gap-3">
              <input
                type="range"
                min={4}
                max={64}
                value={length}
                onChange={(e) => setLength(Number(e.target.value))}
                className="flex-1"
              />
              <div className="flex h-9 w-10 items-center justify-center rounded-md bg-[var(--color-edit-input)] font-mono text-[13px]">
                {length}
              </div>
            </div>
          </div>

          <label className="flex flex-col gap-2">
            <span className="font-mono text-[13px] text-[var(--color-edit-label)]">
              Special Characters to Use
            </span>
            <input
              type="text"
              value={specialChars}
              onChange={(e) => setSpecialChars(e.target.value)}
              className={inputClass}
            />
          </label>
        </div>
      </div>
    </div>
  );
}
