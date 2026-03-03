import React, { useMemo, useState } from "react";
import { ideStore, useIDEStore, toPath } from "../../state/store";

export function ExplorerTree() {
  const nodes = useIDEStore((s) => s.nodes);
  const rootId = useIDEStore((s) => s.rootId);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({ [rootId]: true });

  const renderNode = (id: string) => {
    const node = nodes[id];
    if (!node) return null;
    const isFolder = node.type === "folder";
    const open = expanded[id];
    const children = (node.childrenIds ?? []).map((cid) => nodes[cid]).filter(Boolean).sort((a, b) => Number(b.type === "folder") - Number(a.type === "folder") || a.name.localeCompare(b.name));
    return (
      <div key={id} className="treeNode" draggable={id !== rootId} onDragStart={(e) => e.dataTransfer.setData("text/node", id)} onDragOver={(e) => isFolder && e.preventDefault()} onDrop={(e) => {
        const dragged = e.dataTransfer.getData("text/node");
        if (dragged && dragged !== id) ideStore.moveNode(dragged, isFolder ? id : node.parentId || rootId);
      }}>
        <div className="treeRow" onClick={() => isFolder ? setExpanded((x) => ({ ...x, [id]: !x[id] })) : ideStore.openFile(id)}>
          <span>{isFolder ? (open ? "📂" : "📁") : "📄"}</span><span>{node.name}</span>
          {id !== rootId && <div className="treeActions">
            <button onClick={(e) => { e.stopPropagation(); const n = prompt("Rename", node.name); if (n) ideStore.renameNode(id, n); }}>✎</button>
            <button onClick={(e) => { e.stopPropagation(); ideStore.duplicateNode(id); }}>⧉</button>
            <button onClick={(e) => { e.stopPropagation(); ideStore.deleteNode(id); }}>🗑</button>
          </div>}
        </div>
        {isFolder && open && <div className="treeChildren">{children.map((c) => renderNode(c.id))}</div>}
      </div>
    );
  };

  const recents = useIDEStore((s) => s.recentFiles);
  const recentItems = useMemo(() => recents.map((id) => ({ id, path: toPath(id, nodes) })).filter((x) => !!x.path), [nodes, recents]);

  return (
    <div>
      <div className="sideTools">
        <button onClick={() => ideStore.createNode(rootId, "file", "new-file.ts")}>New File</button>
        <button onClick={() => ideStore.createNode(rootId, "folder", "new-folder")}>New Folder</button>
      </div>
      <div>{renderNode(rootId)}</div>
      <div className="recentList">
        <h4>Recent Files</h4>
        {recentItems.length === 0 ? <p className="empty">No recent files</p> : recentItems.map((r) => <button key={r.id} className="linkish" onClick={() => ideStore.openFile(r.id)}>{r.path}</button>)}
      </div>
    </div>
  );
}
