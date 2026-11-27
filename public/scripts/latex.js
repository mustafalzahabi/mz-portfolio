// ============================================================================
// LATEX → MATHML
// Small in-house converter for the LaTeX subset blog posts use: numbers,
// letters, Greek, \frac, \sqrt, ^ and _, \left…\right, named functions
// (\sin, \ln, \lim…), big operators (\int, \sum), \text, accents, and the
// aligned/cases/matrix environments. The browser draws the result natively
// (MathML Core). Every text node is escaped; unknown commands render as
// literal text, so a typo never breaks a page. Pure string code — runs in
// Node for tests.
// ============================================================================

import { escapeHtml } from "./utils.js";

/**
 * @param {string} tex
 * @param {{ display?: boolean }} opts
 * @returns {string} a <math> element
 */
export function latexToMathml(tex, opts = {}) {
  const p = new Parser(String(tex || ""));
  let body;
  try {
    body = p.parseSeq(() => false);
  } catch {
    return `<code>${escapeHtml(tex)}</code>`;
  }
  const display = opts.display ? ' display="block"' : "";
  return `<math${display}>${row(body.length ? body : ["<mrow></mrow>"])}</math>`;
}

// ---------------------------------------------------------------------------
// Symbol tables
// ---------------------------------------------------------------------------

const GREEK = {
  alpha: "α", beta: "β", gamma: "γ", delta: "δ", epsilon: "ϵ", varepsilon: "ε", zeta: "ζ", eta: "η",
  theta: "θ", vartheta: "ϑ", iota: "ι", kappa: "κ", lambda: "λ", mu: "μ", nu: "ν", xi: "ξ", pi: "π",
  rho: "ρ", sigma: "σ", tau: "τ", upsilon: "υ", phi: "ϕ", varphi: "φ", chi: "χ", psi: "ψ", omega: "ω",
  Gamma: "Γ", Delta: "Δ", Theta: "Θ", Lambda: "Λ", Xi: "Ξ", Pi: "Π", Sigma: "Σ", Phi: "Φ", Psi: "Ψ", Omega: "Ω",
};

/** Constants drawn like numbers (the palette's number color). */
const CONSTANTS = { pi: "π", infty: "∞" };

const OPERATORS = {
  pm: "±", mp: "∓", times: "×", div: "÷", cdot: "·", ast: "∗", circ: "∘", bullet: "•",
  le: "≤", leq: "≤", ge: "≥", geq: "≥", ne: "≠", neq: "≠", approx: "≈", equiv: "≡", sim: "∼", propto: "∝",
  to: "→", rightarrow: "→", leftarrow: "←", Rightarrow: "⇒", implies: "⇒", Leftarrow: "⇐",
  Leftrightarrow: "⇔", iff: "⇔", mapsto: "↦", in: "∈", notin: "∉", subset: "⊂", subseteq: "⊆",
  cup: "∪", cap: "∩", setminus: "∖", emptyset: "∅", forall: "∀", exists: "∃", land: "∧", lor: "∨", neg: "¬",
  lnot: "¬", wedge: "∧", vee: "∨", oplus: "⊕", otimes: "⊗", odot: "⊙", leftrightarrow: "↔",
  longrightarrow: "⟶", Longrightarrow: "⟹", Longleftrightarrow: "⟺", uparrow: "↑", downarrow: "↓",
  therefore: "∴", because: "∵", mid: "∣", parallel: "∥", perp: "⊥", angle: "∠", triangle: "△",
  ldots: "…", cdots: "⋯", dots: "…", vdots: "⋮", partial: "∂", nabla: "∇", prime: "′", degree: "°",
  lbrace: "{", rbrace: "}", langle: "⟨", rangle: "⟩", lvert: "|", rvert: "|", vert: "|", lVert: "‖", rVert: "‖",
  "{": "{", "}": "}", "|": "‖", "%": "%", "$": "$", "&": "&", "#": "#", _: "_", colon: ":",
};

const BIG_OPS = { sum: "∑", prod: "∏", int: "∫", iint: "∬", oint: "∮", bigcup: "⋃", bigcap: "⋂" };

const FUNCTIONS = new Set([
  "sin", "cos", "tan", "cot", "sec", "csc", "arcsin", "arccos", "arctan", "sinh", "cosh", "tanh",
  "ln", "log", "exp", "det", "gcd", "deg", "dim", "arg",
]);
/** Functions whose subscript goes underneath in display style. */
const LIMIT_FUNCS = new Set(["lim", "max", "min", "sup", "inf"]);

const SPACES = { ",": "0.1667em", ":": "0.2222em", ";": "0.2778em", " ": "0.25em", quad: "1em", qquad: "2em", "!": "-0.1667em" };

const ACCENTS = { bar: "¯", overline: "¯", hat: "ˆ", widehat: "ˆ", vec: "→", tilde: "˜", widetilde: "˜", dot: "˙", ddot: "¨" };
/** Accents that stretch over their whole argument. */
const WIDE_ACCENTS = new Set(["overline", "widehat", "widetilde", "vec"]);

const FONTS = { mathbb: { R: "ℝ", N: "ℕ", Z: "ℤ", Q: "ℚ", C: "ℂ" } };

/** Commands with no visible output (sizing hints MathML handles itself). */
const IGNORED = new Set(["displaystyle", "textstyle", "limits", "nolimits", "big", "Big", "bigg", "Bigg", "bigl", "bigr", "Bigl", "Bigr", "biggl", "biggr", "left.", "right."]);

// ---------------------------------------------------------------------------
// MathML builders
// ---------------------------------------------------------------------------

const e = escapeHtml;
const row = (items) => (items.length === 1 ? items[0] : `<mrow>${items.join("")}</mrow>`);
const mi = (s, cls = "") => `<mi${cls ? ` class="${cls}"` : ""}>${e(s)}</mi>`;
const mn = (s) => `<mn>${e(s)}</mn>`;
const mo = (s, attrs = "") => `<mo${attrs}>${e(s)}</mo>`;
const mtext = (s) => `<mtext>${e(s)}</mtext>`;
const APPLY = "<mo>⁡</mo>";

// ---------------------------------------------------------------------------
// Parser
// ---------------------------------------------------------------------------

class Parser {
  constructor(src) {
    this.s = src;
    this.i = 0;
  }

  peek() {
    return this.s[this.i];
  }

  skipSpace() {
    while (this.i < this.s.length && /\s/.test(this.s[this.i])) this.i++;
  }

  /** Reads a control word/symbol after the backslash. */
  readCommand() {
    this.i++; // backslash
    const m = this.s.slice(this.i).match(/^([A-Za-z]+|.)/s);
    if (!m) return "";
    this.i += m[0].length;
    return m[0];
  }

  /** Raw text inside { … } (for \text, \begin names). */
  readRawGroup() {
    this.skipSpace();
    if (this.peek() !== "{") {
      const ch = this.s[this.i++] ?? "";
      return ch;
    }
    let depth = 0;
    const start = this.i + 1;
    for (; this.i < this.s.length; this.i++) {
      const c = this.s[this.i];
      if (c === "\\") { this.i++; continue; }
      if (c === "{") depth++;
      else if (c === "}" && --depth === 0) break;
    }
    const out = this.s.slice(start, this.i);
    this.i++;
    return out;
  }

  /** One argument: a {group} or a single token. Returns an mrow-ish string. */
  parseArg() {
    this.skipSpace();
    if (this.peek() === "{") {
      this.i++;
      const items = this.parseSeq((c) => c === "}");
      this.i++;
      return row(items.length ? items : ["<mrow></mrow>"]);
    }
    return this.parseAtom() ?? "<mrow></mrow>";
  }

  /** A sequence of atoms (with scripts) until stop(char) or the end. */
  parseSeq(stop) {
    const items = [];
    for (;;) {
      this.skipSpace();
      if (this.i >= this.s.length) break;
      const c = this.peek();
      if (stop(c, this)) break;
      if (c === "}") { this.i++; continue; } // stray brace
      this.apply = false;
      const atom = this.parseAtom();
      if (atom == null) continue;
      const fn = this.apply; // a named function: invisible "apply" goes after its scripts
      // A sign at the start, or right after another operator, is unary: no spacing
      const prev = items.at(-1);
      // "sec x tan x": a function name after a non-operator gets a thin space before it
      if (fn && prev && !/^<mo[ >]/.test(prev)) items.push('<mspace width="0.1667em"></mspace>');
      const unary = /^<mo>[−+±∓]<\/mo>$/.test(atom) && (!prev || (/^<mo[ >]/.test(prev) && !/^<mo[^>]*>[)\]|]<\/mo>$/.test(prev)));
      items.push(this.parseScripts(unary ? atom.replace("<mo>", '<mo form="prefix" lspace="0" rspace="0">') : atom));
      if (fn) {
        // "sin x" gets a thin space; "sin(x)" does not
        this.skipSpace();
        const tight = this.peek() === "(" || /^\\left\b/.test(this.s.slice(this.i));
        items.push(tight ? APPLY : '<mo rspace="0.1667em">⁡</mo>');
      }
    }
    return items;
  }

  parseScripts(base) {
    let sub = null;
    let sup = null;
    for (;;) {
      this.skipSpace();
      const c = this.peek();
      if (c === "^" && sup == null) { this.i++; sup = this.parseArg(); }
      else if (c === "_" && sub == null) { this.i++; sub = this.parseArg(); }
      else if (c === "'" ) { this.i++; sup = sup ? row([sup, mo("′")]) : mo("′"); }
      else break;
    }
    if (sub == null && sup == null) return base;
    const under = /^<mo class="op-limits"|^<mi class="fn limits"/.test(base);
    if (under) {
      if (sub != null && sup != null) return `<munderover>${base}${sub}${sup}</munderover>`;
      return sub != null ? `<munder>${base}${sub}</munder>` : `<mover>${base}${sup}</mover>`;
    }
    if (sub != null && sup != null) return `<msubsup>${base}${sub}${sup}</msubsup>`;
    return sub != null ? `<msub>${base}${sub}</msub>` : `<msup>${base}${sup}</msup>`;
  }

  parseAtom() {
    const c = this.peek();

    if (/[0-9.]/.test(c)) {
      const m = this.s.slice(this.i).match(/^(?:\d+(?:\.\d+)?|\.\d+)/);
      if (m) { this.i += m[0].length; return mn(m[0]); }
      this.i++;
      return mo(".");
    }
    if (/[A-Za-z]/.test(c)) { this.i++; return mi(c); }
    if (c === "{") {
      this.i++;
      const items = this.parseSeq((ch) => ch === "}");
      this.i++;
      return row(items.length ? items : ["<mrow></mrow>"]);
    }
    if (c === "\\") return this.parseCommand();
    if (c === "&" || c === "^" || c === "_") { this.i++; return null; }
    if (c === "~") { this.i++; return `<mspace width="0.25em"></mspace>`; }

    this.i++;
    if (c === "-") return mo("−");
    if (c === "*") return mo("∗");
    if (c === "'") return mo("′");
    if ("()[]|".includes(c)) return mo(c, ' stretchy="false"');
    if (c === "," || c === ";") return mo(c, ' rspace="0.2em"');
    if (c === "/") return mo(c, ' lspace="0" rspace="0"');
    if ("+=<>:!?".includes(c)) return mo(c);
    // Any other Unicode character typed directly (π, ∞, ≤, ², …)
    if (/[π∞]/u.test(c)) return mn(c);
    if (/\p{L}/u.test(c)) return mi(c);
    if (/\p{N}/u.test(c)) return mn(c);
    return mo(c);
  }

  parseCommand() {
    const name = this.readCommand();

    if (name === "\\") return null; // line break outside an environment
    if (name in SPACES) return `<mspace width="${SPACES[name]}"></mspace>`;
    if (IGNORED.has(name)) return null;

    if (name === "frac" || name === "dfrac" || name === "tfrac") {
      const num = this.parseArg();
      const den = this.parseArg();
      return `<mfrac>${num}${den}</mfrac>`;
    }
    if (name === "sqrt") {
      this.skipSpace();
      if (this.peek() === "[") {
        this.i++;
        const idx = this.parseSeq((ch) => ch === "]");
        this.i++;
        return `<mroot>${this.parseArg()}${row(idx)}</mroot>`;
      }
      return `<msqrt>${this.parseArg()}</msqrt>`;
    }
    if (name === "text" || name === "textrm" || name === "mbox" || name === "textit" || name === "textbf") {
      // MathML trims spaces inside <mtext>; keep \text{ cm }'s edges as real space
      const raw = this.readRawGroup();
      const gap = '<mspace width="0.25em"></mspace>';
      return (/^\s/.test(raw) ? gap : "") + mtext(raw.trim()) + (/\s$/.test(raw) && raw.trim() ? gap : "");
    }
    if (name === "operatorname" || name === "mathrm") {
      const word = this.readRawGroup().replace(/\\,|\s+/g, " ").trim();
      if (name === "mathrm") return mi(word, "rm");
      this.apply = true;
      return mi(word, "fn");
    }
    if (name in FONTS) {
      const ch = this.readRawGroup();
      return mi(FONTS[name][ch] ?? ch, "set");
    }
    if (name === "left" || name === "right") {
      const open = this.readDelimiter();
      if (name === "right") return null; // stray \right: consumed by its \left normally
      // \left … \right: collect until the matching \right (nested pairs recurse)
      const items = this.parseSeq((ch, p) => ch === "\\" && /^\\right(?![A-Za-z])/.test(p.s.slice(p.i)));
      let close = "";
      if (/^\\right/.test(this.s.slice(this.i))) {
        this.i += 6;
        close = this.readDelimiter();
      }
      const fence = (d) => (d ? mo(d, ' stretchy="true"') : "");
      return `<mrow>${fence(open)}${items.join("")}${fence(close)}</mrow>`;
    }
    if (name === "begin") return this.parseEnvironment(this.readRawGroup());
    if (name === "end") { this.readRawGroup(); return null; }

    if (name in ACCENTS) {
      const stretch = WIDE_ACCENTS.has(name) ? "true" : "false";
      return `<mover accent="true">${this.parseArg()}${mo(ACCENTS[name], ` stretchy="${stretch}"`)}</mover>`;
    }
    if (name in CONSTANTS) return mn(CONSTANTS[name]);
    if (name in GREEK) return mi(GREEK[name]);
    if (name in BIG_OPS) return mo(BIG_OPS[name], ` class="${name === "sum" || name === "prod" || name.startsWith("big") ? "op-limits" : "op-int"}" largeop="true"`);
    if (LIMIT_FUNCS.has(name)) return mi(name, "fn limits");
    if (FUNCTIONS.has(name) || name === "cis") { this.apply = true; return mi(name, "fn"); }
    if (name in OPERATORS) return mo(OPERATORS[name]);

    return mtext(`\\${name}`); // unknown: show it literally
  }

  /** The delimiter after \left or \right ("" for the invisible "."). */
  readDelimiter() {
    this.skipSpace();
    const d = this.peek() === "\\" ? this.readCommand() : (this.s[this.i++] ?? "");
    if (d === ".") return "";
    return OPERATORS[d] ?? d;
  }

  /** aligned / cases / matrix family → <mtable>. */
  parseEnvironment(env) {
    const rows = [[]];
    let cell = [];
    const endRe = new RegExp(`^\\\\end\\s*\\{${env.replace("*", "\\*")}\\}`);
    for (;;) {
      const items = this.parseSeq((ch, p) => ch === "&" || (ch === "\\" && (/^\\\\/.test(p.s.slice(p.i)) || endRe.test(p.s.slice(p.i)))));
      cell.push(...items);
      if (this.i >= this.s.length) break;
      if (this.peek() === "&") { this.i++; rows.at(-1).push(cell); cell = []; continue; }
      if (/^\\\\/.test(this.s.slice(this.i))) {
        this.i += 2;
        this.skipSpace();
        const gap = this.s.slice(this.i).match(/^\[\s*-?[\d.]+\s*[a-z]{2}\s*\]/); // \\[4pt]
        if (gap) this.i += gap[0].length;
        rows.at(-1).push(cell); cell = []; rows.push([]); continue;
      }
      const m = this.s.slice(this.i).match(endRe);
      this.i += m[0].length;
      break;
    }
    rows.at(-1).push(cell);
    if (rows.length > 1 && rows.at(-1).every((c) => !c.length)) rows.pop();

    const kind = /^(aligned|align\*?|split|gathered|eqnarray\*?)$/.test(env) ? "aligned"
      : env === "cases" ? "cases"
      : "matrix";
    const table = `<mtable class="${kind}">${rows
      .map((r) => `<mtr>${r.map((c) => `<mtd>${row(c.length ? c : ["<mrow></mrow>"])}</mtd>`).join("")}</mtr>`)
      .join("")}</mtable>`;
    const fences = { pmatrix: ["(", ")"], bmatrix: ["[", "]"], vmatrix: ["|", "|"], Vmatrix: ["‖", "‖"], cases: ["{", ""] }[env];
    if (!fences) return table;
    return `<mrow>${mo(fences[0], ' stretchy="true"')}${table}${fences[1] ? mo(fences[1], ' stretchy="true"') : ""}</mrow>`;
  }
}

/** Unknown commands in a TeX string (for checking posts before publishing). */
export function unknownCommands(tex) {
  const html = latexToMathml(tex);
  return [...html.matchAll(/<mtext>\\([A-Za-z]+)<\/mtext>/g)].map((m) => m[1]);
}
