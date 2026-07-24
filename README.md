# ScaffoldAI

Bridge the gap between AI-generated code and real file system projects. No backend, no install — everything runs in your browser.

## Features

- **Create New Project** — Paste a JSON project structure from ChatGPT, Claude, Gemini, etc., and ScaffoldAI builds a visual folder/file tree with a dedicated editor for each file
- **Update Your Project** — Load an existing project from disk or JSON, browse/edit files, add or delete files and folders directly in the workspace, ask AI for changes, and sync back to disk
- **Update Your Project — To-Do Plan** — For tasks too big for a single AI response: describe the goal, get the AI to plan it as a JSON to-do list first, then let ScaffoldAI turn every step into a complete, standalone prompt (full plan context, progress so far, and the right files already attached) that you can paste into any AI conversation, one step at a time, with checkboxes to track progress
- **Manual file/folder management** — On the Update Your Project pages, use **New File** / **New Folder** to add items anywhere in the tree, and the ✕ button on any tree item to delete a file or an entire folder (with confirmation). Changes are written straight to disk automatically if a project folder is linked
- **Export** — Download as ZIP, export as JSON snapshot, or write directly to a real folder using the File System Access API
- **Works offline** — Fully client-side, no server, no dependencies beyond a browser

## Getting Started

1. Clone or download this repo
2. Open `index.html` in Chrome or Edge (for full File System Access API support)
3. Choose **Create New Project**, **Update Your Project**, or **Update Your Project — To-Do Plan**

## How It Works

- **Create workflow**: Copy the built-in scaffold prompt, ask an AI for a JSON folder structure, paste it in, build the scaffold, paste code into each file, then export
- **Update workflow**: Load a folder or saved JSON, browse files, create or delete files/folders as needed, ask AI for changes using the built-in prompt generator, paste the AI's change list back, review and apply
- **To-Do Plan workflow**: Load a folder or saved JSON, describe a large task, copy the generated plan prompt into an AI chat to get back a JSON to-do list, paste it in to see a checklist, then for each step click **Copy Step Prompt** — paste it into a fresh AI conversation, apply the resulting code with the Sync Prompt + change list, and check the step off before moving to the next one

## Tech Stack

Vanilla JavaScript, HTML5, CSS3. Single dependency: JSZip (loaded via CDN for ZIP exports).

## Browser Support

Chrome or Edge recommended. File System Access API is required for direct folder read/write operations (including disk sync for manually created/deleted files and folders).
