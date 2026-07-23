# Project Technical Overview

## Architecture

ScaffoldAI is a **static multi-page web application** with no backend, no build step, and no package manager. It consists of two workflows sharing a core JavaScript engine:

```
index.html  (landing page)
├── create_project/
│   ├── create_project.html     # Page HTML
│   ├── create_project.js       # Page-specific UI logic
│   ├── create_project.css      # Page styles
│   └── app.js                  # Shared core engine
└── update_project/
    ├── update_project.html     # Page HTML
    ├── update_project.js       # Page-specific UI logic
    ├── update_project.css      # Page styles
    └── app.js                  # Shared core engine (duplicated)
```

`app.js` (~1300 lines) is the entire business logic — duplicated identically in both directories. It handles everything: data model, tree rendering, editor, JSON validation, ZIP generation, File System Access API, AI prompt generation, and export/import.

## Data Model

The app revolves around a JSON schema:

```json
{
  "projectName": "my-app",
  "structure": [
    { "type": "folder", "name": "src", "children": [
      { "type": "file", "name": "main.py" }
    ]},
    { "type": "file", "name": "README.md" }
  ]
}
```

In-memory state is held in globals:
- `projectData` — parsed JSON (name + structure tree)
- `fileContents` — `{ "path/to/file.ext": "content" }` mapping
- `fileList` — flat array of `{ path, name }` for all files
- `selectedFilePath` — currently open file
- `savedDirHandle` / `linkedProjectDirHandle` — File System Access API directory handles
- `lastSyncedSnapshot` — clone of `fileContents` used for incremental sync diffing

## Key Workflows

### Create New Project

1. User copies the built-in scaffold prompt and pastes it to an AI chat
2. AI returns a JSON structure (folders/files only, no code), user pastes it → validated recursively by `buildStructure()` in `app.js`
3. Visual tree rendered via `buildTree()` with expand/collapse folders
4. Each file gets a textarea editor; user pastes code
5. Export: ZIP (via JSZip CDN), JSON snapshot, or write to real folder via File System Access API

### Update Your Project

1. **Load from Folder** — `window.showDirectoryPicker()` reads all files (skipping `.git`, `node_modules`, etc.) via `handleDirectoryPicker()`. The folder becomes a "linked" project for direct sync.
2. **Load from JSON** — Previously exported `.json` file loaded via file input
3. User browses/edits files, then can use the **Ask AI** section:
   - Select files (checkboxes or `@filename` mentions)
   - Write a question → generates a rich prompt with project structure + file contents
   - AI responds, user asks it to return a change list JSON
   - Paste the change list → `applyChanges()` parses it and shows diffs
   - User pastes new file code → "Apply Changes to Project" updates in-memory state
   - "Apply Changes to Folder" writes only changed files to disk (compares against `lastSyncedSnapshot`)

## AI Prompts

Two hardcoded prompts in `app.js`:
- **SCAFFOLD_PROMPT** — instructs AI to return only a JSON project structure (used in Create workflow)
- **SYNC_PROMPT** — instructs AI to return a JSON list of created/edited/deleted files (used in Update workflow)

## File System Access API

Used for direct disk read/write (Chromium-only):
- `showDirectoryPicker()` — pick a folder
- `getDirectoryHandle()` / `getFileHandle()` — navigate/create entries
- `createWritable()` — write file content
- `removeEntry()` — delete files
- `queryPermission()` / `requestPermission()` — permission management

Buttons that require this API are disabled with a tooltip in unsupported browsers.

## ZIP Export

JSZip (v3.10.1, loaded from CDN) builds a ZIP by recursively walking the project structure. The blob is downloaded via `URL.createObjectURL()` + a dynamically created anchor element.

## Dependencies

**External**: JSZip 3.10.1 (`cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js`)

**None**: No npm, no bundler, no TypeScript, no backend, no database, no auth.

## CSS Architecture

Dark theme (`#0f172a` base, `#38bdf8` accent) using CSS custom properties. Responsive grid layout for the tree + editor workspace. No CSS framework.
