interface PathTreeProps {
  path: string;
  className?: string;
  /** Called with the path prefix up to and including the clicked segment. */
  onSegmentClick?: (path: string) => void;
}

/** ASCII-style directory tree for an entry path. */
export default function PathTree({
  path,
  className = "",
  onSegmentClick,
}: PathTreeProps) {
  const parts = path.split("/").filter(Boolean);

  if (parts.length === 0) {
    return (
      <div className={`min-w-0 font-mono leading-relaxed ${className}`}>
        <div>(root)</div>
      </div>
    );
  }

  return (
    <div className={`min-w-0 font-mono leading-relaxed ${className}`}>
      {parts.map((part, i) => {
        const segmentPath = parts.slice(0, i + 1).join("/");
        const label = i === 0 ? part : `└ ${part}`;
        const rowClass =
          "min-w-0 break-all [overflow-wrap:anywhere]";

        if (!onSegmentClick) {
          return (
            <div
              key={i}
              style={{ paddingLeft: `${i * 1.25}em` }}
              className={rowClass}
            >
              {label}
            </div>
          );
        }

        return (
          <button
            key={i}
            type="button"
            style={{ paddingLeft: `${i * 1.25}em` }}
            className={`block w-full text-left transition-opacity hover:opacity-70 ${rowClass}`}
            onClick={(e) => {
              e.stopPropagation();
              onSegmentClick(segmentPath);
            }}
            onMouseDown={(e) => e.stopPropagation()}
          >
            {label}
          </button>
        );
      })}
    </div>
  );
}
