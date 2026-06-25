import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import {
  dropboxAdapter,
  generatePkce,
  getDropboxAuthUrl,
  exchangeDropboxCode,
  refreshDropboxToken,
} from "../src/adapters/dropbox"

// --- helpers ---

function mockFetch(response: { ok?: boolean; status?: number; body?: unknown }): void {
  const { body, ok = true, status = 200 } = response
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue({
      ok,
      status,
      arrayBuffer: async () => {
        if (body instanceof Uint8Array) return body.buffer
        return new ArrayBuffer(0)
      },
      json: async () => body,
      text: async () => String(body ?? ""),
    } as unknown as Response),
  )
}

function fetchMock() {
  return vi.mocked(globalThis.fetch)
}

// --- generatePkce ---

describe("generatePkce", () => {
  it("returns verifier and challenge strings", async () => {
    const { verifier, challenge } = await generatePkce()
    expect(typeof verifier).toBe("string")
    expect(typeof challenge).toBe("string")
  })

  it("verifier and challenge are base64url (no +, /, or =)", async () => {
    const { verifier, challenge } = await generatePkce()
    expect(verifier).toMatch(/^[A-Za-z0-9_-]+$/)
    expect(challenge).toMatch(/^[A-Za-z0-9_-]+$/)
  })

  it("challenge is SHA-256 of verifier", async () => {
    const { verifier, challenge } = await generatePkce()
    const hash = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(verifier))
    const expected = btoa(String.fromCharCode(...new Uint8Array(hash)))
      .replace(/\+/g, "-")
      .replace(/\//g, "_")
      .replace(/=/g, "")
    expect(challenge).toBe(expected)
  })

  it("generates unique verifiers each call", async () => {
    const a = await generatePkce()
    const b = await generatePkce()
    expect(a.verifier).not.toBe(b.verifier)
  })
})

// --- getDropboxAuthUrl ---

describe("getDropboxAuthUrl", () => {
  it("returns a URL pointing at Dropbox", () => {
    const url = getDropboxAuthUrl({
      clientId: "abc",
      redirectUri: "https://app.example.com/callback",
      codeChallenge: "challenge123",
    })
    expect(url).toContain("https://www.dropbox.com/oauth2/authorize")
  })

  it("includes required OAuth params", () => {
    const url = getDropboxAuthUrl({
      clientId: "abc",
      redirectUri: "https://app.example.com/callback",
      codeChallenge: "challenge123",
    })
    const params = new URLSearchParams(url.split("?")[1])
    expect(params.get("client_id")).toBe("abc")
    expect(params.get("response_type")).toBe("code")
    expect(params.get("code_challenge")).toBe("challenge123")
    expect(params.get("code_challenge_method")).toBe("S256")
    expect(params.get("token_access_type")).toBe("offline")
  })

  it("includes optional state param when provided", () => {
    const url = getDropboxAuthUrl({
      clientId: "abc",
      redirectUri: "https://app.example.com/callback",
      codeChallenge: "challenge123",
      state: "csrf-token",
    })
    const params = new URLSearchParams(url.split("?")[1])
    expect(params.get("state")).toBe("csrf-token")
  })
})

// --- exchangeDropboxCode ---

describe("exchangeDropboxCode", () => {
  afterEach(() => vi.unstubAllGlobals())

  it("posts to the token endpoint and returns tokens", async () => {
    mockFetch({
      body: {
        access_token: "tok_access",
        refresh_token: "tok_refresh",
        expires_in: 14400,
      },
    })

    const tokens = await exchangeDropboxCode({
      clientId: "cid",
      redirectUri: "https://app.example.com/callback",
      code: "auth_code",
      codeVerifier: "verifier_value",
    })

    expect(tokens.accessToken).toBe("tok_access")
    expect(tokens.refreshToken).toBe("tok_refresh")
    expect(tokens.expiresAt).toBeGreaterThan(Date.now())

    const [url, init] = fetchMock().mock.calls[0] as [string, RequestInit]
    expect(url).toBe("https://api.dropboxapi.com/oauth2/token")
    const body = new URLSearchParams(init.body as unknown as string)
    expect(body.get("grant_type")).toBe("authorization_code")
    expect(body.get("code")).toBe("auth_code")
    expect(body.get("code_verifier")).toBe("verifier_value")
  })

  it("throws on non-ok response", async () => {
    mockFetch({ ok: false, status: 400, body: "bad_request" })
    await expect(
      exchangeDropboxCode({
        clientId: "cid",
        redirectUri: "https://app.example.com/callback",
        code: "bad",
        codeVerifier: "v",
      }),
    ).rejects.toThrow("400")
  })
})

// --- refreshDropboxToken ---

describe("refreshDropboxToken", () => {
  afterEach(() => vi.unstubAllGlobals())

  it("posts refresh_token grant and returns new tokens", async () => {
    mockFetch({
      body: { access_token: "new_access", expires_in: 14400 },
    })

    const tokens = await refreshDropboxToken({ clientId: "cid", refreshToken: "old_refresh" })
    expect(tokens.accessToken).toBe("new_access")
    expect(tokens.refreshToken).toBeUndefined()

    const [, init] = fetchMock().mock.calls[0] as [string, RequestInit]
    const body = new URLSearchParams(init.body as unknown as string)
    expect(body.get("grant_type")).toBe("refresh_token")
    expect(body.get("refresh_token")).toBe("old_refresh")
  })
})

// --- dropboxAdapter ---

describe("dropboxAdapter", () => {
  const TOKEN = "test_token"
  const ROOT = "/Apps/TestApp"

  beforeEach(() => vi.unstubAllGlobals())

  function makeAdapter(rootPath = ROOT) {
    return dropboxAdapter({ accessToken: TOKEN, rootPath })
  }

  describe("get", () => {
    it("downloads the file and returns Uint8Array", async () => {
      const data = new Uint8Array([1, 2, 3])
      mockFetch({ body: data })

      const result = await makeAdapter().get("docs/abc/body")
      expect(result).toEqual(data)

      const [url, init] = fetchMock().mock.calls[0] as [string, RequestInit]
      expect(url).toContain("/files/download")
      const arg = JSON.parse((init.headers as Record<string, string>)["Dropbox-API-Arg"]!)
      expect(arg.path).toBe(`${ROOT}/docs/abc/body`)
    })

    it("returns null on 409 (file not found)", async () => {
      mockFetch({ ok: false, status: 409 })
      const result = await makeAdapter().get("docs/missing/body")
      expect(result).toBeNull()
    })

    it("throws on other error status codes", async () => {
      mockFetch({ ok: false, status: 503 })
      await expect(makeAdapter().get("docs/abc/body")).rejects.toThrow("503")
    })
  })

  describe("set", () => {
    it("uploads the value as octet-stream with overwrite mode", async () => {
      mockFetch({ body: { name: "body" } })
      const value = new Uint8Array([4, 5, 6])

      await makeAdapter().set("docs/abc/body", value)

      const [url, init] = fetchMock().mock.calls[0] as [string, RequestInit]
      expect(url).toContain("/files/upload")
      expect((init.headers as Record<string, string>)["Content-Type"]).toBe(
        "application/octet-stream",
      )
      const arg = JSON.parse((init.headers as Record<string, string>)["Dropbox-API-Arg"]!)
      expect(arg.path).toBe(`${ROOT}/docs/abc/body`)
      expect(arg.mode).toBe("overwrite")
      expect(init.body).toBe(value)
    })

    it("throws on error status", async () => {
      mockFetch({ ok: false, status: 400, body: "bad" })
      await expect(makeAdapter().set("docs/abc/body", new Uint8Array())).rejects.toThrow("400")
    })
  })

  describe("delete", () => {
    it("sends delete request with correct path", async () => {
      mockFetch({ body: { metadata: {} } })

      await makeAdapter().delete("docs/abc/body")

      const [url, init] = fetchMock().mock.calls[0] as [string, RequestInit]
      expect(url).toContain("/files/delete_v2")
      const body = JSON.parse(init.body as unknown as string)
      expect(body.path).toBe(`${ROOT}/docs/abc/body`)
    })

    it("treats 409 as success (already deleted)", async () => {
      mockFetch({ ok: false, status: 409 })
      await expect(makeAdapter().delete("docs/abc/body")).resolves.toBeUndefined()
    })

    it("throws on other error status", async () => {
      mockFetch({ ok: false, status: 500, body: "server error" })
      await expect(makeAdapter().delete("docs/abc/body")).rejects.toThrow("500")
    })
  })

  describe("list", () => {
    it("returns keys relative to root, filtered by prefix", async () => {
      mockFetch({
        body: {
          entries: [
            { ".tag": "file", path_display: `${ROOT}/docs/abc/body` },
            { ".tag": "file", path_display: `${ROOT}/docs/abc/meta` },
            { ".tag": "file", path_display: `${ROOT}/vault/salt` },
            { ".tag": "folder", path_display: `${ROOT}/docs` },
          ],
          has_more: false,
          cursor: "cur1",
        },
      })

      const keys = await makeAdapter().list("docs/")
      expect(keys).toEqual(["docs/abc/body", "docs/abc/meta"])
    })

    it("returns all keys when no prefix given", async () => {
      mockFetch({
        body: {
          entries: [
            { ".tag": "file", path_display: `${ROOT}/docs/abc/body` },
            { ".tag": "file", path_display: `${ROOT}/vault/salt` },
          ],
          has_more: false,
          cursor: "cur1",
        },
      })

      const keys = await makeAdapter().list()
      expect(keys).toHaveLength(2)
    })

    it("follows pagination via list_folder/continue", async () => {
      vi.stubGlobal(
        "fetch",
        vi.fn()
          .mockResolvedValueOnce({
            ok: true,
            status: 200,
            json: async () => ({
              entries: [{ ".tag": "file", path_display: `${ROOT}/docs/a/body` }],
              has_more: true,
              cursor: "cursor_page2",
            }),
          })
          .mockResolvedValueOnce({
            ok: true,
            status: 200,
            json: async () => ({
              entries: [{ ".tag": "file", path_display: `${ROOT}/docs/b/body` }],
              has_more: false,
              cursor: "cursor_page3",
            }),
          }),
      )

      const keys = await makeAdapter().list()
      expect(keys).toEqual(["docs/a/body", "docs/b/body"])

      const secondCall = fetchMock().mock.calls[1] as [string, RequestInit]
      expect(secondCall[0]).toContain("/list_folder/continue")
      expect(JSON.parse(secondCall[1].body as string).cursor).toBe("cursor_page2")
    })

    it("returns empty array when root folder does not exist (409)", async () => {
      mockFetch({ ok: false, status: 409 })
      const keys = await makeAdapter().list()
      expect(keys).toEqual([])
    })

    it("works with empty rootPath", async () => {
      mockFetch({
        body: {
          entries: [{ ".tag": "file", path_display: "/docs/abc/body" }],
          has_more: false,
          cursor: "c",
        },
      })

      const adapter = dropboxAdapter({ accessToken: TOKEN })
      const keys = await adapter.list()
      expect(keys).toEqual(["docs/abc/body"])
    })
  })
})
