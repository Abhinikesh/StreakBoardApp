# StreakBoard — Play Store Submission Checklist

## Before Submitting

### Assets Needed

- [ ] **App icon** — 512×512 PNG, no transparency
  - Background: `#0d0d1a` (dark navy)
  - Center: 🔥 flame emoji or flame SVG
  - Below flame: "SB" text in `#7c3aed` purple, bold
  - Tools: [Canva](https://www.canva.com) or [favicon.io](https://favicon.io/favicon-generator/)
  - Files to replace (same image):
    - `assets/icon.png` (1024×1024)
    - `assets/adaptive-icon.png` (1024×1024)
    - `assets/splash-icon.png` (512×512, same design)

- [ ] **Feature graphic** — 1024×500 PNG
  - Dark `#0d0d1a` background
  - StreakBoard logo + tagline: *"Track what you do. Not what you plan."*
  - Make in Canva (free)

- [ ] **Screenshots** — minimum 2, maximum 8
  - Size: at least 375px wide (use a Pixel / Motorola screenshot)
  - Recommended screens to capture:
    1. Dashboard (habit list with streaks)
    2. Calendar (month view)
    3. Leaderboard (podium visible)
    4. Profile (stats + dark mode)

---

## App Details — Play Console Store Listing

| Field | Value |
|---|---|
| App name | StreakBoard |
| Short description (80 chars) | Track daily habits with streaks. See your real consistency. |
| Category | Health & Fitness |
| Content rating | Everyone |
| Privacy policy URL | https://streak-o.vercel.app/privacy |
| Contact email | *(your email)* |

**Full description (copy-paste):**
```
StreakBoard turns your daily habits into a visual streak — like GitHub contributions but for your real life.

Log habits done or missed each day. Watch your streak grow. Compete with friends on the leaderboard. Never lie to yourself about your discipline again.

Features:
• Track any habit with a daily Done / Missed log
• Visual streak counter — don't break the chain
• Calendar heatmap showing 12 weeks of activity
• Leaderboard to compete with friends
• Share your public profile via a unique link
• Daily reminder notifications
• Dark & light mode

Free forever.
```

---

## Build Commands

```bash
# Install dependencies (first time)
npm install

# Preview APK — for testing / sharing via WhatsApp / Drive
eas build -p android --profile preview

# Production AAB — for Play Store upload
eas build -p android --profile production
```

> **Note:** Bump `versionCode` in `app.json` → `android.versionCode` before each Play Store release.

---

## Play Store Submission Steps

1. Go to [play.google.com/console](https://play.google.com/console)
2. Create developer account (one-time **$25 USD** fee)
3. Click **Create app** → Android → Free → Not for children
4. **Dashboard → Upload your first release**
   - Choose track: **Internal testing** (fastest approval)
   - Upload the `.aab` file from your production EAS build
5. **Store presence → Main store listing**
   - Fill in app name, short + full description from above
   - Upload feature graphic and screenshots
6. **Policy → App content**
   - Complete the content rating questionnaire (select "No" for all sensitive content)
   - Add privacy policy URL
7. **Monetisation → Pricing & distribution**
   - Set to **Free**, select countries (all)
8. **Release → Review and roll out**
   - Submit for review — first review takes **3–7 business days**

---

## Indus App Store (Free, India-focused, faster)

1. Register at [developer.indusappstore.com](https://developer.indusappstore.com)
2. Upload the **preview APK** (same build — no AAB needed)
3. Fill in the same store listing details
4. Approval is typically **1–2 business days**

---

## After Each Update

```bash
# 1. Bump versionCode in app.json (android.versionCode: 3, 4, …)
# 2. Build new AAB
eas build -p android --profile production
# 3. Go to Play Console → Production → Create new release
# 4. Upload new .aab file
```

---

## Privacy Policy (Quick Setup)

Add a `/privacy` page to your Vercel site (`streak-o.vercel.app/privacy`) with this minimum content:

```
StreakBoard Privacy Policy

We collect: email address (for login), habit logs you create.
We do not sell your data to any third party.
We use your email only for authentication.
To delete your account email: [your email]
```

This is the minimum required by Google Play.
