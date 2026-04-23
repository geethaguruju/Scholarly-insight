import test from "node:test";
import assert from "node:assert/strict";
import { buildArxivQuery, transformArxivFeed } from "../src/arxiv.js";

test("buildArxivQuery joins supplied filters", () => {
  const query = buildArxivQuery({
    query: "transformers",
    author: "Vaswani",
    category: "cs.CL"
  });

  assert.equal(query, "all:transformers+AND+au:Vaswani+AND+cat:cs.CL");
});

test("transformArxivFeed normalizes XML entries", () => {
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
  <feed xmlns="http://www.w3.org/2005/Atom">
    <entry>
      <id>http://arxiv.org/abs/1234.5678v1</id>
      <updated>2026-01-10T10:00:00Z</updated>
      <published>2026-01-08T10:00:00Z</published>
      <title>  Sample Paper Title </title>
      <summary>  Some abstract text. </summary>
      <author><name>Alice</name></author>
      <author><name>Bob</name></author>
      <link href="http://arxiv.org/abs/1234.5678v1" rel="alternate" type="text/html" />
      <link href="http://arxiv.org/pdf/1234.5678v1" rel="related" title="pdf" type="application/pdf" />
      <arxiv:primary_category term="cs.AI" xmlns:arxiv="http://arxiv.org/schemas/atom" />
      <category term="cs.AI" scheme="http://arxiv.org/schemas/atom" />
    </entry>
  </feed>`;

  const [article] = transformArxivFeed(xml);

  assert.equal(article.id, "1234.5678v1");
  assert.equal(article.title, "Sample Paper Title");
  assert.equal(article.abstract, "Some abstract text.");
  assert.deepEqual(article.authors, ["Alice", "Bob"]);
  assert.equal(article.primaryCategory, "cs.AI");
  assert.equal(article.pdfUrl, "http://arxiv.org/pdf/1234.5678v1");
});
