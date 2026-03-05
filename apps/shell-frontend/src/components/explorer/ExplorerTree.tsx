import React, { useMemo, useState } from "react";
import { ideStore, useIDEStore, toPath } from "../../state/store.ts";
import {
  IconFile,
  IconFolder,
  IconUploadFile,
  IconUploadFolder,
  IconIPFS,
  IconHTTP,
  IconChevronDown,
  IconChevronRight,
  IconDoc,
} from "./ExplorerIcons";

export function ExplorerTree() {
  const nodes = useIDEStore((s) => s.nodes);
  const rootId = useIDEStore((s) => s.rootId);

  // Expanded folders
  const [expanded, setExpanded] = useState<Record<string, boolean>>({ [rootId]: true });

  // Track selection (folder OR file)
  const [selectedId, setSelectedId] = useState<string>(rootId);

  function resolveTargetFolderId(): string {
    const sel = nodes[selectedId];
    if (!sel) return rootId;
    if (sel.type === "folder") return sel.id;
    return sel.parentId ?? rootId;
  }

  async function createNewFile() {
    const parentId = resolveTargetFolderId();
    const parentPath = toPath(parentId, nodes);
    const suggested = parentPath ? `${parentPath}/new-file.hs` : "new-file.hs";
    const nameOrPath = prompt("New file name (or path):", suggested);
    if (!nameOrPath) return;

    const simpleName = nameOrPath.includes("/") ? nameOrPath.split("/").pop()! : nameOrPath;

    ideStore.createNode(parentId, "file", simpleName);
    setExpanded((x) => ({ ...x, [parentId]: true }));
  }

  async function createNewFolder() {
    const parentId = resolveTargetFolderId();
    const parentPath = toPath(parentId, nodes);
    const suggested = parentPath ? `${parentPath}/new-folder` : "new-folder";
    const nameOrPath = prompt("New folder name (or path):", suggested);
    if (!nameOrPath) return;

    const simpleName = nameOrPath.includes("/") ? nameOrPath.split("/").pop()! : nameOrPath;

    const newId = ideStore.createNode(parentId, "folder", simpleName) as any;

    setExpanded((x) => ({ ...x, [parentId]: true, ...(typeof newId === "string" ? { [newId]: true } : {}) }));
    if (typeof newId === "string") setSelectedId(newId);
  }

  // ---- Toolbar actions (safe stubs + existing working features)
  const onOpenFile = async () => {
    const ok = await ideStore.openFromFilePicker?.();
    if (!ok) ideStore.toast("Open canceled or failed.");
  };

  const onUploadFolder = async () => {
    // Prefer the existing local filesystem connect (it imports a whole folder)
    const ok = await ideStore.connectLocalFilesystem?.();
    if (!ok) ideStore.toast("Folder import canceled or not supported.");
  };

    const onImportIPFS = async () => {
    const cidOrPath = window.prompt("Paste IPFS CID or ipfs://CID/path:");
    if (!cidOrPath) return;
    await ideStore.importFromIpfs(cidOrPath);
  };

  const onImportHTTP = async () => {
    const url = window.prompt("Paste HTTPS URL (text file OR JSON manifest):");
    if (!url) return;
    await ideStore.importFromHttp(url);
  };

  const renderNode = (id: string) => {
    const node = nodes[id];
    if (!node) return null;

    const isFolder = node.type === "folder";
    const open = !!expanded[id];
    const isSelected = selectedId === id;

    const children = (node.childrenIds ?? [])
      .map((cid) => nodes[cid])
      .filter(Boolean)
      .sort((a, b) => Number(b.type === "folder") - Number(a.type === "folder") || a.name.localeCompare(b.name));

    return (
      <div
        key={id}
        className="treeNode"
        draggable={id !== rootId}
        onDragStart={(e) => e.dataTransfer.setData("text/node", id)}
        onDragOver={(e) => isFolder && e.preventDefault()}
        onDrop={(e) => {
          const dragged = e.dataTransfer.getData("text/node");
          if (dragged && dragged !== id) {
            ideStore.moveNode(dragged, isFolder ? id : node.parentId || rootId);
            setExpanded((x) => ({ ...x, [isFolder ? id : node.parentId || rootId]: true }));
          }
        }}
      >
        <div
          className={"treeRow" + (isSelected ? " selected" : "")}
          onClick={() => {
            setSelectedId(id);

            if (isFolder) {
              setExpanded((x) => ({ ...x, [id]: !x[id] }));
            } else {
              ideStore.openFile(id);
            }
          }}
        >
          <span className="treeTwisty" aria-hidden>
            {isFolder ? (open ? <IconChevronDown size={14} /> : <IconChevronRight size={14} />) : <span style={{ width: 14 }} />}
          </span>

          <span className="treeIcon" aria-hidden>
            {isFolder ? <IconFolder size={16} /> : <IconDoc size={16} />}
          </span>

          <span className="treeName">{node.name}</span>

          {id !== rootId && (
            <div className="treeActions">
              <button
                className="treeActBtn"
                title="Rename"
                onClick={(e) => {
                  e.stopPropagation();
                  const n = prompt("Rename", node.name);
                  if (n) ideStore.renameNode(id, n);
                }}
              >
                ✎
              </button>
              <button
                className="treeActBtn"
                title="Duplicate"
                onClick={(e) => {
                  e.stopPropagation();
                  ideStore.duplicateNode(id);
                }}
              >
                ⧉
              </button>
              <button
                className="treeActBtn"
                title="Delete"
                onClick={(e) => {
                  e.stopPropagation();
                  ideStore.deleteNode(id);
                  setSelectedId((prev) => (prev === id ? rootId : prev));
                }}
              >
                🗑
              </button>
            </div>
          )}
        </div>

        {isFolder && open && <div className="treeChildren">{children.map((c) => renderNode(c.id))}</div>}
      </div>
    );
  };

  const recents = useIDEStore((s) => s.recentFiles);
  const recentItems = useMemo(() => recents.map((id) => ({ id, path: toPath(id, nodes) })).filter((x) => !!x.path), [nodes, recents]);

  const targetFolderId = resolveTargetFolderId();
  const targetFolderPath = toPath(targetFolderId, nodes) || "root";

  return (
    <div className="rxExplorer">
      {/* Header area like Remix */}
      <div className="rxExplorerHeader">
        <div className="rxExplorerTitleRow">
          <div className="rxExplorerTitle">FILE EXPLORER</div>
          <button
            className="rxGitSignIn"
            onClick={() => ideStore.toast("GitHub Sign-in is a stub (wire OAuth later).")}
            title="GitHub Sign in"
          >
            Sign in
          </button>
        </div>

        <div className="rxWorkspaceBlock">
          <div className="rxWorkspaceLabel">WORKSPACES</div>

          <div className="rxWorkspaceRow">
            <div className="rxWorkspaceSelect">
              <span className="rxWorkspaceName">default_workspace</span>
              <span className="rxWorkspaceCaret" aria-hidden>
                <IconChevronDown size={16} />
              </span>
            </div>
          </div>

          {/* Remix-like 6 icon toolbar (HORIZONTAL) */}
          <div className="rxIconRow">
            <button className="rxIconBtn" title={`New file (inside: ${targetFolderPath})`} onClick={createNewFile}>
              <IconFile size={16} />
            </button>
            <button className="rxIconBtn" title={`New folder (inside: ${targetFolderPath})`} onClick={createNewFolder}>
              <IconFolder size={16} />
            </button>
            <button className="rxIconBtn" title="Open file from filesystem" onClick={onOpenFile}>
              <IconUploadFile size={16} />
            </button>
            <button className="rxIconBtn" title="Upload folder / connect folder" onClick={onUploadFolder}>
              <IconUploadFolder size={16} />
            </button>
            <button className="rxIconBtn" title="Import from IPFS (stub)" onClick={onImportIPFS}>
              <IconIPFS size={16} />
            </button>
            <button className="rxIconBtn" title="Import from HTTPS (stub)" onClick={onImportHTTP}>
              <IconHTTP size={16} />
            </button>
          </div>
        </div>
      </div>

      {/* Tree */}
      <div className="rxTreeWrap">{renderNode(rootId)}</div>

      {/* Recent Files (keep existing feature) */}
      <div className="recentList">
        <h4>Recent Files</h4>
        {recentItems.length === 0 ? (
          <p className="empty">No recent files</p>
        ) : (
          recentItems.map((r) => (
            <button
              key={r.id}
              className="linkish"
              onClick={() => {
                setSelectedId(r.id);
                ideStore.openFile(r.id);
              }}
            >
              {r.path}
            </button>
          ))
        )}
      </div>
    </div>
  );
}