import React, { useEffect, useMemo, useState } from "react";
import { CommandPalette } from "./components/commands/CommandPalette";
import { EditorTabs } from "./components/editor/EditorTabs";
import { ExplorerTree } from "./components/explorer/ExplorerTree";
import { BottomViews } from "./components/terminal/BottomViews";
import { ideStore, useIDEStore } from "./state/store";
import { MonacoEditor } from "./ui/MonacoEditor";
import { LanguageMode } from "./types";

function registerDefaultCommands() {
  const once = (id: string, title: string, handler: () => void, keybinding?: string) => ideStore.registerCommand({ id, title, handler, keybinding });
  once("file.new", "File: New File", () => ideStore.createNode("root", "file", "untitled.ts"), "Ctrl/Cmd+N");
  once("file.newFolder", "File: New Folder", () => ideStore.createNode("root", "folder", "folder"));
  once("file.rename", "File: Rename", () => ideStore.toast("Use rename icon in explorer"));
  once("file.delete", "File: Delete", () => ideStore.toast("Use delete icon in explorer"));
  once("file.save", "File: Save", () => { const active = ideStore.getState().activeTabId; if (active) ideStore.saveFile(active); }, "Ctrl/Cmd+S");
  once("file.saveAll", "File: Save All", () => ideStore.saveAll(), "Ctrl/Cmd+Alt+S");
  once("editor.openFile", "Editor: Open File", () => ideStore.toast("Open file from explorer/quick open"));
  once("editor.closeTab", "Editor: Close Tab", () => { const active = ideStore.getState().activeTabId; if (active) ideStore.closeTab(active); }, "Ctrl/Cmd+W");
  once("editor.splitVertical", "Editor: Split Vertical", () => ideStore.setSplitOrientation("vertical"));
  once("editor.splitHorizontal", "Editor: Split Horizontal", () => ideStore.setSplitOrientation("horizontal"));
  once("view.toggleTerminal", "View: Toggle Terminal", () => ideStore.toggleBottomPanel());
  once("view.toggleSidePanel", "View: Toggle Side Panel", () => ideStore.toggleSidePanel());
  once("view.toggleTheme", "View: Toggle Theme", () => ideStore.toggleTheme());
  once("workspace.export", "Workspace: Export", () => ideStore.exportWorkspace());
  once("workspace.import", "Workspace: Import", () => document.getElementById("workspace-import")?.click());
  once("workspace.reset", "Workspace: Reset", () => ideStore.resetWorkspace());
  once("editor.reopenClosedTab", "Editor: Reopen Closed Tab", () => ideStore.reopenClosedTab(), "Ctrl/Cmd+Shift+T");
  once("editor.format", "Editor: Format Document", () => ideStore.toast("Formatting hook executed"));
}

export default function App() {
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [quickOpen, setQuickOpen] = useState(false);
  const [quickQ, setQuickQ] = useState("");
  const [gotoOpen, setGotoOpen] = useState(false);
  const [gotoLine, setGotoLine] = useState<number | null>(null);
  const [search, setSearch] = useState("");

  const state = useIDEStore((s) => s);
  const activeTab = state.openTabs.find((t) => t.id === state.activeTabId) ?? null;
  const activeNode = activeTab ? state.nodes[activeTab.nodeId] : null;

  useEffect(() => registerDefaultCommands(), []);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const meta = e.ctrlKey || e.metaKey;
      if (meta && e.shiftKey && e.key.toLowerCase() === "p") { e.preventDefault(); setPaletteOpen(true); }
      if (meta && e.key.toLowerCase() === "p") { e.preventDefault(); setQuickOpen(true); }
      if (meta && e.key.toLowerCase() === "s") { e.preventDefault(); ideStore.executeCommand("file.save"); }
      if (meta && e.altKey && e.key.toLowerCase() === "s") { e.preventDefault(); ideStore.executeCommand("file.saveAll"); }
      if (meta && e.key.toLowerCase() === "w") { e.preventDefault(); ideStore.executeCommand("editor.closeTab"); }
      if (meta && e.shiftKey && e.key.toLowerCase() === "t") { e.preventDefault(); ideStore.executeCommand("editor.reopenClosedTab"); }
      if (meta && e.key.toLowerCase() === "g") { e.preventDefault(); setGotoOpen(true); }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  const searchResults = useMemo(() => (search ? ideStore.searchInFiles(search) : []), [search, state.nodes]);
  const quickItems = useMemo(() => Object.values(state.nodes).filter((n) => n.type === "file" && n.name.toLowerCase().includes(quickQ.toLowerCase())), [quickQ, state.nodes]);

  const splitClass = state.layout.splitOrientation === "vertical" ? "split-vertical" : state.layout.splitOrientation === "horizontal" ? "split-horizontal" : "split-none";

  return <div className={`app ${state.theme}`}>
    <input id="workspace-import" type="file" accept="application/json" hidden onChange={(e) => { const f = e.target.files?.[0]; if (f) ideStore.importWorkspace(f); }} />
    <header className="topbar">
      <div>Cardano IDE</div>
      <select><option>default_workspace</option><option>plutus_lab</option></select>
      <div className="topbarActions">
        <button>Build (Aiken/Plutus/Helios)</button>
        <button>Connect Wallet (CIP-30)</button>
        <button onClick={() => ideStore.executeCommand("view.toggleTheme")}>Theme</button>
        <button onClick={() => setPaletteOpen(true)}>Command Palette</button>
      </div>
    </header>

    <div className="workspace">
      <aside className="activityBar">
        {(["explorer", "search", "source", "tests", "extensions"] as const).map((a) => <button key={a} className={state.activity === a ? "active" : ""} onClick={() => ideStore.setActivity(a)}>{a[0].toUpperCase()}</button>)}
      </aside>

      {state.layout.showSidePanel && <aside className="sidePanel" style={{ width: state.layout.sideWidth }}>
        <div className="panelTitle">{state.activity.toUpperCase()}</div>
        {state.activity === "explorer" && <ExplorerTree />}
        {state.activity === "search" && <div><input placeholder="Search in files" value={search} onChange={(e) => setSearch(e.target.value)} />{searchResults.map((r) => <button key={r.nodeId} className="searchItem" onClick={() => ideStore.openFile(r.nodeId)}>{r.path}: {r.preview}</button>)}</div>}
        {state.activity !== "explorer" && state.activity !== "search" && <div className="empty">{state.activity} panel (stub)</div>}
      </aside>}
      {state.layout.showSidePanel && <div className="resizeX" onMouseDown={(e) => {
        const start = e.clientX; const initial = state.layout.sideWidth;
        const move = (me: MouseEvent) => ideStore.resizeSidePanel(initial + (me.clientX - start));
        const up = () => { window.removeEventListener("mousemove", move); window.removeEventListener("mouseup", up); };
        window.addEventListener("mousemove", move); window.addEventListener("mouseup", up);
      }} />}

      <main className={`main ${splitClass}`}>
        <div className="editorPane">
          <EditorTabs splitId="primary" />
          <div className="breadcrumbs">{activeTab?.path ?? "No file selected"}</div>
          {activeNode ? <MonacoEditor value={activeNode.content ?? ""} language={activeNode.language ?? "plaintext"} theme={state.theme} onCursor={(line, column) => ideStore.setCursor(line, column)} gotoLine={gotoLine} onChange={(v) => activeTab && ideStore.updateContent(activeTab.id, v)} /> : <div className="empty">Open a file from Explorer or Quick Open (Ctrl/Cmd+P).</div>}
        </div>
        {state.layout.splitOrientation !== "none" && <div className="editorPane secondary">
          <EditorTabs splitId="primary" />
          <div className="empty">Secondary split view (mirrored active tab). <button onClick={() => ideStore.setSplitOrientation("none")}>Close split</button></div>
        </div>}

        {state.layout.showBottomPanel && <>
          <div className="resizeY" onMouseDown={(e) => {
            const start = e.clientY; const initial = state.layout.bottomHeight;
            const move = (me: MouseEvent) => ideStore.resizeBottomPanel(initial - (me.clientY - start));
            const up = () => { window.removeEventListener("mousemove", move); window.removeEventListener("mouseup", up); };
            window.addEventListener("mousemove", move); window.addEventListener("mouseup", up);
          }} />
          <section className="bottomPanel" style={{ height: state.layout.bottomHeight }}><BottomViews /></section>
        </>}
      </main>
    </div>

    <footer className="statusbar">
      <span>Ln {state.cursor.line}, Col {state.cursor.column}</span>
      <select value={activeNode?.language ?? state.activeLanguage} onChange={(e) => activeTab && ideStore.setLanguage(activeTab.id, e.target.value as LanguageMode)}>
        <option value="typescript">TypeScript</option><option value="javascript">JavaScript</option><option value="json">JSON</option><option value="markdown">Markdown</option><option value="plaintext">Plain Text</option>
      </select>
      <span>{state.settings.lineEnding}</span><span>{state.settings.insertSpaces ? `Spaces: ${state.settings.tabSize}` : "Tabs"}</span><span>Branch: {state.branch}</span>
    </footer>

    <CommandPalette open={paletteOpen} onClose={() => setPaletteOpen(false)} />

    {quickOpen && <div className="overlay" onClick={() => setQuickOpen(false)}><div className="palette" onClick={(e) => e.stopPropagation()}><input autoFocus className="paletteInput" placeholder="Quick Open" value={quickQ} onChange={(e) => setQuickQ(e.target.value)} />{quickItems.map((f) => <button key={f.id} className="paletteItem" onClick={() => { ideStore.openFile(f.id); setQuickOpen(false); }}>{f.name}</button>)}</div></div>}
    {gotoOpen && <div className="overlay" onClick={() => setGotoOpen(false)}><div className="goto" onClick={(e) => e.stopPropagation()}><p>Go to line</p><input autoFocus type="number" onKeyDown={(e) => { if (e.key === "Enter") { setGotoLine(Number((e.target as HTMLInputElement).value)); setGotoOpen(false); } }} /></div></div>}

    <div className="toasts">{state.toasts.map((t) => <div className={`toast ${t.kind}`} key={t.id}>{t.message}</div>)}</div>
  </div>;
}
