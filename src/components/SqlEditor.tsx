"use client";

import { useRef, useEffect, useCallback } from "react";
import { EditorView, keymap, placeholder, drawSelection } from "@codemirror/view";
import { indentWithTab } from "@codemirror/commands";
import { EditorState, Prec } from "@codemirror/state";
import { HighlightStyle, syntaxHighlighting } from "@codemirror/language";
import { tags as t } from "@lezer/highlight";
import { basicSetup } from "codemirror";
import { sqlEditorExtensions } from "@/lib/sqlEditorExtensions";

interface SqlEditorProps {
  value: string;
  onChange: (value: string) => void;
  onRun: () => void;
  onSubmit: () => void;
  schema?: Record<string, string[]>;
}

// Palette matches /DESIGN.md: cool grays + indigo, with semantic
// syntax tones drawn from the same system.
const editorHighlight = HighlightStyle.define([
  { tag: [t.keyword, t.operatorKeyword], color: "#4f46e5", fontWeight: "600" },
  { tag: [t.string, t.special(t.string)], color: "#059669" },
  { tag: [t.number, t.bool], color: "#d97706" },
  {
    tag: [t.comment, t.lineComment, t.blockComment],
    color: "#94a3b8",
    fontStyle: "italic",
  },
  { tag: [t.variableName, t.propertyName], color: "#1e293b" },
  {
    tag: [t.definition(t.variableName), t.function(t.variableName)],
    color: "#4338ca",
  },
  { tag: [t.typeName, t.className], color: "#7c3aed" },
  { tag: t.punctuation, color: "#64748b" },
]);

export default function SqlEditor({
  value,
  onChange,
  onRun,
  onSubmit,
  schema,
}: SqlEditorProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<EditorView | null>(null);
  const onRunRef = useRef(onRun);
  const onSubmitRef = useRef(onSubmit);
  const onChangeRef = useRef(onChange);

  onRunRef.current = onRun;
  onSubmitRef.current = onSubmit;
  onChangeRef.current = onChange;

  const getExtensions = useCallback(() => {
    return [
      basicSetup,
      ...sqlEditorExtensions({ schema }),
      placeholder("Write your SQL query here..."),
      syntaxHighlighting(editorHighlight),
      keymap.of([indentWithTab]),
      drawSelection(),
      Prec.highest(
        keymap.of([
          {
            key: "Mod-Enter",
            run: () => {
              onRunRef.current();
              return true;
            },
          },
          {
            key: "Mod-Shift-Enter",
            run: () => {
              onSubmitRef.current();
              return true;
            },
          },
          {
            key: "Escape",
            run: (view) => {
              view.contentDOM.blur();
              return true;
            },
          },
        ])
      ),
      EditorView.updateListener.of((update) => {
        if (update.docChanged) {
          onChangeRef.current(update.state.doc.toString());
        }
      }),
      EditorView.theme({
        "&": {
          height: "100%",
          fontSize: "14px",
          backgroundColor: "#ffffff",
          color: "#0f172a",
        },
        ".cm-scroller": {
          overflow: "auto",
          fontFamily: "var(--font-mono)",
          lineHeight: "1.65",
        },
        ".cm-content": {
          fontFamily: "var(--font-mono)",
          padding: "22px 20px 36px",
          caretColor: "#4f46e5",
        },
        ".cm-gutters": {
          backgroundColor: "#f8fafc",
          color: "#94a3b8",
          borderRight: "1px solid #e2e8f0",
        },
        ".cm-activeLineGutter": {
          backgroundColor: "#eef2ff",
          color: "#4f46e5",
        },
        ".cm-activeLine": {
          backgroundColor: "rgba(79, 70, 229, 0.04)",
        },
        ".cm-selectionBackground, &.cm-focused .cm-selectionBackground, ::selection":
          {
            backgroundColor: "rgba(79, 70, 229, 0.16)",
          },
        ".cm-cursor, .cm-dropCursor": {
          borderLeftColor: "#4f46e5",
        },
        ".cm-placeholder": {
          color: "#94a3b8",
          fontStyle: "italic",
        },
        ".cm-matchingBracket": {
          backgroundColor: "rgba(79, 70, 229, 0.12)",
          outline: "1px solid rgba(79, 70, 229, 0.25)",
          color: "#0f172a",
        },
      }),
    ];
  }, [schema]);

  useEffect(() => {
    if (!containerRef.current) return;

    const state = EditorState.create({
      doc: value,
      extensions: getExtensions(),
    });

    const view = new EditorView({
      state,
      parent: containerRef.current,
    });

    viewRef.current = view;

    return () => {
      view.destroy();
      viewRef.current = null;
    };
    // Only create editor once on mount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Sync external value changes (e.g., loading starter code)
  useEffect(() => {
    const view = viewRef.current;
    if (!view) return;
    const currentDoc = view.state.doc.toString();
    if (currentDoc !== value) {
      view.dispatch({
        changes: {
          from: 0,
          to: currentDoc.length,
          insert: value,
        },
      });
    }
  }, [value]);

  return <div ref={containerRef} className="h-full w-full overflow-hidden" />;
}
