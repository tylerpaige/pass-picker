import { useEffect } from "react";
import PathTree from "./PathTree";

interface DeleteConfirmProps {
  entryName: string;
  isDeleting?: boolean;
  onConfirm: () => void | Promise<void>;
  onCancel: () => void;
}

export default function DeleteConfirm({
  entryName,
  isDeleting,
  onConfirm,
  onCancel,
}: DeleteConfirmProps) {
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.preventDefault();
        onCancel();
      }
      if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        onConfirm();
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onCancel, onConfirm]);

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-[var(--color-delete-bg)] text-[var(--color-delete-text)]">
      <div data-tauri-drag-region className="drag-region h-10 shrink-0" />

      <div className="no-drag absolute right-6 top-4 flex items-center gap-5">
        <button
          type="button"
          className="font-mono text-[15px] text-[var(--color-delete-text)]/80 transition hover:text-[var(--color-delete-text)]"
          onClick={onCancel}
          disabled={isDeleting}
        >
          Cancel
        </button>
        <button
          type="button"
          className="font-mono text-[15px] text-[var(--color-delete-text)]/80 transition hover:text-[var(--color-delete-text)] disabled:opacity-50"
          onClick={() => onConfirm()}
          disabled={isDeleting}
        >
          {isDeleting ? "Deleting..." : "Delete"}
        </button>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-6 pb-10 pt-6 sm:px-10">
        <div className="mb-10">
          <div className="mb-4 font-mono text-[13px] text-[var(--color-delete-muted)]">
            delete confirmation for...
          </div>
          <PathTree
            path={entryName}
            className="text-[22px] leading-[1.45] text-[var(--color-delete-text)]"
          />
        </div>

        <p className="font-mono text-[22px] font-medium leading-snug text-[var(--color-delete-text)]">
          Are you sure you want to delete this file?
        </p>
      </div>
    </div>
  );
}
