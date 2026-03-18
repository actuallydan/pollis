# Pollis

A desktop messaging app with end-to-end encryption. Think Slack, but nobody (including me) can read your messages. Built with Tauri 2 — native app on macOS/Linux/Windows with a Rust backend and React frontend.

![Pollis App](readme/app.png)

## How it works

The desktop app runs locally with a React frontend talking to a Rust (Tauri) backend. Messages are encrypted using the Signal protocol before they leave your machine. The backend connects directly to Turso (libSQL) for group/channel metadata, and stores encrypted messages in a local SQLite database.

**Stack:**
- Desktop: Tauri 2 (Rust + React/TypeScript)
- Local storage: SQLite via rusqlite
- Remote DB: Turso (libSQL) — direct connection, no middleman server
- Auth: Email OTP, session in OS keystore
- Encryption: Signal Protocol (Ed25519, X3DH, Double Ratchet)

## Getting Started

### What you need

- Node.js 18+
- pnpm 10.25+
- Rust (stable, via rustup)
- Tauri v2 system dependencies — see [tauri.app/start/prerequisites](https://tauri.app/start/prerequisites/)
- An age key for decrypting secrets (ask the project owner)

### Setup

```bash
# Install JS dependencies
pnpm install

# Decrypt secrets → .env.development
pnpm secrets:decrypt
```

### Running

```bash
# Run the desktop app
pnpm dev

# Run frontend in browser only (no Tauri commands available)
pnpm dev:frontend
```

### Testing with two users

Run two app instances pointing at different home directories so each gets its own OS keystore, local DB, and session:

```bash
# Terminal 1 — user A
pnpm dev

# Terminal 2 — user B
HOME=/tmp/pollis-user2 pnpm dev
```

Sign into different email accounts in each window. Both hit the same Turso database, so anything one user writes the other can read (manually refresh until realtime is wired up).

### Building

```bash
# Build for current platform
pnpm build

# Platform-specific
pnpm build:linux    # amd64
pnpm build:macos    # universal binary (Intel + Apple Silicon)
pnpm build:windows  # amd64
```

## Project layout

```
src-tauri/   # Rust backend (Tauri commands, DB, crypto)
frontend/    # React app (Vite, TypeScript, TailwindCSS)
website/     # Next.js marketing site
```
