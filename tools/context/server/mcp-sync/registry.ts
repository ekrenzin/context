const GITHUB_API = "https://api.github.com";
const OFFICIAL_API = "https://registry.modelcontextprotocol.io/v0.1";
const PAGE_SIZE = 30;

export interface RegistryServer {
  name: string;
  fullName: string;
  description?: string;
  stars: number;
  avatarUrl?: string;
  ownerLogin?: string;
  repoUrl?: string;
  topics?: string[];
  source: "github" | "official";
}

export interface RegistrySearchResult {
  servers: RegistryServer[];
  total?: number;
  page?: number;
  hasMore?: boolean;
  error?: string;
}

// -- Public API --

export async function searchRegistry(
  query?: string,
  page = 1,
  perPage = PAGE_SIZE,
): Promise<RegistrySearchResult> {
  // Query both sources in parallel, merge results
  const [github, official] = await Promise.all([
    searchGitHub(query, page, perPage),
    page === 1 ? searchOfficial(query) : Promise.resolve({ servers: [] } as RegistrySearchResult),
  ]);

  const error = github.error && official.error
    ? `${github.error}; ${official.error}`
    : github.error ?? official.error;

  // Dedupe: official first, then GitHub entries that aren't in the official set
  const officialNames = new Set(official.servers.map((s) => normalize(s.name)));
  const githubOnly = github.servers.filter(
    (s) => !officialNames.has(normalize(s.name)) && !officialNames.has(normalize(s.fullName)),
  );

  const servers = [...official.servers, ...githubOnly];
  const total = (github.total ?? 0) + official.servers.length;

  return {
    servers,
    total,
    page,
    hasMore: github.hasMore ?? false,
    error: error || undefined,
  };
}

export async function checkUpdates(
  since: string,
): Promise<RegistrySearchResult> {
  const [github, official] = await Promise.all([
    checkGitHubUpdates(since),
    checkOfficialUpdates(since),
  ]);

  const seen = new Set(github.servers.map((s) => normalize(s.name)));
  const officialOnly = official.servers.filter(
    (s) => !seen.has(normalize(s.name)),
  );

  return {
    servers: [...github.servers, ...officialOnly],
    total: (github.total ?? 0) + officialOnly.length,
  };
}

// -- GitHub Search API --

async function searchGitHub(
  query?: string,
  page = 1,
  perPage = PAGE_SIZE,
): Promise<RegistrySearchResult> {
  const parts = ["topic:mcp-server"];
  if (query) parts.push(query);
  const q = parts.join(" ");

  try {
    const params = new URLSearchParams({
      q,
      sort: "stars",
      order: "desc",
      per_page: String(perPage),
      page: String(page),
    });
    const res = await fetch(`${GITHUB_API}/search/repositories?${params}`, {
      signal: AbortSignal.timeout(10_000),
      headers: { Accept: "application/vnd.github+json" },
    });
    if (!res.ok) {
      return { servers: [], error: `GitHub API returned ${res.status}` };
    }
    const data = (await res.json()) as GitHubSearchResponse;
    const servers = (data.items ?? []).map(ghToServer);
    return {
      servers,
      total: data.total_count,
      page,
      hasMore: page * perPage < data.total_count,
    };
  } catch (err) {
    return { servers: [], error: errMsg(err) };
  }
}

async function checkGitHubUpdates(since: string): Promise<RegistrySearchResult> {
  try {
    const q = `topic:mcp-server pushed:>${since.slice(0, 10)}`;
    const params = new URLSearchParams({
      q, sort: "updated", order: "desc", per_page: "30",
    });
    const res = await fetch(`${GITHUB_API}/search/repositories?${params}`, {
      signal: AbortSignal.timeout(10_000),
      headers: { Accept: "application/vnd.github+json" },
    });
    if (!res.ok) return { servers: [], error: `GitHub API returned ${res.status}` };
    const data = (await res.json()) as GitHubSearchResponse;
    return { servers: (data.items ?? []).map(ghToServer), total: data.total_count };
  } catch (err) {
    return { servers: [], error: errMsg(err) };
  }
}

interface GitHubSearchResponse {
  total_count: number;
  items: GitHubRepo[];
}

interface GitHubRepo {
  full_name: string;
  name: string;
  description: string | null;
  stargazers_count: number;
  html_url: string;
  owner: { login: string; avatar_url: string };
  topics: string[];
}

function ghToServer(repo: GitHubRepo): RegistryServer {
  return {
    name: repo.name,
    fullName: repo.full_name,
    description: repo.description ?? undefined,
    stars: repo.stargazers_count,
    avatarUrl: repo.owner.avatar_url,
    ownerLogin: repo.owner.login,
    repoUrl: repo.html_url,
    topics: repo.topics,
    source: "github",
  };
}

// -- Official MCP Registry API --

async function searchOfficial(query?: string): Promise<RegistrySearchResult> {
  try {
    const params = new URLSearchParams({ limit: "50" });
    if (query) params.set("search", query);
    const res = await fetch(`${OFFICIAL_API}/servers?${params}`, {
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) {
      return { servers: [], error: `Official registry returned ${res.status}` };
    }
    const data = await res.json();
    const servers = normalizeOfficial(data);
    return { servers };
  } catch (err) {
    return { servers: [], error: errMsg(err) };
  }
}

async function checkOfficialUpdates(since: string): Promise<RegistrySearchResult> {
  try {
    const params = new URLSearchParams({
      updated_since: since,
      limit: "50",
    });
    const res = await fetch(`${OFFICIAL_API}/servers?${params}`, {
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) return { servers: [], error: `Official registry returned ${res.status}` };
    const data = await res.json();
    return { servers: normalizeOfficial(data) };
  } catch (err) {
    return { servers: [], error: errMsg(err) };
  }
}

function normalizeOfficial(data: unknown): RegistryServer[] {
  const obj = data as Record<string, unknown> | undefined;
  const raw = Array.isArray(data) ? data : (obj?.servers ?? []);
  if (!Array.isArray(raw)) return [];

  // Dedupe by name -- keep only the latest version of each server
  const byName = new Map<string, RegistryServer>();
  for (const entry of raw) {
    const s = entry?.server ?? entry;
    const name: string = s.name ?? "";
    if (!name) continue;
    // Later entries (newer versions) overwrite earlier ones
    const namespace = name.split("/")[0] ?? "";
    byName.set(name, {
      name,
      fullName: name,
      description: s.description ?? s.title,
      stars: 0,
      ownerLogin: namespace,
      source: "official",
    });
  }
  return Array.from(byName.values());
}

// -- Helpers --

function normalize(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]/g, "");
}

function errMsg(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}
