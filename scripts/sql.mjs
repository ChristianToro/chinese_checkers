// Runs one SQL statement against the database in DATABASE_URL and prints the
// result: `npm run sql -- '<statement>' [param ...]`. Params fill $1, $2, ...
// in order. `--json` prints the rows as JSON, for JSONB columns like `board`.
import { neon } from "@neondatabase/serverless";

const args = process.argv.slice(2);
const json = args.includes("--json");
const [text, ...params] = args.filter((arg) => arg !== "--json");

if (!text) {
  console.error("Usage: npm run sql -- [--json] '<statement>' [param ...]");
  process.exit(1);
}

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("DATABASE_URL is not set; copy .env.example to .env and fill it in.");
  process.exit(1);
}

const sql = neon(url);

let result;
try {
  // The HTTP driver runs one statement per call.
  result = await sql.query(text, params, { fullResults: true });
} catch (error) {
  console.error(`Error: ${error.message}`);
  process.exit(1);
}

if (json) {
  console.log(JSON.stringify(result.rows, null, 2));
} else if (result.rows.length > 0) {
  console.table(result.rows);
}
// On stderr, so `--json` output can be piped on its own.
console.error(`${result.command} ${result.rowCount ?? result.rows.length}`);
