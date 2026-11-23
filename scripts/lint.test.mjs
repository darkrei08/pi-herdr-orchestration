// lint-disable-file
import assert from "node:assert/strict";
import test from "node:test";
import { lintText } from "./lint.mjs";

test("clean source has no lint findings", () => {
  const source = `import { readFileSync } from "node:fs";\n\nexport function read(path) {\n  return readFileSync(path, "utf8");\n}\n`;
  assert.deepEqual(lintText("clean.mjs", source), []);
});

test("reports whitespace, marker, duplicate and statement violations", () => {
  const source = [
    "const value = 1;   ",
    "\tconst tabbed = 2;",
    "const repeated = 'this line is intentionally long enough';",
    "const repeated = 'this line is intentionally long enough';",
    "if (value) console.log(value);if (tabbed) console.log(tabbed);",
    "// TODO fix this",
    "const loose = value == tabbed;",
    "",
  ].join("\r\n");
  const issues = lintText("sample.mjs", source).map((issue) => issue.rule);
  assert.deepEqual(issues, [
    "trailing-whitespace",
    "tab-indentation",
    "crlf",
    "duplicate-line",
    "multiple-statements",
    "todo-marker",
    "loose-equality",
  ]);
});

test("lint-disable-file suppresses intentional fixture violations", () => {
  assert.deepEqual(lintText("fixture.mjs", "// lint-disable-file\nconst a = 1 == 1;\n"), []);
});

test("findings include file and line numbers", () => {
  const issues = lintText("sample.mjs", "const a = 1;\nconst b = 2;   \n");
  assert.equal(issues.length, 1);
  assert.equal(issues[0].file, "sample.mjs");
  assert.equal(issues[0].line, 2);
});
