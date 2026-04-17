# Discord Timezone Board (Netlify + Firebase)

This starter gives you a **single pinned timezone board** in one Discord channel.

It is built as a **Discord interactions app** hosted on **Netlify Functions**, with the board state stored in **Firebase Firestore**.

## What this starter does

- Keeps one pinned board message in one channel
- Refreshes the times every minute with a Netlify Scheduled Function
- Shows these launch zones by default:
  - Seoul
  - PT
  - CT
  - ET
  - MT
  - India
  - Morocco
  - Auckland
  - France
  - Shanghai
- Keeps **Bulgaria** available as a disabled future zone that can be added later
- Uses DST-aware IANA time zones, so regions like PT / CT / ET / MT automatically show the correct seasonal time for the current date
- Uses your requested display rules:
  - `1:00–11:59 AM -> h:mm AM`
  - `12:00–12:59 AM -> h:mm AM midnight`
  - `1:00–11:59 PM -> h:mm PM`
  - `12:00–12:59 PM -> h:mm PM afternoon`
- Lets authorized users:
  - add zones
  - remove zones
  - add members under a zone
  - remove members from a zone
  - refresh the board immediately

## Important limitation

This is a **message-based board**, not a fully custom webpage inside chat.
So the layout is an approximation using a Discord embed with inline fields and message components.

## Files

| File | Purpose |
|---|---|
| `index.html` | simple Netlify landing page |
| `netlify.toml` | Netlify functions config + 1-minute schedule |
| `netlify/functions/interactions.js` | Discord endpoint for commands and buttons |
| `netlify/functions/refresh-board.js` | scheduled 1-minute redraw |
| `lib/firebase.js` | Firebase Admin initialization |
| `lib/store.js` | Firestore board persistence |
| `lib/discord.js` | Discord REST helpers |
| `lib/board.js` | board layout + zone catalog |
| `lib/time.js` | custom time formatting |
| `lib/permissions.js` | admin/mod permission checks |
| `scripts/register-commands.js` | one-time slash-command registration |
| `firestore.rules` | deny-all default rules |

## 1. Create the Firebase project

1. Create a Firebase project.
2. Enable **Cloud Firestore**.
3. Generate a **service account JSON key**.
4. Put the full JSON into the Netlify environment variable `FIREBASE_SERVICE_ACCOUNT_JSON`.

### Firestore document shape

Collection: `boards`
Document: `main`

The bot writes a document shaped roughly like this:

```json
{
  "title": "Timezone Board",
  "guildId": "...",
  "channelId": "...",
  "messageId": "...",
  "adminRoleIds": ["..."],
  "cards": [
    {
      "id": "seoul",
      "label": "Seoul",
      "tz": "Asia/Seoul",
      "enabled": true,
      "order": 1,
      "members": ["123456789012345678"]
    }
  ],
  "lastRenderedAt": "2026-04-03T10:00:00.000Z"
}
```

## 2. Create the Discord application

In the Discord Developer Portal:

1. Create a new application.
2. Add a bot.
3. Copy these values:
   - Application ID
   - Bot Token
   - Public Key
4. Enable installation into your server.
5. Give the bot these permissions in the target channel:
   - View Channel
   - Send Messages
   - Read Message History
   - Use External Emojis (optional)
   - **Pin Messages**

## 3. Set Netlify environment variables

Set these in Netlify:

- `DISCORD_APPLICATION_ID`
- `DISCORD_BOT_TOKEN`
- `DISCORD_PUBLIC_KEY`
- `DISCORD_OWNER_ID` (optional but recommended)
- `DISCORD_GUILD_ID` (optional; use this for instant guild-scoped slash commands while testing)
- `FIREBASE_SERVICE_ACCOUNT_JSON`
- `FIREBASE_PROJECT_ID` (optional if the service account JSON already includes it)

For local testing, copy `.env.example` to `.env`.

## 4. Install and run locally

```bash
npm install
npm run register-commands
npm run dev
```

If you use `netlify dev`, the local interactions endpoint will normally be:

```text
http://localhost:8888/.netlify/functions/interactions
```

## 5. Set the Interactions Endpoint URL in Discord

Set Discord's **Interactions Endpoint URL** to:

```text
https://YOUR-NETLIFY-SITE.netlify.app/.netlify/functions/interactions
```

Discord will verify the endpoint against your public key.

## 6. Initialize the board in Discord

Run this command **inside the exact channel that should contain the board**:

```text
/board-init
```

That creates the board message, stores its channel/message IDs in Firestore, and pins it.

## Slash commands included

- `/board-init`
- `/board-refresh`
- `/board-admin-role-add role:@Role`
- `/board-admin-role-remove role:@Role`

## Control model on the board

Buttons on the board:

- Add Zone
- Remove Zone
- Add Member
- Remove Member
- Refresh

## Permission model

A user can manage the board if **any** of these are true:

- their ID matches `DISCORD_OWNER_ID`
- they have `Administrator`
- they have `Manage Server`
- they have `Manage Channels`
- their role is in `adminRoleIds`

## Notes on mentions

This starter renders member mentions **inside embed fields**. That is intentional.
It is the least noisy way to keep the board readable while avoiding repeated explicit pings from normal refresh edits.

If you later decide you want hard pings on purpose, move the mentions into message content and control `allowed_mentions` more aggressively.

## Testing the scheduled function

Netlify scheduled functions only run automatically on **published deploys**.
Locally, use Netlify's invoke flow for testing, or trigger the function manually in the Netlify UI after deployment.

## Recommended deployment order

1. Upload this project to GitHub or deploy it directly to Netlify.
2. Set all Netlify environment variables.
3. Deploy.
4. Set the Discord interactions endpoint URL.
5. Run `npm run register-commands`.
6. In Discord, run `/board-init` in the target channel.

## If the board stops updating

Most common causes:

- the board message was deleted manually
- the bot lost **Pin Messages** or **Send Messages** permissions
- the Firestore service account env var is malformed
- the scheduled function is not running because the site is not on a published deploy
- the interactions endpoint URL is wrong

## Future changes you may want later

- multiple separate boards
- per-zone color settings
- manual drag order for zones
- server-specific board documents instead of a single `boards/main` doc
- a real web admin page
