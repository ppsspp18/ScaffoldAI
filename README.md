# ScaffoldAI

ScaffoldAI is a browser-based project scaffolding and file management tool for LLM-driven development workflows. It helps you turn an AI-generated folder/file structure into a working editable project workspace, manage file contents, save projects locally, import existing projects from disk, and sync AI-suggested file changes back into your project.

It is designed for a **manual AI workflow**:

* Ask an LLM to generate a **project structure JSON**
* Build the scaffold in ScaffoldAI
* Paste code into generated files manually, or import an existing folder
* Ask AI about selected files
* Apply AI-suggested changes back into the project
* Export as JSON, ZIP, or save directly to a local folder

---

# Features

## 1. Scaffold generation from LLM JSON

ScaffoldAI accepts a JSON description of a project structure and automatically builds:

* a project tree
* a file list
* a file editor workspace
* project stats (files/folders/project name)

It expects JSON in this format:

```json
{
  "projectName": "my-app",
  "structure": [
    {
      "type": "folder",
      "name": "src",
      "children": [
        { "type": "file", "name": "main.py" }
      ]
    },
    { "type": "file", "name": "README.md" }
  ]
}
```

---

## 2. File-by-file editing workspace

Once the scaffold is built, ScaffoldAI creates:

* a **project tree view** on the left
* a **file editor** on the right
* search for file paths
* copy/clear file content actions

Each file in the scaffold gets an in-memory content buffer so you can paste or edit code manually.

---

## 3. AI prompt generation for selected files

ScaffoldAI can generate a context-rich prompt for ChatGPT, Claude, Gemini, or another LLM by combining:

* the project name
* the project folder/file structure
* selected file contents
* your instruction or question

You can:

* tick files manually from the file selection list
* mention files in your message using `@filename` or `@path/to/file.ext`
* generate a prompt containing only the relevant files and project structure

This lets you ask an LLM to modify or create files with full project context.

---

## 4. AI change-list workflow

After the AI answers normally, ScaffoldAI provides a **Sync Prompt** that asks the AI to return a JSON list of changed files only, using this format:

```json
{
  "changes": [
    { "action": "edit", "path": "src/app.js" },
    { "action": "create", "path": "src/utils/helpers.js" },
    { "action": "delete", "path": "old/file.txt" }
  ]
}
```

ScaffoldAI then:

1. loads the AI’s change list
2. creates a UI for each changed file
3. lets you paste the final code manually for each created/edited file
4. applies those changes to the in-memory project
5. optionally syncs them directly to a linked local folder

---

## 5. Export and persistence options

ScaffoldAI supports multiple ways to save or move your project:

### Export Project JSON

Exports the full ScaffoldAI project state, including:

* project name
* structure
* all file contents

This can be loaded back later inside ScaffoldAI.

### Download ZIP

Builds a ZIP archive of the current project in the browser using **JSZip**.

### Save to Folder

Uses the **File System Access API** to write the project directly into a folder on your computer.

### Load Saved Project JSON

Loads a previously exported ScaffoldAI JSON file and restores:

* project structure
* file contents
* workspace state

---

## 6. Load an existing local project folder

ScaffoldAI can import an existing project directly from your computer using the **File System Access API**.

When you choose **Load Project from Folder**, ScaffoldAI:

* recursively walks the selected folder
* builds the folder/file structure automatically
* reads file contents into memory
* skips common heavy folders like `node_modules`, `.git`, `dist`, `build`, etc.
* links that folder for direct sync if write permission is granted

This means you can use ScaffoldAI not only for AI-generated projects, but also for existing local codebases.

---

## 7. Direct folder sync / incremental updates

ScaffoldAI supports writing only the changed files back to disk instead of re-exporting the whole project every time.

There are two related flows:

### Apply Changes to Folder

This compares the current in-memory project with the last synced snapshot and writes only:

* newly created files
* edited files
* deleted files

### Apply Changes to Project

This is used after the AI change-list workflow. It updates the in-memory project and, if a folder is linked, also writes those changes directly to the linked project folder on disk.

---

# How the project works technically

## Architecture overview

ScaffoldAI is a **single-page frontend-only application** built with:

* **HTML** for structure
* **CSS** for layout and styling
* **Vanilla JavaScript** for all application logic
* **JSZip** for ZIP generation in the browser
* **File System Access API** for reading/writing folders directly on the user’s machine

There is **no backend** and no database. Everything runs in the browser.

---

## Core data model

The application revolves around a few in-memory JavaScript objects:

### `projectData`

Stores the current scaffold/project metadata:

```js
{
  projectName: "project-name",
  structure: [ ... ]
}
```

### `fileContents`

A map of file path → content:

```js
{
  "src/main.py": "print('hello')",
  "README.md": "# My Project"
}
```

### `fileList`

A flat list of files used for:

* file selection
* searching
* `@filename` matching
* rendering the tree editor interactions

### `pendingChanges`

Stores the parsed AI change-list before those changes are applied to the project.

### `linkedProjectDirHandle` / `savedDirHandle`

These store directory handles returned by the browser’s **File System Access API** so ScaffoldAI can write back to a local folder without forcing a new folder picker every time.

### `lastSyncedSnapshot`

A snapshot of the project’s file contents at the last successful disk sync. This is used to compute incremental changes and avoid rewriting every file.

---

## Main technical workflow

## A. Scaffold build flow

When the user pastes scaffold JSON and clicks **Build Scaffold**:

1. `parseProjectJson(raw)` parses and validates the JSON.
2. `validateNode()` recursively checks that:

   * each node has `type`
   * type is either `folder` or `file`
   * folders use `children`
   * files do not use `children`
3. `collectFilesAndFolders()` traverses the structure to:

   * count files and folders
   * populate `fileList`
   * initialize empty `fileContents[path]`
4. `buildTree()` renders the project tree in the UI.
5. Workspace state and counters are refreshed.

This turns a plain JSON scaffold into an interactive file editor workspace.

---

## B. File editing flow

When a file is clicked in the tree:

1. `openFile(path)` sets the selected file
2. `renderEditor(path)` creates a textarea for that file
3. edits are written into `fileContents[path]` on input
4. `syncCurrentEditorToMemory()` ensures the latest editor content is preserved before switching files or exporting

No file is written to disk automatically at this stage. Everything stays in memory until the user exports, saves, or syncs.

---

## C. AI prompt generation flow

When the user selects files and asks a question:

1. `generateAIPrompt()` gathers:

   * the project name
   * a text version of the project structure
   * manually selected files
   * files mentioned with `@filename`
   * the user’s question
2. It generates a single prompt string that includes:

   * scaffold context
   * file contents
   * instructions for the AI to return full code for modified files
3. That prompt can be copied and pasted into ChatGPT, Claude, Gemini, etc.

This is how ScaffoldAI turns the current workspace into an LLM-ready context package.

---

## D. AI sync / apply changes flow

After the external AI has responded and the user asks it for a structured change list:

1. The user pastes the JSON into **Step 3 — Paste the AI’s change list**
2. `loadChangeList()` parses and validates each change:

   * `edit`
   * `create`
   * `delete`
3. `renderChangeList()` creates UI blocks for each change:

   * textareas for edited/created files
   * delete confirmation checkboxes for deleted files
4. The user pastes the final code for each changed file
5. `applyAIChanges()`:

   * inserts new files into the structure if needed
   * updates `fileContents`
   * removes deleted files from both structure and content map
   * rebuilds the tree
   * updates stats and file selection UI
   * optionally writes changes to a linked folder on disk

This is the main bridge between an external LLM conversation and the actual project state in ScaffoldAI.

---

## E. Import project from local folder

When the user clicks **Load Project from Folder**:

1. the browser shows a directory picker via `window.showDirectoryPicker()`
2. `traverseDirectoryForImport()` recursively walks the folder
3. directories listed in `EXCLUDED_DIR_NAMES` are skipped
4. text files are read into `importedFileContents`
5. a scaffold `structure` array is built from the real folder tree
6. the project is loaded into the workspace as if it had been built from JSON
7. if write permission is granted, the folder becomes the linked sync target and `lastSyncedSnapshot` is initialized

This allows ScaffoldAI to act as a lightweight project explorer/editor for real projects, not just AI-generated ones.

---

## F. Save to folder / disk sync flow

### Save to Folder

`saveProjectToFolder()`:

1. asks the user for a parent folder
2. creates a child folder named after `projectData.projectName`
3. recursively writes the full structure using `writeNodesToDirectory()`

This is a full project export to disk.

### Apply Changes to Folder

`pushChangesToFolder()`:

1. compares `fileContents` against `lastSyncedSnapshot`
2. determines:

   * which files need to be written
   * which files need to be deleted
3. writes only the changed files with `writeFileToDisk()`
4. deletes removed files with `deleteFileFromDisk()`
5. refreshes `lastSyncedSnapshot`

This is an incremental sync system rather than a full rewrite.

---

# File structure

## `main.html`

Defines the UI structure of the app:

* hero section
* scaffold prompt area
* JSON input
* workspace area
* file tree and editor
* AI prompt / sync workflow panels
* action buttons for export, folder loading, ZIP, sync, etc.

It also loads:

* `style.css`
* `script.js`
* `JSZip` from CDN

---

## `script.js`

Contains the entire application logic, including:

* scaffold prompt and sync prompt constants
* DOM references
* scaffold JSON parsing and validation
* tree rendering
* editor rendering and file-content memory management
* export/import logic
* ZIP creation
* AI prompt generation
* AI change-list parsing and application
* folder import and folder sync logic
* File System Access API integration
* toast notifications and UI helpers

This is the main engine of ScaffoldAI.

---

## `style.css`

Contains all visual styling for:

* layout grids
* cards and panels
* buttons and form controls
* tree UI
* editor UI
* prompt boxes
* change-list UI
* folder sync status pills
* responsive layout behavior

The styling uses a dark theme with a card-based interface.

---

# How to use ScaffoldAI

## Option 1 — Start from an LLM-generated scaffold

### Step 1: Ask an LLM for your project structure

Use the built-in **Scaffold Prompt** in ScaffoldAI. Paste it into ChatGPT, Claude, Gemini, etc. and ask it to return only the project folder/file structure as JSON.

Example output:

```json
{
  "projectName": "todo-app",
  "structure": [
    {
      "type": "folder",
      "name": "src",
      "children": [
        { "type": "file", "name": "main.js" },
        { "type": "file", "name": "utils.js" }
      ]
    },
    { "type": "file", "name": "README.md" }
  ]
}
```

### Step 2: Build the scaffold

Paste that JSON into **Paste Project Structure JSON** and click **Build Scaffold**.

ScaffoldAI will generate:

* the project tree
* editor entries for every file
* file/folder stats

### Step 3: Fill files with code

Open files from the project tree and paste code into them manually.

You can do this by asking your AI model things like:

```txt
Now generate the content for src/main.js only. Return only code.
```

Repeat file by file until your project is populated.

### Step 4: Export or save

Once your project is ready, you can:

* **Export Project JSON** for later use in ScaffoldAI
* **Download ZIP**
* **Save to Folder** directly on your PC

---

## Option 2 — Load an existing local project

If you already have a project on your machine:

1. Click **Load Project from Folder**
2. Pick the folder
3. ScaffoldAI will import the folder structure and file contents automatically
4. Edit files inside ScaffoldAI
5. Use **Apply Changes to Folder** to write only changed files back to disk

---

## Option 3 — Ask AI to update selected files

Use the **Ask AI About Your Files** section.

### Step 1: Select files

Tick the files you want the AI to see.

You can also mention files in your prompt using:

* `@app.js`
* `@src/main.py`

ScaffoldAI will auto-detect those references.

### Step 2: Write your request

Example:

```txt
Please refactor @script.js so the folder sync logic is cleaner and easier to maintain.
```

### Step 3: Generate the AI prompt

Click **Generate AI Prompt**.

ScaffoldAI will build a prompt containing:

* the project structure
* selected file contents
* your request

Copy that prompt and paste it into your AI tool.

### Step 4: Get the AI’s normal answer

Let the AI answer with explanations and code.

### Step 5: Ask for a change list

Copy ScaffoldAI’s **Sync Prompt** and send it to the AI so it returns a structured JSON change list.

### Step 6: Paste the change list into ScaffoldAI

Paste the returned JSON into **Step 3 — Paste the AI’s change list** and click **Load Change List**.

### Step 7: Paste the code for each changed file

ScaffoldAI will show one input box per created/edited file and delete confirmations for removed files.

Paste the final code into each box.

### Step 8: Apply changes

Click **Apply Changes to Project**.

ScaffoldAI will:

* update the project structure
* update file contents
* remove deleted files
* optionally sync changes directly to the linked folder on disk

---

# Browser support

Some features depend on the **File System Access API**, which is supported mainly in Chromium-based browsers such as:

* Google Chrome
* Microsoft Edge
* Brave

These features may not work in browsers without File System Access support:

* **Save to Folder**
* **Load Project from Folder**
* **Apply Changes to Folder**
* **Link PC Folder for Direct Sync**

ScaffoldAI detects this and disables those buttons when unsupported.

---

# Limitations

## 1. No backend / no cloud storage

ScaffoldAI does not store projects remotely. Everything is local to the browser session unless you export or save it.

## 2. AI changes are still manual at the code level

The change-list workflow is semi-automated, not fully automatic:

* AI returns a list of changed file paths
* you still paste the actual code for each file manually

This is deliberate, because it gives you control over what enters the project.

## 3. Binary files are not a primary target

Folder import is optimized for text/code projects. Large or binary files may not import meaningfully.

## 4. Browser capability matters

Direct folder reading/writing depends on browser support and granted permissions.

---

# Suggested workflow

A practical way to use ScaffoldAI is:

1. Describe your project idea to ChatGPT or another LLM
2. Ask it for the scaffold JSON using the built-in scaffold prompt
3. Build the scaffold in ScaffoldAI
4. Generate code file-by-file with the AI and paste it into the relevant files
5. Save the project to a local folder
6. When you want to make changes later:

   * load the project folder back into ScaffoldAI
   * select relevant files
   * ask the AI for updates
   * apply the AI’s change list
   * sync the changed files back to disk

This keeps the workflow transparent and controllable while still making LLM-assisted project generation much faster.

---

# Summary

ScaffoldAI is essentially a **local AI-assisted scaffold manager** for code projects. Technically, it combines:

* JSON-based scaffold generation
* an in-browser file tree + editor
* AI prompt assembly for selected files
* structured change application
* ZIP export
* local folder import/export
* incremental disk sync through the File System Access API

It is useful when you want to use ChatGPT/Claude/Gemini as a coding assistant but still keep tight control over:

* project structure
* file contents
* what gets written to disk
* how AI-generated changes are merged into your project
