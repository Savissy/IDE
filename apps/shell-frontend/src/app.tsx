import React, { useEffect, useMemo, useState } from "react";
import { loadPlugins } from "./core/pluginRuntime";
import { MonacoEditor } from "./ui/MonacoEditor";
import { Terminal } from "./ui/Terminal";

type Panel = { id: string; title: string; location: string; render: () => any };

type OpenTab = {
  path: string;
  title: string;
  value: string;
  dirty: boolean;
};

const API = "http://localhost:8080";

async function apiText(url: string) {
  const r = await fetch(url);
  if (!r.ok) throw new Error(`${r.status} ${r.statusText}`);
  return r.text();
}

async function apiPostForm(url: string, data: Record<string, string>) {
  const r = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams(data),
  });
  if (!r.ok) throw new Error(`${r.status} ${r.statusText}`);
  return r.json();
}

function Icon({ name }: { name: string }) {
  // Simple inline SVGs (Remix-like)
  const common = { width: 18, height: 18, viewBox: "0 0 24 24", fill: "none" as const };
  switch (name) {
    case "files":
      return (
        <svg {...common}>
          <path d="M4 6h6l2 2h8v12H4V6Z" stroke="currentColor" strokeWidth="2" />
        </svg>
      );
    case "compile":
      return (
        <svg {...common}>
          <path d="M8 7h8M8 12h8M8 17h6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          <path d="M4 4h16v16H4V4Z" stroke="currentColor" strokeWidth="2" />
        </svg>
      );
    case "search":
      return (
        <svg {...common}>
          <path d="M10.5 18a7.5 7.5 0 1 1 0-15 7.5 7.5 0 0 1 0 15Z" stroke="currentColor" strokeWidth="2" />
          <path d="M16.5 16.5 21 21" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        </svg>
      );
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
    case "check":
      return (
        <svg {...common}>
          <path d="M20 6 9 17l-5-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        </svg>
      );
    case "save":
      return (
        <svg {...common}>
          <path d="M5 4h12l2 2v14H5V4Z" stroke="currentColor" strokeWidth="2" />
          <path d="M8 4v6h8V4" stroke="currentColor" strokeWidth="2" />
          <path d="M8 20v-6h8v6" stroke="currentColor" strokeWidth="2" />
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

function RemixHome({ onStartCoding }: { onStartCoding: () => void }) {
  return (
    <div className="home">
      <div className="homeTitle">CARDANO IDE</div>

      <div className="homeSearch">
        <input className="homeSearchInput" placeholder="Search Documentation" />
        <button className="homeSearchBtn" title="Search">
          <Icon name="search" />
        </button>
      </div>

      <div className="homeSub">Explore. Prototype. Build on Cardano.</div>

      <div className="homePills">
        <button className="pill primary" onClick={onStartCoding}>Start Coding</button>
        <button className="pill">Plutus Starter</button>
        <button className="pill">Minting Policy</button>
        <button className="pill">Validator Script</button>
      </div>

      <div className="homeSection">
        <div className="homeSectionTitle">Recent Workspaces</div>
        <div className="homeLinks">
          <a className="homeLink" href="#">Basic - 1</a>
          <a className="homeLink" href="#">default_workspace</a>
        </div>
      </div>

      <div className="homeSection">
        <div className="homeSectionTitle">Files</div>
        <div className="homeFileBtns">
          <button className="fileBtn"><span className="fileBtnIcon">📄</span>New</button>
          <button className="fileBtn"><span className="fileBtnIcon">⬆️</span>Open</button>
          <button className="fileBtn"><span className="fileBtnIcon">🐙</span>Gist</button>
          <button className="fileBtn"><span className="fileBtnIcon">🔗</span>Clone</button>
          <button className="fileBtn wide"><span className="fileBtnIcon">🖥️</span>Connect to Local Filesystem</button>
        </div>
      </div>
    </div>
  );
}

export default function App() {
  const project = "demo";

  const [toast, setToast] = useState<string | null>(null);
  const [panels, setPanels] = useState<Panel[]>([]);
  const [commands, setCommands] = useState<any[]>([]);
  const [toolbar, setToolbar] = useState<any[]>([]);
  const [activeTool, setActiveTool] = useState<string>("file.explorer");
  const [activeTab, setActiveTab] = useState<"home" | "editor">("home");

  // ✅ New: multi-tab state
  const [tabs, setTabs] = useState<OpenTab[]>([]);
  const [activePath, setActivePath] = useState<string | null>(null);

  // Keep these for your existing compile logic + header label
  const activeFile = activePath ?? "Main.hs";

  // Editor reads from active tab
  const activeTabObj = useMemo(
    () => tabs.find((t) => t.path === activePath) ?? null,
    [tabs, activePath]
  );

  const [sseUrl, setSseUrl] = useState<string | null>(null);

  const store = useMemo(
    () => ({
      panels,
      commands,
      toolbar,
      activeFile,
      activePanelId: activeTool,
      notify: (m: string) => {
        setToast(m);
        setTimeout(() => setToast(null), 2500);
      },
      openPanel: (id: string) => setActiveTool(id),

      // plugins might call store.setActiveFile
      setActiveFile: (path: string) => {
        setActiveTab("editor");
        setActivePath(path);
      },
    }),
    [panels, commands, toolbar, activeFile, activeTool]
  );

  // Load plugins once
  useMemo(() => {
    if (panels.length === 0 && commands.length === 0) {
      loadPlugins(store, project);
      setPanels([...store.panels]);
      setCommands([...store.commands]);
      setToolbar([...store.toolbar]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const leftPanels = panels.filter((p) => p.location === "left");
  const activeLeft = leftPanels.find((p) => p.id === activeTool) ?? leftPanels[0];

  // ✅ Open file (used by tabs + plugin command fallback)
  async function openFile(path: string) {
    // if already open, just activate
    const existing = tabs.find((t) => t.path === path);
    if (existing) {
      setActivePath(path);
      setActiveTab("editor");
      return;
    }

    const content = await apiText(
      `${API}/api/workspace/${project}/read?path=${encodeURIComponent(path)}`
    );

    const title = path.split("/").pop() || path;
    setTabs((prev) => [...prev, { path, title, value: content, dirty: false }]);
    setActivePath(path);
    setActiveTab("editor");
  }

  // ✅ Save active
  async function saveActive() {
    if (!activePath) {
      store.notify("No file open");
      return;
    }
    const t = tabs.find((x) => x.path === activePath);
    if (!t) return;

    await apiPostForm(`${API}/api/workspace/${project}/write`, {
      path: t.path,
      content: t.value,
    });

    setTabs((prev) => prev.map((x) => (x.path === t.path ? { ...x, dirty: false } : x)));
    store.notify(`Saved ${t.title}`);
  }

  // Ctrl+S
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "s") {
        e.preventDefault();
        saveActive().catch(() => {});
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tabs, activePath]);

  // ✅ Global fallback used by your file explorer plugin if host.commands isn’t typed
  useEffect(() => {
    (window as any).__IDE_OPEN_FILE__ = (path: string) => openFile(path);
  }, [tabs]);

  function closeTab(path: string) {
    setTabs((prev) => {
      const idx = prev.findIndex((t) => t.path === path);
      if (idx === -1) return prev;

      const next = prev.filter((t) => t.path !== path);

      if (activePath === path) {
        const fallback = next[idx - 1]?.path ?? next[idx]?.path ?? null;
        setActivePath(fallback);
        setActiveTab(fallback ? "editor" : "home");
      }
      return next;
    });
  }

  async function runCompile() {
    const compileItem = toolbar.find((t: any) => t.commandId === "plutus.compile") ?? toolbar[0];
    const cmd = commands.find((c: any) => c.id === (compileItem?.commandId ?? "plutus.compile"));
    if (!cmd) {
      store.notify("Compile command not registered");
      return;
    }
    await cmd.handler({
      project,
      setSseUrl,
      getActiveFile: () => activeFile,
    });
  }

  return (
    <div className="remixRoot">
      {/* Left icon bar */}
      <div className="iconBar">
        <div className="logoDot" title="Cardano IDE" />
        <div className="iconGroup">
          <button
            className={"iconBtn " + (activeTool === "file.explorer" ? "active" : "")}
            onClick={() => setActiveTool("file.explorer")}
            title="File Explorer"
          >
            <Icon name="files" />
          </button>

          <button
            className={"iconBtn " + (activeTool === "compiler.panel" ? "active" : "")}
            onClick={() => setActiveTool("compiler.panel")}
            title="Compiler"
          >
            <Icon name="compile" />
          </button>
        </div>

        <div className="iconSpacer" />

        <button className="iconBtn" title="Settings">
          <span style={{ fontSize: 18 }}>⚙️</span>
        </button>
      </div>

      {/* Side panel like Remix File Explorer */}
      <div className="sidePanel">
        <div className="sideHeader">
          <div className="sideTitle">FILE EXPLORER</div>
          <div className="sideHeaderRight">
            <span className="tinyIcon" title="OK"><Icon name="check" /></span>
            <span className="tinyIcon" title="More">›</span>
          </div>
        </div>

        <div className="workspaceRow">
          <div className="workspaceLabel">WORKSPACES</div>
          <button className="signinBtn">Sign in</button>
        </div>

        <div className="workspaceSelect">
          <span className="wsDot" />
          <span className="wsName">Basic - 1</span>
          <span className="wsCaret">▾</span>
        </div>

        <div className="fileActionRow">
          <button className="miniAction" title="New File">📄</button>
          <button className="miniAction" title="New Folder">📁</button>
          <button className="miniAction" title="Upload">⬆️</button>
          <button className="miniAction" title="Download">⬇️</button>
          <button className="miniAction" title="Git">🐙</button>
          <button className="miniAction" title="Link">🔗</button>
        </div>

        <div className="sideBody">
          <div className="panelHost">
            {activeLeft?.render?.()}
          </div>
        </div>

        <div className="sideFooter">Initialize as git repo</div>
      </div>

      {/* Main content */}
      <div className="content">
        {/* top action bar + tabs like Remix */}
        <div className="topStrip">
          <div className="topActions">
            <button className="topIcon" title="Run" onClick={runCompile}><Icon name="play" /></button>
            <button className="topIcon" title="Compile" onClick={runCompile}><Icon name="compile" /></button>
            <button className="topIcon" title="Save (Ctrl+S)" onClick={() => saveActive().catch(() => {})}>
              <Icon name="save" />
            </button>
            <button className="topIcon" title="Search"><Icon name="search" /></button>
          </div>

          {/* ✅ Real tabs */}
          <div className="tabsRow">
            <button
              className={"tabBtn " + (activeTab === "home" ? "active" : "")}
              onClick={() => setActiveTab("home")}
            >
              <Icon name="home" /> <span>Home</span>
            </button>

            {tabs.map((t) => (
              <div
                key={t.path}
                className={"tabChip " + (activePath === t.path && activeTab === "editor" ? "active" : "")}
              >
                <button
                  className="tabChipBtn"
                  onClick={() => {
                    setActivePath(t.path);
                    setActiveTab("editor");
                  }}
                  title={t.path}
                >
                  <span className="dot">{t.dirty ? "●" : ""}</span>
                  <span>{t.title}</span>
                </button>
                <button className="tabClose" onClick={() => closeTab(t.path)} title="Close">
                  ×
                </button>
              </div>
            ))}
          </div>

          <div className="topRight">
            <button className="compileBtn" onClick={runCompile}>Compile</button>
          </div>
        </div>

        <div className="mainStage">
          {activeTab === "home" ? (
            <RemixHome onStartCoding={() => setActiveTab("editor")} />
          ) : (
            <div className="editorWrap">
              <MonacoEditor
                value={activeTabObj?.value ?? "-- select a file\n"}
                onChange={(v) => {
                  if (!activePath) return;
                  setTabs((prev) =>
                    prev.map((x) => (x.path === activePath ? { ...x, value: v, dirty: true } : x))
                  );
                }}
              />
            </div>
          )}
        </div>

        {/* Bottom console (Remix-like) */}
        <div className="console">
          <div className="consoleTop">
            <div className="consoleTitle">terminal</div>
            <div className="consoleControls">
              <span className="consoleStat">0</span>
              <label className="consoleCheck">
                <input type="checkbox" /> Listen on all transactions
              </label>
              <input className="consoleFilter" placeholder="Filter with transaction hash or address" />
            </div>
          </div>
          <div className="consoleBody">
            <Terminal sseUrl={sseUrl} />
          </div>
          <div className="consoleBottomBar">
            <div className="tip">Did you know? You can export scripts and build transactions with Lucid.</div>
            <div className="tipRight">Plutus tools</div>
          </div>
        </div>

        {toast && <div className="toast">{toast}</div>}
      </div>
    </div>
  );
}