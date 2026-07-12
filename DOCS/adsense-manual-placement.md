# AdSense — Manual Placement Only (Halley's Big Catch)

Google-served ads are allowed **only** as the top banner during active gameplay
(on a screen that already has publisher content: the fishing game).

| Placement | When | Implementation |
|-----------|------|----------------|
| **Top banner** | During normal play after `reveal()` | `#ad-banner` iframe via **srcdoc** (no public ad-only URL) |
| **Energy reward** | User taps “Watch Ad” when out of energy | **Fictional Halley ads only** — no Google AdSense |

**Why energy cannot use AdSense:** Google forbids ads on screens without publisher
content, including behavioral / reward overlays. Using a display unit there caused
the “Google-served ads on screens without publisher-content” policy hit.

**Important:** `adsbygoogle.js` must **not** load on `index.html` (the game page).
The banner iframe uses srcdoc so the game document stays ad-script-free.

`/ad-banner.html` and `/ad-energy.html` are **redirect stubs** (no ads) and are
blocked in `robots.txt`. Do not put AdSense tags on those files again.

---

## Step 1 — Turn OFF Auto ads (required)

1. Go to [AdSense](https://adsense.google.com)
2. **Ads** → **By site** (or **Overview** → your site)
3. Select **kitty-creek.onrender.com**
4. Open **Auto ads** (or **Ad settings** → **Auto ads**)
5. **Turn Auto ads OFF** for this site

Also disable individual Auto ad formats if shown:

- ❌ In-page ads  
- ❌ Anchor ads (top/bottom sticky)  
- ❌ Vignette ads (full-screen between pages)  
- ❌ Side rails  

Save. Changes can take up to an hour to apply; clear cache and hard refresh when testing.

> **Do not** use CSS to hide Auto ads while they remain enabled — that violates AdSense policy. Disable them in the dashboard instead.

---

## Step 2 — Manual banner unit only

In AdSense: **Ads** → **By ad unit** → **Display ads**

### Unit A — Top banner

- **Name:** Halley Top Banner  
- **Type:** Display ad → fixed 320×50 or responsive  
- **Use:** Only in `#ad-banner` at top of game during play  

Copy the **ad slot ID** into `src/ads.js`:

```js
export const ADSENSE_BANNER_SLOT = 'YOUR_BANNER_SLOT_ID';
```

### Energy reward

Do **not** create or attach a Google display unit for energy. The overlay uses joke ads
and still grants `AD_ENERGY_REWARD`. For true rewarded video later, use Google’s
**Ad Placement API** (H5 games) — not a blank display overlay.

---

## Step 3 — Deploy & request review

1. Deploy this build (redirect stubs + robots.txt + no energy AdSense).
2. Confirm Auto ads are OFF.
3. Visit `/ad-banner.html` and `/ad-energy.html` — both should redirect home with **no ads**.
4. In AdSense, request a review after the fix is live.

---

## What we do NOT use

- **Auto ads** — off in dashboard  
- **Page-level ads** — blocked via `enable_page_level_ads: false` inside the banner srcdoc  
- **Google ads on energy / alert / loading screens**  
- **Public HTML pages that only contain an ad**  
- **AdMob** — native apps only; this is a PWA  

---

## Troubleshooting

| Problem | Fix |
|---------|-----|
| Ads appear in random places | Auto ads still on — disable in Step 1 |
| Banner empty | Slot ID wrong, site not approved, or low fill — wait 24–48h after approval |
| Policy: screens without content | Do not restore AdSense on energy overlay or ad-*.html |
| Orphans on game page | Banner must stay in srcdoc iframe; never load adsbygoogle on index.html |

---

*Publisher ID:* `ca-pub-8602130362499092`
