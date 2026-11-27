import { test } from "node:test";
import assert from "node:assert/strict";
import { extractReadmeAbout } from "../public/scripts/api.js";

const README = `# my-app

[![Build](https://img.shields.io/badge/build-passing-green.svg)](https://ci.example.com)
![Screenshot](docs/screen.png)

A small app that turns notes into a **searchable** wiki.

It runs entirely in the browser.

<p align="center"><img src="logo.png"></p>

## Features

- Full-text search
- Offline support ![icon](i.png)

## Installation

\`\`\`bash
npm install
\`\`\`

Run \`npm start\`.

## License

MIT
`;

test("readme: only the descriptive part, without images, badges, code or setup", () => {
  const about = extractReadmeAbout(README);
  assert.match(about, /turns notes into a \*\*searchable\*\* wiki/);
  assert.match(about, /runs entirely in the browser/);
  assert.match(about, /\*\*Features\*\*/);
  assert.match(about, /- Full-text search/);
  assert.doesNotMatch(about, /my-app/); // the title is already the page title
  assert.doesNotMatch(about, /shields|png|<img|npm|MIT|Installation|License/);
});

test("readme: empty or setup-only READMEs give nothing", () => {
  assert.equal(extractReadmeAbout(""), "");
  assert.equal(extractReadmeAbout("# x\n\n## Setup\n\nnpm i\n"), "");
});
