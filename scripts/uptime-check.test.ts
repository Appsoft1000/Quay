import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { checkSyntheticLink, checkGet, renderStatusMdContent } from "./lib/uptime-check.ts";

// ---------------------------------------------------------------------------
// helpers
// ---------------------------------------------------------------------------

function jsonResponse(status: number, body?: unknown) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body ?? {},
  } as unknown as Response;
}

// ---------------------------------------------------------------------------
// checkSyntheticLink
// ---------------------------------------------------------------------------

describe("checkSyntheticLink", () => {
  const API = "https://api.example.com";
  let mockFetch: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    mockFetch = vi.fn();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("sends a bearer token when an API key is provided", async () => {
    mockFetch
      .mockResolvedValueOnce(
        jsonResponse(201, { link: { id: "lnk_uptime_1" }, request: {} }),
      )
      .mockResolvedValueOnce(
        jsonResponse(200, { link: { id: "lnk_uptime_1", status: "cancelled" } }),
      );

    await checkSyntheticLink(API, "ak_live_test123", mockFetch);

    // First call: POST /links with auth header.
    const [createUrl, createOpts] = mockFetch.mock.calls[0]!;
    expect(createUrl).toBe(`${API}/links`);
    expect(createOpts.headers.authorization).toBe("Bearer ak_live_test123");
    expect(JSON.parse(createOpts.body)).toEqual({
      title: "uptime-check",
      amount: "0.0000001",
      assetCode: "XLM",
    });

    // Second call: POST /links/:id/cancel with auth header.
    expect(mockFetch).toHaveBeenCalledTimes(2);
    const [cancelUrl, cancelOpts] = mockFetch.mock.calls[1]!;
    expect(cancelUrl).toBe(`${API}/links/lnk_uptime_1/cancel`);
    expect(cancelOpts.headers.authorization).toBe("Bearer ak_live_test123");
  });

  it("does not send an Authorization header when apiKey is null", async () => {
    mockFetch.mockResolvedValueOnce(jsonResponse(401));

    await expect(checkSyntheticLink(API, null, mockFetch)).rejects.toThrow(
      "UPTIME_API_KEY is not set",
    );

    const [, opts] = mockFetch.mock.calls[0]!;
    expect(opts.headers.authorization).toBeUndefined();
  });

  it("throws on non-201 status (e.g. 500)", async () => {
    mockFetch.mockResolvedValueOnce(jsonResponse(500));

    await expect(checkSyntheticLink(API, "ak_live_test123", mockFetch)).rejects.toThrow(
      "HTTP 500 (expected 201)",
    );
  });

  it("succeeds even when the cancel call fails (best-effort cleanup)", async () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

    mockFetch
      .mockResolvedValueOnce(
        jsonResponse(201, { link: { id: "lnk_uptime_2" }, request: {} }),
      )
      .mockResolvedValueOnce(jsonResponse(500)); // cancel fails

    // Should NOT throw — the write succeeded.
    await expect(checkSyntheticLink(API, "ak_live_test123", mockFetch)).resolves.toBeUndefined();

    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining("failed to cancel synthetic link lnk_uptime_2"),
    );

    warnSpy.mockRestore();
  });

  it("skips cancel when response has no link id", async () => {
    mockFetch.mockResolvedValueOnce(jsonResponse(201, { link: {}, request: {} }));

    await expect(checkSyntheticLink(API, "ak_live_test123", mockFetch)).resolves.toBeUndefined();

    // Only one call — no cancel attempted.
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  it("throws on timeout (AbortError)", async () => {
    mockFetch.mockImplementation(() => {
      return new Promise((_resolve, reject) => {
        setTimeout(() => reject(Object.assign(new Error("aborted"), { name: "AbortError" })), 10);
      });
    });

    await expect(checkSyntheticLink(API, "ak_live_test123", mockFetch)).rejects.toThrow();
  });
});

// ---------------------------------------------------------------------------
// checkGet
// ---------------------------------------------------------------------------

describe("checkGet", () => {
  let mockFetch: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    mockFetch = vi.fn();
  });

  it("resolves on HTTP 200", async () => {
    mockFetch.mockResolvedValueOnce(jsonResponse(200));
    await expect(checkGet("https://example.com/health", mockFetch)).resolves.toBeUndefined();
  });

  it("throws on non-OK status", async () => {
    mockFetch.mockResolvedValueOnce(jsonResponse(503));
    await expect(checkGet("https://example.com/health", mockFetch)).rejects.toThrow("HTTP 503");
  });

  it("throws on network error", async () => {
    mockFetch.mockRejectedValueOnce(new Error("fetch failed"));
    await expect(checkGet("https://example.com/health", mockFetch)).rejects.toThrow("fetch failed");
  });
});

// ---------------------------------------------------------------------------
// renderStatusMdContent
// ---------------------------------------------------------------------------

describe("renderStatusMdContent", () => {
  it("includes a prominent 'Last regenerated' timestamp", () => {
    const state = {
      targets: {
        api: {
          lastStatus: "up",
          lastCheckedAt: "2026-08-20T12:00:00.000Z",
          lastError: null,
        },
      },
    };

    const md = renderStatusMdContent(state, "2026-08-20T12:00:00.000Z");
    expect(md).toMatch(/# Status/);
    expect(md).toMatch(/> \*\*Last regenerated:\*\* 2026-08-20T12:00:00.000Z/);
    expect(md).toMatch(/Generated by `.github\/workflows\/uptime\.yml`/);
  });

  it("shows the stale-friendly format even with no targets", () => {
    const md = renderStatusMdContent({ targets: {} }, "2026-01-01T00:00:00.000Z");
    expect(md).toMatch(/# Status/);
    expect(md).toMatch(/> \*\*Last regenerated:\*\* 2026-01-01T00:00:00.000Z/);
  });
});
