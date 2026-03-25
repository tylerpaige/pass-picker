# Pass Picker

A minimal desktop GUI for [zx2c4 pass](https://www.passwordstore.org/) built with Tauri v2, React, and Vite.

Pass Picker shells out to the `pass` CLI for all operations — it never touches your GPG keys or `.password-store` directly (beyond listing files).

## Features

- **Tree view** of your password store with collapsible folders
- **Fuzzy search** with Cmd+K shortcut
- **Decrypt & view** entries with masked password and reveal toggle
- **Copy to clipboard** with auto-clear after 45 seconds for passwords
- **TOTP codes** with circular countdown timer (via `pass otp`)
- **Create, edit, and delete** entries
- **Terminal-modern theme** — dark background, monospace font, neon accents

## Prerequisites

- [Rust](https://rustup.rs/)
- [Node.js](https://nodejs.org/)
- [pass](https://www.passwordstore.org/) (`brew install pass`)
- [pinentry-mac](https://github.com/GPGTools/pinentry-mac) (`brew install pinentry-mac`)
- GPG key configured for your password store

### GPG Agent Setup

Pass Picker launches as a macOS `.app` bundle without a TTY, so `gpg-agent` must use a GUI pinentry. Add this to `~/.gnupg/gpg-agent.conf`:

```
pinentry-program /opt/homebrew/bin/pinentry-mac
```

Then restart the agent:

```
gpgconf --kill gpg-agent
```

## Development

```bash
npm install
npm run tauri dev
```

## Build

```bash
npm run tauri build
```

The built app and `.dmg` will be in `src-tauri/target/release/bundle/`.

## Project Structure

```
src/                        # React frontend
├── App.tsx                 # Main shell + view routing
├── App.css                 # Terminal-modern theme
├── components/
│   ├── Sidebar.tsx         # Folder tree + search
│   ├── EntryView.tsx       # Decrypt, view, copy
│   ├── EntryEditor.tsx     # Create/edit entries
│   ├── OtpDisplay.tsx      # TOTP with countdown
│   └── SearchBar.tsx       # Fuzzy filter (Cmd+K)
└── lib/
    └── pass.ts             # Tauri invoke wrappers

src-tauri/
├── tauri.conf.json
└── src/
    └── lib.rs              # Tauri commands (pass CLI wrappers)
```
