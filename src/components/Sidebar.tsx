import {
  useState,
  useEffect,
  useRef,
  useCallback,
  type MouseEvent as ReactMouseEvent,
} from "react";
import SearchBar from "./SearchBar";
import { renameEntry } from "../lib/pass";

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

function normalizeSearchPath(query: string): string {
  return query.trim().replace(/\/+$/, "");
}

function ancestorPaths(path: string): string[] {
  const parts = path.split("/");
  const ancestors: string[] = [];
  for (let i = 1; i < parts.length; i++) {
    ancestors.push(parts.slice(0, i).join("/"));
  }
  return ancestors;
}

function newEntryPathForNode(node: FlatNode): string {
  if (node.isFolder) return `${node.path}/`;
  return node.parentPath ? `${node.parentPath}/` : "";
}

interface ContextMenuState {
  x: number;
  y: number;
  path: string;
  isFolder: boolean;
  name: string;
  parentPath: string | null;
}

interface SidebarProps {
  entries: string[];
  selected: string | null;
  onSelect: (path: string) => void;
  focused: boolean;
  onRequestFocus: () => void;
  onNew: (initialPath?: string) => void;
  onRenamed: (oldPath: string, newPath: string, isFolder: boolean) => void;
  /** When set, expand ancestors and focus this path in the tree. */
  revealPath?: string | null;
  onRevealHandled?: () => void;
  /** Dim only the tree pane; search controls stay full opacity. */
  dimmed?: boolean;
  /** Reports the focused file entry path (null if a folder or nothing). */
  onFocusedEntryChange?: (path: string | null) => void;
}

export default function Sidebar({
  entries,
  selected,
  onSelect,
  focused,
  onRequestFocus,
  onNew,
  onRenamed,
  revealPath = null,
  onRevealHandled,
  dimmed = false,
  onFocusedEntryChange,
}: SidebarProps) {
  const [search, setSearch] = useState("");
  const [searchActive, setSearchActive] = useState(false);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [focusedIndex, setFocusedIndex] = useState(-1);
  const [initialized, setInitialized] = useState(false);
  const [renamingPath, setRenamingPath] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [renameError, setRenameError] = useState<string | null>(null);
  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null);
  const [pendingFocusPath, setPendingFocusPath] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const rowRefs = useRef<Map<number, HTMLElement>>(new Map());
  const renameInputRef = useRef<HTMLInputElement>(null);
  const skipRenameBlurCommitRef = useRef(false);

  const filtered = search
    ? entries.filter((e) => fuzzyMatch(search, e))
    : entries;

  const tree = buildTree(filtered);

  useEffect(() => {
    if (!initialized && tree.length > 0) {
      setExpanded(new Set(collectFolderPaths(tree)));
      setInitialized(true);
    }
  }, [tree, initialized]);

  const flatNodes = flattenVisible(tree, expanded);

  useEffect(() => {
    const node = focusedIndex >= 0 ? flatNodes[focusedIndex] : null;
    if (!node || node.isFolder) {
      onFocusedEntryChange?.(null);
    } else {
      onFocusedEntryChange?.(node.path);
    }
  }, [focusedIndex, flatNodes, onFocusedEntryChange]);

  useEffect(() => {
    if (!pendingFocusPath) return;
    const idx = flatNodes.findIndex((n) => n.path === pendingFocusPath);
    if (idx >= 0) {
      setFocusedIndex(idx);
      setPendingFocusPath(null);
    }
  }, [pendingFocusPath, flatNodes]);

  const focusExactPath = useCallback(
    (rawQuery: string): boolean => {
      const query = normalizeSearchPath(rawQuery);
      if (!query) return false;

      const allFolders = new Set(collectFolderPaths(buildTree(entries)));
      const isEntry = entries.includes(query);
      const isFolder = allFolders.has(query);
      if (!isEntry && !isFolder) return false;

      setExpanded((prev) => {
        const next = new Set(prev);
        for (const ancestor of ancestorPaths(query)) {
          next.add(ancestor);
        }
        if (isFolder) next.add(query);
        return next;
      });
      onRequestFocus();
      setPendingFocusPath(query);
      return true;
    },
    [entries, onRequestFocus]
  );

  useEffect(() => {
    if (!revealPath) return;
    focusExactPath(revealPath);
    onRevealHandled?.();
  }, [revealPath, focusExactPath, onRevealHandled]);

  const toggleExpand = useCallback((path: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(path)) next.delete(path);
      else next.add(path);
      return next;
    });
  }, []);

  const collapseAll = useCallback(() => {
    setExpanded(new Set());
  }, []);

  const expandAll = useCallback(() => {
    setExpanded(new Set(collectFolderPaths(tree)));
  }, [tree]);

  const collapseLevelAndBelow = useCallback((node: FlatNode) => {
    const parent = node.parentPath;
    const minDepth = node.depth;

    setExpanded((prev) => {
      const next = new Set(prev);
      for (const path of prev) {
        const depth = path.split("/").length - 1;
        if (depth < minDepth) continue;

        if (parent === null) {
          next.delete(path);
        } else if (path.startsWith(parent + "/")) {
          next.delete(path);
        }
      }
      return next;
    });
  }, []);

  const expandLevelAndBelow = useCallback(
    (node: FlatNode) => {
      const parent = node.parentPath;
      const minDepth = node.depth;
      const folders = collectFolderPaths(tree);

      setExpanded((prev) => {
        const next = new Set(prev);
        for (const path of folders) {
          const depth = path.split("/").length - 1;
          if (depth < minDepth) continue;

          if (parent === null) {
            next.add(path);
          } else if (path.startsWith(parent + "/")) {
            next.add(path);
          }
        }
        return next;
      });
    },
    [tree]
  );

  const startRename = useCallback((node: { path: string; name: string }) => {
    setContextMenu(null);
    setRenameError(null);
    skipRenameBlurCommitRef.current = false;
    setRenamingPath(node.path);
    setRenameValue(node.name);
    setTimeout(() => {
      renameInputRef.current?.focus();
      renameInputRef.current?.select();
    }, 0);
  }, []);

  const cancelRename = useCallback(() => {
    skipRenameBlurCommitRef.current = true;
    setRenamingPath(null);
    setRenameValue("");
    setRenameError(null);
  }, []);

  const commitRename = useCallback(
    async (node: FlatNode) => {
      const trimmed = renameValue.trim();
      if (!trimmed || trimmed === node.name) {
        cancelRename();
        return;
      }
      if (trimmed.includes("/")) {
        setRenameError("Name cannot contain /");
        return;
      }

      const newPath = node.parentPath
        ? `${node.parentPath}/${trimmed}`
        : trimmed;

      try {
        await renameEntry(node.path, newPath);
        setExpanded((prev) => {
          const next = new Set<string>();
          for (const p of prev) {
            if (p === node.path) {
              next.add(newPath);
            } else if (node.isFolder && p.startsWith(node.path + "/")) {
              next.add(newPath + p.slice(node.path.length));
            } else {
              next.add(p);
            }
          }
          return next;
        });
        setRenamingPath(null);
        setRenameValue("");
        setRenameError(null);
        onRenamed(node.path, newPath, node.isFolder);
      } catch (err) {
        setRenameError(String(err));
      }
    },
    [renameValue, cancelRename, onRenamed]
  );

  useEffect(() => {
    if (focusedIndex >= 0) {
      const el = rowRefs.current.get(focusedIndex);
      el?.scrollIntoView({ block: "nearest" });
    }
  }, [focusedIndex]);

  useEffect(() => {
    if (!contextMenu) return;

    function handlePointerDown(e: MouseEvent) {
      const target = e.target as HTMLElement | null;
      if (target?.closest("[data-context-menu]")) return;
      setContextMenu(null);
    }

    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") setContextMenu(null);
    }

    window.addEventListener("mousedown", handlePointerDown);
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("mousedown", handlePointerDown);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [contextMenu]);

  useEffect(() => {
    if (!focused) return;

    function handleKeyDown(e: KeyboardEvent) {
      if (
        document.activeElement?.tagName === "INPUT" &&
        document.activeElement?.closest("[data-sidebar]")
      ) {
        return;
      }

      if (renamingPath) return;

      const len = flatNodes.length;

      if (e.key === "+" || e.code === "NumpadAdd") {
        e.preventDefault();
        const node = flatNodes[focusedIndex];
        if (node) {
          onNew(newEntryPathForNode(node));
        } else {
          onNew();
        }
        return;
      }

      if (e.key === "r" || e.key === "R") {
        if (e.metaKey || e.ctrlKey || e.altKey) return;
        const node = flatNodes[focusedIndex];
        if (!node) return;
        e.preventDefault();
        startRename(node);
        return;
      }

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
          if (e.shiftKey && (e.metaKey || e.ctrlKey)) {
            expandAll();
            break;
          }
          if (e.shiftKey) {
            const current = flatNodes[focusedIndex];
            if (current) expandLevelAndBelow(current);
            break;
          }
          const node = flatNodes[focusedIndex];
          if (!node || !node.isFolder) break;
          if (!expanded.has(node.path)) {
            toggleExpand(node.path);
          } else if (
            focusedIndex + 1 < len &&
            flatNodes[focusedIndex + 1].depth > node.depth
          ) {
            setFocusedIndex(focusedIndex + 1);
          }
          break;
        }
        case "ArrowLeft": {
          e.preventDefault();
          if (e.shiftKey && (e.metaKey || e.ctrlKey)) {
            collapseAll();
            break;
          }
          if (e.shiftKey) {
            const current = flatNodes[focusedIndex];
            if (current) collapseLevelAndBelow(current);
            break;
          }
          const current = flatNodes[focusedIndex];
          if (!current) break;
          if (current.isFolder && expanded.has(current.path)) {
            toggleExpand(current.path);
          } else if (current.parentPath) {
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
  }, [
    focused,
    flatNodes,
    focusedIndex,
    expanded,
    toggleExpand,
    collapseAll,
    collapseLevelAndBelow,
    expandAll,
    expandLevelAndBelow,
    onSelect,
    onNew,
    renamingPath,
    startRename,
  ]);

  function openContextMenu(
    e: ReactMouseEvent,
    node: FlatNode,
    index: number
  ) {
    e.preventDefault();
    onRequestFocus();
    setFocusedIndex(index);
    setContextMenu({
      x: e.clientX,
      y: e.clientY,
      path: node.path,
      isFolder: node.isFolder,
      name: node.name,
      parentPath: node.parentPath,
    });
  }

  function renderRenameInput(node: FlatNode) {
    return (
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <input
          ref={renameInputRef}
          type="text"
          value={renameValue}
          spellCheck={false}
          onChange={(e) => {
            setRenameValue(e.target.value);
            setRenameError(null);
          }}
          onBlur={() => {
            setTimeout(() => {
              if (skipRenameBlurCommitRef.current) {
                skipRenameBlurCommitRef.current = false;
                return;
              }
              if (renamingPath === node.path) {
                commitRename(node);
              }
            }, 0);
          }}
          onKeyDown={(e) => {
            e.stopPropagation();
            if (e.key === "Enter") {
              e.preventDefault();
              skipRenameBlurCommitRef.current = true;
              commitRename(node);
            }
            if (e.key === "Escape") {
              e.preventDefault();
              cancelRename();
            }
          }}
          onClick={(e) => e.stopPropagation()}
          className="min-w-0 flex-1 rounded bg-black/20 px-1 py-0 font-mono text-[13px] text-[var(--color-sidebar-text)] outline-none"
        />
        {renameError && (
          <span className="text-[10px] leading-tight text-red-700">
            {renameError}
          </span>
        )}
      </div>
    );
  }

  function renderRow(node: FlatNode, index: number) {
    const isFocused = focused && focusedIndex === index;
    const isSelected = !node.isFolder && selected === node.path;
    const isRenaming = renamingPath === node.path;
    const indentStep = 14;

    return (
      <div
        key={node.path}
        role={node.isFolder ? undefined : "button"}
        tabIndex={-1}
        data-selected={isSelected ? "true" : undefined}
        data-focused={isFocused ? "true" : undefined}
        ref={(el) => {
          if (el) rowRefs.current.set(index, el);
          else rowRefs.current.delete(index);
        }}
        className="tree-row relative flex w-full cursor-pointer items-center gap-1.5 py-[5px] text-left font-mono text-[13px] leading-[16px] text-[var(--color-sidebar-text)]"
        style={{
          paddingLeft: `${node.depth * indentStep + 14}px`,
          paddingRight: "14px",
        }}
        onClick={() => {
          if (isRenaming) return;
          onRequestFocus();
          setFocusedIndex(index);
          if (node.isFolder) {
            toggleExpand(node.path);
          } else {
            onSelect(node.path);
          }
        }}
        onContextMenu={(e) => openContextMenu(e, node, index)}
      >
        {Array.from({ length: node.depth }, (_, level) => (
          <span
            key={level}
            aria-hidden
            className="absolute top-0 bottom-0 w-[3px] bg-[var(--color-hierarchy)]"
            style={{ left: `${level * indentStep + 8}px` }}
          />
        ))}
        {node.isFolder && (
          <span className="shrink-0 text-[10px] opacity-70">
            {expanded.has(node.path) ? "\u25BE" : "\u25B8"}
          </span>
        )}
        {isRenaming ? (
          renderRenameInput(node)
        ) : (
          <span className="min-w-0 truncate">{node.name}</span>
        )}
      </div>
    );
  }

  return (
    <div
      data-sidebar
      className="flex h-full min-h-0 w-full flex-col text-[var(--color-sidebar-text)]"
    >
      <div
        ref={containerRef}
        className={`relative z-[2] min-h-0 flex-1 overflow-hidden overflow-y-auto rounded-2xl bg-[var(--color-tree-a)] transition-opacity duration-150 ${
          dimmed ? "opacity-30" : "opacity-100"
        }`}
      >
        {flatNodes.length === 0 && (
          <div className="bg-[var(--color-tree-a)] p-[15px] text-xs text-[var(--color-sidebar-muted)]">
            {search ? "No matches" : "No entries found"}
          </div>
        )}
        {flatNodes.map((node, index) => renderRow(node, index))}
      </div>

      <div className="flex shrink-0 items-center px-1 pt-2 pb-1">
        <SearchBar
          value={search}
          onChange={setSearch}
          active={searchActive}
          onActiveChange={(active) => {
            setSearchActive(active);
            if (active) onRequestFocus();
          }}
          compact
          onSubmit={() => {
            if (focusExactPath(search)) return;
            onRequestFocus();
            if (flatNodes.length > 0) setFocusedIndex(0);
          }}
          onArrowDown={() => {
            onRequestFocus();
            if (flatNodes.length > 0) setFocusedIndex(0);
          }}
        />
      </div>

      {contextMenu && (
        <div
          data-context-menu
          className="fixed z-50 min-w-[120px] overflow-hidden rounded-lg border border-black/10 bg-[var(--color-surface)] py-1 shadow-lg"
          style={{ left: contextMenu.x, top: contextMenu.y }}
        >
          <button
            type="button"
            className="block w-full px-3 py-1.5 text-left font-mono text-xs text-[var(--color-surface-text)] hover:bg-black/5"
            onClick={() => {
              startRename({
                path: contextMenu.path,
                name: contextMenu.name,
              });
            }}
          >
            Rename
          </button>
          <button
            type="button"
            className="block w-full px-3 py-1.5 text-left font-mono text-xs text-[var(--color-surface-text)] hover:bg-black/5"
            onClick={() => {
              const path = contextMenu.isFolder
                ? `${contextMenu.path}/`
                : contextMenu.parentPath
                  ? `${contextMenu.parentPath}/`
                  : "";
              setContextMenu(null);
              onNew(path);
            }}
          >
            New Entry
          </button>
        </div>
      )}
    </div>
  );
}
