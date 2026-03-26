import { useState, useEffect, useCallback } from "react";
import { listEntries, gitPull, gitPush } from "./lib/pass";
import Sidebar from "./components/Sidebar";
import EntryView from "./components/EntryView";
import EntryEditor from "./components/EntryEditor";

type View =
  | { kind: "empty" }
  | { kind: "view"; name: string }
  | { kind: "edit"; name: string }
  | { kind: "new" };

type FocusZone = "sidebar" | "main";

export default function App() {
  const [entries, setEntries] = useState<string[]>([]);
  const [view, setView] = useState<View>({ kind: "empty" });
  const [error, setError] = useState<string | null>(null);
  const [focusZone, setFocusZone] = useState<FocusZone>("sidebar");

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

  // Global keyboard shortcuts
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      const meta = e.metaKey || e.ctrlKey;

      // Cmd+Alt+Left → focus sidebar
      if (meta && e.altKey && e.key === "ArrowLeft") {
        e.preventDefault();
        setFocusZone("sidebar");
        return;
      }

      // Cmd+Alt+Right → focus main
      if (meta && e.altKey && e.key === "ArrowRight") {
        e.preventDefault();
        setFocusZone("main");
        return;
      }

      // Cmd+N → new entry
      if (meta && e.key === "n") {
        e.preventDefault();
        setView({ kind: "new" });
        setFocusZone("main");
        return;
      }

      // Cmd+E → edit current entry
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

  return (
    <div className="flex h-screen rounded-xl overflow-hidden bg-bg font-mono text-[13px] leading-[15px] text-text">
      <Sidebar
        entries={entries}
        selected={selectedName()}
        onSelect={(name) => {
          setView({ kind: "view", name });
          setFocusZone("main");
        }}
        onNewEntry={() => setView({ kind: "new" })}
        focused={focusZone === "sidebar"}
        onRequestFocus={() => setFocusZone("sidebar")}
      />
      <div className="flex flex-1 flex-col overflow-hidden">
        {error && <div className="p-[15px] text-xs text-danger">{error}</div>}

        {view.kind === "empty" && (
          <div className="flex flex-1 items-center justify-center text-sm text-dim">
            Select an entry to view
          </div>
        )}

        {view.kind === "view" && (
          <EntryView
            key={view.name}
            entryName={view.name}
            onEdit={() => setView({ kind: "edit", name: view.name })}
            onDeleted={() => {
              gitPush().catch(() => {});
              loadEntries();
              setView({ kind: "empty" });
            }}
            onRenamed={(newName) => {
              gitPush().catch(() => {});
              loadEntries();
              setView({ kind: "view", name: newName });
            }}
            focused={focusZone === "main"}
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
            key="new"
            entryName={null}
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
  );
}
