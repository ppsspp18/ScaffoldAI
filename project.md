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
├── update_project/
│   ├── update_project.html     # Page HTML
│   ├── update_project.js       # Page-specific UI logic
│   ├── update_project.css      # Page styles
│   └── app.js                  # Shared core engine (duplicated)
└── todo_project/
    ├── todo_project.html       # Page HTML
    ├── todo_project.js         # Page-specific UI logic
    ├── todo_project.css        # Page styles (extends update_project.css)
    └── app.js                  # Shared core engine (duplicated)
```

`app.js` is the entire business logic — duplicated identically in all three directories. It handles everything: data model, tree rendering, editor, JSON validation, ZIP generation, File System Access API, AI prompt generation, export/import, manual file/folder creation & deletion, and the To-Do Plan feature.

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
- `planData` — the loaded to-do plan (`{ planTitle, steps: [{ id, title, description, files }] }`), only used on the To-Do Plan page
- `completedStepIds` — a `Set` of step `id`s the user has checked off, used both for the progress bar and to mark steps `[DONE]` in later step prompts

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

### Update Your Project — To-Do Plan

A dedicated page (`todo_project.html`) for tasks too large for a single AI response — e.g. "add authentication across the whole app." It reuses the same Load Project / Project Workspace / Apply Changes machinery as Update Your Project, but replaces the freeform "Ask AI About Your Project" question with a **plan-then-execute** flow:

1. **Generate Plan Prompt** (`generatePlanPromptFlow()` → `buildPlanPrompt()`) — the user describes the overall task; ScaffoldAI builds a prompt (embedding the project structure) instructing the AI to **not write code yet**, but instead return an ordered, JSON-structured to-do list, where each step is small enough to implement in one response and lists the exact files it touches. The user copies this prompt into any AI chat.
2. **Load Plan** (`loadPlanFlow()` → `validatePlanData()`) — the user pastes the AI's JSON reply back in. It's validated against the schema `{ planTitle, steps: [{ id, title, description, files }] }` and rendered as a checklist (`renderPlan()`).
3. **Per-step prompts** (`buildStepPrompt()` / `copyStepPrompt()`) — each checklist item has a "Copy Step Prompt" button. The generated prompt is fully self-contained so it can be pasted into a **brand-new** AI conversation with no prior context, and includes:
   - The full plan, with each step marked `[THIS STEP]`, `[DONE]`, or `[NOT DONE YET]`
   - A summary of steps already completed
   - The project structure
   - This step's own title/description
   - The **current, live content** of every file this step lists — which automatically reflects any edits made while completing earlier steps, since it's read straight from `fileContents` at copy time (no separate "previous step output" tracking needed)
   - The same "always output full file content, never diffs" instructions used elsewhere
4. **Apply the step's changes** — same Sync Prompt → paste change list → paste code → "Apply Changes to Project" flow as Update Your Project, so the resulting code actually lands in the workspace and on disk.
5. **Track progress** — each checklist item has a checkbox (`completedStepIds`); checking it off updates the progress bar (`updatePlanProgress()`) and causes that step to show as `[DONE]` (with its description as completed-so-far context) in every subsequent step's prompt.

`resetPlanUI()` clears the plan whenever the project itself is reset, rebuilt, or reloaded (called alongside `resetAskAiUI()` in all four of those code paths), so a stale plan never survives a project swap.

## Manual File & Folder Management

Present only on the Update Your Project page (`update_project.html`), gated in `app.js` by the presence of the `newFileBtn` / `newFolderBtn` elements (`enableTreeManagement`), so `create_project.html` is unaffected:

- **New File** (`createNewFileFlow()`) — prompts for a relative path (e.g. `src/utils/helpers.js`), rejects the path if something already exists there, inserts an empty file node into the structure (creating any missing parent folders along the way via `insertFileIntoStructure()`), and opens it in the editor.
- **New Folder** (`createNewFolderFlow()`) — prompts for a relative path (e.g. `src/components`), rejects the path if something already exists there, and inserts the folder chain via `insertFolderIntoStructure()`.
- **Delete** (`deleteNodeFlow()`) — a ✕ button appears on hover for every tree node (file or folder). Deleting a folder recursively removes it and all descendant files from `fileContents` (via `collectFileDescendants()`) after a confirmation dialog that warns the action can't be undone.
- **Disk sync** — if a PC folder is linked (`linkedProjectDirHandle`, set via "Load Project from Folder" or "Link PC Folder for Direct Sync"), creates and deletes are mirrored to disk immediately using `ensureDirPathOnDisk()` and `deleteEntryFromDisk()` (the latter uses `removeEntry({ recursive: true })` for folders). If no folder is linked, the change stays in-memory until the user exports/saves.

## AI Prompts

Two hardcoded prompts in `app.js`, plus two dynamically-built ones for the To-Do Plan workflow:
- **SCAFFOLD_PROMPT** — instructs AI to return only a JSON project structure (used in Create workflow)
- **SYNC_PROMPT** — instructs AI to return a JSON list of created/edited/deleted files (used in Update and To-Do Plan workflows)
- **Plan prompt** (`buildPlanPrompt()`) — built per-task, not hardcoded, since it embeds the live project structure and the user's task description; instructs the AI to return a JSON to-do list instead of code (To-Do Plan workflow)
- **Step prompt** (`buildStepPrompt()`) — built per-step, embedding the full plan, completed-so-far context, project structure, and the live content of that step's files (To-Do Plan workflow)

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

Dark theme (`#0f172a` base, `#38bdf8` accent) using CSS custom properties. Responsive grid layout for the tree + editor workspace. No CSS framework. `update_project.css` and `todo_project.css` additionally include the `.load-options` grid and `.node-delete-btn` hover styling. `todo_project.css` further extends `update_project.css` with `.plan-*` classes for the checklist, progress bar, and per-step file chips.
