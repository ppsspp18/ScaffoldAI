# ScaffoldAI

A single-file, no-backend, no-install browser tool that turns AI chat responses into a real project on your
disk — and lets you keep editing that project with AI help afterwards.

## The problem it solves

When you ask an AI assistant (ChatGPT, Claude, Gemini, etc.) to build a project, you usually get a big wall of
chat text with lots of files mixed together. Turning that into an actual folder/file structure on your computer
is tedious and error-prone:

- You have to manually create every folder and file.
- You have to copy-paste each block of code into the right file, one by one.
- If you later want the AI to change a few files, you have to re-paste your *entire* project back into the
  chat just to give it context — often blowing past context limits or hitting copy-paste mistakes.
- There's no easy way to track exactly which files changed, or to apply an AI's edits back to your project
  without redoing everything by hand.

**ScaffoldAI solves this by acting as the "glue" between an AI chat and your local project folder.** It never
talks to an AI API itself — there's no backend and nothing is uploaded anywhere. Instead, it gives you ready-made
prompts to paste into whatever AI chat you're already using, turns the AI's structured JSON reply into a real
folder/file tree in your browser, and lets you save that tree straight to disk (or as a ZIP). For existing
projects, it can also load a real folder from your PC, help you build a "select these files as context" prompt
for the AI, and then write the AI's changes back to disk for you.

## How it works

ScaffoldAI has two modes, both reachable from `index.html`:

### 1. Create New Project (`create_project/create_project.html`)
For starting a brand-new project from scratch with AI help.

1. Copy the **Scaffold Prompt** shown on the page and paste it into your AI chat, along with a description of
   the project you want. Ask the AI to return **only** the folder/file structure as JSON (no code yet).
2. Paste that JSON into the **Paste Project Structure JSON** box and click **⚙️ Build Scaffold**.
   ScaffoldAI builds the full folder/file tree with an empty editor for every file.
3. Click through each file in the tree and ask the AI (file by file) for its code, then paste the code into
   the matching editor.
4. When you're done, either:
   - **💾 Export Project JSON** — save the whole project as a JSON file you can re-load later.
   - **🧷 Download ZIP** — download the real project as a ZIP archive.
   - **📁 Save to Folder** — write the project directly to a folder on your PC (uses your browser's File System
     Access API).

### 2. Update Your Project (`update_project/update_project.html`)
For continuing to work on a project you already have, with AI assistance.

1. Click **📥 Load Project from Folder** and pick your existing project's folder. ScaffoldAI reads every file
   and rebuilds the full tree with all content already filled in.
2. Use **2) Ask AI About Your Project** to get AI help with changes:
   - Tick the files (or whole folders) you want the AI to see in the **Project Tree**-style file selector, or
     just mention them inline as `@filename` in your message — they'll be auto-selected.
   - Type what you want changed and click **🧠 Generate AI Prompt**, then **📋 Copy Prompt** and paste it into
     your AI chat. (Or use **📄 Copy Files as Text** to just copy the raw file contents with no extra
     instructions.)
   - Once the AI replies, send it the **Sync Prompt** (copied via **📋 Copy Sync Prompt**) so it returns a
     structured JSON list of every file it created, edited, or deleted — no code yet, just the list.
   - Paste that JSON into **Step 3** and click **📝 Load Change List**. ScaffoldAI shows a box for each changed
     file.
   - Ask the AI for each file's actual code (one at a time works best) and paste it into the matching box.
   - Click **✅ Apply Changes to Project** to apply everything to your in-browser workspace.
3. In **3) Project Workspace**, browse the full **Project Tree**, open any file to view/edit it directly,
   add new files/folders (**📄+ New File** / **📁+ New Folder**), or delete items with the ✕ button.
4. Sync your work back out:
   - **🔗 Link PC Folder for Direct Sync** — link the project's real folder once, so changes can be written
     straight to disk.
   - **🔄 / 📁 Apply Changes to Folder** — writes back only what changed since the last sync (no full
     re-download needed).
   - **💾 Export Project JSON** or **🧷 Download ZIP** are also available for a full snapshot.

## Key ideas to remember

- **No AI API key, no backend.** ScaffoldAI itself doesn't talk to any AI — you always copy prompts into your
  own AI chat and paste its replies back in. Everything runs locally in your browser.
- **JSON is the contract.** The AI is always asked to return structured JSON (project structure, then a change
  list) so ScaffoldAI can reliably turn its answers into real files — code is pasted in manually afterward.
- **Nothing leaves your machine except what you copy into your AI chat yourself.** Folder access uses your
  browser's native File System Access API.

## Getting started

Just open `index.html` in a modern desktop browser (Chrome/Edge recommended for folder access) and choose
**Create New Project** or **Update Your Project**. Click the **?** help icon on either page at any time for a
quick step-by-step reminder.
