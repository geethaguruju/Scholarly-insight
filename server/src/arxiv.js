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

const queryAliases = {
  ai: ["artificial intelligence"],
  ml: ["machine learning"],
  dl: ["deep learning"],
  nlp: ["natural language processing", "computation and language"],
  llm: ["large language model", "large language models"],
  cv: ["computer vision"],
  rl: ["reinforcement learning"]
};

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

  function formatValue(value) {
    const normalized = value.trim().replace(/\s+/g, " ");
    const escaped = normalized.replace(/"/g, '\\"');
    return /\s/.test(escaped) ? `"${escaped}"` : escaped;
  }

  if (params.query) {
    clauses.push(`all:${formatValue(params.query)}`);
  }

  if (params.author) {
    clauses.push(`au:${formatValue(params.author)}`);
  }

  if (params.category) {
    clauses.push(`cat:${formatValue(params.category)}`);
  }

  if (params.from || params.to) {
    const fromStr = params.from ? params.from.replace(/-/g, '') + '0000' : '199001010000';
    const toStr = params.to ? params.to.replace(/-/g, '') + '2359' : '*';
    clauses.push(`submittedDate:[${fromStr} TO ${toStr}]`);
  }

  return clauses.length > 0 ? clauses.join("+AND+") : 'all:"research"';
}

const RATE_LIMIT_MS = 3000;
let arxivQueue = Promise.resolve();

function enqueueArxivRequest(requestFn) {
  const task = arxivQueue.then(async () => {
    try {
      return await requestFn();
    } finally {
      // Ensure the next request in the queue waits at least 3 seconds
      await new Promise((resolve) => setTimeout(resolve, RATE_LIMIT_MS));
    }
  });
  
  // Prevent the queue from halting on errors
  arxivQueue = task.catch(() => {});
  return task;
}

async function fetchArxiv(params) {
  const searchQuery = buildArxivQuery(params);
  const url = new URL("https://export.arxiv.org/api/query");

  url.searchParams.set("search_query", searchQuery);
  url.searchParams.set("start", String(params.start || 0));
  url.searchParams.set("max_results", String(params.maxResults || 12));
  url.searchParams.set("sortBy", "submittedDate");
  url.searchParams.set("sortOrder", "descending");

  return enqueueArxivRequest(async () => {
    const response = await fetch(url, {
      headers: {
        "User-Agent": "ScholarlyInsight/0.1 (academic project app)"
      }
    });

    if (!response.ok) {
      throw new Error(`arXiv request failed with status ${response.status}`);
    }

    const xml = await response.text();
    const parsed = parser.parse(xml);
    return {
      items: transformArxivFeed(xml),
      query: searchQuery,
      totalResults: Number(parsed?.feed?.["opensearch:totalResults"] || 0)
    };
  });
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

export async function searchArxiv({
  query,
  author,
  category,
  start = 0,
  maxResults = 10
}) {
  const pageStart = Math.max(0, Number(start || 0));
  const pageSize = Math.min(Math.max(Number(maxResults || 10), 1), 50);

  const primary = await fetchArxiv({
    query,
    author,
    category,
    start: pageStart,
    maxResults: pageSize
  });

  const items = primary.items;
  const total = primary.totalResults || 0;
  const page = Math.floor(pageStart / pageSize) + 1;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  return {
    items,
    query: primary.query,
    count: items.length,
    total,
    page,
    pageSize,
    totalPages,
    hasNextPage: page < totalPages
  };
}

export async function getArticleById(id) {
  const url = new URL("https://export.arxiv.org/api/query");
  url.searchParams.set("id_list", id);

  return enqueueArxivRequest(async () => {
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
  });
}

export function getCategoryCatalog() {
  return categoryCatalog;
}
