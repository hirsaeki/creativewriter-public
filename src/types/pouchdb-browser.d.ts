declare module 'pouchdb-browser' {
  const PouchDB: PouchDB.Static;
  export default PouchDB;
}

declare namespace PouchDB {
  interface Static {
    new <T = object>(name: string, options?: Configuration.DatabaseConfiguration): Database<T>;
    plugin(plugin: unknown): Static;
  }

  // eslint-disable-next-line @typescript-eslint/no-empty-object-type
  interface Database<T = {}> {
    put(doc: T & Core.Document): Promise<PutResponse>;
    get(id: string): Promise<T & Core.ExistingDocument>;
    remove(doc: Core.ExistingDocument): Promise<PutResponse>;
    allDocs(options?: AllDocsOptions): Promise<AllDocsResponse<T>>;
    find(options: FindOptions): Promise<FindResponse<T>>;
    createIndex(options: IndexOptions): Promise<{ result: string }>;
    info(): Promise<InfoResponse>;
    compact(): Promise<void>;
    destroy(): Promise<void>;
    close(): Promise<void>;
    sync(target: Database<T>, options?: Replication.SyncOptions): Replication.Sync<T>;
    replicate: {
      to(target: Database<T>, options?: Replication.ReplicateOptions): Replication.Replication<T>;
      from(target: Database<T>, options?: Replication.ReplicateOptions): Replication.Replication<T>;
    };
    bulkDocs(docs: (T & Core.Document)[]): Promise<PutResponse[]>;
    getAttachment(docId: string, attachmentId: string): Promise<Blob>;
    putAttachment(docId: string, attachmentId: string, attachment: Blob, type: string): Promise<PutResponse>;
    removeAttachment(docId: string, attachmentId: string, rev: string): Promise<PutResponse>;
    viewCleanup(): Promise<void>;
    name?: string;
  }

  namespace Replication {
    interface SyncOptions {
      live?: boolean;
      retry?: boolean;
      filter?: string | ((doc: unknown) => boolean);
      doc_ids?: string[];
      query_params?: Record<string, unknown>;
      view?: string;
      since?: number | string;
      heartbeat?: number;
      timeout?: number;
      batch_size?: number;
      batches_limit?: number;
      back_off_function?: (delay: number) => number;
      checkpoint?: boolean | 'source' | 'target';
      push?: ReplicateOptions;
      pull?: ReplicateOptions;
    }

    interface ReplicateOptions {
      live?: boolean;
      retry?: boolean;
      filter?: string | ((doc: unknown) => boolean);
      doc_ids?: string[];
      query_params?: Record<string, unknown>;
      view?: string;
      since?: number | string;
      heartbeat?: number;
      timeout?: number;
      batch_size?: number;
      batches_limit?: number;
      back_off_function?: (delay: number) => number;
      checkpoint?: boolean | 'source' | 'target';
    }

    interface Replication<T = unknown> extends Promise<ReplicationResult<T>> {
      on(event: 'change', handler: (info: ReplicationInfo<T>) => void): Replication<T>;
      on(event: 'paused', handler: (err: unknown) => void): Replication<T>;
      on(event: 'active', handler: () => void): Replication<T>;
      on(event: 'denied', handler: (err: unknown) => void): Replication<T>;
      on(event: 'complete', handler: (info: ReplicationInfo<T>) => void): Replication<T>;
      on(event: 'error', handler: (err: unknown) => void): Replication<T>;
      on(event: string, handler: (info: unknown) => void): Replication<T>;
      cancel(): void;
    }

    interface ReplicationInfo<T = unknown> {
      doc_write_failures: number;
      docs_read: number;
      docs_written: number;
      errors: unknown[];
      last_seq: number | string;
      ok: boolean;
      start_time: string;
      end_time?: string;
      docs?: T[];
    }

    interface ReplicationResult<_T = unknown> {
      doc_write_failures: number;
      docs_read: number;
      docs_written: number;
      errors: unknown[];
      last_seq: number | string;
      ok: boolean;
      start_time: string;
      end_time: string;
      status: string;
    }

    interface Sync<T = unknown> {
      on(event: 'change', handler: (info: SyncInfo<T>) => void): Sync<T>;
      on(event: 'paused', handler: (err: unknown) => void): Sync<T>;
      on(event: 'active', handler: () => void): Sync<T>;
      on(event: 'denied', handler: (err: unknown) => void): Sync<T>;
      on(event: 'complete', handler: (info: SyncInfo<T>) => void): Sync<T>;
      on(event: 'error', handler: (err: unknown) => void): Sync<T>;
      on(event: string, handler: (info: unknown) => void): Sync<T>;
      cancel(): void;
    }

    interface SyncInfo<T = unknown> {
      direction: 'push' | 'pull';
      change: {
        docs: T[];
        docs_read: number;
        docs_written: number;
        errors: unknown[];
      };
    }
  }
}
