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

  // Guarantee one from each charset
  for (let i = 0; i < charsets.length; i++) {
    const cs = charsets[i];
    if (cs.length > 0) {
      result.push(cs[arr[i] % cs.length]);
    }
  }

  // Fill remaining
  for (let i = result.length; i < length; i++) {
    result.push(pool[arr[i] % pool.length]);
  }

  // Fisher-Yates shuffle
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

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
      onClick={(e) => {
        if (e.target === e.currentTarget) onCancel();
      }}
    >
      <div className="w-[420px] rounded-lg border border-datum-border bg-surface p-[30px]">
        <div className="mb-[15px] text-sm font-semibold text-neon leading-[30px]">
          Generate Password
        </div>

        <div className="mb-[15px]">
          <label className="mb-[7.5px] block text-[11px] uppercase tracking-wide text-dim leading-[15px]">
            Current Password
          </label>
          <input
            type="text"
            readOnly
            value={currentPassword}
            className="w-full rounded border border-datum-border bg-bg px-[7.5px] py-[7.5px] font-mono text-xs text-dim outline-none leading-[15px]"
          />
        </div>

        <div className="mb-[15px]">
          <label className="mb-[7.5px] block text-[11px] uppercase tracking-wide text-dim leading-[15px]">
            New Password
          </label>
          <div className="flex items-center gap-[7.5px]">
            <input
              type="text"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              className="flex-1 rounded border border-datum-border bg-bg px-[7.5px] py-[7.5px] font-mono text-xs text-text outline-none leading-[15px] focus:border-neon"
            />
            <button
              className="rounded border border-datum-border bg-datum-bg px-2 py-[3.75px] font-mono text-sm leading-[15px] text-text transition hover:bg-hover"
              onClick={regenerate}
              title="Regenerate"
            >
              &#x1f503;
            </button>
          </div>
        </div>

        <div className="mb-[15px]">
          <label className="mb-[7.5px] block text-[11px] uppercase tracking-wide text-dim leading-[15px]">
            Length: {length}
          </label>
          <div className="flex items-center gap-[7.5px]">
            <input
              type="range"
              min={4}
              max={128}
              value={length}
              onChange={(e) => setLength(Number(e.target.value))}
              className="flex-1"
            />
            <input
              type="number"
              min={4}
              max={128}
              value={length}
              onChange={(e) => {
                const v = Math.max(4, Math.min(128, Number(e.target.value)));
                setLength(v);
              }}
              className="w-16 rounded border border-datum-border bg-bg px-2 py-[3.75px] font-mono text-xs text-text outline-none leading-[15px] focus:border-neon"
            />
          </div>
        </div>

        <div className="mb-[15px]">
          <label className="mb-[7.5px] block text-[11px] uppercase tracking-wide text-dim leading-[15px]">
            Special Characters
          </label>
          <input
            type="text"
            value={specialChars}
            onChange={(e) => setSpecialChars(e.target.value)}
            className="w-full rounded border border-datum-border bg-bg px-[7.5px] py-[7.5px] font-mono text-xs text-text outline-none leading-[15px] focus:border-neon"
          />
        </div>

        <div className="flex gap-[7.5px]">
          <button
            className="rounded border border-neon bg-neon px-[7.5px] py-[7.5px] font-mono text-xs font-semibold text-bg transition hover:opacity-85"
            onClick={() => onApply(newPassword)}
          >
            Apply
          </button>
          <button
            className="rounded border border-datum-border bg-datum-bg px-[7.5px] py-[7.5px] font-mono text-xs text-text transition hover:bg-hover"
            onClick={onCancel}
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
