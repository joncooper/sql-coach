"use client";

import { useRef, useEffect, useCallback } from "react";
import { EditorView, keymap, placeholder, drawSelection } from "@codemirror/view";
import { indentWithTab } from "@codemirror/commands";
import { EditorState, Prec } from "@codemirror/state";
import { sql, PostgreSQL } from "@codemirror/lang-sql";
import { oneDark } from "@codemirror/theme-one-dark";
import { basicSetup } from "codemirror";

interface SqlEditorProps {
  value: string;
  onChange: (value: string) => void;
  onRun: () => void;
  onSubmit: () => void;
  schema?: Record<string, string[]>;
}

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
      sql({ dialect: PostgreSQL, schema: schema }),
      oneDark,
      placeholder("Write your SQL query here..."),
      keymap.of([indentWithTab]),
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
        "&": { height: "100%", fontSize: "14px" },
        ".cm-scroller": { overflow: "auto" },
        ".cm-content": { fontFamily: "'JetBrains Mono', 'Fira Code', monospace" },
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
