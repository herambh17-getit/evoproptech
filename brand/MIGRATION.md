# Domain migration runbook — evoproptech.com → buysafeproperty.in

Internal. `brand/` is excluded from the deploy. Status at time of writing:
**buysafeproperty.in is not yet registered** (no DNS / nameservers / HTTPS).

Decisions locked:
- Canonical = **bare** `https://buysafeproperty.in/` (www redirects to it).
- Public brand name **unchanged**: "BuySafe by Evoproptech". Legal entity stays "EVO Proptech Advisory".
- Email `hello@evoproptech.com` is **not** part of the URL swap (decide separately whether to move to @buysafeproperty.in).

## Order of operations

**You (prerequisites — nothing in code can happen until these are done):**
1. Register `buysafeproperty.in`.
2. In Vercel → the project → Settings → Domains: add `buysafeproperty.in` (set as the production/primary domain) and `www.buysafeproperty.in` (redirect → bare, 308). Add the DNS records Vercel shows at your registrar.
3. Keep `evoproptech.com` / `www.evoproptech.com` pointed at Vercel and set them to **redirect (301/308) → buysafeproperty.in**. Do not delete them — they must live on to serve the redirect and pass authority.

**Me (one commit, ~minutes) once the domain resolves:**
4. Run `scratchpad/migrate-domain.js` — swaps all 100 `https://…evoproptech.com` URL refs (canonical, og:url, sitemap, schema, internal absolute links) to `https://buysafeproperty.in`. Emails left intact.
5. Regenerate the OG image if any absolute URL shows in it (it doesn't today).
6. Commit + push; verify the live bare domain serves 200 and every canonical points to it.

**You (search + platforms — after the swap is live):**
7. Search Console: add `buysafeproperty.in` as a new property, verify, submit the sitemap, then use **Change of Address** from the old property to the new one.
8. Bing Webmaster Tools: same (add + verify + Site Move).
9. Meta: verify the new domain (new `facebook-domain-verification` tag — I'll add it when you give me the value) and update the Pixel's domain.
10. Update everywhere the old domain is named: Google Business Profile, Privyr, socials, email signatures, business cards.

## Why the sequence matters
Pointing canonicals/sitemap/schema at a domain that doesn't resolve tells Google the real site lives at a dead address and suppresses indexing. So step 4 never runs before steps 1–3 are done and the domain answers over HTTPS.

## Keep the old domain alive
The 301 from evoproptech.com → buysafeproperty.in is what carries any accrued authority and stops old links 404ing. Renew evoproptech.com for at least a year past the move.
