import { useEffect, useState } from "react";

interface EntryControlsBarProps {
  title?: string;
  canNew: boolean;
  canEdit: boolean;
  canDelete: boolean;
  isDeleting?: boolean;
  onNew: () => void;
  onEdit: () => void;
  onDelete: () => Promise<void> | void;
}

const btnBase =
  "inline-flex h-8 items-center justify-center rounded-none border-0 bg-transparent px-2 text-lg leading-none text-neon shadow-none transition hover:opacity-80 disabled:cursor-not-allowed disabled:opacity-50";

export default function EntryControlsBar({
  title = "Pass Picker",
  canNew,
  canEdit,
  canDelete,
  isDeleting,
  onNew,
  onEdit,
  onDelete,
}: EntryControlsBarProps) {
  const [confirmDelete, setConfirmDelete] = useState(false);

  useEffect(() => {
    if (!canDelete) setConfirmDelete(false);
  }, [canDelete]);

  async function handleDelete() {
    if (!canDelete || isDeleting) return;
    if (!confirmDelete) {
      setConfirmDelete(true);
      return;
    }

    setConfirmDelete(false);
    try {
      await onDelete();
    } catch {
      // App owns error display
    }
  }

  return (
    <div className="flex shrink-0 items-center justify-between gap-[7.5px] pt-[20px] pb-[10px]">
      <div
        data-tauri-drag-region
        className="min-w-0 flex-1 text-left text-3xl font-semibold tracking-narrow leading-tight text-neon"
      >
        {title}
      </div>
      <div className="flex shrink-0 flex-wrap items-center justify-end gap-[2px]">
        <button
          type="button"
          className={btnBase}
          onClick={onNew}
          disabled={!canNew}
        >
          + New
        </button>

        <button
          type="button"
          className={btnBase}
          onClick={onEdit}
          disabled={!canEdit}
        >
          Edit
        </button>

        <button
          type="button"
          className={`${btnBase} ${
            confirmDelete ? "text-danger hover:opacity-100" : ""
          }`}
          onClick={handleDelete}
          disabled={!canDelete || isDeleting}
        >
          {confirmDelete ? "Confirm Delete" : "Delete"}
        </button>
      </div>
    </div>
  );
}
