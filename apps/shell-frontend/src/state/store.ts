import { useSyncExternalStore } from "react";
import {
  Command,
  Diagnostic,
  EditorSplit,
  OpenTab,
  WorkspaceNode,
  ActivityView,
  BottomView,
  LanguageMode,
} from "../types";

import { importFilesIntoWorkspace, setFileAtPath, type ImportedFile } from "../workspace/importers.ts";
import { parseGistId, fetchGistFiles } from "../workspace/gist.ts";
import { connectDirectoryPicker, readDirectoryAsFiles } from "../workspace/localFs.ts";
import { wsClone } from "../core/api.ts";
import type { DocItem } from "../docs/catalog.ts";
import { searchCatalog } from "../docs/search.ts";
import { searchDocs } from "../docs/searchDocs.ts";
import { importFromHttpUrl } from "../workspace/httpImport.ts";
import { pickFolderAsFiles } from "../workspace/folderPicker.ts";
import { importFromIpfsRef } from "../workspace/ipfsImport.ts";

const STORAGE_KEY = "cardano.ide.workspace.v1";

function makePersistableState(state: any) {
  // Persist everything EXCEPT big file contents.
  // Keep node structure, but blank out content for files.
  const nodes = Object.fromEntries(
    Object.entries(state.nodes).map(([id, n]: any) => {
      if (n?.type === "file") {
        return [id, { ...n, content: "" }]; // keep name, type, parentId, etc.
      }
      return [id, n];
    })
  );

  // Also don't persist noisy logs that can grow forever.
  return {
    ...state,
    nodes,
    terminalLines: state.terminalLines?.slice(-200) ?? [],
    outputLines: state.outputLines?.slice(-400) ?? [],
    diagnostics: state.diagnostics ?? [],
    toasts: [],

    // editor view state stays as you already force home-first at loadState anyway
    // (so this is safe even if you keep it)
  };
}

type Toast = { id: string; message: string; kind: "info" | "error" };

type Layout = {
  sideWidth: number;
  bottomHeight: number;
  showSidePanel: boolean;
  showBottomPanel: boolean;
  splitOrientation: "none" | "vertical" | "horizontal";
};

type State = {
  nodes: Record<string, WorkspaceNode>;
  rootId: string;
  openTabs: OpenTab[];
  activeTabId: string | null;
  dirty: Record<string, boolean>;
  recentFiles: string[];
  closedTabStack: OpenTab[];
  activity: ActivityView;
  bottomView: BottomView;
  layout: Layout;
  theme: "dark" | "light";
  settings: { tabSize: number; lineEnding: "LF" | "CRLF"; insertSpaces: boolean };
  diagnostics: Diagnostic[];
  outputLines: string[];
  terminalLines: string[];
  terminalInput: string;
  branch: string;
  cursor: { line: number; column: number };
  activeLanguage: LanguageMode;
  splits: EditorSplit[];
  toasts: Toast[];
  commands: Record<string, Command>;
};

const uid = () => Math.random().toString(36).slice(2, 9);

function pathOf(id: string, nodes: Record<string, WorkspaceNode>): string {
  const chunks: string[] = [];
  let cur: WorkspaceNode | undefined = nodes[id];
  while (cur && cur.parentId) {
    chunks.unshift(cur.name);
    cur = nodes[cur.parentId];
  }
  return chunks.join("/");
}

function detectLanguage(name: string): LanguageMode {
  if (name.endsWith(".ts") || name.endsWith(".tsx")) return "typescript";
  if (name.endsWith(".js") || name.endsWith(".jsx")) return "javascript";
  if (name.endsWith(".json")) return "json";
  if (name.endsWith(".md")) return "markdown";
  return "plaintext";
}

function createInitialState(): State {
  const rootId = "root";
  const srcId = "src";
  const readmeId = "readme";
  const mainId = "main";

  const nodes: Record<string, WorkspaceNode> = {
    [rootId]: { id: rootId, name: "workspace", type: "folder", parentId: null, childrenIds: [srcId, readmeId] },
    [srcId]: { id: srcId, name: "src", type: "folder", parentId: rootId, childrenIds: [mainId] },
    [readmeId]: {
      id: readmeId,
      name: "README.md",
      type: "file",
      parentId: rootId,
      content: "# Cardano IDE\n",
      language: "markdown",
    },
    [mainId]: {
      id: mainId,
      name: "Main.ts",
      type: "file",
      parentId: srcId,
      content: "export const hello = 'Cardano';\n",
      language: "typescript",
    },
  };

  return {
    nodes,
    rootId,
    openTabs: [],
    activeTabId: null,
    dirty: {},
    recentFiles: [],
    closedTabStack: [],
    activity: "explorer",
    bottomView: "terminal",
    layout: { sideWidth: 280, bottomHeight: 190, showSidePanel: true, showBottomPanel: true, splitOrientation: "none" },
    theme: "dark",
    settings: { tabSize: 2, lineEnding: "LF", insertSpaces: true },
    diagnostics: [{ id: uid(), nodeId: mainId, message: "Unused binding: hello", severity: "warning", line: 1, column: 14 }],
    outputLines: ["[output] Cardano IDE initialized"],
    terminalLines: ["cardano@ide:$ welcome"],
    terminalInput: "",
    branch: "main",
    cursor: { line: 1, column: 1 },
    activeLanguage: "typescript",
    splits: [{ id: "primary", tabIds: [], activeTabId: null }],
    toasts: [],
    commands: {},
  };
}

function loadState(): State {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return createInitialState();

    const persisted = JSON.parse(raw) as Partial<State>;
    const base = createInitialState();

    const merged: State = { ...base, ...persisted } as State;

    // ✅ HOME-FIRST: do NOT restore editor tabs
    return {
      ...merged,
      openTabs: [],
      activeTabId: null,
      splits:
        merged.splits?.map((sp) => ({ ...sp, tabIds: [], activeTabId: null })) ?? [{ id: "primary", tabIds: [], activeTabId: null }],
    };
  } catch {
    return createInitialState();
  }
}

class IDEStore {
  private state: State = loadState();
  private listeners = new Set<() => void>();

  subscribe = (cb: () => void) => {
    this.listeners.add(cb);
    return () => this.listeners.delete(cb);
  };

  searchDocumentation(query: string) {
  const docs = searchDocs(query).map((d) => ({
    kind: "doc",
    item: d
  }));

  const local = this.searchInFiles(query).map((m) => ({
    kind: "local",
    nodeId: m.nodeId,
    title: m.path,
    path: m.path,
    preview: m.preview
  }));

  return [...docs, ...local];
}

openDocumentationUrl(url: string) {
  window.open(url, "_blank");
}

  //   // ---------------------------------------------------------------------------
  // // ✅ Documentation search (catalog + local workspace)
  // // ---------------------------------------------------------------------------

  // searchDocumentation(query: string): Array<
  //   | { kind: "doc"; item: DocItem }
  //   | { kind: "local"; title: string; path: string; nodeId: string; preview: string }
  // > {
  //   const q = (query ?? "").trim();
  //   if (!q) return [];

  //   // 1) Cardano docs catalog search
  //   const docs = searchCatalog(q).map((item) => ({ kind: "doc" as const, item }));

  //   // 2) Local workspace search (Markdown + any file contents)
  //   const localMatches = this.searchInFiles(q)
  //     .slice(0, 25)
  //     .map((m) => {
  //       const node = this.state.nodes[m.nodeId];
  //       return {
  //         kind: "local" as const,
  //         title: node?.name ?? m.path,
  //         path: m.path,
  //         nodeId: m.nodeId,
  //         preview: m.preview,
  //       };
  //     });

  //   return [...docs, ...localMatches].slice(0, 30);
  // }

  // openDocumentationUrl(url: string) {
  //   window.open(url, "_blank", "noopener,noreferrer");
  // }

  getState = () => this.state;

  private setState = (updater: (s: State) => State) => {
  this.state = updater(this.state);

  // Persist safely (avoid quota exceeded)
  try {
    const persistable = makePersistableState(this.state);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(persistable));
  } catch (e) {
    // If storage quota is exceeded, don't crash the app.
    console.warn("[persist] Failed to save workspace (quota). Keeping in-memory state only.", e);

    // Optional: auto-trim logs further and try once more
    try {
      const trimmed = makePersistableState({
        ...this.state,
        terminalLines: this.state.terminalLines.slice(-50),
        outputLines: this.state.outputLines.slice(-100),
      });
      localStorage.setItem(STORAGE_KEY, JSON.stringify(trimmed));
    } catch (e2) {
      console.warn("[persist] Still cannot persist after trimming.", e2);
    }

    // Optional: tell the user once
    // (avoid spamming toasts in loops)
    if (!(this.state as any).__quotaWarned) {
      (this.state as any).__quotaWarned = true;
      this.toast("Workspace too large to save in browser storage. Data kept in memory.", "error");
    }
  }

  this.listeners.forEach((l) => l());
};

  toast(message: string, kind: "info" | "error" = "info") {
    const id = uid();
    this.setState((s) => ({ ...s, toasts: [...s.toasts, { id, message, kind }] }));
    window.setTimeout(() => this.dismissToast(id), 2400);
  }
  dismissToast(id: string) {
    this.setState((s) => ({ ...s, toasts: s.toasts.filter((t) => t.id !== id) }));
  }

  setTheme(theme: "dark" | "light") {
    this.setState((s) => ({ ...s, theme }));
  }
  toggleTheme() {
    this.setTheme(this.state.theme === "dark" ? "light" : "dark");
  }
  setActivity(activity: ActivityView) {
    this.setState((s) => ({ ...s, activity }));
  }
  setBottomView(bottomView: BottomView) {
    this.setState((s) => ({ ...s, bottomView }));
  }
  toggleBottomPanel() {
    this.setState((s) => ({ ...s, layout: { ...s.layout, showBottomPanel: !s.layout.showBottomPanel } }));
  }
  toggleSidePanel() {
    this.setState((s) => ({ ...s, layout: { ...s.layout, showSidePanel: !s.layout.showSidePanel } }));
  }
  resizeSidePanel(sideWidth: number) {
    this.setState((s) => ({ ...s, layout: { ...s.layout, sideWidth: Math.max(200, Math.min(520, sideWidth)) } }));
  }
  resizeBottomPanel(bottomHeight: number) {
    this.setState((s) => ({ ...s, layout: { ...s.layout, bottomHeight: Math.max(120, Math.min(420, bottomHeight)) } }));
  }

  openFile(nodeId: string, splitId = "primary") {
    const node = this.state.nodes[nodeId];
    if (!node || node.type !== "file") return;

    const exists = this.state.openTabs.find((t) => t.nodeId === nodeId);
    const path = pathOf(nodeId, this.state.nodes);
    const tab = exists ?? { id: uid(), nodeId, title: node.name, path };

    this.setState((s) => {
      const openTabs = exists ? s.openTabs : [...s.openTabs, tab];
      const recentFiles = [nodeId, ...s.recentFiles.filter((x) => x !== nodeId)].slice(0, 15);
      const splits = s.splits.map((sp) =>
        sp.id === splitId
          ? { ...sp, tabIds: sp.tabIds.includes(tab.id) ? sp.tabIds : [...sp.tabIds, tab.id], activeTabId: tab.id }
          : sp
      );
      return { ...s, openTabs, activeTabId: tab.id, recentFiles, splits, activeLanguage: node.language ?? detectLanguage(node.name) };
    });
  }

  closeTab(tabId: string) {
    this.setState((s) => {
      const tab = s.openTabs.find((t) => t.id === tabId);
      const openTabs = s.openTabs.filter((t) => t.id !== tabId);
      const splits = s.splits.map((sp) => ({
        ...sp,
        tabIds: sp.tabIds.filter((id) => id !== tabId),
        activeTabId: sp.activeTabId === tabId ? sp.tabIds.find((x) => x !== tabId) ?? null : sp.activeTabId,
      }));
      return {
        ...s,
        openTabs,
        activeTabId: s.activeTabId === tabId ? openTabs[openTabs.length - 1]?.id ?? null : s.activeTabId,
        closedTabStack: tab ? [tab, ...s.closedTabStack] : s.closedTabStack,
        splits,
      };
    });
  }

  reopenClosedTab() {
    const tab = this.state.closedTabStack[0];
    if (!tab) return this.toast("No recently closed tab");
    this.setState((s) => ({ ...s, closedTabStack: s.closedTabStack.slice(1) }));
    this.openFile(tab.nodeId);
  }

  updateContent(tabId: string, content: string) {
    const tab = this.state.openTabs.find((t) => t.id === tabId);
    if (!tab) return;
    this.setState((s) => ({
      ...s,
      nodes: { ...s.nodes, [tab.nodeId]: { ...s.nodes[tab.nodeId], content } },
      dirty: { ...s.dirty, [tab.nodeId]: true },
    }));
  }

  saveFile(tabId: string) {
    const tab = this.state.openTabs.find((t) => t.id === tabId);
    if (!tab) return;

    this.setState((s) => {
      const dirty = { ...s.dirty };
      delete dirty[tab.nodeId];
      return { ...s, dirty, outputLines: [...s.outputLines, `[save] ${tab.path}`] };
    });
    this.toast("File saved");
  }

  saveAll() {
    this.setState((s) => ({ ...s, dirty: {}, outputLines: [...s.outputLines, `[save-all] ${Object.keys(s.dirty).length} files`] }));
    this.toast("All files saved");
  }

  setCursor(line: number, column: number) {
    this.setState((s) => ({ ...s, cursor: { line, column } }));
  }

  setLanguage(tabId: string, language: LanguageMode) {
    const tab = this.state.openTabs.find((t) => t.id === tabId);
    if (!tab) return;
    this.setState((s) => ({ ...s, nodes: { ...s.nodes, [tab.nodeId]: { ...s.nodes[tab.nodeId], language } }, activeLanguage: language }));
  }

  createNode(parentId: string, type: "file" | "folder", name: string) {
    const id = uid();
    this.setState((s) => {
      const parent = s.nodes[parentId];
      if (!parent || parent.type !== "folder") return s;

      const node: WorkspaceNode = {
        id,
        name,
        type,
        parentId,
        childrenIds: type === "folder" ? [] : undefined,
        content: type === "file" ? "" : undefined,
        language: type === "file" ? detectLanguage(name) : undefined,
      };

      return {
        ...s,
        nodes: { ...s.nodes, [id]: node, [parentId]: { ...parent, childrenIds: [...(parent.childrenIds ?? []), id] } },
      };
    });

    this.toast(`${type} created`);
    if (type === "file") this.openFile(id);
  }

  renameNode(id: string, name: string) {
    this.setState((s) => ({ ...s, nodes: { ...s.nodes, [id]: { ...s.nodes[id], name } } }));
  }

  deleteNode(id: string) {
    const ok = window.confirm("Delete item? This cannot be undone.");
    if (!ok) return;

    this.setState((s) => {
      const node = s.nodes[id];
      if (!node || !node.parentId) return s;

      const nodes = { ...s.nodes };
      const remove = (n: string) => {
        const cur = nodes[n];
        if (!cur) return;
        (cur.childrenIds ?? []).forEach(remove);
        delete nodes[n];
      };
      remove(id);

      const parent = nodes[node.parentId];
      if (parent) parent.childrenIds = (parent.childrenIds ?? []).filter((cid) => cid !== id);

      const openTabs = s.openTabs.filter((t) => t.nodeId !== id);

      return { ...s, nodes, openTabs };
    });
  }

  duplicateNode(id: string) {
    const node = this.state.nodes[id];
    if (!node || !node.parentId) return;
    this.createNode(node.parentId, node.type, `${node.name}.copy`);
  }

  moveNode(id: string, parentId: string) {
    this.setState((s) => {
      const node = s.nodes[id];
      const parent = s.nodes[parentId];
      if (!node || !node.parentId || !parent || parent.type !== "folder") return s;

      const oldParent = s.nodes[node.parentId];

      return {
        ...s,
        nodes: {
          ...s.nodes,
          [id]: { ...node, parentId },
          [oldParent.id]: { ...oldParent, childrenIds: (oldParent.childrenIds ?? []).filter((c) => c !== id) },
          [parentId]: { ...parent, childrenIds: [...(parent.childrenIds ?? []), id] },
        },
      };
    });
  }

  setSplitOrientation(splitOrientation: Layout["splitOrientation"]) {
    this.setState((s) => ({ ...s, layout: { ...s.layout, splitOrientation } }));
  }

  registerCommand(command: Command) {
    this.setState((s) => ({ ...s, commands: { ...s.commands, [command.id]: command } }));
  }

  executeCommand(id: string, args?: unknown) {
    const cmd = this.state.commands[id];
    if (!cmd) return this.toast(`Command not found: ${id}`, "error");
    try {
      cmd.handler(args);
    } catch {
      this.toast(`Command failed: ${cmd.title}`, "error");
    }
  }

  runTerminalInput(input: string) {
    this.setState((s) => ({
      ...s,
      terminalLines: [...s.terminalLines, `$ ${input}`, `Executed: ${input}`].slice(-500),
      outputLines: [...s.outputLines, `[terminal] ${input}`].slice(-800),
    }));
  }

  clearOutput() {
    this.setState((s) => ({ ...s, outputLines: [] }));
  }

  searchInFiles(query: string) {
    const q = query.toLowerCase();
    return Object.values(this.state.nodes)
      .filter((n) => n.type === "file" && (n.content ?? "").toLowerCase().includes(q))
      .map((n) => ({
        nodeId: n.id,
        path: pathOf(n.id, this.state.nodes),
        preview: (n.content ?? "").split("\n").find((line) => line.toLowerCase().includes(q)) ?? "",
      }));
  }

  exportWorkspace() {
    const blob = new Blob([JSON.stringify(this.state, null, 2)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "cardano-workspace.json";
    a.click();
    this.toast("Workspace exported");
  }

  importWorkspace(file: File) {
    file
      .text()
      .then((text) => {
        const imported = JSON.parse(text);
        this.setState((_) => ({ ...createInitialState(), ...imported }));
        this.toast("Workspace imported");
      })
      .catch(() => this.toast("Import failed", "error"));
  }

  resetWorkspace() {
    if (!window.confirm("Reset workspace to defaults?")) return;
    this.setState(() => createInitialState());
  }

  // ---------------------------------------------------------------------------
  // ✅ NEW SAFE HELPERS (do not break existing UI)
  // ---------------------------------------------------------------------------

  /**
   * Add/update files into current in-memory workspace tree.
   * This touches ONLY nodes tree; it doesn't break editor tabs.
   */
  private applyImportedFiles(files: ImportedFile[], rootFolderName = "imports") {
    this.setState((s) => {
      const nextNodes = importFilesIntoWorkspace(s.nodes, s.rootId, files, rootFolderName);
      return { ...s, nodes: nextNodes, outputLines: [...s.outputLines, `[import] ${files.length} file(s)`] };
    });
  }

  /** Open local files via browser file picker (works everywhere) */
  async openFromFilePicker(): Promise<boolean> {
    try {
      const input = document.createElement("input");
      input.type = "file";
      input.multiple = true;
      input.accept = "*/*";

      const files: File[] = await new Promise((resolve) => {
        input.onchange = () => resolve(Array.from(input.files ?? []));
        input.click();
      });

      if (!files.length) return false;

      const imported: ImportedFile[] = [];
      for (const f of files) {
        const content = await f.text();
        imported.push({ path: f.name, content });
      }

      this.applyImportedFiles(imported, "opened");
      this.toast(`Opened ${files.length} file(s)`);
      return true;
    } catch (e) {
      console.error(e);
      this.toast("Open failed", "error");
      return false;
    }
  }

    /** Upload Folder (browser picker). Does not break anything if unsupported. */
  async openFolderFromPicker(): Promise<boolean> {
    try {
      const files = await pickFolderAsFiles();
      if (!files.length) return false;
      this.applyImportedFiles(files, "folder-upload");
      this.toast(`Uploaded folder (${files.length} file(s))`);
      return true;
    } catch (e) {
      console.error(e);
      this.toast("Folder upload not supported or cancelled.", "error");
      return false;
    }
  }

  /** Import a single file from HTTPS url (raw text). */
  async importFromHttp(url: string): Promise<boolean> {
    try {
      const files = await importFromHttpUrl(url);
      if (!files.length) {
        this.toast("No importable content from URL", "error");
        return false;
      }
      this.applyImportedFiles(files, "https-import");
      this.toast("Imported from URL");
      return true;
    } catch (e) {
      console.error(e);
      this.toast("HTTPS import failed", "error");
      return false;
    }
  }

  /** Import from IPFS (CID or ipfs://...). Uses public gateway by default. */
  async importFromIpfs(cidOrUrl: string): Promise<boolean> {
    try {
      const files = await importFromIpfsRef(cidOrUrl);
      if (!files.length) {
        this.toast("IPFS import returned no files", "error");
        return false;
      }
      this.applyImportedFiles(files, "ipfs-import");
      this.toast(`Imported from IPFS (${files.length} file(s))`);
      return true;
    } catch (e) {
      console.error(e);
      this.toast("IPFS import failed", "error");
      return false;
    }
  }

  /**
   * Connect to Local Filesystem (Remix-style).
   * Uses File System Access API if supported.
   * If not supported, it won't crash; it will toast.
   */
  async connectLocalFilesystem(): Promise<boolean> {
    try {
      const dir = await connectDirectoryPicker();
      if (!dir) return false;

      const files = await readDirectoryAsFiles(dir);
      if (!files.length) {
        this.toast("No files found in selected directory");
        return false;
      }

      this.applyImportedFiles(files, dir.name || "local");
      this.toast(`Connected: ${dir.name} (${files.length} file(s))`);
      return true;
    } catch (e) {
      console.error(e);
      this.toast("Local filesystem not supported in this browser or permission denied.", "error");
      return false;
    }
  }

  /** Import from GitHub Gist (client-side via GitHub API) */
  async importFromGist(gistIdOrUrl: string): Promise<boolean> {
    try {
      const id = parseGistId(gistIdOrUrl);
      if (!id) {
        this.toast("Invalid Gist URL/ID", "error");
        return false;
      }

  const tokenKey = "cardano.ide.github.token";
    let token = localStorage.getItem(tokenKey) ?? undefined;

    // If rate-limited or user wants private gist, let them paste a token once
    if (!token) {
      const maybe = window.prompt(
        "Optional: paste a GitHub token to avoid rate limits (leave blank to continue without):"
      );
      if (maybe && maybe.trim()) {
        token = maybe.trim();
        localStorage.setItem(tokenKey, token);
      }
    }

const files = await fetchGistFiles(id, token);
      if (!files.length) {
        this.toast("Gist had no importable files", "error");
        return false;
      }

      this.applyImportedFiles(files, `gist-${id.slice(0, 6)}`);
      this.toast(`Imported gist (${files.length} file(s))`);
      return true;
    } catch (e) {
      console.error(e);
      this.toast("Gist import failed (rate limit or network issue).", "error");
      return false;
    }
  }

  /**
   * Clone (Remix-style).
   * This expects your backend to implement /api/workspace/{project}/clone.
   * If backend doesn't support it, we toast and keep UI stable.
   */
  async cloneRepo(repoUrl: string, project = "default_workspace"): Promise<boolean> {
    try {
      const res = await wsClone(project, repoUrl);

      if (!res.ok) {
        this.toast(res.error || "Clone failed", "error");
        return false;
      }

      // Convert backend files -> ImportedFile list
      const imported: ImportedFile[] = (res.files ?? []).map((f) => ({ path: f.path, content: f.content }));
      if (!imported.length) {
        this.toast("Clone returned no files", "error");
        return false;
      }

      this.applyImportedFiles(imported, "cloned");
      this.toast(`Cloned (${imported.length} file(s))`);
      return true;
    } catch (e) {
      console.error(e);
      this.toast("Clone failed (backend missing /clone endpoint?)", "error");
      return false;
    }
  }

  /**
   * Optional helper: create/update a file at a path without breaking existing nodes structure.
   * Example: setFileAtPath("src/Example.ts", "...").
   */
  setFileAtPath(path: string, content: string) {
    this.setState((s) => {
      const nextNodes = setFileAtPath(s.nodes, s.rootId, path, content, detectLanguage);
      return { ...s, nodes: nextNodes };
    });
  }
}

export const ideStore = new IDEStore();

export function useIDEStore<T>(selector: (state: State) => T) {
  return useSyncExternalStore(ideStore.subscribe, () => selector(ideStore.getState()), () => selector(ideStore.getState()));
}

export const toPath = pathOf;