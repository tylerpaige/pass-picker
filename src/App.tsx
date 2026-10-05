import { useState, useEffect, useCallback, useMemo, type MouseEvent as ReactMouseEvent } from "react";
import { listEntries, gitPull, gitPush, deleteEntry } from "./lib/pass";
import Sidebar from "./components/Sidebar";
import EntryView from "./components/EntryView";
import EntryEditor from "./components/EntryEditor";
import EntryControlsBar from "./components/EntryControlsBar";

type View =
  | { kind: "empty" }
  | { kind: "view"; name: string }
  | { kind: "edit"; name: string }
  | { kind: "new"; initialPath?: string };

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

export default function App() {
  const [entries, setEntries] = useState<string[]>([]);
  const [view, setView] = useState<View>({ kind: "empty" });
  const [error, setError] = useState<string | null>(null);
  const [focusZone, setFocusZone] = useState<FocusZone>("sidebar");
  const [deleting, setDeleting] = useState(false);
  const [sidebarWidth, setSidebarWidth] = useState(260);

  const folderSuggestions = useMemo(
    () => collectFolderSuggestions(entries),
    [entries]
  );

  // Default to a 50/50 split between Sidebar and EntryView.
  // (We exclude the fixed gap + resize handle widths, and clamp to the allowed range.)
  useEffect(() => {
    const padding = 30; // root `p-[15px]` on both sides
    const gap = 15; // main container `gap-[15px]`
    const handle = 6; // `w-1.5` ≈ 6px

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

    // Guard in case this ever renders in a non-browser context.
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

      if (meta && e.key === "n") {
        e.preventDefault();
        setView({ kind: "new" });
        setFocusZone("main");
        return;
      }

      if (meta && e.key === "e") {
        e.preventDefault();
        setView((prev) => {
          if (prev.kind === "view") return { kind: "edit", name: prev.name };
          return prev;
        });
        setFocusZone("main");
        return;
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  function selectedName(): string | null {
    if (view.kind === "view" || view.kind === "edit") return view.name;
    return null;
  }

  const canNew =
    view.kind === "empty" || view.kind === "view" || view.kind === "new";
  const canEdit = view.kind === "view";
  const canDelete = view.kind === "view";

  function openNew(initialPath?: string) {
    setView({ kind: "new", initialPath });
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
    if (!canDelete) return;
    if (view.kind !== "view") return;
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

  const toolbarProps = {
    canNew,
    canEdit,
    canDelete,
    isDeleting: deleting,
    onNew: () => openNew(),
    onEdit: () => {
      if (view.kind !== "view") return;
      setView({ kind: "edit", name: view.name });
      setFocusZone("main");
    },
    onDelete: handleDeleteCurrentEntry,
  };

  return (
    <div className="flex h-screen flex-col overflow-hidden rounded-xl bg-bg text-[13px] leading-[15px] text-text">
      <div data-tauri-drag-region className="drag-region h-6 shrink-0" />
      <div className="flex min-h-0 flex-1 flex-col p-[15px] pt-[6px]">
        <EntryControlsBar title="Pass Picker" {...toolbarProps} />

        <div className="flex min-h-0 flex-1 gap-[15px] overflow-hidden">
          <div className="flex h-full shrink-0">
            <div
              className="h-full min-h-0 overflow-hidden"
              style={{ width: sidebarWidth }}
            >
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
              />
            </div>
            <div
              role="separator"
              aria-orientation="vertical"
              aria-label="Resize sidebar"
              className="w-1.5 shrink-0 cursor-col-resize self-stretch rounded-full hover:bg-border/40"
              onMouseDown={handleSidebarResizeStart}
            />
          </div>

          <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
            {error && (
              <div className="p-[15px] text-xs text-danger">{error}</div>
            )}

            {view.kind === "empty" && (
              <div className="flex flex-1 items-center justify-center text-sm text-dim">
                Select an entry to view
              </div>
            )}

            {view.kind === "view" && (
              <EntryView
                key={view.name}
                entryName={view.name}
                onRenamed={(newName) => {
                  gitPush().catch(() => {});
                  loadEntries();
                  setView({ kind: "view", name: newName });
                }}
                focused={focusZone === "main"}
                onRequestEdit={() => {
                  setView({ kind: "edit", name: view.name });
                  setFocusZone("main");
                }}
              />
            )}

            {view.kind === "edit" && (
              <EntryEditor
                key={`edit-${view.name}`}
                entryName={view.name}
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
          </div>
        </div>
      </div>
    </div>
  );
}
