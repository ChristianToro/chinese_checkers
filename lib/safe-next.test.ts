import { describe, expect, it } from "vitest";
import { safeNext } from "./safe-next";

describe("safeNext", () => {
  it("keeps same-site paths", () => {
    expect(safeNext("/games/abc123")).toBe("/games/abc123");
    expect(safeNext("/")).toBe("/");
  });

  it("falls back to / for anything that could leave the site", () => {
    for (const value of ["//evil.example", "/\\evil.example", "https://evil.example", "games", "", null, 42]) {
      expect(safeNext(value)).toBe("/");
    }
  });
});
