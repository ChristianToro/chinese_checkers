// Applies db/schema.sql to the database in DATABASE_URL. The schema is
// idempotent (CREATE ... IF NOT EXISTS), so this is safe to run repeatedly.
import fs from "node:fs";
import { neon } from "@neondatabase/serverless";

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("DATABASE_URL is not set; copy .env.example to .env and fill it in.");
  process.exit(1);
}

const sql = neon(url);
const schema = fs.readFileSync(new URL("../db/schema.sql", import.meta.url), "utf8");

// The HTTP driver runs one statement per call.
const statements = schema
  .split(";")
  .map((s) => s.trim())
  .filter(Boolean);

for (const statement of statements) {
  await sql.query(statement);
}
console.log(`Applied ${statements.length} schema statements.`);
