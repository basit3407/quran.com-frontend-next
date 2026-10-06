# Connected Apps public search

The `/apps` page preserves its existing local Browse and Featured catalog. For a nonempty, valid
search, it additionally requests published Connected Apps through the same-origin
`GET /api/connected-apps/search?q=...&locale=...` adapter. Search-only Indexed apps are not added to
Browse, Featured, or homepage data. This is not a catalog migration.

## Server-only configuration

The empty entries in `.env.example` are documentation, not usable credentials:

| Variable                           | Required value                                                                                            |
| ---------------------------------- | --------------------------------------------------------------------------------------------------------- |
| `CONNECTED_APPS_PLATFORM_ORIGIN`   | The authorized environment's direct HTTPS Platform origin. No path, query, user information, or fragment. |
| `CONNECTED_APPS_PUBLIC_READ_TOKEN` | A secret accepted by that Platform instance's public-read middleware.                                     |

Neither variable may use a `NEXT_PUBLIC_` prefix. Do not put a token in the browser, query string,
source control, PR description, or logs. Configure them through the authorized server deployment's
secret/configuration mechanism. Missing or invalid configuration fails closed with
`503 search_unavailable`; the page shows an explicit incomplete-results notice and preserves
available local matches. Configuration and publication of a PR do not prove that the deployed
service has been wired up.

The adapter does not use the general `/api/proxy` transport: that proxy forwards browser cookies and
has a different authentication contract. It never reads or forwards browser cookies, OAuth
Authorization, gateway credentials, or administrator/service/user identity headers. Only the
server-owned credential and `Accept: application/json` are sent upstream.

## Confirmed Platform contract

Source contract: `qf-platform-api` at `d0167a62cfa6495fce1e1999578e011ca8ea9bbc`,
`src/routes/public_connected_apps.rs`, `src/models.rs`, `src/repository.rs`, and `src/domain.rs`.

- Endpoint: `GET /v1/public/connected-apps/search?q=...&locale=...&limit=20`.
- Public-read authentication header: **`x-api-gateway-token`**. With direct public access disabled,
  Platform verifies it against its server-side `GATEWAY_SHARED_TOKEN`. The frontend requires its
  dedicated server configuration even if direct access is enabled. This is not a new backend
  credential type or an authorization to expose the shared token.
- Response: `{ apps: ConnectedAppCard[] }`, at most 20 cards.
- Platform searches published revisions of active apps with published listing pointers and
  `search_only` or `browse` discoverability. Publication/approval enforcement belongs to this
  backend query, not to a client-supplied status boolean. No internal/draft endpoint is used.
- Query: NFKC, lowercase, alphanumeric tokens separated by spaces; 2 to 100 normalized Unicode
  characters. Locale is a bounded alphanumeric/hyphen string and is normalized to lowercase.
  Browser-supplied limits, duplicate query parameters, and unknown parameters are rejected.

The adapter projects only card ID, localized title/tagline/description, icon and alt text, active
recognized category slugs, and HTTPS official web/iOS/Android destinations. It does not spread
upstream data or expose owner, review, draft, relationship, program-status, or provenance metadata.
React renders copy as plain text, never API HTML. Remote icons bypass the server image optimizer and
use `no-referrer`; local icons remain within `/images/`.

Upstream fetch redirects are rejected. Fetch and response reading share a five-second abort timeout
and a 256 KiB response limit. Failure responses are `no-store` and generic; upstream bodies,
exception messages, credentials, and headers are neither returned nor logged by the adapter.
Successful projected results use a SHA-256 ETag binding the normalized query, locale, fixed limit,
and projected body, with a 60-second public cache and 60-second stale-while-revalidate period.
Internal upstream ETags/headers are not exposed.

Client SWR keys include query and locale, preventing old responses from replacing a newer search.
Input is debounced, empty/invalid input makes no request, requests have an eight-second client
timeout, and failures require explicit retry rather than an unbounded automatic loop. Local and
published matches are deduplicated by stable IDs and normalized official URLs.

## Credential-free verification

Use the repository-supported Node 18 and existing cached dependencies. Focused unit tests:

```sh
yarn test src/utils/connectedApps.test.ts src/hooks/useConnectedAppSearch.test.tsx src/pages/api/connected-apps/search.test.ts
```

The opt-in Playwright spec is `tests/integration/connected-apps/indexed-search.spec.ts`. It requires
`CONNECTED_APPS_FIXTURE=1` and a local frontend configured against a local Platform fixture
returning the card in `tests/helpers/connected-app-card.ts`. The fixture must return that card only
for matching nonempty queries, validate the fixed limit/server dummy token, and reject incoming
cookie/identity headers. It must never call a live Platform API or database.

Loopback HTTP Platform origins are accepted **only** with `NODE_ENV=development`, for this local
fixture setup; production requires HTTPS. Use dummy credentials only and pass fixture configuration
through a short-lived process environment, not a real `.env` file. Run the existing unauthenticated
desktop/mobile Chromium projects only, with no setup/authentication projects. The spec blocks
external browser requests and captures Indexed search, restored empty-query Browse, and error-state
screenshots. Server-side outbound networking must also be restricted to local fixtures when doing
credential-free verification; browser routing alone cannot prevent server-side calls. Do not run
this opt-in spec against a public deployment.

A testing PR is not deployment or merge authorization. Frontend has no `origin/staging`; the
promotion destination must be clarified separately, not substituted with `master` or `pre-live`.
