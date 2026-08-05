import { test } from "node:test";
import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";

// These tests execute real SQLite to pin the runtime facts behind two
// type-only refactors in payment/evidence code:
//   1. Adding `.as("<column>")` aliases to the sql<> columns of several
//      INSERT..SELECT statements (job-operations, evidence-scan-result-recorder)
//      so Drizzle can name them. SQLite maps INSERT..SELECT columns positionally,
//      so the aliases are cosmetic.
//   2. The checkout eq() fixes rely on eq(column, value) emitting `column = ?`,
//      so a null value becomes `column = NULL`, which matches no rows.

test("INSERT..SELECT column aliases do not change the inserted rows", () => {
  const db = new DatabaseSync(":memory:");
  db.exec(`
    CREATE TABLE src (id TEXT, name TEXT, note TEXT);
    INSERT INTO src VALUES ('x', 'Alice', 'hello'), ('y', 'Bob', 'world');
    CREATE TABLE without_alias (id TEXT, name TEXT, note TEXT);
    CREATE TABLE with_alias (id TEXT, name TEXT, note TEXT);
  `);
  db.prepare(
    `INSERT INTO without_alias (id, name, note) SELECT ?, name, ? FROM src`,
  ).run("A", "n");
  db.prepare(
    `INSERT INTO with_alias (id, name, note) SELECT ? AS "id", name, ? AS "note" FROM src`,
  ).run("A", "n");
  const withoutRows = db.prepare("SELECT * FROM without_alias ORDER BY name").all();
  const withRows = db.prepare("SELECT * FROM with_alias ORDER BY name").all();
  assert.deepEqual(withRows, withoutRows);
  db.close();
});

test("equality against NULL matches no rows (checkout eq semantics)", () => {
  const db = new DatabaseSync(":memory:");
  db.exec(`
    CREATE TABLE t (id TEXT, req_id TEXT);
    INSERT INTO t VALUES ('p1', NULL), ('p2', 'r2');
  `);
  // A null value in `column = ?` matches nothing — not even the NULL row —
  // which is why the checkout status lookup skips the query entirely when the
  // request id is null rather than relying on the empty result.
  assert.equal(db.prepare("SELECT * FROM t WHERE req_id = ?").all(null).length, 0);
  assert.equal(db.prepare("SELECT * FROM t WHERE req_id = ?").all("r2").length, 1);
  db.close();
});
