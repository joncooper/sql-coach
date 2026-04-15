import { describe, expect, it } from "bun:test";
import { EditorState } from "@codemirror/state";
import { CompletionContext } from "@codemirror/autocomplete";
import { sql, PostgreSQL } from "@codemirror/lang-sql";
import {
  POSTGRES_FUNCTIONS,
  postgresFunctionCompletion,
} from "./sqlCompletions";

describe("POSTGRES_FUNCTIONS", () => {
  const expectAll = (names: readonly string[]) => {
    for (const name of names) {
      expect(POSTGRES_FUNCTIONS).toContain(name);
    }
  };

  it("covers aggregate functions", () => {
    expectAll([
      "array_agg",
      "string_agg",
      "json_agg",
      "jsonb_agg",
      "jsonb_object_agg",
      "bool_and",
      "bool_or",
      "bit_and",
      "bit_or",
      "count",
      "sum",
      "avg",
      "min",
      "max",
      "stddev",
      "variance",
      "var_pop",
      "var_samp",
      "stddev_pop",
      "stddev_samp",
      "percentile_cont",
      "percentile_disc",
      "mode",
      "corr",
      "covar_pop",
      "covar_samp",
    ]);
  });

  it("covers window functions", () => {
    expectAll([
      "row_number",
      "rank",
      "dense_rank",
      "lag",
      "lead",
      "first_value",
      "last_value",
      "nth_value",
      "ntile",
      "percent_rank",
      "cume_dist",
    ]);
  });

  it("covers JSON and JSONB builders and accessors", () => {
    expectAll([
      "jsonb_build_object",
      "jsonb_build_array",
      "json_build_object",
      "json_build_array",
      "json_object",
      "jsonb_object",
      "json_object_keys",
      "jsonb_object_keys",
      "jsonb_array_elements",
      "jsonb_array_elements_text",
      "json_array_elements",
      "jsonb_set",
      "jsonb_insert",
      "jsonb_each",
      "jsonb_each_text",
      "jsonb_path_query",
      "jsonb_strip_nulls",
      "to_jsonb",
      "to_json",
      "row_to_json",
    ]);
  });

  it("covers date and time functions", () => {
    expectAll([
      "now",
      "current_date",
      "current_time",
      "current_timestamp",
      "localtime",
      "localtimestamp",
      "date_trunc",
      "date_part",
      "extract",
      "age",
      "to_char",
      "to_date",
      "to_timestamp",
      "to_number",
      "make_date",
      "make_time",
      "make_timestamp",
      "make_timestamptz",
      "make_interval",
      "justify_days",
      "justify_hours",
      "justify_interval",
      "timezone",
    ]);
  });

  it("covers string functions", () => {
    expectAll([
      "length",
      "char_length",
      "character_length",
      "octet_length",
      "upper",
      "lower",
      "initcap",
      "trim",
      "ltrim",
      "rtrim",
      "btrim",
      "lpad",
      "rpad",
      "substring",
      "substr",
      "position",
      "strpos",
      "split_part",
      "replace",
      "translate",
      "reverse",
      "repeat",
      "concat",
      "concat_ws",
      "format",
      "left",
      "right",
      "ascii",
      "chr",
      "starts_with",
      "quote_ident",
      "quote_literal",
      "quote_nullable",
    ]);
  });

  it("covers regexp functions", () => {
    expectAll([
      "regexp_match",
      "regexp_matches",
      "regexp_replace",
      "regexp_split_to_array",
      "regexp_split_to_table",
      "regexp_count",
      "regexp_instr",
      "regexp_like",
      "regexp_substr",
    ]);
  });

  it("covers array and set-returning functions", () => {
    expectAll([
      "array_length",
      "array_upper",
      "array_lower",
      "array_ndims",
      "array_position",
      "array_positions",
      "array_remove",
      "array_replace",
      "array_append",
      "array_prepend",
      "array_cat",
      "array_to_string",
      "string_to_array",
      "cardinality",
      "unnest",
      "generate_series",
      "generate_subscripts",
    ]);
  });

  it("covers math functions", () => {
    expectAll([
      "abs",
      "ceil",
      "ceiling",
      "floor",
      "round",
      "trunc",
      "sign",
      "power",
      "sqrt",
      "cbrt",
      "exp",
      "ln",
      "log",
      "log10",
      "mod",
      "div",
      "pi",
      "random",
      "sin",
      "cos",
      "tan",
      "asin",
      "acos",
      "atan",
      "atan2",
      "degrees",
      "radians",
      "width_bucket",
      "gcd",
      "lcm",
    ]);
  });

  it("covers conditional functions", () => {
    expectAll(["coalesce", "nullif", "greatest", "least"]);
  });

  it("covers encoding and hash functions", () => {
    expectAll(["md5", "encode", "decode"]);
  });

  it("covers postgres system functions", () => {
    expectAll([
      "pg_typeof",
      "pg_size_pretty",
      "current_user",
      "current_schema",
      "session_user",
      "version",
    ]);
  });

  it("contains no duplicates", () => {
    const set = new Set(POSTGRES_FUNCTIONS);
    expect(set.size).toBe(POSTGRES_FUNCTIONS.length);
  });

  it("uses lowercase snake_case identifiers only", () => {
    for (const fn of POSTGRES_FUNCTIONS) {
      expect(fn).toMatch(/^[a-z][a-z0-9_]*$/);
    }
  });

  it("has comprehensive coverage (>= 180 entries)", () => {
    expect(POSTGRES_FUNCTIONS.length).toBeGreaterThanOrEqual(180);
  });
});

describe("postgresFunctionCompletion", () => {
  const makeContext = (doc: string, pos = doc.length, explicit = true) => {
    const state = EditorState.create({
      doc,
      extensions: [sql({ dialect: PostgreSQL })],
    });
    return new CompletionContext(state, pos, explicit);
  };

  it("returns completions when typing a function prefix", async () => {
    const ctx = makeContext("SELECT str");
    const result = await postgresFunctionCompletion(ctx);
    expect(result).not.toBeNull();
    const labels = result!.options.map((o) => o.label);
    expect(labels).toContain("string_agg");
    expect(labels).toContain("strpos");
  });

  it("marks every option with type 'function'", async () => {
    const ctx = makeContext("SELECT j");
    const result = await postgresFunctionCompletion(ctx);
    expect(result).not.toBeNull();
    for (const opt of result!.options) {
      expect(opt.type).toBe("function");
    }
  });

  it("inserts an open paren when the completion is applied", async () => {
    const ctx = makeContext("SELECT co");
    const result = await postgresFunctionCompletion(ctx);
    const coalesce = result!.options.find((o) => o.label === "coalesce");
    expect(coalesce).toBeDefined();
    expect(coalesce!.apply).toBe("coalesce(");
  });

  it("returns a result on an explicit empty-prefix request", async () => {
    const ctx = makeContext("SELECT ", "SELECT ".length, true);
    const result = await postgresFunctionCompletion(ctx);
    expect(result).not.toBeNull();
    expect(result!.options.length).toBeGreaterThan(100);
  });
});
