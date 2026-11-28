// ============================================================================
// SYNTAX HIGHLIGHTING for code blocks in posts — a small tokenizer, no library.
// One scanner covers the C family (Java, C, C#, JS, TS, PHP, GLSL, CSS), plus
// Python, SQL, shell, assembly and Prolog through per-language comment rules
// and keyword lists. Tokens use the same classes as the code tabs:
//   k keyword · f function or type · s string · n number · c comment · p punctuation
// HTML/XML goes through tokenizeHtml from the code tabs. Unknown languages
// (and "text") are left plain.
// ============================================================================

import { tokenizeHtml } from "./animations/code-reveal.js";

const words = (s) => new Set(s.split(/\s+/).filter(Boolean));

const C_LIKE = "if else for while do switch case default break continue return goto sizeof typedef struct union enum const static extern void";
const LANGS = {
  java: {
    line: "//", block: true,
    keywords: words(`${C_LIKE} abstract assert boolean byte catch char class double extends final finally float implements import instanceof int interface long native new package private protected public short super synchronized this throw throws transient try volatile var record yield null true false`),
  },
  c: {
    line: "//", block: true, hash: "directive",
    keywords: words(`${C_LIKE} auto char double float int long register short signed unsigned volatile inline restrict NULL bool true false`),
  },
  js: {
    line: "//", block: true, backtick: true,
    keywords: words("async await break case catch class const continue debugger default delete do else export extends false finally for from function if import in instanceof let new null of return static super switch this throw true try typeof undefined var void while with yield"),
  },
  php: {
    line: "//", block: true, hash: "comment",
    keywords: words("abstract and array as break case catch class clone const continue declare default do echo else elseif empty endif endforeach endwhile extends final finally fn for foreach function global if implements include include_once instanceof interface isset list match namespace new null or print private protected public require require_once return static switch throw trait try unset use var while xor yield true false"),
  },
  glsl: {
    line: "//", block: true, hash: "directive",
    keywords: words(`${C_LIKE} attribute uniform varying in out inout precision highp mediump lowp float int bool vec2 vec3 vec4 mat2 mat3 mat4 sampler2D samplerCube discard true false`),
  },
  css: {
    block: true,
    keywords: words("important media supports import keyframes from to and not only screen"),
  },
  python: {
    hash: "comment", triple: true,
    keywords: words("and as assert async await break class continue def del elif else except False finally for from global if import in is lambda None nonlocal not or pass raise return True try while with yield self print len range"),
  },
  sql: {
    line: "--", block: true, caseless: true,
    keywords: words("select from where and or not in is null as join inner left right full outer cross on group by order having limit offset insert into values update set delete create table view index drop alter add column primary key foreign references unique check default distinct union all exists between like case when then else end asc desc count sum avg min max cast integer int real text varchar char decimal numeric date boolean begin commit rollback transaction grant revoke with"),
  },
  bash: {
    hash: "comment",
    keywords: words("if then else elif fi for while until do done case esac in function return export local echo cd ls cat grep sudo exit set source"),
  },
  asm: {
    semicolon: true, caseless: true,
    keywords: words("mov add sub mul div and or xor not jmp je jne jz jnz jg jl call ret push pop cmp inc dec lea nop int load store"),
  },
  prolog: {
    percent: true, block: true,
    keywords: words("is not true fail"),
  },
};

const ALIASES = {
  javascript: "js", ts: "js", typescript: "js", jsx: "js", tsx: "js", mjs: "js", json: "js",
  cpp: "c", "c++": "c", h: "c", cs: "java", csharp: "java", kotlin: "java", scala: "java", go: "java", rust: "java",
  py: "python", sh: "bash", shell: "bash", zsh: "bash", console: "bash", scss: "css",
  mysql: "sql", sqlite: "sql", postgresql: "sql", psql: "sql", nasm: "asm", assembly: "asm", hack: "asm", pl: "prolog",
};

/** The language rules for a fence name, or null for plain text. */
export function languageOf(name = "") {
  const key = String(name).toLowerCase();
  return LANGS[key] ? key : ALIASES[key] || null;
}

const NUMBER = /^(?:0x[\da-f]+|\d[\d_]*(?:\.\d+)?(?:e[+-]?\d+)?[fldu]?)/i;
const IDENT = /^[A-Za-z_$@][\w$]*/;

/** [[class, text], …] for `src` in language `name` (class "" = plain text). */
export function tokenizeCode(src, name = "") {
  const key = String(name).toLowerCase();
  if (/^(html|xml|svg|vue)$/.test(key)) return tokenizeHtml(src);
  const lang = LANGS[languageOf(key)];
  if (!lang) return [["", src]];

  const out = [];
  const push = (cls, text) => {
    const last = out[out.length - 1];
    if (last && last[0] === cls) last[1] += text;
    else out.push([cls, text]);
  };
  let i = 0;
  const lineEnd = () => {
    const j = src.indexOf("\n", i);
    return j === -1 ? src.length : j;
  };
  const atLineStart = () => {
    let j = i - 1;
    while (j >= 0 && (src[j] === " " || src[j] === "\t")) j--;
    return j < 0 || src[j] === "\n";
  };

  while (i < src.length) {
    const rest = src.slice(i, i + 3);
    const ch = src[i];
    let end = -1;
    let cls = "";

    // Comments
    if (lang.line && src.startsWith(lang.line, i)) [end, cls] = [lineEnd(), "c"];
    else if (lang.block && rest.startsWith("/*")) {
      const j = src.indexOf("*/", i + 2);
      [end, cls] = [j === -1 ? src.length : j + 2, "c"];
    } else if (ch === "#" && lang.hash === "comment") [end, cls] = [lineEnd(), "c"];
    else if (ch === "#" && lang.hash === "directive" && atLineStart()) [end, cls] = [lineEnd(), "k"];
    else if (ch === ";" && lang.semicolon) [end, cls] = [lineEnd(), "c"];
    else if (ch === "%" && lang.percent) [end, cls] = [lineEnd(), "c"];
    // Strings
    else if (lang.triple && (rest === '"""' || rest === "'''")) {
      const j = src.indexOf(rest, i + 3);
      [end, cls] = [j === -1 ? src.length : j + 3, "s"];
    } else if (ch === '"' || ch === "'" || (ch === "`" && lang.backtick)) {
      let j = i + 1;
      while (j < src.length && src[j] !== ch && (src[j] !== "\n" || ch === "`")) j += src[j] === "\\" ? 2 : 1;
      [end, cls] = [Math.min(j + 1, src.length), "s"];
    }

    if (end !== -1) {
      push(cls, src.slice(i, end));
      i = end;
      continue;
    }

    const tail = src.slice(i);
    const prev = src[i - 1] || "";
    const num = /[\w$]/.test(prev) ? null : tail.match(NUMBER);
    if (num) {
      push("n", num[0]);
      i += num[0].length;
      continue;
    }
    const id = tail.match(IDENT);
    if (id) {
      const word = id[0];
      const isKeyword = lang.keywords.has(lang.caseless ? word.toLowerCase() : word);
      const after = src.slice(i + word.length).match(/^\s*(.)/)?.[1];
      // Calls and type names read as "f"; CSS property names too
      const isFn = after === "(" || (/^[A-Z]/.test(word) && !lang.caseless && key !== "css");
      push(isKeyword ? "k" : isFn ? "f" : "", word);
      i += word.length;
      continue;
    }
    push(/[{}()[\];,.:<>=+\-*/%!&|^~?]/.test(ch) ? "p" : "", ch);
    i++;
  }
  return out;
}

/** Colors every <pre><code class="language-…"> inside `root`, in place. */
export function highlightBlocks(root) {
  for (const code of root.querySelectorAll('pre > code[class*="language-"]')) {
    const name = code.className.match(/language-([\w+#-]+)/)?.[1] || "";
    const tokens = tokenizeCode(code.textContent, name);
    if (tokens.length === 1 && !tokens[0][0]) continue;
    code.replaceChildren(...tokens.map(([cls, text]) => {
      if (!cls) return document.createTextNode(text);
      const span = document.createElement("span");
      span.className = `tk-${cls}`;
      span.textContent = text;
      return span;
    }));
    code.parentElement.dataset.lang = name.toLowerCase();
  }
}
