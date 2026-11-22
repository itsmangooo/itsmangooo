# Inside the workbench

This profile is plain Markdown, JavaScript and SVG. No widget host, image API,
tracking pixel, runtime package, embedded script or personal access token is needed.

## The four instruments

- **A year in small squares**: 365 consecutive calendar days, ending on the UTC
  date printed below the widgets. Each square represents one day. Colour levels
  use square-root scaling against the largest day in that snapshot, preserving
  the visibility of quiet days. The dated tooltips contain the exact counts.
  A separate narrow-screen SVG folds the weeks into two chronological rows.
- **Public notebook**: the sum of that calendar, days with at least one public
  contribution, public source repository count, stars received and language shares.
- **The last twelve weeks**: twelve Monday-based weeks, including the current
  incomplete week. Bars share a linear scale; tooltips provide their dates/counts.
- **A little light on**: 28 little window panes in chronological reading order.
  A pane lights up when its day had at least one public contribution. It is a
  small drawing of activity, not online presence or a claim about working hours.

The date stays visible if a refresh fails. Committed images continue to load;
the failed workflow provides the error signal. A failed API response is never
replaced with plausible-looking zeroes.

## Counting and privacy

The REST endpoint `/users/itsmangooo/repos` supplies **public, owned** repositories.
Forks and this profile repository are excluded from repository, star and language
statistics. Archived public source repositories remain included. Language shares
are weighted by GitHub's reported source bytes across those repositories. These
are neither coding-time percentages nor proficiency scores. “Other” combines the
languages below the first three. Display rounding can introduce a 0.1% difference.

The GraphQL contribution collection supplies daily commit counts, opened issues,
opened pull requests, pull-request reviews and repository creations. Every item
must resolve to a repository explicitly marked `isPrivate: false` before it can
count. Private, restricted, missing and inaccessible records are excluded, even
when a local token has broader access. Their names, dates and aggregates are not
saved. Public contributions outside the owned source repositories can count here;
this matches the contributor-oriented scope of the calendar.

Dates use the calendar-date portion of `occurredAt` reported by GitHub. The window
ends on the current UTC day and today's observations are necessarily incomplete.
GitHub's attribution rules apply: not every push is a contribution, and API data
may take time to settle. This intentionally public-only reconstruction can differ
from the native graph, especially when private contribution visibility is enabled.

Monthly queries keep each per-repository daily commit connection below 100 nodes.
Issue, pull-request, review and repository connections are cursor-paginated. The
generator rejects a month reaching the non-paginated 100-repository grouping limit
rather than publishing a potentially incomplete calendar. Rate limits and network
errors have bounded retries; long rate-limit waits stop the run. Partial GraphQL
responses fail the refresh. Response bodies and tokens are never logged.

Only an allowlist of public fields and derived daily counts enters
[`data/snapshot.json`](../data/snapshot.json). No full authenticated API response
is committed. The same input renders byte-for-byte identical assets; no run
timestamp creates unnecessary commits. The visible date changes at most daily.
Image references include a short SHA-256 digest of each SVG's content, so a
changed widget receives a new cache URL while unchanged artwork retains its URL.
This prevents a refreshed README from displaying a cached previous snapshot.

## Design and accessibility

The palette pairs charcoal and warm paper with muted sage and small amber details.
Separate light/dark images are selected through GitHub-supported `<picture>`
sources. A light asset remains the fallback. SVGs contain their own colours,
system font fallbacks, accessible titles/descriptions and view boxes. They have
no external fonts, raster dependencies, scripts, animation or `foreignObject`.
The window drawing conveys its meaning without motion.

The 390px project and statistic images are inline elements, so they wrap into
one column on narrow screens. Project links wrap the entire card. Markdown keeps
the introduction, technology groups and methodology links as selectable text.
Image alternative text provides the essential content if graphics cannot load.
Native GitHub achievement badges and the native contribution graph are untouched.
The four language chips are ordinary README graphics, not achievement badges.

## Running it

Use Node.js 22 or newer; Actions uses Node.js 24. There is no install step.

```sh
npm test
npm run render  # draw from the existing public snapshot, without network access
npm run check
```

For a live refresh, provide a GitHub API token through `GITHUB_TOKEN` or `GH_TOKEN`
in the process environment, then run `npm run generate`. Never paste it into source,
commit it, or put it in a command argument. The normal GitHub Actions token works
for the scheduled workflow; no extra repository secret is configured or required.

Edit `scripts/config.js` for featured project copy and `scripts/render.js` for
layout and README text. Then render and check. `README.md` and `assets/` are outputs,
so direct edits to them are overwritten at the next refresh.

## Automation

[`refresh.yml`](../.github/workflows/refresh.yml) runs daily at **04:17 UTC**, on
manual dispatch and when its generators/tests change on `main`. GitHub may delay
scheduled runs. Pull requests only run offline verification with read access.
The refresh job alone receives `contents: write`, exclusively for committing the
allowlisted generated files. Actions are pinned to full commit SHAs. Credentials
are not persisted in the checkout. There is no dependency installation or external
rendering service.

Every successful refresh validates the snapshot and SVG outputs before committing.
An unchanged snapshot produces no commit. Concurrent runs are serialized. Pushes
are normal fast-forward pushes; a conflicting human change causes a failure rather
than a force-push. The next run reads the latest branch state. If refreshes fail,
open the workflow, inspect the failed step, fix the cause and use **Run workflow**.

GitHub can disable scheduled workflows after long repository inactivity; re-enable
them from the repository's Actions page when necessary. Manually dispatching a
workflow remains available. No hosted widget service needs to remain online.

## References

- [GitHub GraphQL contribution collections](https://docs.github.com/en/graphql/reference/users#contributionscollection)
- [Commit contribution grouping](https://docs.github.com/en/graphql/reference/commits#commitcontributionsbyrepository)
- [GitHub Actions token permissions](https://docs.github.com/en/actions/tutorials/authenticate-with-github_token)
- [Theme-aware README pictures](https://docs.github.com/en/get-started/writing-on-github/working-with-advanced-formatting/about-images)
