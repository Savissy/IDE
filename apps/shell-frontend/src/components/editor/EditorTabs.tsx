import React from "react";
import { ideStore, useIDEStore } from "../../state/store";

export function EditorTabs({ splitId }: { splitId: string }) {
  const split = useIDEStore((s) => s.splits.find((sp) => sp.id === splitId));
  const tabs = useIDEStore((s) => s.openTabs);
  const dirty = useIDEStore((s) => s.dirty);
  if (!split) return null;
  return <div className="tabsRow2">{split.tabIds.map((id) => {
    const tab = tabs.find((t) => t.id === id);
    if (!tab) return null;
    return <div className={`tab2 ${split.activeTabId === id ? "active" : ""}`} key={id}>
      <button onClick={() => ideStore.openFile(tab.nodeId, splitId)}>{tab.title}{dirty[tab.nodeId] ? " ●" : ""}</button>
      <button onClick={() => ideStore.closeTab(id)}>×</button>
    </div>;
  })}</div>;
}
