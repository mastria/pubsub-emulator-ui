# Contributing to PubSub Emulator UI

Thank you for considering contributing! All improvements and suggestions are welcome.

## Table of Contents

- [Code of Conduct](#code-of-conduct)
- [Getting Started](#getting-started)
- [How to Report a Bug](#how-to-report-a-bug)
- [How to Request a Feature](#how-to-request-a-feature)
- [How to Submit a Pull Request](#how-to-submit-a-pull-request)
- [Development Setup](#development-setup)
- [Coding Standards](#coding-standards)

---

## Code of Conduct

Please read our [Code of Conduct](CODE_OF_CONDUCT.md) before participating. We expect everyone to follow it in all interactions with this project.

---

## Getting Started

1. **Fork** the repository.
2. **Clone** your fork locally:
   ```bash
   git clone https://github.com/<your-username>/pubsub-emulator-ui.git
   cd pubsub-emulator-ui
   ```
3. Create a **feature branch** from `main`:
   ```bash
   git checkout -b feat/my-feature
   ```
4. Make your changes, commit, and push to your fork.
5. Open a **Pull Request** against the `main` branch of this repository.

---

## How to Report a Bug

- Search [existing issues](https://github.com/NeoScript/pubsub-emulator-ui/issues) first to avoid duplicates.
- If no issue exists, open one using the **Bug Report** template.
- Include steps to reproduce, expected behavior, actual behavior, and your environment (OS, Docker version, browser).

---

## How to Request a Feature

- Search [existing issues](https://github.com/NeoScript/pubsub-emulator-ui/issues) and the [roadmap](README.md) first.
- If it's not tracked, open an issue using the **Feature Request** template.
- Explain the problem you're trying to solve and why the feature would be useful.

---

## How to Submit a Pull Request

1. Ensure your branch is up to date with `main` before opening a PR.
2. Fill out the Pull Request template completely.
3. Keep PRs focused — one logical change per PR.
4. Make sure the Angular app builds without errors:
   ```bash
   cd webapp
   npm run build
   ```
5. If you add new behavior, include or update relevant tests.
6. Be responsive to review feedback.

---

## Development Setup

### Prerequisites

- [Docker](https://www.docker.com/) (recommended — uses the devcontainer)
- Or: Node.js ≥ 18, npm ≥ 9

### Steps

```bash
# Install dependencies
cd webapp
npm install

# Start the dev server (hot-reload enabled)
npm run start
```

The app will be available at `http://localhost:4200`.

For a full local stack (UI + PubSub emulator):
```bash
# From the repository root
docker compose up
```

---

## Coding Standards

- **Framework**: Angular 18 standalone components (`standalone: true`, no NgModules).
- **Control flow**: Use `@if` / `@for` — not `*ngIf` / `*ngFor`.
- **UI library**: Angular Material 18 — prefer existing components; no deprecated variants (e.g. no `mat-horizontal-stepper`).
- **State**: Managed in `PubsubService` — no NgRx; use `BehaviorSubject` / `Observable` patterns already established.
- **`LocalStorageService`**: All `localStorage` access must go through this service — no raw `localStorage` calls.
- **No new external libraries** — keep the bundle lean; raise an issue first if a dependency is truly needed.
- Commit messages should follow [Conventional Commits](https://www.conventionalcommits.org/):
  - `feat:`, `fix:`, `docs:`, `chore:`, `refactor:`
