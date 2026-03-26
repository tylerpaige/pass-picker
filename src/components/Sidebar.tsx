import { useState, useEffect, useRef, useCallback } from "react";
import SearchBar from "./SearchBar";

interface TreeNode {
  name: string;
  path: string;
  children: TreeNode[];
  isFolder: boolean;
}

interface FlatNode {
  path: string;
  name: string;
  isFolder: boolean;
  depth: number;
  parentPath: string | null;
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

function flattenVisible(
  nodes: TreeNode[],
  expanded: Set<string>,
  depth: number = 0,
  parentPath: string | null = null
): FlatNode[] {
  const result: FlatNode[] = [];
  for (const node of nodes) {
    result.push({
      path: node.path,
      name: node.name,
      isFolder: node.isFolder,
      depth,
      parentPath,
    });
    if (node.isFolder && expanded.has(node.path)) {
      result.push(
        ...flattenVisible(node.children, expanded, depth + 1, node.path)
      );
    }
  }
  return result;
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

function collectFolderPaths(nodes: TreeNode[]): string[] {
  const paths: string[] = [];
  for (const node of nodes) {
    if (node.isFolder) {
      paths.push(node.path);
      paths.push(...collectFolderPaths(node.children));
    }
  }
  return paths;
}

interface SidebarProps {
  entries: string[];
  selected: string | null;
  onSelect: (path: string) => void;
  focused: boolean;
  onRequestFocus: () => void;
}

export default function Sidebar({
  entries,
  selected,
  onSelect,
  focused,
  onRequestFocus,
}: SidebarProps) {
  const [search, setSearch] = useState("");
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [focusedIndex, setFocusedIndex] = useState(-1);
  const [initialized, setInitialized] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const rowRefs = useRef<Map<number, HTMLElement>>(new Map());

  const filtered = search
    ? entries.filter((e) => fuzzyMatch(search, e))
    : entries;

  const tree = buildTree(filtered);

  // Initialize all folders as expanded on first render
  useEffect(() => {
    if (!initialized && tree.length > 0) {
      setExpanded(new Set(collectFolderPaths(tree)));
      setInitialized(true);
    }
  }, [tree, initialized]);

  const flatNodes = flattenVisible(tree, expanded);

  const toggleExpand = useCallback(
    (path: string) => {
      setExpanded((prev) => {
        const next = new Set(prev);
        if (next.has(path)) next.delete(path);
        else next.add(path);
        return next;
      });
    },
    []
  );

  // Auto-scroll focused item into view
  useEffect(() => {
    if (focusedIndex >= 0) {
      const el = rowRefs.current.get(focusedIndex);
      el?.scrollIntoView({ block: "nearest" });
    }
  }, [focusedIndex]);

  // Keyboard handler
  useEffect(() => {
    if (!focused) return;

    function handleKeyDown(e: KeyboardEvent) {
      // Skip when search input is focused
      if (
        document.activeElement?.tagName === "INPUT" &&
        document.activeElement?.closest("[data-sidebar]")
      ) {
        return;
      }

      const len = flatNodes.length;
      if (len === 0) return;

      switch (e.key) {
        case "ArrowDown": {
          e.preventDefault();
          setFocusedIndex((prev) => Math.min(prev + 1, len - 1));
          break;
        }
        case "ArrowUp": {
          e.preventDefault();
          setFocusedIndex((prev) => Math.max(prev - 1, 0));
          break;
        }
        case "ArrowRight": {
          e.preventDefault();
          const node = flatNodes[focusedIndex];
          if (!node || !node.isFolder) break;
          if (!expanded.has(node.path)) {
            toggleExpand(node.path);
          } else {
            // Move to first child
            if (focusedIndex + 1 < len && flatNodes[focusedIndex + 1].depth > node.depth) {
              setFocusedIndex(focusedIndex + 1);
            }
          }
          break;
        }
        case "ArrowLeft": {
          e.preventDefault();
          const current = flatNodes[focusedIndex];
          if (!current) break;
          if (current.isFolder && expanded.has(current.path)) {
            toggleExpand(current.path);
          } else if (current.parentPath) {
            // Jump to parent folder
            const parentIdx = flatNodes.findIndex(
              (n) => n.path === current.parentPath
            );
            if (parentIdx >= 0) setFocusedIndex(parentIdx);
          }
          break;
        }
        case "Enter": {
          e.preventDefault();
          const target = flatNodes[focusedIndex];
          if (!target) break;
          if (target.isFolder) {
            toggleExpand(target.path);
          } else {
            onSelect(target.path);
          }
          break;
        }
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [focused, flatNodes, focusedIndex, expanded, toggleExpand, onSelect]);

  function renderRow(node: FlatNode, index: number) {
    const isFocused = focused && focusedIndex === index;
    const isSelected = !node.isFolder && selected === node.path;

    if (node.isFolder) {
      const isOpen = expanded.has(node.path);
      return (
        <div
          key={node.path}
          ref={(el) => {
            if (el) rowRefs.current.set(index, el);
            else rowRefs.current.delete(index);
          }}
          className={`flex cursor-pointer items-center gap-1.5 py-[4px] font-mono text-xs leading-[14px] text-sidebar-text opacity-80 hover:opacity-100 ${
            isFocused ? "ring-1 ring-sidebar-text" : ""
          }`}
          style={{ paddingLeft: `${node.depth * 16 + 12}px`, paddingRight: "12px" }}
          onClick={() => {
            onRequestFocus();
            setFocusedIndex(index);
            toggleExpand(node.path);
          }}
        >
          <span>{isOpen ? "\u25BE" : "\u25B8"}</span>
          <span>{node.name}</span>
        </div>
      );
    }

    return (
      <button
        key={node.path}
        ref={(el) => {
          if (el) rowRefs.current.set(index, el);
          else rowRefs.current.delete(index);
        }}
        className={`flex w-full cursor-pointer items-center gap-1.5 border-none bg-transparent py-[4px] text-left font-mono text-xs leading-[14px] hover:bg-white/10 ${
          isSelected ? "bg-white/15 text-sidebar-text" : "text-sidebar-text/80"
        } ${isFocused ? "ring-1 ring-sidebar-text" : ""}`}
        style={{ paddingLeft: `${node.depth * 16 + 12}px`, paddingRight: "12px" }}
        onClick={() => {
          onRequestFocus();
          setFocusedIndex(index);
          onSelect(node.path);
        }}
      >
        {node.name}
      </button>
    );
  }

  return (
    <div
      data-sidebar
      data-tauri-drag-region
      className="flex h-full min-h-0 w-full flex-col overflow-hidden rounded-xl bg-sidebar-bg text-sidebar-text"
    >
      <div data-tauri-drag-region className="flex flex-col gap-[6px] border-b border-border/30 p-[15px] pt-[25px]">
        <SearchBar value={search} onChange={setSearch} onSubmit={() => setFocusedIndex(0)} />
      </div>
      <div ref={containerRef} className="relative z-[2] mx-2 my-[7.5px] flex-1 overflow-y-auto rounded-lg">
        {flatNodes.length === 0 && (
          <div className="p-[15px] text-xs text-sidebar-text/60">
            {search ? "No matches" : "No entries found"}
          </div>
        )}
        {flatNodes.map((node, index) => renderRow(node, index))}
      </div>
    </div>
  );
}
