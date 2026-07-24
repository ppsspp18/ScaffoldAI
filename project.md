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

`app.js` is the entire business logic — duplicated identically in both directories. It handles everything: data model, tree rendering, editor, JSON validation, ZIP generation, File System Access API, AI prompt generation, export/import, and manual file/folder creation & deletion.

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
2. AI returns a JSON structure (folders/files only, no code), user pastes it → validated recursively by `parseProjectJson()` / `validateNode()` in `app.js`
3. Visual tree rendered via `buildTree()` with expand/collapse folders
4. Each file gets a textarea editor; user pastes code
5. Export: ZIP (via JSZip CDN), JSON snapshot, or write to real folder via File System Access API

### Update Your Project

1. **Load from Folder** — `window.showDirectoryPicker()` reads all files (skipping `.git`, `node_modules`, etc.) via `traverseDirectoryForImport()`. The folder becomes a "linked" project for direct sync.
2. **Load from JSON** — Previously exported `.json` file loaded via file input
3. User browses/edits files, and can:
   - **Manually manage files and folders** — the Project Workspace toolbar has **New File** and **New Folder** buttons (`createNewFileFlow()` / `createNewFolderFlow()`), which prompt for a relative path, insert the node into `projectData.structure`, and (if a folder is linked for direct sync) create it on disk immediately. Every tree node also shows a hover-revealed ✕ delete button (`deleteNodeFlow()`) that removes a file, or a folder and everything inside it, from the in-memory project and — if linked — from disk, after a confirmation prompt.
   - Use the **Ask AI** section:
     - Select files (checkboxes or `@filename` mentions)
     - Write a question → generates a rich prompt with project structure + file contents
     - AI responds, user asks it to return a change list JSON
     - Paste the change list → `loadChangeList()` parses it and shows diffs
     - User pastes new file code → "Apply Changes to Project" (`applyAIChanges()`) updates in-memory state
     - "Apply Changes to Folder" (`pushChangesToFolder()`) writes only changed files to disk (compares against `lastSyncedSnapshot`)

Both the manual create/delete flow and the AI-driven apply flow funnel through a shared `rebuildWorkspaceView()` helper, which re-renders the tree, stats, file-select list, and editor from the current `projectData` / `fileContents` state.

## Manual File & Folder Management

Present only on the Update Your Project page (`update_project.html`), gated in `app.js` by the presence of the `newFileBtn` / `newFolderBtn` elements (`enableTreeManagement`), so `create_project.html` is unaffected:

- **New File** (`createNewFileFlow()`) — prompts for a relative path (e.g. `src/utils/helpers.js`), rejects the path if something already exists there, inserts an empty file node into the structure (creating any missing parent folders along the way via `insertFileIntoStructure()`), and opens it in the editor.
- **New Folder** (`createNewFolderFlow()`) — prompts for a relative path (e.g. `src/components`), rejects the path if something already exists there, and inserts the folder chain via `insertFolderIntoStructure()`.
- **Delete** (`deleteNodeFlow()`) — a ✕ button appears on hover for every tree node (file or folder). Deleting a folder recursively removes it and all descendant files from `fileContents` (via `collectFileDescendants()`) after a confirmation dialog that warns the action can't be undone.
- **Disk sync** — if a PC folder is linked (`linkedProjectDirHandle`, set via "Load Project from Folder" or "Link PC Folder for Direct Sync"), creates and deletes are mirrored to disk immediately using `ensureDirPathOnDisk()` and `deleteEntryFromDisk()` (the latter uses `removeEntry({ recursive: true })` for folders). If no folder is linked, the change stays in-memory until the user exports/saves.

## AI Prompts

Two hardcoded prompts in `app.js`:
- **SCAFFOLD_PROMPT** — instructs AI to return only a JSON project structure (used in Create workflow)
- **SYNC_PROMPT** — instructs AI to return a JSON list of created/edited/deleted files (used in Update workflow)

## File System Access API

Used for direct disk read/write (Chromium-only):
- `showDirectoryPicker()` — pick a folder
- `getDirectoryHandle()` / `getFileHandle()` — navigate/create entries
- `createWritable()` — write file content
- `removeEntry()` (with `{ recursive: true }` for folders) — delete files/folders
- `queryPermission()` / `requestPermission()` — permission management

Buttons that require this API are disabled with a tooltip in unsupported browsers.

## ZIP Export

JSZip (v3.10.1, loaded from CDN) builds a ZIP by recursively walking the project structure. The blob is downloaded via `URL.createObjectURL()` + a dynamically created anchor element.

## Dependencies

**External**: JSZip 3.10.1 (`cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js`)

**None**: No npm, no bundler, no TypeScript, no backend, no database, no auth.

## CSS Architecture

Dark theme (`#0f172a` base, `#38bdf8` accent) using CSS custom properties. Responsive grid layout for the tree + editor workspace. No CSS framework. `update_project.css` additionally includes the `.load-options` grid and `.node-delete-btn` hover styling used only on the Update Your Project page.
