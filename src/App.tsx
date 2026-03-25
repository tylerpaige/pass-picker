import { useState, useEffect, useCallback } from "react";
import { listEntries } from "./lib/pass";
import Sidebar from "./components/Sidebar";
import EntryView from "./components/EntryView";
import EntryEditor from "./components/EntryEditor";

type View =
  | { kind: "empty" }
  | { kind: "view"; name: string }
  | { kind: "edit"; name: string }
  | { kind: "new" };

export default function App() {
  const [entries, setEntries] = useState<string[]>([]);
  const [view, setView] = useState<View>({ kind: "empty" });
  const [error, setError] = useState<string | null>(null);

  const loadEntries = useCallback(async () => {
    try {
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

  function selectedName(): string | null {
    if (view.kind === "view" || view.kind === "edit") return view.name;
    return null;
  }

  return (
    <div className="app">
      <Sidebar
        entries={entries}
        selected={selectedName()}
        onSelect={(name) => setView({ kind: "view", name })}
        onNewEntry={() => setView({ kind: "new" })}
      />
      <div className="main">
        {error && <div className="error">{error}</div>}

        {view.kind === "empty" && (
          <div className="main-empty">Select an entry to view</div>
        )}

        {view.kind === "view" && (
          <EntryView
            key={view.name}
            entryName={view.name}
            onEdit={() => setView({ kind: "edit", name: view.name })}
            onDeleted={() => {
              loadEntries();
              setView({ kind: "empty" });
            }}
          />
        )}

        {view.kind === "edit" && (
          <EntryEditor
            key={`edit-${view.name}`}
            entryName={view.name}
            onSaved={(name) => {
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
