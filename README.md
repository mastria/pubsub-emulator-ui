# PubSub Emulator UI

A visual UI for the [Google Cloud PubSub emulator](https://cloud.google.com/pubsub/docs/emulator) — manage topics and subscriptions, publish messages, inspect payloads, and visualize your project topology, all from the browser.

## Features

- **Topics & subscriptions** — create, delete, and browse topics and subscriptions. Existing resources are loaded automatically from the emulator when you open a project.
- **Publisher** — publish single messages or batches, with ordering key support, named templates (saved to `localStorage`), and a publish history panel.
- **Message inspector** — pull messages into a sortable, paginated table with JSON syntax highlighting, expandable metadata (message ID, publish time, delivery attempt, attributes), and one-click copy for payloads and IDs.
- **Search & filters** — real-time full-text search on decoded payloads, independent attribute key/value filters, matched term highlighting, and filter state persisted per subscription.
- **Flow graph view** — inline SVG topology showing topics and their subscriptions. Click any node to navigate to it. On-demand backlog badge per subscription (non-destructive peek).
- **Notes** — attach a local note to any topic or subscription; indicator icons in the list rows show which resources have notes.
- **Ack All** — acknowledge all pulled messages in a single action.
- **Auto-pull** — configurable polling interval that stops automatically when the subscription changes or the panel is closed.

## Quickstart

```bash
docker run -p 4200:80 ghcr.io/mastria/pubsub-emulator-ui:latest
```

Open [http://localhost:4200](http://localhost:4200), add your project ID, and your existing topics and subscriptions will load automatically.

For a full stack with the emulator included, use the [`docker-compose.yml`](https://github.com/mastria/pubsub-emulator-ui/blob/main/docker-compose.yml) at the root of this repo.

### Environment variables

| Variable | Description |
|---|---|
| `DEFAULT_PUBSUB_EMULATOR_HOST` | Sets the emulator host on startup (e.g. `http://localhost:8681`) |
| `AUTO_ATTACH_PUBSUB_PROJECTS` | Comma-separated list of project IDs to attach automatically |

```bash
docker run -p 4200:80 \
  -e DEFAULT_PUBSUB_EMULATOR_HOST=http://localhost:8681 \
  -e AUTO_ATTACH_PUBSUB_PROJECTS=my-project,other-project \
  ghcr.io/mastria/pubsub-emulator-ui:latest
```

## Setting Up For Development

1. Clone the repository
    ```bash
    git clone https://github.com/mastria/pubsub-emulator-ui.git
    cd pubsub-emulator-ui
    ```

2. Install dependencies and start the dev server
    ```bash
    cd webapp
    npm install
    npm run start
    ```

3. (Optional) Spin up the emulator via docker-compose
    ```bash
    docker-compose up pubsub-emulator
    ```

The app will be available at [http://localhost:4200](http://localhost:4200) with live reload.

---

### Motivations
 - The Google Cloud PubSub emulator has no official visual tooling
 - An existing project ([gcp-pubsub-emulator-ui](https://github.com/echocode-io/gcp-pubsub-emulator-ui)) was limited to pulling one message at a time with no publisher or management features

---

LICENSE: MIT — all improvements and suggestions are welcome!
