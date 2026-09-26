import importlib.util
import pathlib
import sqlite3
import unittest

spec = importlib.util.spec_from_file_location("restore", pathlib.Path(__file__).parents[1] / "scripts" / "prepare-d1-restore.py")
restore = importlib.util.module_from_spec(spec)
spec.loader.exec_module(restore)


class RecoveryPreparationTests(unittest.TestCase):
    def test_parent_table_is_created_before_child_data(self):
        sql = """PRAGMA defer_foreign_keys=TRUE;
CREATE TABLE child (id INTEGER PRIMARY KEY, parent INTEGER REFERENCES parent(id), label TEXT);
INSERT INTO child VALUES(1, 2, 'same; value with ''quotes''');
CREATE TABLE parent (id INTEGER PRIMARY KEY AUTOINCREMENT);
INSERT INTO parent VALUES(2);
DELETE FROM sqlite_sequence;
INSERT INTO sqlite_sequence VALUES('parent',9);
CREATE TRIGGER guard BEFORE DELETE ON parent BEGIN SELECT RAISE(ABORT, 'keep; parent'); END;
"""
        with sqlite3.connect(":memory:") as connection:
            connection.execute("PRAGMA foreign_keys=ON")
            with self.assertRaisesRegex(sqlite3.OperationalError, "no such table"):
                connection.executescript("BEGIN;" + sql + "COMMIT;")
        prepared = restore.prepare(sql)
        self.assertLess(prepared.index("CREATE TABLE parent"), prepared.index("INSERT INTO child"))
        self.assertEqual(len(restore.split_statements(prepared)), 8)
        report = restore.verify_equivalent(sql, prepared)
        self.assertEqual(report["tables"], 2)
        self.assertEqual(report["rows"], 2)
        self.assertTrue(report["schemaAndRecordsIdentical"])

    def test_rejects_unexpected_or_incomplete_commands(self):
        with self.assertRaises(ValueError):
            restore.prepare("PRAGMA defer_foreign_keys=TRUE; DROP TABLE anything;")
        with self.assertRaises(ValueError):
            restore.prepare("PRAGMA defer_foreign_keys=TRUE; CREATE TABLE incomplete (")


if __name__ == "__main__":
    unittest.main()
