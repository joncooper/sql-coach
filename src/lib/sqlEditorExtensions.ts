import { sql, PostgreSQL, type SQLNamespace } from "@codemirror/lang-sql";
import {
  indentService,
  indentUnit,
  LanguageSupport,
} from "@codemirror/language";
import type { Extension } from "@codemirror/state";
import { postgresFunctionCompletion } from "./sqlCompletions";

export interface SqlEditorExtensionsOptions {
  schema?: SQLNamespace;
  defaultTable?: string;
}

/**
 * Preserve-previous-line indentation strategy. Overrides the SQL
 * language's default `continuedIndent` rule so that pressing Enter on
 * a line inside an ongoing SELECT doesn't double-indent. An open-paren
 * on the previous line still bumps indent by one unit, which keeps
 * subqueries and CTEs readable.
 */
const sqlIndentService = indentService.of((context, pos) => {
  const doc = context.state.doc;
  const simulated = context.simulatedBreak;
  // Find the line whose indent we should copy. With a simulated break
  // (the insertNewlineAndIndent flow), that's the line at `pos` biased
  // to "before the break" — the content line we're leaving. Without a
  // simulated break, `pos` sits inside the line we're computing indent
  // for, so we step back one line.
  let refFrom: number;
  let refText: string;
  if (simulated !== null) {
    const ref = context.lineAt(pos, -1);
    refFrom = ref.from;
    refText = ref.text;
  } else {
    const current = doc.lineAt(Math.min(pos, doc.length));
    if (current.from === 0) return 0;
    const prev = doc.lineAt(current.from - 1);
    refFrom = prev.from;
    refText = prev.text;
  }

  while (/^\s*$/.test(refText)) {
    if (refFrom === 0) return 0;
    const up = doc.lineAt(refFrom - 1);
    refFrom = up.from;
    refText = up.text;
  }

  const leading = /^[ \t]*/.exec(refText);
  let indent = leading ? leading[0].length : 0;
  if (/\([ \t]*$/.test(refText)) {
    indent += context.unit;
  }
  return indent;
});

/**
 * Full set of editor extensions for the SQL editor surface:
 *
 *   - PostgreSQL dialect + schema-driven autocomplete
 *   - Extended PostgreSQL function completions (see sqlCompletions.ts)
 *   - Two-space indent unit
 *   - Preserve-previous-line indentation for Tab / Enter
 *
 * Factored out of `SqlEditor.tsx` so indentation and completions can
 * be unit-tested headless against `EditorState` (no DOM required).
 */
export function sqlEditorExtensions(
  options: SqlEditorExtensionsOptions = {}
): Extension[] {
  const language: LanguageSupport = sql({
    dialect: PostgreSQL,
    schema: options.schema,
    defaultTable: options.defaultTable,
  });
  return [
    language,
    PostgreSQL.language.data.of({ autocomplete: postgresFunctionCompletion }),
    indentUnit.of("  "),
    sqlIndentService,
  ];
}
