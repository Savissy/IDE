import React, { useEffect, useMemo, useRef, useState } from "react";
import { CommandPalette } from "./components/commands/CommandPalette";
import { EditorTabs } from "./components/editor/EditorTabs";
import { ExplorerTree } from "./components/explorer/ExplorerTree";
import { BottomViews } from "./components/terminal/BottomViews";
import { HomePage } from "./components/home/HomePage.tsx";
import { ideStore, useIDEStore } from "./state/store";
import { MonacoEditor } from "./ui/MonacoEditor";
import { LanguageMode } from "./types";

/**
 * Prevent the entire IDE from going blank if CommandPalette has a runtime loop.
 */
class PaletteErrorBoundary extends React.Component<
  { onError?: (err: unknown) => void; children: React.ReactNode },
  { hasError: boolean }
> {
  state = { hasError: false };

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error: unknown) {
    this.props.onError?.(error);
  }

  render() {
    if (this.state.hasError) return null;
    return this.props.children;
  }
}

function registerDefaultCommands() {
  const once = (id: string, title: string, handler: () => void, keybinding?: string) =>
    ideStore.registerCommand({ id, title, handler, keybinding });

  // UI/IDE commands (Cardano-focused, not EVM-specific).
  once("file.new", "File: New File", () => ideStore.createNode("root", "file", "untitled.ts"), "Ctrl/Cmd+N");
  once("file.newFolder", "File: New Folder", () => ideStore.createNode("root", "folder", "folder"));
  once("file.rename", "File: Rename", () => ideStore.toast("Use rename icon in explorer"));
  once("file.delete", "File: Delete", () => ideStore.toast("Use delete icon in explorer"));

  once(
    "file.save",
    "File: Save",
    () => {
      const active = ideStore.getState().activeTabId;
      if (active) ideStore.saveFile(active);
    },
    "Ctrl/Cmd+S"
  );
  once("file.saveAll", "File: Save All", () => ideStore.saveAll(), "Ctrl/Cmd+Alt+S");

  once("editor.openFile", "Editor: Open File", () => ideStore.toast("Open file from explorer/quick open"));
  once(
    "editor.closeTab",
    "Editor: Close Tab",
    () => {
      const active = ideStore.getState().activeTabId;
      if (active) ideStore.closeTab(active);
    },
    "Ctrl/Cmd+W"
  );

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

function Icon({ name }: { name: string }) {
  const common = { width: 18, height: 18, viewBox: "0 0 24 24", fill: "none" as const };
  switch (name) {
    case "home":
      return (
        <svg {...common}>
          <path d="M3 11 12 3l9 8v10H3V11Z" stroke="currentColor" strokeWidth="2" />
        </svg>
      );
    case "play":
      return (
        <svg {...common}>
          <path d="M8 5v14l12-7-12-7Z" fill="currentColor" />
        </svg>
      );
    case "compile":
      return (
        <svg {...common}>
          <path d="M8 7h8M8 12h8M8 17h6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          <path d="M4 4h16v16H4V4Z" stroke="currentColor" strokeWidth="2" />
        </svg>
      );
    case "terminal":
      return (
        <svg {...common}>
          <path d="M4 6h16v12H4V6Z" stroke="currentColor" strokeWidth="2" />
          <path d="M7 10l2 2-2 2" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M11 14h6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        </svg>
      );
    default:
      return (
        <svg {...common}>
          <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="2" />
        </svg>
      );
  }
}

export default function App() {
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [quickOpen, setQuickOpen] = useState(false);
  const [quickQ, setQuickQ] = useState("");
  const [gotoOpen, setGotoOpen] = useState(false);
  const [gotoLine, setGotoLine] = useState<number | null>(null);
  const [search, setSearch] = useState("");

  // ✅ Home should be the first screen
  const [activeView, setActiveView] = useState<"home" | "editor">("home");

  // 🔒 prevents the "activeTabId restored => jump to editor" on initial load
  const bootRef = useRef(false);

  const state = useIDEStore((s) => s);
  const activeTab = state.openTabs.find((t) => t.id === state.activeTabId) ?? null;
  const activeNode = activeTab ? state.nodes[activeTab.nodeId] : null;

  useEffect(() => registerDefaultCommands(), []);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const meta = e.ctrlKey || e.metaKey;

      if (meta && e.shiftKey && e.key.toLowerCase() === "p") {
        e.preventDefault();
        setPaletteOpen(true);
      }
      if (meta && e.key.toLowerCase() === "p") {
        e.preventDefault();
        setQuickOpen(true);
      }
      if (meta && e.key.toLowerCase() === "s") {
        e.preventDefault();
        ideStore.executeCommand("file.save");
      }
      if (meta && e.altKey && e.key.toLowerCase() === "s") {
        e.preventDefault();
        ideStore.executeCommand("file.saveAll");
      }
      if (meta && e.key.toLowerCase() === "w") {
        e.preventDefault();
        ideStore.executeCommand("editor.closeTab");
      }
      if (meta && e.shiftKey && e.key.toLowerCase() === "t") {
        e.preventDefault();
        ideStore.executeCommand("editor.reopenClosedTab");
      }
      if (meta && e.key.toLowerCase() === "g") {
        e.preventDefault();
        setGotoOpen(true);
      }
      if (meta && e.key.toLowerCase() === "j") {
        // Optional: terminal toggle hotkey (Ctrl/Cmd+J)
        e.preventDefault();
        ideStore.executeCommand("view.toggleTerminal");
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  // ✅ Only auto-switch to editor AFTER the app has booted once.
  useEffect(() => {
    if (!bootRef.current) {
      bootRef.current = true;
      return;
    }
    if (state.activeTabId) setActiveView("editor");
  }, [state.activeTabId]);

  const searchResults = useMemo(() => (search ? ideStore.searchInFiles(search) : []), [search, state.nodes]);

  const quickItems = useMemo(
    () =>
      Object.values(state.nodes).filter(
        (n) => n.type === "file" && n.name.toLowerCase().includes(quickQ.toLowerCase())
      ),
    [quickQ, state.nodes]
  );

  const splitClass =
    state.layout.splitOrientation === "vertical"
      ? "split-vertical"
      : state.layout.splitOrientation === "horizontal"
      ? "split-horizontal"
      : "split-none";

  const onCompile = () => {
    ideStore.toast("Compile triggered (wire to your Plutus compile action/command).");
  };

  const onRun = () => {
    ideStore.toast("Run triggered (wire to run/test action).");
  };

  const toggleTerminal = () => ideStore.executeCommand("view.toggleTerminal");

  return (
    <div className={`app ${state.theme}`}>
      <input
        id="workspace-import"
        type="file"
        accept="application/json"
        hidden
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) ideStore.importWorkspace(f);
        }}
      />

      <header className="topbar">
        <div className="brand">Cardano IDE</div>

        <div className="topbarMid">
          <button className="topIconBtn" title="Home" onClick={() => setActiveView("home")}>
            <Icon name="home" />
            <span>Home</span>
          </button>
        </div>

        <select className="workspaceSelectTop">
          <option>default_workspace</option>
          <option>plutus_lab</option>
        </select>

        <div className="topbarActions">
          <button className="btnGhost" onClick={onRun} title="Run">
            <Icon name="play" /> Run
          </button>
          <button className="btnGhost" onClick={onCompile} title="Compile">
            <Icon name="compile" /> Compile
          </button>

          {/* ✅ Terminal toggle in topbar */}
          <button className="btnGhost" onClick={toggleTerminal} title="Toggle Terminal (Ctrl/Cmd+J)">
            <Icon name="terminal" /> {state.layout.showBottomPanel ? "Hide Terminal" : "Show Terminal"}
          </button>

          <button className="btnGhost">Connect Wallet (CIP-30)</button>
          <button className="btnGhost" onClick={() => ideStore.executeCommand("view.toggleTheme")}>
            Theme
          </button>
          <button className="btnGhost" onClick={() => setPaletteOpen(true)}>
            Command Palette
          </button>

          <button className="btnPrimary" onClick={onCompile}>
            Compile
          </button>
        </div>
      </header>

      <div className="workspace">
        <aside className="activityBar">
          {(["explorer", "search", "source", "tests", "extensions"] as const).map((a) => (
            <button
              key={a}
              className={state.activity === a ? "active" : ""}
              onClick={() => ideStore.setActivity(a)}
              title={a}
            >
              {a[0].toUpperCase()}
            </button>
          ))}
        </aside>

        {state.layout.showSidePanel && (
          <aside className="sidePanel" style={{ width: state.layout.sideWidth }}>
            <div className="panelTitle">{state.activity.toUpperCase()}</div>

            {state.activity === "explorer" && <ExplorerTree />}

            {state.activity === "search" && (
              <div>
                <input placeholder="Search in files" value={search} onChange={(e) => setSearch(e.target.value)} />
                {searchResults.map((r) => (
                  <button key={r.nodeId} className="searchItem" onClick={() => ideStore.openFile(r.nodeId)}>
                    {r.path}: {r.preview}
                  </button>
                ))}
              </div>
            )}

            {state.activity !== "explorer" && state.activity !== "search" && (
              <div className="empty">{state.activity} panel (stub)</div>
            )}
          </aside>
        )}

        {state.layout.showSidePanel && (
          <div
            className="resizeX"
            onMouseDown={(e) => {
              const start = e.clientX;
              const initial = state.layout.sideWidth;
              const move = (me: MouseEvent) => ideStore.resizeSidePanel(initial + (me.clientX - start));
              const up = () => {
                window.removeEventListener("mousemove", move);
                window.removeEventListener("mouseup", up);
              };
              window.addEventListener("mousemove", move);
              window.addEventListener("mouseup", up);
            }}
          />
        )}

        <main className={`main ${splitClass}`}>
          {activeView === "home" ? (
            <div className="mainStage">
              <HomePage
                onStartCoding={() => setActiveView("editor")}
                onPlutusStarter={() => {
                  setActiveView("editor");
                  ideStore.toast("Plutus Starter: choose a template (wire to scaffold).");
                }}
                onMintingPolicy={() => {
                  setActiveView("editor");
                  ideStore.toast("Minting Policy: choose a template (wire to scaffold).");
                }}
                onValidatorScript={() => {
                  setActiveView("editor");
                  ideStore.toast("Validator Script: choose a template (wire to scaffold).");
                }}
              />
            </div>
          ) : (
            <>
              <div className="editorPane">
                <EditorTabs splitId="primary" />
                <div className="breadcrumbs">{activeTab?.path ?? "No file selected"}</div>

                {activeNode ? (
                  <MonacoEditor
                    value={activeNode.content ?? ""}
                    language={activeNode.language ?? "plaintext"}
                    theme={state.theme}
                    onCursor={(line, column) => ideStore.setCursor(line, column)}
                    gotoLine={gotoLine}
                    onChange={(v) => activeTab && ideStore.updateContent(activeTab.id, v)}
                  />
                ) : (
                  <div className="empty">Open a file from Explorer or Quick Open (Ctrl/Cmd+P).</div>
                )}
              </div>

              {state.layout.splitOrientation !== "none" && (
                <div className="editorPane secondary">
                  <EditorTabs splitId="primary" />
                  <div className="empty">
                    Secondary split view (mirrored active tab).{" "}
                    <button onClick={() => ideStore.setSplitOrientation("none")}>Close split</button>
                  </div>
                </div>
              )}
            </>
          )}

          {/* ✅ When terminal is hidden, keep a small bar so user can bring it back easily */}
          {!state.layout.showBottomPanel && (
            <div className="bottomCollapsed">
              <button className="bottomCollapsedBtn" onClick={toggleTerminal}>
                <Icon name="terminal" /> Show Terminal
              </button>
            </div>
          )}

          {state.layout.showBottomPanel && (
            <>
              <div
                className="resizeY"
                title="Drag to resize terminal"
                onMouseDown={(e) => {
                  const start = e.clientY;
                  const initial = state.layout.bottomHeight;
                  const move = (me: MouseEvent) => ideStore.resizeBottomPanel(initial - (me.clientY - start));
                  const up = () => {
                    window.removeEventListener("mousemove", move);
                    window.removeEventListener("mouseup", up);
                  };
                  window.addEventListener("mousemove", move);
                  window.addEventListener("mouseup", up);
                }}
              >
                <div className="resizeYGrip" />
              </div>

              <section className="bottomPanel" style={{ height: state.layout.bottomHeight }}>
                <BottomViews />
              </section>
            </>
          )}
        </main>
      </div>

      <footer className="statusbar">
        <span>
          Ln {state.cursor.line}, Col {state.cursor.column}
        </span>

        <select
          value={activeNode?.language ?? state.activeLanguage}
          onChange={(e) => activeTab && ideStore.setLanguage(activeTab.id, e.target.value as LanguageMode)}
        >
          <option value="typescript">TypeScript</option>
          <option value="javascript">JavaScript</option>
          <option value="json">JSON</option>
          <option value="markdown">Markdown</option>
          <option value="plaintext">Plain Text</option>
        </select>

        <span>{state.settings.lineEnding}</span>
        <span>{state.settings.insertSpaces ? `Spaces: ${state.settings.tabSize}` : "Tabs"}</span>
        <span>Branch: {state.branch}</span>
      </footer>

      {paletteOpen && (
        <PaletteErrorBoundary
          onError={(err) => {
            console.error("[CommandPalette crashed]", err);
            ideStore.toast("Command palette crashed. Fix CommandPalette.tsx snapshot.");
            setPaletteOpen(false);
          }}
        >
          <CommandPalette open={paletteOpen} onClose={() => setPaletteOpen(false)} />
        </PaletteErrorBoundary>
      )}

      {quickOpen && (
        <div className="overlay" onClick={() => setQuickOpen(false)}>
          <div className="palette" onClick={(e) => e.stopPropagation()}>
            <input
              autoFocus
              className="paletteInput"
              placeholder="Quick Open"
              value={quickQ}
              onChange={(e) => setQuickQ(e.target.value)}
            />
            {quickItems.map((f) => (
              <button
                key={f.id}
                className="paletteItem"
                onClick={() => {
                  ideStore.openFile(f.id);
                  setQuickOpen(false);
                }}
              >
                {f.name}
              </button>
            ))}
          </div>
        </div>
      )}

      {gotoOpen && (
        <div className="overlay" onClick={() => setGotoOpen(false)}>
          <div className="goto" onClick={(e) => e.stopPropagation()}>
            <p>Go to line</p>
            <input
              autoFocus
              type="number"
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  setGotoLine(Number((e.target as HTMLInputElement).value));
                  setGotoOpen(false);
                }
              }}
            />
          </div>
        </div>
      )}

      <div className="toasts">
        {state.toasts.map((t) => (
          <div className={`toast ${t.kind}`} key={t.id}>
            {t.message}
          </div>
        ))}
      </div>
    </div>
  );
}