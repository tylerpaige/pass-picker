import { useState } from "react";
import SearchBar from "./SearchBar";

interface TreeNode {
  name: string;
  path: string;
  children: TreeNode[];
  isFolder: boolean;
}

function buildTree(entries: string[]): TreeNode[] {
  const root: TreeNode[] = [];

  for (const entry of entries) {
    const parts = entry.split("/");
    let current = root;

    for (let i = 0; i < parts.length; i++) {
      const part = parts[i];
      const isLast = i === parts.length - 1;
      const path = parts.slice(0, i + 1).join("/");

      let existing = current.find((n) => n.name === part);
      if (!existing) {
        existing = {
          name: part,
          path,
          children: [],
          isFolder: !isLast,
        };
        current.push(existing);
      }
      if (!isLast) {
        existing.isFolder = true;
        current = existing.children;
      }
    }
  }

  function sortNodes(nodes: TreeNode[]) {
    nodes.sort((a, b) => {
      if (a.isFolder !== b.isFolder) return a.isFolder ? -1 : 1;
      return a.name.localeCompare(b.name);
    });
    for (const node of nodes) {
      if (node.children.length > 0) sortNodes(node.children);
    }
  }
  sortNodes(root);
  return root;
}

function fuzzyMatch(query: string, text: string): boolean {
  const q = query.toLowerCase();
  const t = text.toLowerCase();
  let qi = 0;
  for (let ti = 0; ti < t.length && qi < q.length; ti++) {
    if (t[ti] === q[qi]) qi++;
  }
  return qi === q.length;
}

interface FolderProps {
  node: TreeNode;
  selected: string | null;
  onSelect: (path: string) => void;
}

function Folder({ node, selected, onSelect }: FolderProps) {
  const [open, setOpen] = useState(true);

  return (
    <div className="tree-folder">
      <div className="tree-folder-label" onClick={() => setOpen(!open)}>
        <span>{open ? "\u25BE" : "\u25B8"}</span>
        <span>{node.name}</span>
      </div>
      {open && (
        <div className="tree-folder-children">
          {node.children.map((child) =>
            child.isFolder ? (
              <Folder
                key={child.path}
                node={child}
                selected={selected}
                onSelect={onSelect}
              />
            ) : (
              <button
                key={child.path}
                className={`tree-entry ${selected === child.path ? "active" : ""}`}
                onClick={() => onSelect(child.path)}
              >
                {child.name}
              </button>
            )
          )}
        </div>
      )}
    </div>
  );
}

interface SidebarProps {
  entries: string[];
  selected: string | null;
  onSelect: (path: string) => void;
  onNewEntry: () => void;
}

export default function Sidebar({
  entries,
  selected,
  onSelect,
  onNewEntry,
}: SidebarProps) {
  const [search, setSearch] = useState("");

  const filtered = search
    ? entries.filter((e) => fuzzyMatch(search, e))
    : entries;

  const tree = buildTree(filtered);

  return (
    <div className="sidebar">
      <div className="sidebar-header">
        <div className="sidebar-title">Pass Picker</div>
        <SearchBar value={search} onChange={setSearch} />
        <div className="sidebar-actions">
          <button className="btn btn-small btn-primary" onClick={onNewEntry}>
            + New
          </button>
        </div>
      </div>
      <div className="sidebar-tree">
        {tree.length === 0 && (
          <div className="loading">
            {search ? "No matches" : "No entries found"}
          </div>
        )}
        {tree.map((node) =>
          node.isFolder ? (
            <Folder
              key={node.path}
              node={node}
              selected={selected}
              onSelect={onSelect}
            />
          ) : (
            <button
              key={node.path}
              className={`tree-entry ${selected === node.path ? "active" : ""}`}
              onClick={() => onSelect(node.path)}
            >
              {node.name}
            </button>
          )
        )}
      </div>
    </div>
  );
}
