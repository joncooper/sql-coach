import { describe, expect, it } from "bun:test";
import {
  EditorState,
  EditorSelection,
  type StateCommand,
  type Transaction,
} from "@codemirror/state";
import { indentUnit, getIndentation } from "@codemirror/language";
import {
  indentMore,
  indentLess,
  insertNewlineAndIndent,
} from "@codemirror/commands";
import { sqlEditorExtensions } from "./sqlEditorExtensions";

const makeState = (doc: string, pos = 0) =>
  EditorState.create({
    doc,
    selection: EditorSelection.cursor(pos),
    extensions: sqlEditorExtensions(),
  });

const makeStateWithSelection = (
  doc: string,
  anchor: number,
  head: number
) =>
  EditorState.create({
    doc,
    selection: EditorSelection.single(anchor, head),
    extensions: sqlEditorExtensions(),
  });

const runCmd = (cmd: StateCommand, state: EditorState): EditorState => {
  let next: EditorState = state;
  let dispatched = false;
  cmd({
    state,
    dispatch: (tr: Transaction) => {
      next = tr.state;
      dispatched = true;
    },
  });
  return dispatched ? next : state;
};

describe("SQL editor indent unit", () => {
  it("is exactly two spaces", () => {
    const state = makeState("");
    expect(state.facet(indentUnit)).toBe("  ");
  });
});

describe("indentMore (Tab)", () => {
  it("inserts one indent unit at the start of a single line", () => {
    const state = makeState("FROM users", 0);
    const next = runCmd(indentMore, state);
    expect(next.doc.toString()).toBe("  FROM users");
  });

  it("indents every line of a multi-line selection by one unit", () => {
    const doc = "SELECT *\nFROM users\nWHERE id = 1";
    const state = makeStateWithSelection(doc, 9, doc.length);
    const next = runCmd(indentMore, state);
    expect(next.doc.toString()).toBe(
      "SELECT *\n  FROM users\n  WHERE id = 1"
    );
  });

  it("adds exactly two spaces to an already-indented line", () => {
    const state = makeState("  FROM users", 0);
    const next = runCmd(indentMore, state);
    expect(next.doc.toString()).toBe("    FROM users");
  });
});

describe("indentLess (Shift-Tab)", () => {
  it("removes one indent unit from an indented line", () => {
    const state = makeState("    FROM users", 0);
    const next = runCmd(indentLess, state);
    expect(next.doc.toString()).toBe("  FROM users");
  });

  it("is a no-op when the line has no leading whitespace", () => {
    const state = makeState("FROM users", 0);
    const next = runCmd(indentLess, state);
    expect(next.doc.toString()).toBe("FROM users");
  });

  it("dedents every line of a multi-line selection", () => {
    const doc = "SELECT *\n    FROM users\n    WHERE id = 1";
    const state = makeStateWithSelection(doc, 9, doc.length);
    const next = runCmd(indentLess, state);
    expect(next.doc.toString()).toBe(
      "SELECT *\n  FROM users\n  WHERE id = 1"
    );
  });
});

describe("insertNewlineAndIndent (Enter)", () => {
  it("preserves zero indentation from the previous line", () => {
    const doc = "SELECT 1";
    const state = makeState(doc, doc.length);
    const next = runCmd(insertNewlineAndIndent, state);
    expect(next.doc.toString()).toBe("SELECT 1\n");
  });

  it("preserves two-space indentation from the previous line", () => {
    const doc = "  SELECT 1";
    const state = makeState(doc, doc.length);
    const next = runCmd(insertNewlineAndIndent, state);
    expect(next.doc.toString()).toBe("  SELECT 1\n  ");
  });

  it("preserves deep indentation from the previous line", () => {
    const doc = "SELECT id,\n       name";
    const state = makeState(doc, doc.length);
    const next = runCmd(insertNewlineAndIndent, state);
    const lines = next.doc.toString().split("\n");
    expect(lines[2]).toBe("       ");
  });

  it("indents one more level after a line ending with an open paren", () => {
    const doc = "SELECT * FROM (";
    const state = makeState(doc, doc.length);
    const next = runCmd(insertNewlineAndIndent, state);
    expect(next.doc.toString()).toBe("SELECT * FROM (\n  ");
  });

  it("stacks paren indentation with existing indentation", () => {
    const doc = "  SELECT * FROM (";
    const state = makeState(doc, doc.length);
    const next = runCmd(insertNewlineAndIndent, state);
    expect(next.doc.toString()).toBe("  SELECT * FROM (\n    ");
  });

  it("does not over-indent on a continuation line of a plain SELECT", () => {
    // Regression: SQL's default continuedIndent would push this to 4 spaces.
    const doc = "  SELECT 1\n  FROM users";
    const state = makeState(doc, doc.length);
    const next = runCmd(insertNewlineAndIndent, state);
    const lines = next.doc.toString().split("\n");
    expect(lines[2]).toBe("  ");
  });
});

describe("getIndentation via indentService", () => {
  it("returns the previous line's indent for a fresh line", () => {
    const doc = "  SELECT 1\n";
    const state = makeState(doc, doc.length);
    expect(getIndentation(state, doc.length)).toBe(2);
  });

  it("skips blank lines when looking for a reference indent", () => {
    const doc = "  SELECT 1\n\n";
    const state = makeState(doc, doc.length);
    expect(getIndentation(state, doc.length)).toBe(2);
  });
});
