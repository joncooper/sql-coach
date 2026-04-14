import { NextResponse, type NextRequest } from "next/server";

/**
 * Old-slug → canonical-slug redirects. When a problem is renamed,
 * add its old slug here pointing at the new one. Requests to the old
 * URL get a 308 Permanent Redirect to the new URL, so bookmarks,
 * external links, and the browser history clean themselves up.
 *
 * Don't remove entries; let the list grow. 308 is cheap and keeps
 * pre-rename links working forever.
 */
const SLUG_ALIASES: Record<string, string> = {
  // Renamed on 2026-04-14 because the old slugs named the solution
  // technique (generate_series, GROUPING SETS, LATERAL, NTILE, ROLLUP,
  // UNION/INTERSECT) — which defeated the "figure out the trick" point
  // of the problems.
  "generate-series-date-spine": "daily-completed-order-counts",
  "grouping-sets-revenue": "multi-level-revenue-summary",
  "lateral-top-orders": "top-two-recent-orders-per-customer",
  "ntile-salary-bands": "salary-quartile-bands",
  "rollup-location-salary": "location-salary-summary-with-subtotals",
  "active-users-union": "visited-both-pages-same-session",
};

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // Match /problems/[slug] and /api/problems/[slug][/sub]
  const pageMatch = pathname.match(/^\/problems\/([^/]+)$/);
  if (pageMatch) {
    const canonical = SLUG_ALIASES[pageMatch[1]];
    if (canonical) {
      const url = req.nextUrl.clone();
      url.pathname = `/problems/${canonical}`;
      return NextResponse.redirect(url, 308);
    }
  }

  const apiMatch = pathname.match(/^\/api\/problems\/([^/]+)(\/.*)?$/);
  if (apiMatch) {
    const canonical = SLUG_ALIASES[apiMatch[1]];
    if (canonical) {
      const url = req.nextUrl.clone();
      url.pathname = `/api/problems/${canonical}${apiMatch[2] ?? ""}`;
      return NextResponse.redirect(url, 308);
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/problems/:slug", "/api/problems/:slug/:path*"],
};
