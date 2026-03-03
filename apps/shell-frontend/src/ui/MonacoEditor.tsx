import React, { useEffect, useRef } from "react";
import * as monaco from "monaco-editor";
import { LanguageMode } from "../types";

export function MonacoEditor({
  value,
  language,
  theme,
  onChange,
  onCursor,
  gotoLine,
}: {
  value: string;
  language: LanguageMode;
  theme: "dark" | "light";
  onChange: (v: string) => void;
  onCursor: (line: number, column: number) => void;
  gotoLine?: number | null;
}) {
  const divRef = useRef<HTMLDivElement>(null);
  const editorRef = useRef<monaco.editor.IStandaloneCodeEditor | null>(null);

  useEffect(() => {
    if (!divRef.current) return;
    const ed = monaco.editor.create(divRef.current, {
      value,
      language,
      automaticLayout: true,
      theme: theme === "dark" ? "vs-dark" : "vs",
      minimap: { enabled: false },
    });
    editorRef.current = ed;

    const sub = ed.onDidChangeModelContent(() => onChange(ed.getValue()));
    const cursorSub = ed.onDidChangeCursorPosition((e) => onCursor(e.position.lineNumber, e.position.column));
    return () => {
      sub.dispose();
      cursorSub.dispose();
      ed.dispose();
    };
  }, []);

  useEffect(() => {
    const ed = editorRef.current;
    if (!ed) return;
    const model = ed.getModel();
    if (model) monaco.editor.setModelLanguage(model, language);
    monaco.editor.setTheme(theme === "dark" ? "vs-dark" : "vs");
    if (ed.getValue() !== value) ed.setValue(value);
  }, [value, language, theme]);

  useEffect(() => {
    const ed = editorRef.current;
    if (!ed || !gotoLine) return;
    ed.revealLineInCenter(gotoLine);
    ed.setPosition({ lineNumber: gotoLine, column: 1 });
    ed.focus();
  }, [gotoLine]);

  return <div ref={divRef} style={{ height: "100%", width: "100%" }} />;
}
