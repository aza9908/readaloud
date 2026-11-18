# Bookser on WhatsApp

Phase 0 is a local reading simulator for a parent and up to four fictional readers. It runs with zero credentials. The two stories come from Bookser’s existing seed library. «Батыл қоян» has five Kazakh pages and «Репка» has six Russian pages.

## Try a reading turn

Use Node 20.19 or later and run the following from the repository root.

```sh
npm ci
npm run whatsapp:dev
```

Open [the local simulator](http://127.0.0.1:4286). Choose a chat language, complete the fictional consent form and add a reader. You can choose a different language for the reader. In **Voice-note lab**, send **With missed words**. Change the sample to **Full page** and send it again to see the improvement. **Replay last delivery** submits the same message ID and earns zero additional coins. The menu in the chat header switches readers. **Delete demo family** erases their records.

To make a single file you can open in a browser without a server, run the following command. The exported demo keeps its session in memory until the tab reloads. It embeds the books, character art and scripts.

```sh
npm run whatsapp:export -- bookser-whatsapp.html
```

## What runs today

- The local webhook accepts Meta-shaped message batches. It verifies the challenge and raw-body HMAC, saves an inbound job, and acknowledges delivery before the worker transcribes it. The worker handles repeat deliveries and retries transient failures three times in total. A single local process saves queue state and receipts together with the family update using an atomic file replacement in `whatsapp/.local/`. Restarting on the same port resumes outstanding jobs.
- The parent chooses Kazakh or Russian and records versioned demo consent. The optional cross-border choice is separate. Readers have individual books, progress, coins and streaks. Free text receives a fixed reply. Command examples include «Тоқта» or «Стоп» for reminders and «Жою» or «Удалить» for deletion. Reminders are off in this milestone.
- A replaceable mock transcriber takes an editable sample transcript and duration. The aligner compares words across the whole page, recognises common Kazakh approximations, and marks up to five words to practise. The child sees a highlighted image, encouragement and stars. The parent panel shows correctly read words per minute. The **Listen** action uses an installed local voice in the reading language when available and always displays the text.
- A qualifying first read earns a daily bonus. Better attempts earn the difference between reward tiers. The daily cap is 200 coins per reader and the day boundary is midnight in Almaty. Completing a book gives its bonus once. The simulated wallet is local. **Open Bookser** opens the existing web app with its normal sign-in.
- Both simulator versions share the same state machine and scoring code. Server mode also exercises signature verification, durable queuing and restart recovery. The standalone file delivers events in memory. Neither mode needs a microphone, a phone number or a speech service.

```sh
npm run test:whatsapp
```

For manual local webhook fixtures, set `WA_VERIFY_TOKEN` to a local value of your choice and `WA_APP_SECRET` to a separate test value before starting the server. Otherwise it generates ephemeral values. Use GET `/webhook` for the verification challenge and POST `/webhook` for signed message batches. The HMAC input is the exact request body. The simulator generates signatures on the server. Unknown media IDs return a retry prompt. The signed fixtures support `sample-perfect` and `sample-practice` after demo onboarding.

## When you are ready for Meta

1. Register as a Meta developer. Create an app, choose **Connect with customers through WhatsApp**, then select or create a business portfolio. Under **API Setup**, connect the WhatsApp Business Account for the test. [Meta’s setup guide](https://developers.facebook.com/documentation/business-messaging/whatsapp/get-started)
2. Select the test number, generate a temporary access token and add your own WhatsApp number as the test recipient. Keep the phone number ID and WhatsApp Business Account ID for the integration. You can send your first test message from the dashboard. [Meta’s first-message walkthrough](https://developers.facebook.com/documentation/business-messaging/whatsapp/get-started)
3. For the pilot webhook, deploy an HTTPS endpoint, choose its verification token, and subscribe the app to **messages** on the test account. Keep the Meta app secret and access token in the server’s secret store. The app secret verifies inbound notifications. The access token authorizes outbound Graph API calls. A system user token is an option for a longer-running integration. [Meta webhook verification](https://developers.facebook.com/docs/graph-api/webhooks/getting-started/) · [Meta’s Cloud API collection](https://www.postman.com/meta/whatsapp-business-platform/collection/wlk6lh4/whatsapp-cloud-api)

## First pilot milestone

Complete one turn on a personal test phone with a real voice note and a scored reply. That requires a Cloud API sender and media downloader, a Kazakh/Russian speech recognizer, and an image format accepted by the media API. Live message delivery and speech recognition quality still need to be measured on devices.

Before inviting families, arrange review of both consent translations and the Kazakhstan hosting and retention plan. The local JSON store is for fictional data. The pilot also needs a durable multi-worker queue, a reviewed library, a single-use Firebase sign-in handoff and a shared reward ledger. The current web app and the WhatsApp PRD use different reward rules.
