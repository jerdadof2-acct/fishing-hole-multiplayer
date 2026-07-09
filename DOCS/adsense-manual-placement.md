# AdSense — Manual Placement Only (Halley's Big Catch)

Google is injecting ads across the page because **Auto ads** are turned on in your AdSense account. This game only allows ads in **two places you control**:

| Placement | When | Code |
|-----------|------|------|
| **Top banner** | During normal play | `#ad-banner` iframe → `/ad-banner.html` |
| **Energy reward** | User taps “Watch Ad (+20 Energy)” when out of energy | Overlay iframe → `/ad-energy.html` |

**Important:** `adsbygoogle.js` must **not** load on `index.html` (the game page). Isolated ad HTML pages load the script so Google cannot inject `adsbygoogle-noablate` on the game UI.

Everything else must **not** show Google ads.

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

## Step 2 — Create TWO manual ad units (not Auto ads)

In AdSense: **Ads** → **By ad unit** → **Display ads**

### Unit A — Top banner

- **Name:** Halley Top Banner  
- **Type:** Display ad → **Responsive**  
- **Use:** Only in `#ad-banner` at top of game  

Copy the **ad slot ID** (numeric) into `src/ads.js`:

```js
export const ADSENSE_BANNER_SLOT = 'YOUR_BANNER_SLOT_ID';
```

### Unit B — Energy reward (user opt-in)

- **Name:** Halley Energy Reward  
- **Type:** Display ad → **Responsive** (or large rectangle on mobile)  
- **Use:** Only when player chooses “Watch Ad” on the out-of-energy modal  

Copy the slot ID into:

```js
export const ADSENSE_ENERGY_SLOT = 'YOUR_ENERGY_SLOT_ID';
```

---

## Step 3 — Deploy

Commit and push after pasting both slot IDs. Until slots are set, the game shows **placeholder** cat ads (banner) and **mock** rewarded overlay (energy).

---

## What we do NOT use

- **Auto ads** — off in dashboard  
- **Page-level ads** — blocked in code via `enable_page_level_ads: false` (first `adsbygoogle.push`)  
- **AdMob** — native apps only; this is a PWA  
- **Ads on shop / inventory / friends tabs** — no ad units there  
- **Ads during fishing fight** — banner stays at top only; no interstitials unless user requests energy ad  

---

## True “rewarded video” on the web (later)

AdSense **display** units in our energy overlay work for “watch then get +20 energy.” For skippable **video** rewarded ads on the web, Google’s **Ad Placement API** (H5 games) is a separate integration. The current design is correct for launch: manual banner + opt-in full-size unit on energy.

---

## Troubleshooting

| Problem | Fix |
|---------|-----|
| Ads appear in random places | Auto ads still on — disable in Step 1 |
| Banner empty | Slot ID wrong, site not approved, or low fill — wait 24–48h after approval |
| Energy ad shows mock | `ADSENSE_ENERGY_SLOT` still empty |
| Ads on loading screen | Auto ads — disable; banner is hidden until game `reveal()` |

---

*Publisher ID:* `ca-pub-8602130362499092` (already in `index.html`)
