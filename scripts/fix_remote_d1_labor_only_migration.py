from pathlib import Path

MIGRATION = Path("drizzle/0048_customer_supplied_parts_preferences.sql")
TEST = Path("tests/customer-supplied-parts-preferences.test.mjs")
BREAKPOINT = "--> statement-breakpoint"
EXPECTED_STATEMENTS = 43

migration = MIGRATION.read_text()

if BREAKPOINT not in migration:
    # D1 remote migrations need explicit top-level boundaries. SQLite trigger
    # bodies contain semicolons, so they must remain intact as one statement.
    migration = migration.replace(";\n\nALTER TABLE", f";\n{BREAKPOINT}\nALTER TABLE")
    migration = migration.replace(";\n\nDROP TRIGGER", f";\n{BREAKPOINT}\nDROP TRIGGER")
    migration = migration.replace(";\nCREATE TRIGGER", f";\n{BREAKPOINT}\nCREATE TRIGGER")
    migration = migration.rstrip() + f"\n{BREAKPOINT}\n"
    MIGRATION.write_text(migration)

statements = [
    statement.strip()
    for statement in migration.split(BREAKPOINT)
    if statement.strip()
]
if len(statements) != EXPECTED_STATEMENTS:
    raise SystemExit(
        f"Expected {EXPECTED_STATEMENTS} top-level D1 statements, found {len(statements)}"
    )

for index, statement in enumerate(statements, start=1):
    if statement.startswith("CREATE TRIGGER"):
        if not statement.endswith("END;"):
            raise SystemExit(f"Trigger statement {index} is incomplete")
        if statement.count("CREATE TRIGGER") != 1:
            raise SystemExit(f"Trigger statement {index} contains multiple triggers")
    elif statement.startswith("DROP TRIGGER"):
        if statement.count("DROP TRIGGER") != 1 or not statement.endswith(";"):
            raise SystemExit(f"Drop-trigger statement {index} is malformed")
    elif statement.startswith("ALTER TABLE"):
        if statement.count("ALTER TABLE") != 1 or not statement.endswith(";"):
            raise SystemExit(f"Alter-table statement {index} is malformed")
    else:
        raise SystemExit(f"Unexpected top-level migration statement {index}")

source = TEST.read_text()
needle = """  assert.match(migration, /Customer-supplied repair parts may be recorded only at a zero Tuveloz amount/);\n"""
addition = """  assert.match(migration, /Customer-supplied repair parts may be recorded only at a zero Tuveloz amount/);\n\n  const statements = migration\n    .split(\"--> statement-breakpoint\")\n    .map((statement) => statement.trim())\n    .filter(Boolean);\n  assert.equal(statements.length, 43);\n  for (const statement of statements) {\n    assert.match(statement, /^(ALTER TABLE|DROP TRIGGER|CREATE TRIGGER)/);\n    if (statement.startsWith(\"CREATE TRIGGER\")) {\n      assert.match(statement, /END;$/);\n      assert.equal(statement.match(/CREATE TRIGGER/g)?.length, 1);\n    }\n  }\n"""
if addition not in source:
    if source.count(needle) != 1:
        raise SystemExit("Could not find the labor-only migration test insertion marker")
    TEST.write_text(source.replace(needle, addition, 1))

print("Added explicit remote-D1 statement boundaries to the labor-only migration.")
