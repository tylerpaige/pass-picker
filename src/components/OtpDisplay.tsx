import { useState, useEffect, useCallback } from "react";
import { getOtp, copyToClipboard } from "../lib/pass";

interface OtpDisplayProps {
  entryName: string;
}

export default function OtpDisplay({ entryName }: OtpDisplayProps) {
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
    <div className="mt-[15px] rounded-md border border-datum-border bg-datum-bg p-[15px]">
      <div className="mb-[7.5px] text-[11px] uppercase tracking-wide text-cyan leading-[15px]">
        TOTP Code
      </div>
      <div className="flex items-center gap-[15px]">
        <span
          className="cursor-pointer font-mono text-[32px] font-bold tracking-[6px] text-cyan leading-[30px] hover:opacity-80"
          onClick={handleCopy}
          title="Click to copy"
        >
          {code}
        </span>
        <div className="relative h-10 w-10">
          <svg
            width="40"
            height="40"
            viewBox="0 0 40 40"
            className="-rotate-90"
          >
            <circle
              cx="20"
              cy="20"
              r="16"
              fill="none"
              className="stroke-dim"
              strokeWidth="3"
            />
            <circle
              cx="20"
              cy="20"
              r="16"
              fill="none"
              className="stroke-cyan"
              strokeWidth="3"
              strokeDasharray={circumference}
              strokeDashoffset={dashOffset}
              strokeLinecap="round"
            />
          </svg>
          <span className="absolute inset-0 flex items-center justify-center font-mono text-xs text-cyan leading-[15px]">
            {secondsLeft}
          </span>
        </div>
        <button
          className={`rounded border px-2 py-[3.75px] font-mono text-[11px] leading-[15px] transition ${
            copied
              ? "border-neon text-neon"
              : "border-datum-border bg-surface text-text hover:bg-hover"
          }`}
          onClick={handleCopy}
        >
          {copied ? "Copied" : "Copy"}
        </button>
      </div>
    </div>
  );
}
