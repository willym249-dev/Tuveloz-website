"""Prepare a D1 dump for isolated recovery without changing its schema or data.

All input/output data must stay outside Git checkouts. This tool never connects
to Cloudflare and never prints SQL or row contents.
"""
import collections
import hashlib
import json
import pathlib
import re
import sqlite3
import sys


def split_statements(sql):
    statements = []
    start = 0
    for index, character in enumerate(sql):
        if character == ";" and sqlite3.complete_statement(sql[start:index + 1]):
            statements.append(sql[start:index + 1].strip())
            start = index + 1
    if sql[start:].strip():
        raise ValueError("The backup ends with an incomplete SQL statement.")
    return statements


def prepare(sql):
    statements = split_statements(sql)
    pragmas, tables, remaining = [], [], []
    for statement in statements:
        if re.match(r"PRAGMA\s+defer_foreign_keys\s*=\s*(?:TRUE|ON|1)\s*;", statement, re.I):
            pragmas.append(statement)
        elif re.match(r"CREATE\s+TABLE\s", statement, re.I):
            tables.append(statement)
        elif re.match(r"(?:INSERT\s+INTO|CREATE\s+(?:UNIQUE\s+)?INDEX|CREATE\s+TRIGGER)\s", statement, re.I):
            remaining.append(statement)
        elif re.fullmatch(r'DELETE FROM (?:sqlite_sequence|"sqlite_sequence"|\[sqlite_sequence\]);', statement, re.I):
            remaining.append(statement)
        else:
            raise ValueError("Unsupported statement in backup; review privately before recovery.")
    if len(pragmas) != 1 or not tables:
        raise ValueError("Expected a D1 export with deferred foreign keys and table definitions.")
    return "\n".join(pragmas + tables + remaining) + "\n"


def verify_equivalent(original_sql, prepared_sql):
    original = sqlite3.connect(":memory:")
    restored = sqlite3.connect(":memory:")
    try:
        original.executescript(original_sql)
        restored.execute("PRAGMA foreign_keys=ON")
        restored.executescript("BEGIN;\n" + prepared_sql + "\nCOMMIT;")
        schema_query = "SELECT type,name,tbl_name,sql FROM sqlite_schema WHERE name NOT LIKE 'sqlite_%' ORDER BY type,name"
        original_schema = original.execute(schema_query).fetchall()
        if restored.execute(schema_query).fetchall() != original_schema:
            raise ValueError("Prepared restore changed the database schema.")
        tables = [row[1] for row in original_schema if row[0] == "table"]
        total_rows = 0
        for index, table in enumerate(tables):
            quoted = '"' + table.replace('"', '""') + '"'
            expected = collections.Counter(original.execute("SELECT * FROM " + quoted).fetchall())
            actual = collections.Counter(restored.execute("SELECT * FROM " + quoted).fetchall())
            if actual != expected:
                raise ValueError(f"Prepared restore changed records in table {index + 1}.")
            total_rows += expected.total()
        if restored.execute("PRAGMA integrity_check").fetchall() != [("ok",)]:
            raise ValueError("Prepared restore failed the integrity check.")
        if restored.execute("PRAGMA foreign_key_check").fetchall():
            raise ValueError("Prepared restore has foreign-key violations.")
        if original.execute("SELECT 1 FROM sqlite_schema WHERE name='sqlite_sequence'").fetchone():
            sequence_query = "SELECT name,seq FROM sqlite_sequence ORDER BY name"
            if original.execute(sequence_query).fetchall() != restored.execute(sequence_query).fetchall():
                raise ValueError("Prepared restore changed an automatic ID sequence.")
        return {"tables": len(tables), "rows": total_rows, "schemaObjects": len(original_schema),
                "schemaAndRecordsIdentical": True, "integrity": "ok", "foreignKeyViolations": 0}
    finally:
        original.close()
        restored.close()


def outside_checkout(path):
    resolved = pathlib.Path(path).resolve()
    if any((parent / ".git").exists() for parent in (resolved.parent, *resolved.parents)):
        raise ValueError("Backup data must stay outside every Git checkout.")
    return resolved


def main():
    if len(sys.argv) != 3:
        raise ValueError("Usage: prepare-d1-restore.py PRIVATE_INPUT.sql PRIVATE_OUTPUT.sql")
    source, destination = map(outside_checkout, sys.argv[1:])
    original = source.read_text(encoding="utf-8")
    prepared = prepare(original)
    report = verify_equivalent(original, prepared)
    with destination.open("x", encoding="utf-8", newline="\n") as output:
        output.write(prepared)
    report["preparedSha256"] = hashlib.sha256(prepared.encode()).hexdigest()
    print(json.dumps(report))


if __name__ == "__main__":
    try:
        main()
    except (ValueError, sqlite3.Error, OSError) as error:
        # sqlite errors can quote private input; keep the public diagnostic generic.
        print(json.dumps({"ok": False, "errorType": type(error).__name__,
                          "message": "Recovery preparation failed; no unverified SQL was written."}))
        sys.exit(1)
