import { NextRequest } from "next/server";
import { describe, expect, it } from "vitest";
import { config, proxy } from "./proxy";

describe("proxy", () => {
  it("sends a cookieless game visit to sign-in, remembering where it was going", () => {
    const res = proxy(new NextRequest("http://localhost:3000/games/abc123"));
    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toBe("http://localhost:3000/?next=%2Fgames%2Fabc123");
  });

  it("lets a request with a session cookie through for the page to verify", () => {
    const res = proxy(
      new NextRequest("http://localhost:3000/games/abc123", { headers: { cookie: "cc_session=anything" } }),
    );
    expect(res.status).toBe(200);
    expect(res.headers.get("location")).toBeNull();
  });

  it("only guards game pages", () => {
    expect(config.matcher).toBe("/games/:path*");
  });
});
