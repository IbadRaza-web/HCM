import { describe, expect, it } from "vitest";
import { parseCsv } from "@/lib/csv";

describe("parseCsv", () => {
  it("parses comma-separated values and CRLF rows", () => {
    expect(parseCsv("name,email\r\nAda,ada@example.com\r\n")).toEqual([
      ["name", "email"],
      ["Ada", "ada@example.com"],
    ]);
  });

  it("preserves commas, escaped quotes, and newlines in quoted fields", () => {
    expect(parseCsv('name,address,note\nAda,"1 Main St, Apt 2","Said ""hello"""\nLin,"Line 1\nLine 2",ok')).toEqual([
      ["name", "address", "note"],
      ["Ada", "1 Main St, Apt 2", 'Said "hello"'],
      ["Lin", "Line 1\nLine 2", "ok"],
    ]);
  });

  it("rejects an unclosed quoted field", () => {
    expect(() => parseCsv('name,email\nAda,"ada@example.com')).toThrow("unclosed quoted field");
  });

  it("ignores empty lines", () => {
    expect(parseCsv("name,email\n\nAda,ada@example.com\n")).toEqual([
      ["name", "email"],
      ["Ada", "ada@example.com"],
    ]);
  });
});
