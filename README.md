# ScaffoldAI

ScaffoldAI is a lightning-fast, client-side web tool designed to help developers package their project structure and source file contents into clean, structured text ready to paste into any AI chat.

## Features

- **100% Client-Side:** No backend server required, no data uploaded to external servers. Everything runs locally in your browser using the modern File System Access API with folder fallback.
- **Project Structure Export:** Quickly copy the folder and file hierarchy tree to give AI models instant layout awareness.
- **Selective File Copying:** Browse the full project tree, select specific files or folders, and copy their full contents (formatted with file paths) as plain text.
- **Ignored Patterns:** Automatically skips common build directories, dependencies, and lock files (e.g., `node_modules`, `.git`, `dist`, `.DS_Store`) to keep context clean.
- **Search & Filter:** Easily filter through files within your project tree.
- **Customizable Output:** Copy structure only, or bundle file contents.

## Project Structure

```text
├── index.html       # Main application UI and layout
├── style.css        # Modern, clean styling with dark/light theme accents
└── app.js           # Core logic for directory reading, tree rendering, and clipboard actions
```

## Getting Started

Because ScaffoldAI is built entirely with vanilla web technologies, no build steps or installation are required:

1. Clone or download this repository.
2. Open `index.html` directly in any modern web browser, or serve it via a local static server (e.g., `npx serve .`).
3. Click **Load Project from Folder** and choose your project directory.
