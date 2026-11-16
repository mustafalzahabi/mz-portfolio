// Static project checks (tools/check.mjs): node --test
import { test } from "node:test";
import assert from "node:assert/strict";
import { checkImports, checkHtml, checkColors, checkCssImports } from "../tools/check.mjs";

test("check: every relative import resolves", () => assert.deepEqual(checkImports(), []));
test("check: HTML is CSP-safe (no inline handlers or scripts)", () => assert.deepEqual(checkHtml(), []));
test("check: no hard-coded colors outside the token block", () => assert.deepEqual(checkColors(), []));
test("check: every stylesheet @import exists", () => assert.deepEqual(checkCssImports(), []));
