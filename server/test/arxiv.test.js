import test from "node:test";
import assert from "node:assert/strict";
import { buildArxivQuery, rankArticles, transformArxivFeed } from "../src/arxiv.js";

test("buildArxivQuery joins supplied filters", () => {
  const query = buildArxivQuery({
    query: "graph neural networks",
    author: "Yann LeCun",
    category: "cs.CL"
  });

  assert.equal(query, 'all:"graph neural networks"+AND+au:"Yann LeCun"+AND+cat:cs.CL');
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

test("rankArticles boosts close author and title matches", () => {
  const ranked = rankArticles(
    [
      {
        id: "1",
        title: "Machine Learning for Vision",
        abstract: "A paper about neural methods.",
        authors: ["Yann LeCun"],
        primaryCategory: "cs.LG",
        categories: ["cs.LG"],
        published: "2026-04-20T00:00:00.000Z"
      },
      {
        id: "2",
        title: "Random Systems Paper",
        abstract: "Unrelated topic.",
        authors: ["Another Author"],
        primaryCategory: "cs.AI",
        categories: ["cs.AI"],
        published: "2026-04-21T00:00:00.000Z"
      }
    ],
    {
      query: "machine learning",
      author: "yann le cunn",
      category: "cs.LG"
    }
  );

  assert.equal(ranked[0].id, "1");
  assert.equal(ranked.length, 1);
});

test("rankArticles filters out weak author mismatches when author search is used", () => {
  const ranked = rankArticles(
    [
      {
        id: "1",
        title: "Learning Systems",
        abstract: "A paper by the requested author.",
        authors: ["Raghu Hemadri"],
        primaryCategory: "cs.LG",
        categories: ["cs.LG"],
        published: "2026-04-20T00:00:00.000Z"
      },
      {
        id: "2",
        title: "Another Paper",
        abstract: "Unrelated author entirely.",
        authors: ["Suresh Raghu"],
        primaryCategory: "cs.AI",
        categories: ["cs.AI"],
        published: "2026-04-21T00:00:00.000Z"
      }
    ],
    {
      query: "",
      author: "raghu hemadri",
      category: ""
    }
  );

  assert.deepEqual(ranked.map((item) => item.id), ["1"]);
});
