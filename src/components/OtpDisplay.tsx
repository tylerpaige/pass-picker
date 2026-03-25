import { useState, useEffect, useCallback } from "react";
import { getOtp, copyToClipboard } from "../lib/pass";

interface OtpDisplayProps {
  entryName: string;
}

export default function OtpDisplay({ entryName }: OtpDisplayProps) {
  const [code, setCode] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [secondsLeft, setSecondsLeft] = useState(30);
  const [copied, setCopied] = useState(false);

  const fetchOtp = useCallback(async () => {
    try {
      const otp = await getOtp(entryName);
      setCode(otp);
      setError(null);
      setSecondsLeft(30 - (Math.floor(Date.now() / 1000) % 30));
    } catch {
      setCode(null);
      setError(null); // silently fail — entry may not have OTP
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
      if (remaining === 30) {
        fetchOtp();
      }
    }, 1000);
    return () => clearInterval(interval);
  }, [code, fetchOtp]);

  async function handleCopy() {
    if (!code) return;
    await copyToClipboard(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  if (error || !code) return null;

  const progress = secondsLeft / 30;
  const circumference = 2 * Math.PI * 16;
  const dashOffset = circumference * (1 - progress);

  return (
    <div className="otp-section">
      <div className="otp-label">TOTP Code</div>
      <div className="otp-display">
        <span
          className="otp-code"
          onClick={handleCopy}
          title="Click to copy"
        >
          {code}
        </span>
        <div className="otp-countdown">
          <svg width="40" height="40" viewBox="0 0 40 40">
            <circle
              cx="20"
              cy="20"
              r="16"
              fill="none"
              stroke="var(--border)"
              strokeWidth="3"
            />
            <circle
              cx="20"
              cy="20"
              r="16"
              fill="none"
              stroke="var(--cyan)"
              strokeWidth="3"
              strokeDasharray={circumference}
              strokeDashoffset={dashOffset}
              strokeLinecap="round"
            />
          </svg>
          <span className="otp-countdown-text">{secondsLeft}</span>
        </div>
        <button
          className={`btn btn-small ${copied ? "copied" : ""}`}
          onClick={handleCopy}
        >
          {copied ? "Copied" : "Copy"}
        </button>
      </div>
    </div>
  );
}
