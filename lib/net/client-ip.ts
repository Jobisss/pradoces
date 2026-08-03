/**
 * Trusted client-IP resolution (HI-01 / INFRA-04 / T-01-06-01).
 *
 * The deployment is nginx (host, sole proxy hop) -> app. A client-supplied
 * `X-Forwarded-For` is NOT trustworthy: the LEFTMOST XFF value is fully
 * attacker-controlled. Keying the rate limiter off the leftmost hop lets an
 * attacker land in a fresh bucket on every request (random XFF) and defeat
 * the brute-force throttle.
 *
 * Resolution order (most-trustworthy first):
 *   1. `CF-Connecting-IP` — checked in case a Cloudflare proxy is ever placed
 *      in front again; currently always absent (no Cloudflare in this
 *      deployment), so resolution always falls through to (2).
 *   2. The RIGHTMOST `X-Forwarded-For` hop — the entry closest to our trusted
 *      proxy (nginx appends on the right), not the spoofable left.
 *   3. `'unknown'` — only when no forwarding headers exist (e.g. direct
 *      same-host calls / tests). See LO-05 for the fail-closed follow-up.
 *
 * Shared by the proxy boundary throttle (`proxy.ts`) and the Server-Action
 * defense layer (`clientContext()` in `lib/actions/auth.ts`) so both key the same
 * rate-limit bucket off the same trusted source.
 */
type HeadersLike = { get(name: string): string | null }

export function clientIp(h: HeadersLike): string {
  const cf = h.get('cf-connecting-ip')?.trim()
  if (cf) return cf

  const xff = (h.get('x-forwarded-for') ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)

  return xff.at(-1) ?? 'unknown' // rightmost = closest trusted hop
}
