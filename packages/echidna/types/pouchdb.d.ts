declare module "pouchdb" {
  interface PouchAttachment {
    content_type: string
    data: string
  }

  interface PouchDoc {
    _id: string
    _rev?: string
    _deleted?: boolean
    _attachments?: Record<string, PouchAttachment>
  }

  export interface PouchDatabase {
    get(id: string, options?: { attachments?: boolean }): Promise<PouchDoc>
    put(doc: PouchDoc): Promise<{ ok: boolean; id: string; rev: string }>
    remove(id: string, rev: string): Promise<{ ok: boolean }>
    allDocs(options?: { startkey?: string; endkey?: string }): Promise<{ rows: { id: string }[] }>
    destroy(): Promise<{ ok: boolean }>
  }

  interface PouchDatabaseConstructor {
    new (name: string): PouchDatabase
  }

  const PouchDB: PouchDatabaseConstructor
  export default PouchDB
}
