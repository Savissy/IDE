import { useSyncExternalStore } from "react";
import { Command, Diagnostic, EditorSplit, OpenTab, WorkspaceNode, ActivityView, BottomView, LanguageMode } from "../types";

const STORAGE_KEY = "cardano.ide.workspace.v1";

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
    [readmeId]: { id: readmeId, name: "README.md", type: "file", parentId: rootId, content: "# Cardano IDE\n", language: "markdown" },
    [mainId]: { id: mainId, name: "Main.ts", type: "file", parentId: srcId, content: "export const hello = 'Cardano';\n", language: "typescript" },
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
    return { ...createInitialState(), ...JSON.parse(raw) };
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

  getState = () => this.state;

  private setState = (updater: (s: State) => State) => {
    this.state = updater(this.state);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(this.state));
    this.listeners.forEach((l) => l());
  };

  toast(message: string, kind: "info" | "error" = "info") {
    const id = uid();
    this.setState((s) => ({ ...s, toasts: [...s.toasts, { id, message, kind }] }));
    window.setTimeout(() => this.dismissToast(id), 2400);
  }
  dismissToast(id: string) { this.setState((s) => ({ ...s, toasts: s.toasts.filter((t) => t.id !== id) })); }

  setTheme(theme: "dark" | "light") { this.setState((s) => ({ ...s, theme })); }
  toggleTheme() { this.setTheme(this.state.theme === "dark" ? "light" : "dark"); }
  setActivity(activity: ActivityView) { this.setState((s) => ({ ...s, activity })); }
  setBottomView(bottomView: BottomView) { this.setState((s) => ({ ...s, bottomView })); }
  toggleBottomPanel() { this.setState((s) => ({ ...s, layout: { ...s.layout, showBottomPanel: !s.layout.showBottomPanel } })); }
  toggleSidePanel() { this.setState((s) => ({ ...s, layout: { ...s.layout, showSidePanel: !s.layout.showSidePanel } })); }
  resizeSidePanel(sideWidth: number) { this.setState((s) => ({ ...s, layout: { ...s.layout, sideWidth: Math.max(200, Math.min(520, sideWidth)) } })); }
  resizeBottomPanel(bottomHeight: number) { this.setState((s) => ({ ...s, layout: { ...s.layout, bottomHeight: Math.max(120, Math.min(420, bottomHeight)) } })); }

  openFile(nodeId: string, splitId = "primary") {
    const node = this.state.nodes[nodeId];
    if (!node || node.type !== "file") return;
    const exists = this.state.openTabs.find((t) => t.nodeId === nodeId);
    const path = pathOf(nodeId, this.state.nodes);
    const tab = exists ?? { id: uid(), nodeId, title: node.name, path };
    this.setState((s) => {
      const openTabs = exists ? s.openTabs : [...s.openTabs, tab];
      const recentFiles = [nodeId, ...s.recentFiles.filter((x) => x !== nodeId)].slice(0, 15);
      const splits = s.splits.map((sp) => sp.id === splitId ? { ...sp, tabIds: sp.tabIds.includes(tab.id) ? sp.tabIds : [...sp.tabIds, tab.id], activeTabId: tab.id } : sp);
      return { ...s, openTabs, activeTabId: tab.id, recentFiles, splits, activeLanguage: node.language ?? detectLanguage(node.name) };
    });
  }

  closeTab(tabId: string) {
    this.setState((s) => {
      const tab = s.openTabs.find((t) => t.id === tabId);
      const openTabs = s.openTabs.filter((t) => t.id !== tabId);
      const splits = s.splits.map((sp) => ({ ...sp, tabIds: sp.tabIds.filter((id) => id !== tabId), activeTabId: sp.activeTabId === tabId ? sp.tabIds.find((x) => x !== tabId) ?? null : sp.activeTabId }));
      return { ...s, openTabs, activeTabId: s.activeTabId === tabId ? openTabs[openTabs.length - 1]?.id ?? null : s.activeTabId, closedTabStack: tab ? [tab, ...s.closedTabStack] : s.closedTabStack, splits };
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
    this.setState((s) => ({ ...s, nodes: { ...s.nodes, [tab.nodeId]: { ...s.nodes[tab.nodeId], content } }, dirty: { ...s.dirty, [tab.nodeId]: true } }));
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

  setCursor(line: number, column: number) { this.setState((s) => ({ ...s, cursor: { line, column } })); }
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
      const node: WorkspaceNode = { id, name, type, parentId, childrenIds: type === "folder" ? [] : undefined, content: type === "file" ? "" : undefined, language: type === "file" ? detectLanguage(name) : undefined };
      return { ...s, nodes: { ...s.nodes, [id]: node, [parentId]: { ...parent, childrenIds: [...(parent.childrenIds ?? []), id] } } };
    });
    this.toast(`${type} created`);
    if (type === "file") this.openFile(id);
  }
  renameNode(id: string, name: string) { this.setState((s) => ({ ...s, nodes: { ...s.nodes, [id]: { ...s.nodes[id], name } } })); }
  deleteNode(id: string) {
    const ok = window.confirm("Delete item? This cannot be undone.");
    if (!ok) return;
    this.setState((s) => {
      const node = s.nodes[id];
      if (!node || !node.parentId) return s;
      const nodes = { ...s.nodes };
      const remove = (n: string) => { const cur = nodes[n]; if (!cur) return; (cur.childrenIds ?? []).forEach(remove); delete nodes[n]; };
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

  setSplitOrientation(splitOrientation: Layout["splitOrientation"]) { this.setState((s) => ({ ...s, layout: { ...s.layout, splitOrientation } })); }

  registerCommand(command: Command) { this.setState((s) => ({ ...s, commands: { ...s.commands, [command.id]: command } })); }
  executeCommand(id: string, args?: unknown) {
    const cmd = this.state.commands[id];
    if (!cmd) return this.toast(`Command not found: ${id}`, "error");
    try { cmd.handler(args); } catch { this.toast(`Command failed: ${cmd.title}`, "error"); }
  }

  runTerminalInput(input: string) {
    this.setState((s) => ({ ...s, terminalLines: [...s.terminalLines, `$ ${input}`, `Executed: ${input}`], terminalInput: "", outputLines: [...s.outputLines, `[terminal] ${input}`] }));
  }

  clearOutput() { this.setState((s) => ({ ...s, outputLines: [] })); }

  searchInFiles(query: string) {
    const q = query.toLowerCase();
    return Object.values(this.state.nodes)
      .filter((n) => n.type === "file" && (n.content ?? "").toLowerCase().includes(q))
      .map((n) => ({ nodeId: n.id, path: pathOf(n.id, this.state.nodes), preview: (n.content ?? "").split("\n").find((line) => line.toLowerCase().includes(q)) ?? "" }));
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
    file.text().then((text) => {
      const imported = JSON.parse(text);
      this.setState((_) => ({ ...createInitialState(), ...imported }));
      this.toast("Workspace imported");
    }).catch(() => this.toast("Import failed", "error"));
  }
  resetWorkspace() {
    if (!window.confirm("Reset workspace to defaults?")) return;
    this.setState(() => createInitialState());
  }
}

export const ideStore = new IDEStore();

export function useIDEStore<T>(selector: (state: State) => T) {
  return useSyncExternalStore(ideStore.subscribe, () => selector(ideStore.getState()), () => selector(ideStore.getState()));
}

export const toPath = pathOf;
