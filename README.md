# RecallFlow

RecallFlow is a local-first iOS flashcards app designed around fast mobile deck creation, optional OpenAI-powered card generation, simple spaced repetition, focused study sessions, tags, search, CSV/JSON import/export, and clear progress stats.

## AI

RecallFlow supports hosted backend AI through `api/generate-cards.js`. Deploy the project to Vercel or another serverless host, set `OPENAI_API_KEY`, then set `VITE_RECALLFLOW_AI_ENDPOINT` to the deployed `/api/generate-cards` URL before building the iOS app. Users can still enter their own OpenAI API key as a fallback, and if AI is off or unavailable the app falls back to its local note-to-card builder.

Copy `.env.example` to `.env.local` for local/deploy configuration.

## iCloud sync

The iOS app includes a native `ICloudSync` Capacitor bridge backed by `NSUbiquitousKeyValueStore`. It syncs the RecallFlow library and non-sensitive settings across devices signed into iCloud. The user OpenAI API key is deliberately omitted from iCloud payloads. In Apple Developer/App Store setup, make sure the app identifier has iCloud key-value storage enabled.

## Privacy and support pages

The `public/privacy.html` and `public/support.html` files are included so the required App Store URLs can be hosted without buying another domain first. Deploy the web build to a free static host, replace `your-support-email@example.com` with the real support email, then use those hosted URLs in App Store Connect.

## Run

```sh
npm install
npm run dev
```

## Build

```sh
npm run build
```

## iOS

```sh
npm run ios
npm run ios:open
```

Bundle identifier: `com.recallflow.flashcards`

Before App Store submission, create public privacy/support URLs, set the support email and privacy URL in the app, create the App Store Connect record, fill privacy answers, add screenshots, and configure any subscriptions or one-time purchases.
