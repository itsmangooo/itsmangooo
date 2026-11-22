const API = 'https://api.github.com';
const DAY = 86_400_000;
export const isoDay = value => new Date(value).toISOString().slice(0, 10);
export const addDays = (day, count) => isoDay(Date.parse(day + 'T00:00:00Z') + count * DAY);

export function windowFor(now = new Date()) {
  const end = isoDay(now);
  return { start: addDays(end, -364), end };
}

export function monthWindows(start, end) {
  const windows = [];
  for (let from = start; from <= end;) {
    const date = new Date(from + 'T00:00:00Z');
    const next = isoDay(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 1));
    const to = [addDays(next, -1), end].sort()[0];
    windows.push({ start: from, end: to });
    from = next;
  }
  return windows;
}

export function createClient({ token, fetchImpl = fetch, sleep = ms => new Promise(r => setTimeout(r, ms)) } = {}) {
  return async function request(path, body) {
    if (!path.startsWith('/') || path.startsWith('//')) throw new Error('Invalid API path.');
    for (let attempt = 0; attempt < 3; attempt++) {
      let response;
      try {
        response = await fetchImpl(API + path, {
          method: body ? 'POST' : 'GET',
          headers: {
            Accept: 'application/vnd.github+json',
            'X-GitHub-Api-Version': '2022-11-28',
            'User-Agent': 'mango-workbench',
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
            ...(body ? { 'Content-Type': 'application/json' } : {}),
          },
          ...(body ? { body: JSON.stringify(body) } : {}),
          signal: AbortSignal.timeout(20_000),
        });
      } catch {
        if (attempt === 2) throw new Error('GitHub API unavailable after three attempts.');
        await sleep(1000 * 2 ** attempt);
        continue;
      }
      if (!response.ok) {
        const retryable = [429, 500, 502, 503, 504].includes(response.status)
          || (response.status === 403 && (response.headers.get('x-ratelimit-remaining') === '0'
            || response.headers.has('retry-after')));
        const retryAfter = response.headers.get('retry-after');
        const reset = Number(response.headers.get('x-ratelimit-reset')) * 1000;
        const delay = retryAfter
          ? (Number.isFinite(Number(retryAfter)) ? Number(retryAfter) * 1000 : Date.parse(retryAfter) - Date.now())
          : (reset > Date.now() ? reset - Date.now() + 1000 : 1000 * 2 ** attempt);
        if (!retryable || attempt === 2 || delay > 30_000) {
          throw new Error(`GitHub API returned HTTP ${response.status}; existing assets retained.`);
        }
        await sleep(Math.max(1000, delay));
        continue;
      }
      let json;
      try { json = await response.json(); } catch { throw new Error('GitHub API returned invalid JSON.'); }
      // Never print API response bodies: authenticated responses can contain private data.
      if (json.errors) throw new Error('GitHub GraphQL query failed; existing assets retained.');
      return json;
    }
  };
}

const connections = {
  issueContributions: 'issue { repository { isPrivate } }',
  pullRequestContributions: 'pullRequest { repository { isPrivate } }',
  pullRequestReviewContributions: 'pullRequestReview { repository { isPrivate } }',
  repositoryContributions: 'repository { isPrivate }',
};
const itemRepository = node => node.repository ?? node.issue?.repository
  ?? node.pullRequest?.repository ?? node.pullRequestReview?.repository;

function queryFor(fields, commits) {
  return `query($login:String!,$from:DateTime!,$to:DateTime!,$after:String) {
    user(login:$login) { contributionsCollection(from:$from,to:$to) {
      ${commits ? `commitContributionsByRepository(maxRepositories:100) {
        repository { isPrivate }
        contributions(first:100) { nodes { occurredAt commitCount } pageInfo { hasNextPage endCursor } }
      }` : ''}
      ${fields.map(field => `${field}(first:100,after:$after) {
        nodes { occurredAt ${connections[field]} } pageInfo { hasNextPage endCursor }
      }`).join('\n')}
    } }
  }`;
}

function publicItems(connection, daily, type) {
  if (!connection || !Array.isArray(connection.nodes) || !connection.pageInfo) {
    throw new Error('Incomplete contribution connection.');
  }
  for (const node of connection.nodes) {
    // Fail closed: null, restricted, internal or private repositories never count.
    if (itemRepository(node)?.isPrivate !== false) continue;
    const day = node.occurredAt?.slice(0, 10);
    if (daily[day]) daily[day][type]++;
  }
}

export async function fetchContributions(request, login, start, end, now) {
  const daily = {};
  for (let day = start; day <= end; day = addDays(day, 1)) {
    daily[day] = { date: day, commits: 0, issues: 0, pullRequests: 0, reviews: 0, repositories: 0 };
  }
  const types = { issueContributions: 'issues', pullRequestContributions: 'pullRequests',
    pullRequestReviewContributions: 'reviews', repositoryContributions: 'repositories' };
  for (const range of monthWindows(start, end)) {
    const variables = { login, from: range.start + 'T00:00:00Z',
      to: range.end === end ? now.toISOString() : range.end + 'T23:59:59.999Z', after: null };
    const result = await request('/graphql', { query: queryFor(Object.keys(connections), true), variables });
    const collection = result.data?.user?.contributionsCollection;
    if (!collection || !Array.isArray(collection.commitContributionsByRepository)) {
      throw new Error('Contribution collection missing.');
    }
    // Monthly slicing bounds daily commit connections to 31 nodes. The outer
    // repository grouping has no cursor; refuse a possibly truncated month.
    if (collection.commitContributionsByRepository.length >= 100) {
      throw new Error('Monthly repository limit reached; refusing an incomplete calendar.');
    }
    for (const group of collection.commitContributionsByRepository) {
      if (group.repository?.isPrivate !== false) continue;
      if (group.contributions?.pageInfo?.hasNextPage || !Array.isArray(group.contributions?.nodes)) {
        throw new Error('Incomplete daily commit contribution connection.');
      }
      for (const node of group.contributions.nodes) {
        if (!Number.isSafeInteger(node.commitCount) || node.commitCount < 0) throw new Error('Invalid commit count.');
        const day = node.occurredAt?.slice(0, 10);
        if (daily[day]) daily[day].commits += node.commitCount;
      }
    }
    for (const [field, type] of Object.entries(types)) {
      let connection = collection[field];
      const cursors = new Set();
      for (let page = 0; ; page++) {
        publicItems(connection, daily, type);
        if (!connection.pageInfo.hasNextPage) break;
        const after = connection.pageInfo.endCursor;
        if (!after || cursors.has(after) || page >= 100) throw new Error('Invalid contribution pagination.');
        cursors.add(after);
        const more = await request('/graphql', { query: queryFor([field], false), variables: { ...variables, after } });
        connection = more.data?.user?.contributionsCollection?.[field];
      }
    }
  }
  return Object.values(daily).map(day => ({ ...day,
    total: day.commits + day.issues + day.pullRequests + day.reviews + day.repositories }));
}

export async function fetchSnapshot({ token, login, now = new Date(), fetchImpl, sleep } = {}) {
  if (!token) throw new Error('GITHUB_TOKEN is required. Use --offline to render the saved public snapshot.');
  const request = createClient({ token, fetchImpl, sleep });
  const repositories = [];
  for (let page = 1; ; page++) {
    // This endpoint exposes public repositories only, even with a broad local token.
    const batch = await request(`/users/${encodeURIComponent(login)}/repos?type=owner&per_page=100&page=${page}`);
    if (!Array.isArray(batch)) throw new Error('Invalid public repository list.');
    for (const repo of batch) {
      if (repo.private !== false || repo.visibility !== 'public' || repo.owner?.login?.toLowerCase() !== login.toLowerCase()) continue;
      if (repo.fork || repo.name.toLowerCase() === login.toLowerCase()) continue;
      const languages = await request(`/repos/${encodeURIComponent(login)}/${encodeURIComponent(repo.name)}/languages`);
      // Explicit allowlist: do not serialize complete API objects.
      repositories.push({ name: repo.name, url: repo.html_url, description: repo.description,
        language: repo.language, languages, stars: repo.stargazers_count,
        pushedAt: repo.pushed_at, archived: repo.archived, topics: repo.topics ?? [] });
    }
    if (batch.length < 100) break;
    if (page >= 100) throw new Error('Public repository pagination exceeded its bound.');
  }
  repositories.sort((a, b) => a.name.localeCompare(b.name, 'en'));
  const range = windowFor(now);
  const days = await fetchContributions(request, login, range.start, range.end, now);
  return { schemaVersion: 1, login, capturedOn: isoDay(now), range, repositories, days };
}

export function validateSnapshot(data, login) {
  if (data?.schemaVersion !== 1 || data.login !== login || !/^\d{4}-\d{2}-\d{2}$/.test(data.capturedOn)) {
    throw new Error('Invalid snapshot header.');
  }
  if (!Array.isArray(data.repositories) || !Array.isArray(data.days) || data.days.length !== 365) {
    throw new Error('Snapshot must include 365 contiguous days.');
  }
  if (data.range?.end !== data.capturedOn || addDays(data.range.end, -364) !== data.range.start) {
    throw new Error('Invalid snapshot date range.');
  }
  for (const [index, day] of data.days.entries()) {
    const values = ['commits', 'issues', 'pullRequests', 'reviews', 'repositories'];
    if (day.date !== addDays(data.range.start, index)
      || values.some(key => !Number.isSafeInteger(day[key]) || day[key] < 0)
      || day.total !== values.reduce((sum, key) => sum + day[key], 0)) throw new Error('Invalid contribution day.');
  }
  for (const repo of data.repositories) {
    if (!/^[\w.-]+$/.test(repo.name) || repo.url !== `https://github.com/${login}/${repo.name}`
      || !Number.isSafeInteger(repo.stars) || repo.stars < 0
      || !repo.languages || Object.values(repo.languages).some(bytes => !Number.isSafeInteger(bytes) || bytes < 0)
      || Number.isNaN(Date.parse(repo.pushedAt))) throw new Error('Invalid public repository record.');
  }
  return data;
}
