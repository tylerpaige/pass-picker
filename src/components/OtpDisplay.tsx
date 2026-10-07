import { useState, useEffect, useCallback } from "react";
import { getOtp, copyToClipboard } from "../lib/pass";

interface OtpDisplayProps {
  entryName: string;
  showRuleAbove?: boolean;
  ruleCoveredByPrevious?: boolean;
}

export default function OtpDisplay({
  entryName,
  showRuleAbove = false,
  ruleCoveredByPrevious = false,
}: OtpDisplayProps) {
  const [code, setCode] = useState<string | null>(null);
  const [secondsLeft, setSecondsLeft] = useState(30);
  const [copied, setCopied] = useState(false);

  const fetchOtp = useCallback(async () => {
    try {
      const otp = await getOtp(entryName);
      setCode(otp);
      setSecondsLeft(30 - (Math.floor(Date.now() / 1000) % 30));
    } catch {
      setCode(null);
    }
  }, [entryName]);

  useEffect(() => {
    fetchOtp();
  }, [fetchOtp]);

  useEffect(() => {
    if (!code) return;
    const interval = setInterval(() => {
      const remaining = 30 - (Math.floor(Date.now() / 1000) % 30);
      setSecondsLeft(remaining);
      if (remaining === 30) fetchOtp();
    }, 1000);
    return () => clearInterval(interval);
  }, [code, fetchOtp]);

  async function handleCopy() {
    if (!code) return;
    await copyToClipboard(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  if (!code) return null;

  const progress = secondsLeft / 30;
  const circumference = 2 * Math.PI * 16;
  const dashOffset = circumference * (1 - progress);

  return (
    <div className="flex flex-col">
      {showRuleAbove && (
        <div
          className={`h-[6px] ${
            ruleCoveredByPrevious
              ? "bg-transparent"
              : "bg-[var(--color-field-rule)]"
          }`}
        />
      )}
      <div className="flex flex-col gap-2 px-4 py-5">
        <div className="flex items-baseline justify-between">
          <span className="font-mono text-[13px] text-[var(--color-field-label)]">
            otp
          </span>
          {copied && (
            <span className="font-mono text-[11px] text-[var(--color-surface-muted)]">
              copied
            </span>
          )}
        </div>
        <button
          type="button"
          onClick={handleCopy}
          className="flex w-full items-center gap-4 rounded-xl bg-[var(--color-datum-bg)] px-4 py-3 text-left"
        >
          <span className="font-mono text-[22px] font-medium tracking-[4px] text-[var(--color-datum-text)]">
            {code}
          </span>
          <div className="relative ml-auto h-9 w-9 shrink-0">
            <svg
              width="36"
              height="36"
              viewBox="0 0 40 40"
              className="-rotate-90"
            >
              <circle
                cx="20"
                cy="20"
                r="16"
                fill="none"
                stroke="currentColor"
                className="text-[var(--color-datum-text)]/30"
                strokeWidth="3"
              />
              <circle
                cx="20"
                cy="20"
                r="16"
                fill="none"
                stroke="currentColor"
                className="text-[var(--color-datum-text)]"
                strokeWidth="3"
                strokeDasharray={circumference}
                strokeDashoffset={dashOffset}
                strokeLinecap="round"
              />
            </svg>
            <span className="absolute inset-0 flex items-center justify-center font-mono text-[10px] text-[var(--color-datum-text)]">
              {secondsLeft}
            </span>
          </div>
        </button>
      </div>
    </div>
  );
}
