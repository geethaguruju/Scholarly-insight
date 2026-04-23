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

  return clauses.length > 0 ? clauses.join("+AND+") : "all:*";
}

function normalizeText(value) {
  return (value || "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function tokenize(value) {
  return normalizeText(value)
    .split(" ")
    .filter(Boolean);
}

function expandTokens(tokens) {
  const expanded = new Set(tokens);

  for (const token of tokens) {
    const aliases = queryAliases[token] || [];
    for (const phrase of aliases) {
      for (const aliasToken of tokenize(phrase)) {
        expanded.add(aliasToken);
      }
    }
  }

  return [...expanded];
}

function levenshteinDistance(a, b) {
  if (a === b) {
    return 0;
  }

  if (!a.length) {
    return b.length;
  }

  if (!b.length) {
    return a.length;
  }

  const matrix = Array.from({ length: a.length + 1 }, (_, row) =>
    Array.from({ length: b.length + 1 }, (_, col) => (row === 0 ? col : col === 0 ? row : 0))
  );

  for (let row = 1; row <= a.length; row += 1) {
    for (let col = 1; col <= b.length; col += 1) {
      const cost = a[row - 1] === b[col - 1] ? 0 : 1;
      matrix[row][col] = Math.min(
        matrix[row - 1][col] + 1,
        matrix[row][col - 1] + 1,
        matrix[row - 1][col - 1] + cost
      );
    }
  }

  return matrix[a.length][b.length];
}

function similarityScore(a, b) {
  const left = normalizeText(a);
  const right = normalizeText(b);

  if (!left || !right) {
    return 0;
  }

  if (left === right) {
    return 1;
  }

  const distance = levenshteinDistance(left, right);
  return Math.max(0, 1 - distance / Math.max(left.length, right.length));
}

function scoreTokenMatches(text, tokens) {
  if (!tokens.length) {
    return 0;
  }

  const haystackTokens = new Set(tokenize(text));
  let matches = 0;

  for (const token of tokens) {
    if (haystackTokens.has(token)) {
      matches += 1;
    }
  }

  return matches / tokens.length;
}

function computeAuthorMatchScore(article, authorQuery) {
  const normalizedAuthors = article.authors.map(normalizeText);
  const normalizedQuery = normalizeText(authorQuery);

  if (!normalizedQuery) {
    return 0;
  }

  const queryParts = normalizedQuery.split(" ").filter(Boolean);

  const authorScores = normalizedAuthors.map((author) => {
    if (author.includes(normalizedQuery) || normalizedQuery.includes(author)) {
      return 1;
    }

    const authorParts = author.split(" ").filter(Boolean);
    const overlappingParts = queryParts.filter((part) => authorParts.includes(part)).length;
    const partScore = queryParts.length ? overlappingParts / queryParts.length : 0;
    const fuzzyScore = similarityScore(author, normalizedQuery);

    return Math.max(partScore, fuzzyScore);
  });

  return authorScores.length ? Math.max(...authorScores) : 0;
}

function scoreArticle(article, filters) {
  let score = 0;
  const normalizedTitle = normalizeText(article.title);
  const normalizedAbstract = normalizeText(article.abstract);
  const queryTokens = expandTokens(tokenize(filters.query));
  const authorMatchScore = computeAuthorMatchScore(article, filters.author);

  if (queryTokens.length) {
    score += scoreTokenMatches(article.title, queryTokens) * 45;
    score += scoreTokenMatches(article.abstract, queryTokens) * 18;

    const normalizedQuery = normalizeText(filters.query);
    if (normalizedQuery && normalizedTitle.includes(normalizedQuery)) {
      score += 30;
    }
    if (normalizedQuery && normalizedAbstract.includes(normalizedQuery)) {
      score += 12;
    }
  }

  if (filters.author) {
    score += authorMatchScore * 70;
  }

  if (filters.category) {
    if (article.primaryCategory === filters.category) {
      score += 20;
    } else if (article.categories.includes(filters.category)) {
      score += 12;
    }
  }

  const publishedTime = article.published ? new Date(article.published).getTime() : 0;
  if (publishedTime) {
    const daysOld = Math.max(0, (Date.now() - publishedTime) / (1000 * 60 * 60 * 24));
    score += Math.max(0, 8 - Math.min(daysOld / 30, 8));
  }

  return {
    score,
    authorMatchScore
  };
}

export function rankArticles(items, filters) {
  return [...items]
    .map((article) => {
      const { score, authorMatchScore } = scoreArticle(article, filters);
      return {
        ...article,
        relevanceScore: score,
        authorMatchScore
      };
    })
    .filter((article) => {
      if (!filters.author) {
        return true;
      }

      return article.authorMatchScore >= 0.6;
    })
    .sort((left, right) => {
      if (right.relevanceScore !== left.relevanceScore) {
        return right.relevanceScore - left.relevanceScore;
      }

      return new Date(right.published || 0).getTime() - new Date(left.published || 0).getTime();
    });
}

async function fetchArxiv(params) {
  const searchQuery = buildArxivQuery(params);
  const url = new URL("https://export.arxiv.org/api/query");

  url.searchParams.set("search_query", searchQuery);
  url.searchParams.set("start", String(params.start || 0));
  url.searchParams.set("max_results", String(params.maxResults || 12));
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
  const parsed = parser.parse(xml);
  return {
    items: transformArxivFeed(xml),
    query: searchQuery,
    totalResults: Number(parsed?.feed?.["opensearch:totalResults"] || 0)
  };
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
  maxResults = 10
}) {
  const filters = { query, author, category, from, to };
  const hasActiveSearch = Boolean(query || author || category || from || to);
  const cappedWindow = 50;
  const pageStart = Math.max(0, Number(start || 0));
  const pageSize = Math.min(Math.max(Number(maxResults || 10), 1), 10);
  const candidateLimit = hasActiveSearch ? cappedWindow : Math.max(pageStart + pageSize, 20);
  const primary = await fetchArxiv({
    query,
    author,
    category,
    start: 0,
    maxResults: candidateLimit
  });

  const candidateMap = new Map(primary.items.map((article) => [article.id, article]));

  if (author) {
    const fallback = await fetchArxiv({
      query,
      category,
      start: 0,
      maxResults: candidateLimit
    });

    for (const article of fallback.items) {
      candidateMap.set(article.id, article);
    }
  }

  const rankedItems = rankArticles(
    [...candidateMap.values()].filter((article) => articleMatchesDateRange(article, from, to)),
    filters
  );
  const cappedRankedItems = rankedItems.slice(0, cappedWindow);
  const items = cappedRankedItems.slice(pageStart, pageStart + pageSize);
  const total = cappedRankedItems.length;
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
