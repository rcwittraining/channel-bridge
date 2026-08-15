# RCW Channel Bridge — mobile app (Android-friendly)

**Prompt → Lab-exercise video → Upload to YouTube.**
Installable web app (Add to Home Screen). Works on any phone browser.

## What it does
1. **Create** — type a lab topic → (optional) AI generates title/description/tags/slides via Gemini, or write manually.
2. **Record** — slides play full-screen with a teleprompter; your voice + slides are captured into a WebM video on the phone.
3. **Publish** — connect YouTube (official OAuth), set title/desc/tags/thumbnail/privacy, upload.
4. **Bridge (the key part)** — create *scoped* YouTube credentials, copy them, paste into the RCW assistant chat. From then on, give a topic in chat → the assistant generates the video package and uploads to your channel.

## 1-time setup (≈20 min, free)

### A. Gemini key (for AI script generation — optional)
1. aistudio.google.com → Get API key → copy (AIza...)
2. Paste into the app's Create tab. Stored only on your phone.

### B. YouTube OAuth client (for uploads + bridge)
1. console.cloud.google.com → New project (e.g. `rcw-bridge`)
2. Enable **YouTube Data API v3**
3. OAuth consent screen → External → add your email as Test user
4. Credentials → **Create OAuth Client ID**
   - For the **Bridge (assistant uploads)**: type **Desktop app** → download `client_secret.json`
   - For **in-app upload**: type **Web application** → add your site URL as Authorized JS origin
5. Bridge credentials:
   - PC: `pip install google-auth google-auth-oauthlib google-api-python-client`
   - `python auth.py --secrets client_secret.json`
   - Open the printed URL → sign in → Allow (scoped to your YouTube channel)
   - Open `credentials.json` → copy refresh_token / client_id / client_secret into the app's **Bridge** tab → **Test connection** → **Copy bridge credentials** → paste into the RCW assistant chat once.

### C. Install on your phone
Open the deployed URL → browser menu → **Add to Home screen** (becomes an app).

## Security model (why this is safe)
- No passwords anywhere. Google's OAuth consent screen controls access.
- The bridge credential is **scoped to YouTube channel management only** — it cannot touch Gmail, Drive, etc.
- **Revoke anytime**: myaccount.google.com → Security → Third-party access → RCW Bridge → Remove.
- Revoke right after an upload batch if you prefer.

## Files
- `index.html`, `app.js`, `manifest.webmanifest`, `icon-192.png`, `icon-512.png`
- `channel-bridge/` (PC helper): `auth.py`, `youtube_client.py`, `upload.py`

## Honest limits
- Videos produced are **slides + voiceover** (a standard training format). Live screen recording of a terminal isn't possible from a web page — for that, record with OBS and drop the MP4 to the assistant to upload.
- YouTube API quota: free tier ≈ 6 uploads/day.
