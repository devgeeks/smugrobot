export interface StorageAdapter {
  get(key: string): Promise<Uint8Array | null>;
  set(key: string, value: Uint8Array): Promise<void>;
  delete(key: string): Promise<void>;
  list(prefix?: string): Promise<string[]>;
}

export interface DocMeta {
  id: string;
  title: string;
  createdAt: number;
  updatedAt: number;
  tags?: string[];
  size?: number;
  [key: string]: unknown;
}

export type KdfAlgo = "scrypt" | "pbkdf2";

export interface ScryptParams {
  algo: "scrypt";
  N: number;
  r: number;
  p: number;
}

export interface Pbkdf2Params {
  algo: "pbkdf2";
  iterations: number;
  hash: "SHA-256";
}

export type KdfParams = ScryptParams | Pbkdf2Params;

export type KeySource =
  { type: "passphrase"; passphrase: string; kdf?: KdfAlgo } | { type: "raw"; key: Uint8Array };

export interface CreateStoreOptions {
  adapter: StorageAdapter;
  keySource: KeySource;
}

export interface ListOptions {
  tags?: string[];
  since?: number;
  until?: number;
}

export interface SetMetaOptions {
  title?: string;
  tags?: string[];
  [key: string]: unknown;
}

export type EchidnaJsErrorCode =
  | "WRONG_KEY"
  | "CORRUPT_BLOB"
  | "TAMPERED"
  | "NEEDS_MIGRATION"
  | "INVALID_KEY"
  | "INVALID_ID"
  | "NOT_FOUND"
  | "KDF_FAILED"
  | "INVALID_KDF_PARAMS"
  | "VAULT_EXISTS"
  | "VAULT_NOT_FOUND";

export class EchidnaJsError extends Error {
  constructor(
    message: string,
    public readonly code: EchidnaJsErrorCode,
  ) {
    super(message);
    this.name = "EchidnaJsError";
  }
}
