import { useState, useEffect, useCallback, useMemo, type MouseEvent as ReactMouseEvent } from "react";
import { listEntries, gitPull, gitPush, deleteEntry } from "./lib/pass";
import Sidebar from "./components/Sidebar";
import EntryView from "./components/EntryView";
import EntryEditor from "./components/EntryEditor";
import DeleteConfirm from "./components/DeleteConfirm";

type View =
  | { kind: "empty" }
  | { kind: "view"; name: string }
  | { kind: "edit"; name: string }
  | { kind: "new"; initialPath?: string }
  | { kind: "delete"; name: string };

type FocusZone = "sidebar" | "main";

const MIN_SIDEBAR = 200;
const MAX_SIDEBAR = 560;

function collectFolderSuggestions(entries: string[]): string[] {
  const folders = new Set<string>();
  for (const entry of entries) {
    const parts = entry.split("/");
    for (let i = 1; i < parts.length; i++) {
      folders.add(parts.slice(0, i).join("/") + "/");
    }
  }
  return Array.from(folders).sort((a, b) => a.localeCompare(b));
}

const footerBtn =
  "no-drag font-mono text-[12px] text-[var(--color-pane-footer-text)]/80 transition hover:text-[var(--color-pane-footer-text)] disabled:cursor-not-allowed disabled:opacity-35";

function DetailFooter({
  canNew,
  canEdit,
  canDelete,
  onNew,
  onEdit,
  onDelete,
}: {
  canNew: boolean;
  canEdit: boolean;
  canDelete: boolean;
  onNew: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  return (
    <div className="flex shrink-0 items-center justify-between px-1 pt-2 pb-1">
      <button
        type="button"
        className={footerBtn}
        onClick={onDelete}
        disabled={!canDelete}
      >
        Delete (cmd+d)
      </button>
      <div className="flex items-center gap-5">
        <button
          type="button"
          className={footerBtn}
          onClick={onEdit}
          disabled={!canEdit}
        >
          Edit (cmd+e)
        </button>
        <button
          type="button"
          className={footerBtn}
          onClick={onNew}
          disabled={!canNew}
        >
          New (cmd+n)
        </button>
      </div>
    </div>
  );
}

export default function App() {
  const [entries, setEntries] = useState<string[]>([]);
  const [view, setView] = useState<View>({ kind: "empty" });
  const [error, setError] = useState<string | null>(null);
  const [focusZone, setFocusZone] = useState<FocusZone>("sidebar");
  const [deleting, setDeleting] = useState(false);
  const [sidebarWidth, setSidebarWidth] = useState(320);
  const [revealPath, setRevealPath] = useState<string | null>(null);
  const [sidebarFocusedEntry, setSidebarFocusedEntry] = useState<string | null>(
    null
  );

  const folderSuggestions = useMemo(
    () => collectFolderSuggestions(entries),
    [entries]
  );

  useEffect(() => {
    const padding = 24;
    const gap = 10;
    const handle = 10;

    function computeDefaultWidth() {
      const vw = window.innerWidth;
      const inner = vw - padding;
      const availableForPanels = inner - gap - handle;
      const half = availableForPanels / 2;
      const clamped = Math.round(
        Math.min(MAX_SIDEBAR, Math.max(MIN_SIDEBAR, half))
      );
      setSidebarWidth(clamped);
    }

    if (typeof window !== "undefined") computeDefaultWidth();
  }, []);

  const loadEntries = useCallback(async () => {
    try {
      await gitPull().catch(() => {});
      const list = await listEntries();
      setEntries(list.sort());
      setError(null);
    } catch (err) {
      setError(String(err));
    }
  }, []);

  useEffect(() => {
    loadEntries();
  }, [loadEntries]);

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      const meta = e.metaKey || e.ctrlKey;

      if (meta && e.altKey && e.key === "ArrowLeft") {
        e.preventDefault();
        setFocusZone("sidebar");
        return;
      }

      if (meta && e.altKey && e.key === "ArrowRight") {
        e.preventDefault();
        setFocusZone("main");
        return;
      }

      if (view.kind === "edit" || view.kind === "new" || view.kind === "delete") {
        return;
      }

      if (meta && e.key === "n") {
        e.preventDefault();
        setView({ kind: "new" });
        setFocusZone("main");
        return;
      }

      if (meta && e.key === "e") {
        e.preventDefault();
        const editTarget =
          focusZone === "sidebar" && sidebarFocusedEntry
            ? sidebarFocusedEntry
            : view.kind === "view"
              ? view.name
              : null;
        if (!editTarget) return;
        setView({ kind: "edit", name: editTarget });
        setFocusZone("main");
        return;
      }

      if (meta && e.key === "d") {
        e.preventDefault();
        setView((prev) => {
          if (prev.kind === "view") return { kind: "delete", name: prev.name };
          return prev;
        });
        return;
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [view.kind, focusZone, sidebarFocusedEntry]);

  function selectedName(): string | null {
    if (view.kind === "view" || view.kind === "edit" || view.kind === "delete") {
      return view.name;
    }
    return null;
  }

  const canNew = view.kind === "empty" || view.kind === "view";
  const canEdit =
    view.kind === "view" ||
    (focusZone === "sidebar" && sidebarFocusedEntry != null);
  const canDelete = view.kind === "view";

  function openNew(initialPath?: string) {
    setView({ kind: "new", initialPath });
    setFocusZone("main");
  }

  function openEdit(name?: string) {
    const editTarget =
      name ??
      (focusZone === "sidebar" && sidebarFocusedEntry
        ? sidebarFocusedEntry
        : view.kind === "view"
          ? view.name
          : null);
    if (!editTarget) return;
    setView({ kind: "edit", name: editTarget });
    setFocusZone("main");
  }

  function handleSidebarRenamed(
    oldPath: string,
    newPath: string,
    isFolder: boolean
  ) {
    gitPush().catch(() => {});
    loadEntries();

    setView((prev) => {
      if (prev.kind !== "view" && prev.kind !== "edit") return prev;
      if (isFolder) {
        if (prev.name === oldPath || prev.name.startsWith(oldPath + "/")) {
          return {
            ...prev,
            name: newPath + prev.name.slice(oldPath.length),
          };
        }
        return prev;
      }
      if (prev.name === oldPath) {
        return { ...prev, name: newPath };
      }
      return prev;
    });
  }

  async function handleDeleteCurrentEntry() {
    if (view.kind !== "delete") return;
    setDeleting(true);
    setError(null);
    try {
      await deleteEntry(view.name);
      gitPush().catch(() => {});
      await loadEntries();
      setView({ kind: "empty" });
      setFocusZone("sidebar");
    } catch (err) {
      setError(String(err));
      setView({ kind: "view", name: view.name });
    } finally {
      setDeleting(false);
    }
  }

  function handleSidebarResizeStart(e: ReactMouseEvent<HTMLDivElement>) {
    e.preventDefault();
    const startX = e.clientX;
    const startW = sidebarWidth;

    function onMove(ev: MouseEvent) {
      const next = startW + ev.clientX - startX;
      setSidebarWidth(Math.min(MAX_SIDEBAR, Math.max(MIN_SIDEBAR, next)));
    }

    function onUp() {
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseup", onUp);
    }

    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", onUp);
  }

  const footerProps = {
    canNew,
    canEdit,
    canDelete,
    onNew: () => openNew(),
    onEdit: () => openEdit(),
    onDelete: () => {
      if (view.kind !== "view") return;
      setView({ kind: "delete", name: view.name });
    },
  };

  const leftDimmed = focusZone === "main";
  const rightDimmed = focusZone === "sidebar";

  return (
    <div
      data-focus={focusZone}
      className="flex h-screen flex-col overflow-hidden font-mono text-[13px] leading-[15px]"
    >
      <div className="flex min-h-0 flex-1 overflow-hidden">
        {/* Left half — solid green */}
        <div
          className="flex h-full shrink-0 flex-col bg-[var(--color-left-bg)]"
          style={{ width: sidebarWidth }}
        >
          <div data-tauri-drag-region className="drag-region h-7 shrink-0" />

          <div
            className="flex min-h-0 flex-1 flex-col pl-3 pr-0.5 pb-2 pt-1"
            onMouseDown={() => setFocusZone("sidebar")}
          >
            <div className="flex shrink-0 items-center justify-end px-1 pb-2">
              <span className="font-mono text-[12px] text-[var(--color-sidebar-controls)]/80">
                Pass
              </span>
            </div>

            <div className="min-h-0 flex-1 overflow-hidden">
              <Sidebar
                entries={entries}
                selected={selectedName()}
                onSelect={(name) => {
                  setView({ kind: "view", name });
                  setFocusZone("main");
                }}
                focused={focusZone === "sidebar"}
                onRequestFocus={() => setFocusZone("sidebar")}
                onNew={openNew}
                onRenamed={handleSidebarRenamed}
                revealPath={revealPath}
                onRevealHandled={() => setRevealPath(null)}
                dimmed={leftDimmed}
                onFocusedEntryChange={setSidebarFocusedEntry}
              />
            </div>
          </div>
        </div>

        {/* Resize / divider */}
        <div
          role="separator"
          aria-orientation="vertical"
          aria-label="Resize sidebar"
          className="pane-divider shrink-0 cursor-col-resize self-stretch"
          style={{
            background: `linear-gradient(to right, var(--color-left-bg) 50%, var(--color-right-bg) 50%)`,
          }}
          onMouseDown={handleSidebarResizeStart}
        />

        {/* Right half — solid brown */}
        <div className="flex min-w-0 flex-1 flex-col bg-[var(--color-right-bg)]">
          <div data-tauri-drag-region className="drag-region h-7 shrink-0" />

          <div
            className="flex min-h-0 flex-1 flex-col pl-0.5 pr-3 pb-2 pt-1"
            onMouseDown={() => setFocusZone("main")}
          >
            <div className="flex shrink-0 items-center px-1 pb-2">
              <span className="font-mono text-[12px] text-[var(--color-pane-footer-text)]/80">
                Picker
              </span>
            </div>

            <div
              className={`flex min-h-0 flex-1 flex-col overflow-hidden rounded-2xl bg-[var(--color-surface)] text-[var(--color-surface-text)] transition-opacity duration-150 ${
                rightDimmed ? "opacity-30" : "opacity-100"
              }`}
            >
              {error && (
                <div className="px-5 pt-2 text-xs text-danger">{error}</div>
              )}

              <div className="min-h-0 flex-1 overflow-hidden">
                {(view.kind === "empty" || view.kind === "new") && (
                  <div className="flex h-full items-center justify-center text-sm text-[var(--color-surface-muted)]">
                    Select an entry to view
                  </div>
                )}

                {(view.kind === "view" ||
                  view.kind === "edit" ||
                  view.kind === "delete") && (
                  <EntryView
                    key={view.name}
                    entryName={view.name}
                    onRenamed={(newName) => {
                      gitPush().catch(() => {});
                      loadEntries();
                      setView({ kind: "view", name: newName });
                    }}
                    focused={focusZone === "main" && view.kind === "view"}
                    onRequestEdit={() => {
                      setView({ kind: "edit", name: view.name });
                      setFocusZone("main");
                    }}
                    onPathSegmentClick={(path) => {
                      setFocusZone("sidebar");
                      setRevealPath(path);
                    }}
                  />
                )}
              </div>
            </div>

            <DetailFooter {...footerProps} />
          </div>
        </div>
      </div>

      {view.kind === "edit" && (
        <EntryEditor
          key={`edit-${view.name}`}
          entryName={view.name}
          folderSuggestions={folderSuggestions}
          onSaved={(name) => {
            gitPush().catch(() => {});
            loadEntries();
            setView({ kind: "view", name });
          }}
          onCancel={() => setView({ kind: "view", name: view.name })}
        />
      )}

      {view.kind === "new" && (
        <EntryEditor
          key={`new-${view.initialPath ?? ""}`}
          entryName={null}
          initialPath={view.initialPath}
          folderSuggestions={folderSuggestions}
          onSaved={(name) => {
            gitPush().catch(() => {});
            loadEntries();
            setView({ kind: "view", name });
          }}
          onCancel={() => setView({ kind: "empty" })}
        />
      )}

      {view.kind === "delete" && (
        <DeleteConfirm
          entryName={view.name}
          isDeleting={deleting}
          onConfirm={handleDeleteCurrentEntry}
          onCancel={() => setView({ kind: "view", name: view.name })}
        />
      )}
    </div>
  );
}
