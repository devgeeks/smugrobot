import type { StorageAdapter } from "../types"

const API_BASE = "https://api.dropboxapi.com/2"
const CONTENT_BASE = "https://content.dropboxapi.com/2"
const AUTH_URL = "https://www.dropbox.com/oauth2/authorize"
const TOKEN_URL = "https://api.dropboxapi.com/oauth2/token"

// --- Auth types ---

export interface DropboxTokens {
  accessToken: string
  refreshToken?: string
  /** Unix ms when the access token expires */
  expiresAt: number
}

export interface PkceChallenge {
  verifier: string
  challenge: string
}

export interface DropboxAuthUrlOptions {
  clientId: string
  redirectUri: string
  codeChallenge: string
  state?: string
}

export interface DropboxExchangeOptions {
  clientId: string
  redirectUri: string
  code: string
  codeVerifier: string
}

export interface DropboxRefreshOptions {
  clientId: string
  refreshToken: string
}

// --- Auth helpers ---

function base64url(bytes: Uint8Array): string {
  let str = ""
  for (const b of bytes) str += String.fromCharCode(b)
  return btoa(str).replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "")
}

/** Generate a PKCE verifier and its SHA-256 base64url challenge. */
export async function generatePkce(): Promise<PkceChallenge> {
  const raw = new Uint8Array(32)
  crypto.getRandomValues(raw)
  const verifier = base64url(raw)
  const hash = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(verifier))
  const challenge = base64url(new Uint8Array(hash))
  return { verifier, challenge }
}

/** Build the Dropbox OAuth 2.0 authorization URL (PKCE, offline access). */
export function getDropboxAuthUrl(options: DropboxAuthUrlOptions): string {
  const params = new URLSearchParams({
    client_id: options.clientId,
    redirect_uri: options.redirectUri,
    response_type: "code",
    code_challenge: options.codeChallenge,
    code_challenge_method: "S256",
    token_access_type: "offline",
  })
  if (options.state) params.set("state", options.state)
  return `${AUTH_URL}?${params}`
}

/** Exchange an authorization code for tokens. */
export async function exchangeDropboxCode(options: DropboxExchangeOptions): Promise<DropboxTokens> {
  return fetchToken(
    new URLSearchParams({
      grant_type: "authorization_code",
      code: options.code,
      redirect_uri: options.redirectUri,
      client_id: options.clientId,
      code_verifier: options.codeVerifier,
    }),
  )
}

/** Refresh an access token using a refresh token. */
export async function refreshDropboxToken(options: DropboxRefreshOptions): Promise<DropboxTokens> {
  return fetchToken(
    new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: options.refreshToken,
      client_id: options.clientId,
    }),
  )
}

async function fetchToken(body: URLSearchParams): Promise<DropboxTokens> {
  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
  })
  if (!res.ok) {
    const text = await res.text()
    throw new Error(`Dropbox token error ${res.status}: ${text}`)
  }
  const data = (await res.json()) as {
    access_token: string
    refresh_token?: string
    expires_in?: number
  }
  const tokens: DropboxTokens = {
    accessToken: data.access_token,
    expiresAt: Date.now() + (data.expires_in ?? 14400) * 1000,
  }
  if (data.refresh_token !== undefined) tokens.refreshToken = data.refresh_token
  return tokens
}

// --- Storage adapter ---

export interface DropboxAdapterOptions {
  accessToken: string
  /**
   * Root path within the Dropbox app folder, e.g. "/MyApp".
   * Use "" (default) to write directly into the app folder root.
   * Dropbox is case-insensitive — document IDs that differ only by case will collide.
   */
  rootPath?: string
}

export function dropboxAdapter(options: DropboxAdapterOptions): StorageAdapter {
  const { accessToken } = options
  const root = (options.rootPath ?? "").replace(/\/+$/, "")

  function toPath(key: string): string {
    return `${root}/${key}`
  }

  function auth(): Record<string, string> {
    return { Authorization: `Bearer ${accessToken}` }
  }

  return {
    async get(key: string): Promise<Uint8Array | null> {
      const res = await fetch(`${CONTENT_BASE}/files/download`, {
        method: "POST",
        headers: {
          ...auth(),
          "Dropbox-API-Arg": JSON.stringify({ path: toPath(key) }),
        },
      })
      if (res.status === 409) return null
      if (!res.ok) throw new Error(`Dropbox download failed: ${res.status}`)
      return new Uint8Array(await res.arrayBuffer())
    },

    async set(key: string, value: Uint8Array): Promise<void> {
      const res = await fetch(`${CONTENT_BASE}/files/upload`, {
        method: "POST",
        headers: {
          ...auth(),
          "Content-Type": "application/octet-stream",
          "Dropbox-API-Arg": JSON.stringify({
            path: toPath(key),
            mode: "overwrite",
            autorename: false,
            mute: true,
          }),
        },
        body: value as unknown as BodyInit,
      })
      if (!res.ok) throw new Error(`Dropbox upload failed: ${res.status}`)
    },

    async delete(key: string): Promise<void> {
      const res = await fetch(`${API_BASE}/files/delete_v2`, {
        method: "POST",
        headers: { ...auth(), "Content-Type": "application/json" },
        body: JSON.stringify({ path: toPath(key) }),
      })
      if (res.status === 409) return // already gone
      if (!res.ok) throw new Error(`Dropbox delete failed: ${res.status}`)
    },

    async list(prefix = ""): Promise<string[]> {
      const results: string[] = []
      let cursor: string | null = null
      let hasMore = true

      while (hasMore) {
        let res: Response

        if (cursor === null) {
          res = await fetch(`${API_BASE}/files/list_folder`, {
            method: "POST",
            headers: { ...auth(), "Content-Type": "application/json" },
            body: JSON.stringify({ path: root, recursive: true }),
          })
        } else {
          res = await fetch(`${API_BASE}/files/list_folder/continue`, {
            method: "POST",
            headers: { ...auth(), "Content-Type": "application/json" },
            body: JSON.stringify({ cursor }),
          })
        }

        if (res.status === 409) break // folder doesn't exist yet — vault is empty
        if (!res.ok) throw new Error(`Dropbox list failed: ${res.status}`)

        const data = (await res.json()) as {
          entries: Array<{ ".tag": string; path_display: string }>
          has_more: boolean
          cursor: string
        }

        for (const entry of data.entries) {
          if (entry[".tag"] !== "file") continue
          // Strip the root prefix and the leading "/" to recover the storage key
          const key = entry.path_display.slice(root.length + 1)
          if (key.startsWith(prefix)) results.push(key)
        }

        hasMore = data.has_more
        cursor = data.cursor
      }

      return results
    },
  }
}
