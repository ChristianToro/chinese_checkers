import { neon } from "@neondatabase/serverless";

/** The one storage seam: Neon in the app, PGlite in tests (via `setDb`). */
export interface Db {
  query<T>(text: string, params?: unknown[]): Promise<T[]>;
}

let db: Db | undefined;

export function getDb(): Db {
  if (!db) {
    const url = process.env.DATABASE_URL;
    if (!url) {
      throw new Error("DATABASE_URL is not set; copy .env.example to .env and fill it in");
    }
    const sql = neon(url);
    db = {
      query: async <T>(text: string, params?: unknown[]) =>
        (await sql.query(text, params)) as T[],
    };
  }
  return db;
}

export function setDb(next: Db): void {
  db = next;
}
