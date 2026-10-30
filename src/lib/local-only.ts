/**
 * Ledger is a single-user app with no login, so it only answers requests made
 * to this computer by name. That blocks DNS rebinding (a web page pointing its
 * own hostname at 127.0.0.1) and cross-site form posts. Extra names can be
 * allowed with LEDGER_ALLOWED_HOSTS="host1,host2".
 */

const LOCAL_NAMES = ["localhost", "127.0.0.1", "[::1]", "::1"];

function allowedNames() {
  const extra = (process.env.LEDGER_ALLOWED_HOSTS ?? "")
    .split(",")
    .map((h) => h.trim().toLowerCase())
    .filter(Boolean);
  return new Set([...LOCAL_NAMES, ...extra]);
}

/** "localhost:3000" → "localhost"; "[::1]:3000" → "[::1]". */
export function hostName(host: string) {
  const h = host.trim().toLowerCase();
  if (h.startsWith("[")) return h.slice(0, h.indexOf("]") + 1);
  return h.split(":")[0];
}

export function isAllowedHost(host: string | null) {
  return !!host && allowedNames().has(hostName(host));
}

const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

/** Why a request should be refused, or null to let it through. */
export function rejectReason(req: { method: string; host: string | null; origin: string | null }): string | null {
  if (!isAllowedHost(req.host)) return "Unknown host";
  if (SAFE_METHODS.has(req.method.toUpperCase())) return null;
  // Writes must come from one of our own pages. Browsers always send Origin on
  // cross-site POSTs; a missing Origin means a non-browser client on this machine.
  if (req.origin && req.origin !== "null") {
    let originHost: string;
    try {
      originHost = new URL(req.origin).host;
    } catch {
      return "Bad origin";
    }
    if (!isAllowedHost(originHost)) return "Cross-site request";
  } else if (req.origin === "null") {
    return "Cross-site request";
  }
  return null;
}
