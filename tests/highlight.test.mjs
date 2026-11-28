import { test } from "node:test";
import assert from "node:assert/strict";
import { tokenizeCode, languageOf } from "../public/scripts/highlight.js";

const kinds = (src, lang) => tokenizeCode(src, lang).filter(([c]) => c).map(([c, t]) => `${c}:${t.trim()}`);

test("highlight: Java keywords, strings, numbers, comments, calls", () => {
  const k = kinds('public int x = 42; // hi\nSystem.out.println("a\\"b");', "java");
  assert.ok(k.includes("k:public") && k.includes("k:int") && k.includes("n:42") && k.includes("c:// hi"));
  assert.ok(k.includes('s:"a\\"b"') && k.includes("f:println") && k.includes("f:System"));
});

test("highlight: SQL is case-insensitive, -- comments", () => {
  const k = kinds("SELECT name FROM t -- note\nwhere id = 3", "sql");
  assert.ok(k.includes("k:SELECT") && k.includes("k:FROM") && k.includes("k:where") && k.includes("c:-- note") && k.includes("n:3"));
});

test("highlight: Python # comments and triple strings; text stays plain", () => {
  const k = kinds('def f():\n    """doc"""\n    return 1  # one', "python");
  assert.ok(k.includes("k:def") && k.includes('s:"""doc"""') && k.includes("c:# one") && k.includes("f:f"));
  assert.deepEqual(tokenizeCode("a = 1", "text"), [["", "a = 1"]]);
  assert.equal(languageOf("JavaScript"), "js");
});

test("highlight: tokens rebuild the source exactly", () => {
  for (const [src, lang] of [["int a=0x1F; /* x */ char c='\n';", "c"], ["#include <stdio.h>\nint main(){}", "c"], ["mov r1, 5 ; set", "asm"], ["x :- y, % c\n z.", "prolog"]]) {
    assert.equal(tokenizeCode(src, lang).map(([, t]) => t).join(""), src);
  }
});
