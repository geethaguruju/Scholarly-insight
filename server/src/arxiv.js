import { XMLParser } from "fast-xml-parser";

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "",
  trimValues: true
});

const categoryCatalog = [
  { code: "cs.AI", label: "Artificial Intelligence" },
  { code: "cs.CL", label: "Computation and Language" },
  { code: "cs.CV", label: "Computer Vision and Pattern Recognition" },
  { code: "cs.LG", label: "Machine Learning" },
  { code: "cs.RO", label: "Robotics" },
  { code: "math.CO", label: "Combinatorics" },
  { code: "physics.data-an", label: "Data Analysis, Statistics and Probability" },
  { code: "q-bio.BM", label: "Biomolecules" },
  { code: "q-fin.EC", label: "Economics" },
  { code: "stat.ML", label: "Statistics Machine Learning" }
];

function normalizeAuthors(authorNode) {
  if (!authorNode) {
    return [];
  }

  const authors = Array.isArray(authorNode) ? authorNode : [authorNode];
  return authors.map((author) => author.name).filter(Boolean);
}

function normalizeLinks(linkNode) {
  if (!linkNode) {
    return [];
  }

  const links = Array.isArray(linkNode) ? linkNode : [linkNode];
  return links
    .map((link) => ({
      href: link.href,
      rel: link.rel,
      title: link.title,
      type: link.type
    }))
    .filter((link) => link.href);
}

function extractPdfUrl(links) {
  return (
    links.find((link) => link.title === "pdf")?.href ||
    links.find((link) => link.type === "application/pdf")?.href ||
    null
  );
}

function normalizeCategories(categoryNode, primaryCategoryNode) {
  const categories = Array.isArray(categoryNode)
    ? categoryNode
    : categoryNode
      ? [categoryNode]
      : [];

  const terms = categories.map((item) => item.term).filter(Boolean);
  const primaryCategory = primaryCategoryNode?.term || terms[0] || null;

  return {
    categories: terms,
    primaryCategory
  };
}

function toIsoDate(value) {
  if (!value) {
    return null;
  }

  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

export function buildArxivQuery(params = {}) {
  const clauses = [];

  if (params.query) {
    clauses.push(`all:${params.query.trim()}`);
  }

  if (params.author) {
    clauses.push(`au:${params.author.trim()}`);
  }

  if (params.category) {
    clauses.push(`cat:${params.category.trim()}`);
  }

  return clauses.length > 0 ? clauses.join("+AND+") : "all:*";
}

export function transformArxivFeed(xml) {
  const parsed = parser.parse(xml);
  const rawEntries = parsed?.feed?.entry;
  const entries = Array.isArray(rawEntries) ? rawEntries : rawEntries ? [rawEntries] : [];

  return entries.map((entry) => {
    const links = normalizeLinks(entry.link);
    const { categories, primaryCategory } = normalizeCategories(entry.category, entry["arxiv:primary_category"]);

    return {
      id: entry.id?.split("/abs/").pop() || entry.id,
      entryId: entry.id,
      title: entry.title?.replace(/\s+/g, " ").trim() || "Untitled",
      abstract: entry.summary?.replace(/\s+/g, " ").trim() || "",
      authors: normalizeAuthors(entry.author),
      published: toIsoDate(entry.published),
      updated: toIsoDate(entry.updated),
      primaryCategory,
      categories,
      comment: entry["arxiv:comment"] || "",
      journalReference: entry["arxiv:journal_ref"] || "",
      doi: entry["arxiv:doi"] || "",
      links,
      pdfUrl: extractPdfUrl(links)
    };
  });
}

function articleMatchesDateRange(article, from, to) {
  if (!from && !to) {
    return true;
  }

  const publishedTime = article.published ? new Date(article.published).getTime() : null;

  if (!publishedTime) {
    return false;
  }

  if (from) {
    const fromTime = new Date(from).getTime();
    if (!Number.isNaN(fromTime) && publishedTime < fromTime) {
      return false;
    }
  }

  if (to) {
    const toBoundary = new Date(to);
    toBoundary.setHours(23, 59, 59, 999);
    const toTime = toBoundary.getTime();
    if (!Number.isNaN(toTime) && publishedTime > toTime) {
      return false;
    }
  }

  return true;
}

export async function searchArxiv({
  query,
  author,
  category,
  from,
  to,
  start = 0,
  maxResults = 12
}) {
  const searchQuery = buildArxivQuery({ query, author, category });
  const url = new URL("https://export.arxiv.org/api/query");

  url.searchParams.set("search_query", searchQuery);
  url.searchParams.set("start", String(start));
  url.searchParams.set("max_results", String(maxResults));
  url.searchParams.set("sortBy", "submittedDate");
  url.searchParams.set("sortOrder", "descending");

  const response = await fetch(url, {
    headers: {
      "User-Agent": "ScholarlyInsight/0.1 (academic project app)"
    }
  });

  if (!response.ok) {
    throw new Error(`arXiv request failed with status ${response.status}`);
  }

  const xml = await response.text();
  const items = transformArxivFeed(xml).filter((article) => articleMatchesDateRange(article, from, to));

  return {
    items,
    query: searchQuery,
    count: items.length
  };
}

export async function getArticleById(id) {
  const url = new URL("https://export.arxiv.org/api/query");
  url.searchParams.set("id_list", id);

  const response = await fetch(url, {
    headers: {
      "User-Agent": "ScholarlyInsight/0.1 (academic project app)"
    }
  });

  if (!response.ok) {
    throw new Error(`arXiv request failed with status ${response.status}`);
  }

  const xml = await response.text();
  return transformArxivFeed(xml)[0] || null;
}

export function getCategoryCatalog() {
  return categoryCatalog;
}
