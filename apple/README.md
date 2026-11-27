# Bookser for Apple devices

The **Bookser** scheme builds a SwiftUI app for iPhone, iPad and native Mac. The reading room opens immediately on iPhone and in narrow iPad windows. A sidebar holds parent access and the online app in wider iPad windows and on Mac. Native controls follow the system language in English, Kazakh and Russian.

## Run in Xcode

If you received **Bookser for Xcode.zip**, unzip it, open the included `apple/Bookser.xcodeproj`, select a destination and run. The archive already includes the offline HTML. The Node steps below are for a source checkout or refreshing that resource.

From the repository root, use the project's Node environment and export the self-contained reading room.

```sh
npm ci
npm run whatsapp:export -- apple/Resources/reading-room.html
open apple/Bookser.xcodeproj
```

Choose the **Bookser** scheme, select an iPhone, iPad or **My Mac**, and run. The minimum systems are iOS/iPadOS 16 and macOS 13. Install the appropriate simulator runtime in Xcode to run a simulated device. For a physical iPhone or iPad, choose a signing team and an available bundle identifier in the target’s Signing & Capabilities settings.

After changing the simulator or its assets, export the HTML again. The Xcode build phase packages that file into the app and checks that it was built in offline mode.

## Build a local Mac preview

On a Mac with Apple Command Line Tools, Node and the repository dependencies installed, the following command builds a local app for the Mac’s processor. Run it from the repository root and choose a fresh output path.

```sh
sh apple/build-macos-preview.sh ./apple/build/Bookser.app
open ./apple/build/Bookser.app
```

The script exports the current reading room, compiles Swift against the local macOS SDK, includes localizations and icons, and verifies an ad-hoc signature. Its output is intended for local use. Distribution through TestFlight or outside the local Mac requires the corresponding Apple signing and distribution process.

## Reading and parent access

The bundled room contains the existing Kazakh and Russian sample stories, synthetic voice-note scoring, and the PIN-protected parent area. Each window keeps its demo family in memory. Closing or reloading the window ends that session. **Open Bookser online** opens the hosted reading app in the system browser for account sign-in and live microphone reading.

The embedded WebKit view grants file access to the bundled HTML alone. Its content policy disables network requests, and only a user-activated Bookser website link can open externally. The app uses an ephemeral WebKit data store. Only the reading room handles the parent PIN. On app inactivity the native window covers the reading surface, clears PIN input and closes the parent area.
