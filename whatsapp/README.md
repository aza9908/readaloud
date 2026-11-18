# Bookser on WhatsApp

Phase 0 is a local reading simulator for a parent and up to four fictional readers. It runs with zero credentials. The two stories come from Bookser’s existing seed library. «Батыл қоян» has five Kazakh pages and «Репка» has six Russian pages.

## Try a reading turn

Use Node 20.19 or later and run the following from the repository root.

```sh
npm ci
npm run whatsapp:dev
```

Open [the local reading room](http://127.0.0.1:4286). Choose a chat language, complete the fictional consent form and set a four-digit demo parent PIN. Add a reader and choose their reading language. Send the sample with missed words twice, then send the full page to see the improvement. Replaying a delivery submits the same message ID and earns zero additional coins.

Open **Ата-анаға** or **Родителям** and enter the PIN to see that reader’s activity calendar, reading time, words read, completed books, accuracy and speed. The report compares the last seven Almaty dates with the previous seven. It suggests a word to practise after difficulty on two separate scored attempts. Families created in the previous demo choose a PIN on their first parent visit. Dated statistics start with the first scored reading in this version.

To make a single file you can open in a browser without a server, run the following command. The exported demo keeps its session in memory until the tab reloads. It embeds the books, character art and scripts.

```sh
npm run whatsapp:export -- bookser-whatsapp.html
```

## What runs today

- The local webhook accepts Meta-shaped message batches. It verifies the challenge and raw-body HMAC, saves an inbound job, and acknowledges delivery before the worker transcribes it. The worker handles repeat deliveries and retries transient failures three times in total. A single local process saves queue state and receipts together with the family update using an atomic file replacement in `whatsapp/.local/`. Restarting on the same port resumes outstanding jobs.
- The interface takes its colours, typography, corners and shadows from Bookser’s Tailwind configuration. It includes the Page Pal guide, a dark theme, adjustable reading text and separate reader and parent views.
- Server mode owns scoring, page progression, rewards, reports and access checks. The backend imports the web reader’s normalization, word matching, karaoke struggle detection, speed calculation and book difficulty code. Whole-page alignment also handles words omitted at the end and hyphenated words spoken in parts. The child sees encouragement and up to five marked words. **Listen** uses an installed local voice when available.
- The parent PIN follows Bookser’s five-attempt lockout, one-minute cooldown and ten-minute unlock. In server mode the backend stores a salted hash, checks access for every private operation and returns a limited child view. Closing or hiding the parent sheet clears the private report. The PIN is a child lock for a fictional family on a shared device. A live pilot needs authenticated parent ownership and recovery.
- A weekly report notice is opt-in in the parent panel. If the simulator runs on Sunday during the 19:00 hour in Almaty, it shows a generic local notification once that week. The report itself stays behind the PIN. «Тоқта» or «Стоп» disables notices. «Жою» or «Удалить» opens the parent deletion flow. A confirmed deletion erases the family, its reports, review items and pending deliveries.
- Free text outside the reading commands gets a fixed response. The mock uses synthetic transcripts. Provider adapters must declare their processing region. A cross-border adapter requires separate parent consent and an unknown region prevents the call. A flagged sample or provider response skips scoring and awards. Its time appears in the private parent follow-up list until acknowledged. This exercises routing with test flags. A staffed review service and a validated flagging provider belong to the pilot.
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
