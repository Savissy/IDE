import React, { useEffect, useRef } from "react";
import * as monaco from "monaco-editor";

export function MonacoEditor({
  value,
  onChange
}: {
  value: string;
  onChange: (v: string) => void;
}) {
  const divRef = useRef<HTMLDivElement>(null);
  const editorRef = useRef<monaco.editor.IStandaloneCodeEditor | null>(null);

  useEffect(() => {
    if (!divRef.current) return;
    const ed = monaco.editor.create(divRef.current, {
      value,
      language: "haskell",
      automaticLayout: true,
      theme: "vs-dark",
      minimap: { enabled: false }
    });
    editorRef.current = ed;

    const sub = ed.onDidChangeModelContent(() => onChange(ed.getValue()));

    // expose quick hook for file explorer demo
    (window as any).__EDITOR_SET_VALUE = (v: string) => {
      if (editorRef.current) editorRef.current.setValue(v);
    };

    return () => {
      sub.dispose();
      ed.dispose();
    };
  }, []);

  useEffect(() => {
    const ed = editorRef.current;
    if (!ed) return;
    if (ed.getValue() !== value) ed.setValue(value);
  }, [value]);

  return <div ref={divRef} style={{ height: "100%", width: "100%" }} />;
}
