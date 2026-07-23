# ScaffoldAI

Bridge the gap between AI-generated code and real file system projects. No backend, no install — everything runs in your browser.

## Features

- **Create New Project** — Paste a JSON project structure from ChatGPT, Claude, Gemini, etc., and ScaffoldAI builds a visual folder/file tree with a dedicated editor for each file
- **Update Your Project** — Load an existing project from disk or JSON, browse/edit files, ask AI for changes, and sync back to disk
- **Export** — Download as ZIP, export as JSON snapshot, or write directly to a real folder using the File System Access API
- **Works offline** — Fully client-side, no server, no dependencies beyond a browser

## Getting Started

1. Clone or download this repo
2. Open `index.html` in Chrome or Edge (for full File System Access API support)
3. Choose **Create New Project** or **Update Your Project**

## How It Works

- **Create workflow**: Copy the built-in scaffold prompt, ask an AI for a JSON folder structure, paste it in, build the scaffold, paste code into each file, then export
- **Update workflow**: Load a folder or saved JSON, browse files, ask AI for changes using the built-in prompt generator, paste the AI's change list back, review and apply

## Tech Stack

Vanilla JavaScript, HTML5, CSS3. Single dependency: JSZip (loaded via CDN for ZIP exports).

## Browser Support

Chrome or Edge recommended. File System Access API is required for direct folder read/write operations.
