const SCAFFOLD_PROMPT = `You are generating a project scaffold.

Return ONLY valid JSON.
Do not include markdown.
Do not include explanations.
Do not include code content.
Do not include comments.
Do not wrap in triple backticks.

Task:
Create the full project folder/file structure for the project I asked for.

Rules:
1. Return only the project structure.
2. Include all folders and files needed for a clean implementation.
3. Do not include file contents.
4. Use this exact JSON schema:

{
  "projectName": "project-name",
  "structure": [
    {
      "type": "folder",
      "name": "folder-name",
      "children": []
    },
    {
      "type": "file",
      "name": "file-name.ext"
    }
  ]
}

Important:
- Every item must have type = "folder" or "file"
- Folders must use "children"
- Files must not use "children"
- Output must be valid JSON only`;

const SYNC_PROMPT = `Now output a JSON object listing every file you created, edited, or deleted in this conversation — paths only, no code.

Do not include any explanation, prose, or markdown fences. Output ONLY the JSON.

Use exactly this schema:

{
  "changes": [
    { "action": "edit", "path": "relative/path/to/file.ext" },
    { "action": "create", "path": "relative/path/to/newfile.ext" },
    { "action": "delete", "path": "relative/path/to/file-to-remove.ext" }
  ]
}

Rules:
- "action" must be exactly "edit", "create", or "delete".
- Do NOT include a "content" field — I will paste the code in myself for each file.
- Use forward-slash relative paths that match the project structure I gave you earlier.
- Include one entry per changed file. Do not include files you did not touch.
- Return ONLY the JSON object. No markdown code fences, no commentary.`;

const SAMPLE_JSON = {
  "projectName": "scaffold-demo",
  "structure": [
    {
      "type": "folder",
      "name": "src",
      "children": [
        { "type": "file", "name": "main.py" },
        {
          "type": "folder",
          "name": "utils",
          "children": [
            { "type": "file", "name": "helpers.py" }
          ]
        }
      ]
    },
    {
      "type": "folder",
      "name": "templates",
      "children": [
        { "type": "file", "name": "index.html" }
      ]
    },
    {
      "type": "folder",
      "name": "static",
      "children": [
        { "type": "file", "name": "styles.css" },
        { "type": "file", "name": "app.js" }
      ]
    },
    { "type": "file", "name": "README.md" },
    { "type": "file", "name": "requirements.txt" }
  ]
};

const promptBox = document.getElementById("promptBox");
const copyPromptBtn = document.getElementById("copyPromptBtn");
const jsonInput = document.getElementById("jsonInput");
const buildBtn = document.getElementById("buildBtn");
const loadSampleBtn = document.getElementById("loadSampleBtn");
const resetBtn = document.getElementById("resetBtn");

const workspace = document.getElementById("workspace");
const workspaceEmpty = document.getElementById("workspaceEmpty");
const treeRoot = document.getElementById("treeRoot");
const editorContainer = document.getElementById("editorContainer");
const editorFile = document.getElementById("editorFile");

const statProject = document.getElementById("statProject");
const statFiles = document.getElementById("statFiles");
const statFolders = document.getElementById("statFolders");

const copyFileContentBtn = document.getElementById("copyFileContentBtn");
const clearFileBtn = document.getElementById("clearFileBtn");
const saveProjectBtn = document.getElementById("saveProjectBtn");
const loadProjectBtn = document.getElementById("loadProjectBtn");
const projectLoader = document.getElementById("projectLoader");
const downloadZipBtn = document.getElementById("downloadZipBtn");
const saveToFolderBtn = document.getElementById("saveToFolderBtn");
const importFromFolderBtn = document.getElementById("importFromFolderBtn");
const pushChangesBtn = document.getElementById("pushChangesBtn");
const folderStatusPill = document.getElementById("folderStatusPill");
const fileSearch = document.getElementById("fileSearch");
const clearSearchBtn = document.getElementById("clearSearchBtn");

const fileSelectList = document.getElementById("fileSelectList");
const aiQuestion = document.getElementById("aiQuestion");
const generatePromptBtn = document.getElementById("generatePromptBtn");
const copyGeneratedPromptBtn = document.getElementById("copyGeneratedPromptBtn");
const generatedPromptBox = document.getElementById("generatedPromptBox");
const syncPromptBox = document.getElementById("syncPromptBox");
const copySyncPromptBtn = document.getElementById("copySyncPromptBtn");
const aiChangesJsonInput = document.getElementById("aiChangesJsonInput");
const loadChangeListBtn = document.getElementById("loadChangeListBtn");
const changeListContainer = document.getElementById("changeListContainer");
const changeListItems = document.getElementById("changeListItems");
const linkSyncFolderBtn = document.getElementById("linkSyncFolderBtn");
const syncFolderStatusPill = document.getElementById("syncFolderStatusPill");
const applyChangesBtn = document.getElementById("applyChangesBtn");

let generatedPrompt = "";
let pendingChanges = [];
let linkedProjectDirHandle = null;
let lastSyncedSnapshot = null; // { path: content } as of the last successful disk sync

const toast = document.getElementById("toast");

let projectData = null;
let fileContents = {};
let fileList = [];
let selectedFilePath = null;

// Handle to the last directory the user picked for "Save to Folder", so
// repeat saves (after editing more files) can reuse it without re-prompting.
let savedDirHandle = null;

const supportsFileSystemAccess = "showDirectoryPicker" in window;

promptBox.textContent = SCAFFOLD_PROMPT;
if(syncPromptBox) syncPromptBox.textContent = SYNC_PROMPT;

if(!supportsFileSystemAccess && saveToFolderBtn){
  saveToFolderBtn.disabled = true;
  saveToFolderBtn.title = "Not supported in this browser. Try Chrome, Edge, or another Chromium-based browser.";
}
if(!supportsFileSystemAccess && importFromFolderBtn){
  importFromFolderBtn.disabled = true;
  importFromFolderBtn.title = "Not supported in this browser. Try Chrome, Edge, or another Chromium-based browser.";
}
if(!supportsFileSystemAccess && pushChangesBtn){
  pushChangesBtn.disabled = true;
  pushChangesBtn.title = "Not supported in this browser. Try Chrome, Edge, or another Chromium-based browser.";
}

function showToast(message){
  toast.textContent = message;
  toast.classList.add("show");
  clearTimeout(showToast._t);
  showToast._t = setTimeout(() => toast.classList.remove("show"), 2400);
}

async function copyText(text, successMessage="Copied"){
  try{
    await navigator.clipboard.writeText(text);
    showToast(successMessage);
  }catch{
    showToast("Clipboard copy failed");
  }
}

function syncCurrentEditorToMemory(){
  if(!selectedFilePath) return;
  const textarea = editorContainer.querySelector("textarea");
  if(textarea){
    fileContents[selectedFilePath] = textarea.value;
  }
}

copyPromptBtn.addEventListener("click", () => {
  copyText(SCAFFOLD_PROMPT, "Scaffold prompt copied");
});

loadSampleBtn.addEventListener("click", () => {
  jsonInput.value = JSON.stringify(SAMPLE_JSON, null, 2);
  showToast("Sample JSON loaded");
});

resetBtn.addEventListener("click", () => {
  if(!confirm("Reset ScaffoldAI and clear the current scaffold + file contents?")) return;
  projectData = null;
  fileContents = {};
  fileList = [];
  selectedFilePath = null;
  savedDirHandle = null;
  updateFolderStatusPill();
  linkedProjectDirHandle = null;
  updateSyncFolderStatusPill();
  lastSyncedSnapshot = null;
  jsonInput.value = "";
  treeRoot.innerHTML = "";
  editorContainer.innerHTML = `
    <div class="empty-state" style="min-height:520px">
      Select a file from the tree to paste its code or text content.
    </div>
  `;
  editorFile.textContent = "No file selected";
  workspace.classList.add("hidden");
  workspaceEmpty.classList.remove("hidden");
  updateStats();

  aiQuestion.value = "";
  aiChangesJsonInput.value = "";
  pendingChanges = [];
  changeListItems.innerHTML = "";
  changeListContainer.classList.add("hidden");
  generatedPrompt = "";
  generatedPromptBox.textContent = 'Select files, type your message, and click "Generate AI Prompt".';
  renderFileSelectList();

  showToast("Scaffold reset");
});

function validateNode(node, path="root"){
  if(!node || typeof node !== "object"){
    throw new Error(`Invalid node at ${path}`);
  }
  if(!node.type || !["folder","file"].includes(node.type)){
    throw new Error(`Invalid type at ${path}`);
  }
  if(!node.name || typeof node.name !== "string"){
    throw new Error(`Missing/invalid name at ${path}`);
  }
  if(node.type === "folder"){
    if(node.children && !Array.isArray(node.children)){
      throw new Error(`children must be array at ${path}/${node.name}`);
    }
    (node.children || []).forEach((child, idx) => validateNode(child, `${path}/${node.name}[${idx}]`));
  } else {
    if("children" in node){
      throw new Error(`File cannot have children at ${path}/${node.name}`);
    }
  }
}

function parseProjectJson(raw){
  let data;
  try{
    data = JSON.parse(raw);
  }catch{
    throw new Error("Invalid JSON format");
  }

  if(!data.projectName || typeof data.projectName !== "string"){
    throw new Error("projectName is required");
  }
  if(!Array.isArray(data.structure)){
    throw new Error("structure must be an array");
  }

  data.structure.forEach((node, idx) => validateNode(node, `structure[${idx}]`));
  return data;
}

function collectFilesAndFolders(nodes, basePath=""){
  let files = 0;
  let folders = 0;

  nodes.forEach(node => {
    const currentPath = basePath ? `${basePath}/${node.name}` : node.name;
    if(node.type === "folder"){
      folders++;
      const res = collectFilesAndFolders(node.children || [], currentPath);
      files += res.files;
      folders += res.folders;
    }else{
      files++;
      fileList.push({ path: currentPath, name: node.name });
      if(!(currentPath in fileContents)) fileContents[currentPath] = "";
    }
  });

  return { files, folders };
}

function updateStats(files=0, folders=0){
  statProject.textContent = projectData?.projectName || "—";
  statFiles.textContent = files;
  statFolders.textContent = folders;
}

function updateFolderStatusPill(){
  if(!folderStatusPill) return;
  if(savedDirHandle){
    folderStatusPill.textContent = `📁 Linked: ${savedDirHandle.name}`;
    folderStatusPill.classList.remove("hidden");
  }else{
    folderStatusPill.classList.add("hidden");
  }
}

function renderFileSelectList(){
  if(!fileSelectList) return;
  fileSelectList.innerHTML = "";

  if(!fileList.length){
    fileSelectList.innerHTML = `<div class="small">Build a scaffold first to select files.</div>`;
    return;
  }

  fileList.forEach(f => {
    const row = document.createElement("label");
    row.className = "file-select-item";

    const cb = document.createElement("input");
    cb.type = "checkbox";
    cb.className = "file-select-checkbox";
    cb.dataset.path = f.path;

    const span = document.createElement("span");
    span.textContent = f.path;

    row.append(cb, span);
    fileSelectList.appendChild(row);
  });
}

function buildTree(nodes, parentEl, basePath=""){
  nodes.forEach(node => {
    const li = document.createElement("li");
    const currentPath = basePath ? `${basePath}/${node.name}` : node.name;

    const nodeDiv = document.createElement("div");
    nodeDiv.className = `tree-node ${node.type}`;
    nodeDiv.dataset.path = currentPath;

    const icon = document.createElement("span");
    icon.className = "icon";
    icon.textContent = node.type === "folder" ? "📁" : "📄";

    const name = document.createElement("span");
    name.className = "node-name";
    name.textContent = node.name;

    nodeDiv.append(icon, name);
    li.appendChild(nodeDiv);

    if(node.type === "file"){
      nodeDiv.addEventListener("click", () => {
        openFile(currentPath);
      });
    }else{
      const childrenUl = document.createElement("ul");
      childrenUl.className = "tree-children";
      buildTree(node.children || [], childrenUl, currentPath);
      li.appendChild(childrenUl);
    }

    parentEl.appendChild(li);
  });
}

function refreshTreeActiveState(){
  document.querySelectorAll(".tree-node.file").forEach(el => {
    el.classList.toggle("active", el.dataset.path === selectedFilePath);
  });
}

function renderEditor(path){
  const content = fileContents[path] || "";
  editorContainer.innerHTML = "";

  const label = document.createElement("div");
  label.className = "small";
  label.textContent = "Paste or edit the content for this file.";

  const textarea = document.createElement("textarea");
  textarea.value = content;
  textarea.placeholder = `Paste content for ${path} here...`;

  textarea.addEventListener("input", () => {
    fileContents[path] = textarea.value;
  });

  editorContainer.append(label, textarea);
}

function openFile(path){
  syncCurrentEditorToMemory();
  selectedFilePath = path;
  editorFile.textContent = path;
  renderEditor(path);
  refreshTreeActiveState();
}

buildBtn.addEventListener("click", () => {
  const raw = jsonInput.value.trim();
  if(!raw){
    showToast("Paste JSON first");
    return;
  }

  try{
    syncCurrentEditorToMemory();
    const parsed = parseProjectJson(raw);
    projectData = parsed;
    fileContents = {};
    fileList = [];
    selectedFilePath = null;
    savedDirHandle = null;
    updateFolderStatusPill();
    treeRoot.innerHTML = "";

    const { files, folders } = collectFilesAndFolders(parsed.structure);
    buildTree(parsed.structure, treeRoot);

    workspaceEmpty.classList.add("hidden");
    workspace.classList.remove("hidden");
    editorFile.textContent = "No file selected";
    editorContainer.innerHTML = `
      <div class="empty-state" style="min-height:520px">
        Select a file from the tree to paste its code or text content.
      </div>
    `;

    updateStats(files, folders);
    renderFileSelectList();
    aiQuestion.value = "";
    aiChangesJsonInput.value = "";
    pendingChanges = [];
    changeListItems.innerHTML = "";
    changeListContainer.classList.add("hidden");
    generatedPrompt = "";
    generatedPromptBox.textContent = 'Select files, type your message, and click "Generate AI Prompt".';
    lastSyncedSnapshot = null;
    showToast("Scaffold built successfully");
  }catch(err){
    showToast(err.message || "Failed to build scaffold");
  }
});

copyFileContentBtn.addEventListener("click", () => {
  if(!selectedFilePath){
    showToast("Select a file first");
    return;
  }
  syncCurrentEditorToMemory();
  copyText(fileContents[selectedFilePath] || "", "File content copied");
});

clearFileBtn.addEventListener("click", () => {
  if(!selectedFilePath){
    showToast("Select a file first");
    return;
  }
  if(!confirm(`Clear content of ${selectedFilePath}?`)) return;
  fileContents[selectedFilePath] = "";
  renderEditor(selectedFilePath);
  showToast("File content cleared");
});

function exportProjectState(){
  syncCurrentEditorToMemory();
  return {
    app: "ScaffoldAI",
    version: 1,
    projectName: projectData?.projectName || "",
    structure: projectData?.structure || [],
    fileContents: { ...fileContents }
  };
}

saveProjectBtn.addEventListener("click", () => {
  if(!projectData){
    showToast("No project loaded");
    return;
  }

  const data = exportProjectState();
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `${projectData.projectName || "scaffold-project"}-scaffoldai.json`;
  a.click();
  URL.revokeObjectURL(a.href);
  showToast("Project JSON exported");
});

loadProjectBtn.addEventListener("click", () => {
  projectLoader.click();
});

projectLoader.addEventListener("change", async (e) => {
  const file = e.target.files[0];
  if(!file) return;

  try{
    const text = await file.text();
    const data = JSON.parse(text);

    if(!data.projectName || !Array.isArray(data.structure) || typeof data.fileContents !== "object"){
      throw new Error("Invalid ScaffoldAI project file");
    }

    data.structure.forEach((node, idx) => validateNode(node, `structure[${idx}]`));

    projectData = {
      projectName: data.projectName,
      structure: data.structure
    };
    fileContents = data.fileContents || {};
    fileList = [];
    selectedFilePath = null;
    savedDirHandle = null;
    updateFolderStatusPill();
    treeRoot.innerHTML = "";

    const { files, folders } = collectFilesAndFolders(projectData.structure);
    buildTree(projectData.structure, treeRoot);

    workspaceEmpty.classList.add("hidden");
    workspace.classList.remove("hidden");
    editorFile.textContent = "No file selected";
    editorContainer.innerHTML = `
      <div class="empty-state" style="min-height:520px">
        Select a file from the tree to edit its content.
      </div>
    `;

    updateStats(files, folders);
    renderFileSelectList();
    aiQuestion.value = "";
    aiChangesJsonInput.value = "";
    pendingChanges = [];
    changeListItems.innerHTML = "";
    changeListContainer.classList.add("hidden");
    generatedPrompt = "";
    generatedPromptBox.textContent = 'Select files, type your message, and click "Generate AI Prompt".';
    lastSyncedSnapshot = null;
    showToast("Saved project loaded");
  }catch(err){
    showToast(err.message || "Failed to load project");
  }finally{
    projectLoader.value = "";
  }
});

fileSearch.addEventListener("input", () => {
  const q = fileSearch.value.trim().toLowerCase();
  const nodes = document.querySelectorAll(".tree-node");

  nodes.forEach(node => {
    const path = (node.dataset.path || "").toLowerCase();
    if(!q){
      node.parentElement.style.display = "";
    }else{
      node.parentElement.style.display = path.includes(q) ? "" : "none";
    }
  });
});

clearSearchBtn.addEventListener("click", () => {
  fileSearch.value = "";
  fileSearch.dispatchEvent(new Event("input"));
});

async function downloadProjectZip(){
  if(!projectData){
    showToast("No project loaded");
    return;
  }

  syncCurrentEditorToMemory();

  const zip = new JSZip();
  const root = zip.folder(projectData.projectName || "project");

  function addItems(nodes, currentFolder, currentPath = ""){
    nodes.forEach(node => {
      if(node.type === "folder"){
        const nextFolder = currentFolder.folder(node.name);
        const nextPath = currentPath ? `${currentPath}/${node.name}` : node.name;
        addItems(node.children || [], nextFolder, nextPath);
      }else{
        const fullPath = currentPath ? `${currentPath}/${node.name}` : node.name;
        currentFolder.file(node.name, fileContents[fullPath] || "");
      }
    });
  }

  addItems(projectData.structure, root);

  const blob = await zip.generateAsync({ type: "blob" });

  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `${projectData.projectName || "project"}.zip`;
  a.click();
  URL.revokeObjectURL(a.href);

  showToast("ZIP downloaded");
}

downloadZipBtn.addEventListener("click", downloadProjectZip);

/* ---------------------------------------------------------------------
 * Ask AI About Your Files
 * Build a context-rich prompt (project structure + selected file
 * contents + the user's question), then later apply a structured JSON
 * response (created/edited/deleted files) straight back into the project.
 * ------------------------------------------------------------------- */

function buildStructureText(nodes, indent=""){
  let text = "";
  nodes.forEach(node => {
    if(node.type === "folder"){
      text += `${indent}${node.name}/\n`;
      text += buildStructureText(node.children || [], indent + "  ");
    }else{
      text += `${indent}${node.name}\n`;
    }
  });
  return text;
}

function detectMentionedFiles(question){
  const mentioned = new Set();
  const tokens = question.match(/@[^\s,;]+/g) || [];

  tokens.forEach(token => {
    const clean = token.slice(1).replace(/[.,;:]+$/, "");
    if(!clean) return;
    fileList.forEach(f => {
      const matches =
        f.path === clean ||
        f.name === clean ||
        f.path.toLowerCase() === clean.toLowerCase() ||
        f.name.toLowerCase() === clean.toLowerCase() ||
        f.path.toLowerCase().endsWith("/" + clean.toLowerCase());
      if(matches) mentioned.add(f.path);
    });
  });

  return mentioned;
}

function generateAIPrompt(){
  if(!projectData){
    showToast("Build a scaffold first");
    return;
  }

  syncCurrentEditorToMemory();

  const question = aiQuestion.value.trim();
  if(!question){
    showToast("Type your message to the AI first");
    return;
  }

  const manualSelected = Array.from(document.querySelectorAll(".file-select-checkbox:checked"))
    .map(cb => cb.dataset.path);
  const mentioned = detectMentionedFiles(question);
  const allSelected = Array.from(new Set([...manualSelected, ...mentioned]));

  // Reflect auto-detected @mentions back onto the checkboxes so the user can see what was picked up.
  mentioned.forEach(path => {
    const cb = fileSelectList.querySelector(`.file-select-checkbox[data-path="${CSS.escape(path)}"]`);
    if(cb) cb.checked = true;
  });

  let prompt = `I'm working on a project called "${projectData.projectName}".\n\n`;
  prompt += `Project structure:\n${buildStructureText(projectData.structure)}\n`;

  if(allSelected.length){
    prompt += `Below are the current contents of the relevant file(s):\n\n`;
    allSelected.forEach(path => {
      prompt += `--- FILE: ${path} ---\n${fileContents[path] || "(empty file)"}\n--- END FILE ---\n\n`;
    });
  }else{
    prompt += `(No specific file contents attached — only the structure above.)\n\n`;
  }

  prompt += `My request:\n${question}\n\n`;
  prompt += `Instructions for you (the AI):\n`;
  prompt += `- Write the COMPLETE code for any file you modify or create — no partial snippets, no "// unchanged" placeholders.\n`;
  prompt += `- If you create a new file, give its full relative path (matching the structure above) and complete content.\n`;
  prompt += `- Keep unrelated parts of each file intact.\n`;
  prompt += `- For now, just answer normally with explanation and code. I will separately ask you to reformat your changes as JSON.`;

  generatedPrompt = prompt;
  generatedPromptBox.textContent = prompt;
  showToast(allSelected.length ? `Prompt generated with ${allSelected.length} file(s) attached` : "Prompt generated");
}

if(generatePromptBtn) generatePromptBtn.addEventListener("click", generateAIPrompt);

if(copyGeneratedPromptBtn){
  copyGeneratedPromptBtn.addEventListener("click", () => {
    if(!generatedPrompt){
      showToast("Generate the prompt first");
      return;
    }
    copyText(generatedPrompt, "Prompt copied");
  });
}

if(copySyncPromptBtn){
  copySyncPromptBtn.addEventListener("click", () => {
    copyText(SYNC_PROMPT, "Sync prompt copied");
  });
}

function parseChangeAction(action){
  if(action === "edit" || action === "create" || action === "delete") return action;
  return null;
}

function loadChangeList(){
  if(!projectData){
    showToast("Build or load a project first");
    return;
  }

  const raw = aiChangesJsonInput.value.trim();
  if(!raw){
    showToast("Paste the AI's change-list JSON first");
    return;
  }

  let data;
  try{
    data = JSON.parse(raw);
  }catch{
    showToast("Invalid JSON — check the pasted change list");
    return;
  }

  if(!Array.isArray(data.changes) || !data.changes.length){
    showToast('JSON must contain a non-empty "changes" array');
    return;
  }

  const validChanges = [];
  data.changes.forEach(change => {
    if(!change || typeof change !== "object" || !change.path) return;
    const action = parseChangeAction(change.action);
    if(!action) return;
    const parts = getPathParts(change.path);
    if(!parts.length) return;
    validChanges.push({ action, path: change.path });
  });

  if(!validChanges.length){
    showToast("No valid entries found in that JSON");
    return;
  }

  pendingChanges = validChanges;
  renderChangeList();
  changeListContainer.classList.remove("hidden");
  showToast(`Loaded ${validChanges.length} change(s) — paste code below for each`);
}

if(loadChangeListBtn) loadChangeListBtn.addEventListener("click", loadChangeList);

function renderChangeList(){
  changeListItems.innerHTML = "";

  pendingChanges.forEach((change, idx) => {
    const item = document.createElement("div");
    item.className = "change-item";

    const header = document.createElement("div");
    header.className = "change-item-header";

    const pathEl = document.createElement("div");
    pathEl.className = "change-item-path";
    pathEl.textContent = change.path;

    const badge = document.createElement("span");
    badge.className = `change-badge ${change.action}`;
    badge.textContent = change.action === "edit" ? "Edited" : change.action === "create" ? "Created" : "Deleted";

    header.append(pathEl, badge);
    item.appendChild(header);

    if(change.action === "delete"){
      const row = document.createElement("label");
      row.className = "change-item-delete-row";

      const cb = document.createElement("input");
      cb.type = "checkbox";
      cb.checked = true;
      cb.dataset.changeIndex = idx;
      cb.className = "change-delete-checkbox";

      const span = document.createElement("span");
      span.textContent = "Confirm this file should be deleted.";

      row.append(cb, span);
      item.appendChild(row);
    }else{
      const textarea = document.createElement("textarea");
      textarea.className = "change-content-input";
      textarea.dataset.changeIndex = idx;
      textarea.placeholder = `Paste the ${change.action === "create" ? "new" : "updated"} code for ${change.path} here...`;
      textarea.value = change.action === "edit" ? (fileContents[change.path] || "") : "";
      item.appendChild(textarea);
    }

    changeListItems.appendChild(item);
  });
}

function getPathParts(path){
  return path.split("/").map(p => p.trim()).filter(Boolean);
}

function insertFileIntoStructure(structure, pathParts){
  let currentArr = structure;

  for(let i = 0; i < pathParts.length - 1; i++){
    const folderName = pathParts[i];
    let folderNode = currentArr.find(n => n.type === "folder" && n.name === folderName);
    if(!folderNode){
      folderNode = { type: "folder", name: folderName, children: [] };
      currentArr.push(folderNode);
    }
    if(!folderNode.children) folderNode.children = [];
    currentArr = folderNode.children;
  }

  const fileName = pathParts[pathParts.length - 1];
  const existingFile = currentArr.find(n => n.type === "file" && n.name === fileName);
  if(!existingFile){
    currentArr.push({ type: "file", name: fileName });
  }
}

function removeNodeFromStructure(structure, pathParts){
  if(pathParts.length === 1){
    const idx = structure.findIndex(n => n.name === pathParts[0]);
    if(idx !== -1) structure.splice(idx, 1);
    return;
  }

  const folderName = pathParts[0];
  const folderNode = structure.find(n => n.type === "folder" && n.name === folderName);
  if(folderNode && folderNode.children){
    removeNodeFromStructure(folderNode.children, pathParts.slice(1));
  }
}

async function getDirHandleForParentPath(rootHandle, pathParts, { create=false }={}){
  let current = rootHandle;
  for(let i = 0; i < pathParts.length - 1; i++){
    current = await current.getDirectoryHandle(pathParts[i], { create });
  }
  return current;
}

async function writeFileToDisk(rootHandle, path, content){
  const parts = getPathParts(path);
  const fileName = parts[parts.length - 1];
  const parentHandle = await getDirHandleForParentPath(rootHandle, parts, { create: true });
  const fileHandle = await parentHandle.getFileHandle(fileName, { create: true });
  const writable = await fileHandle.createWritable();
  await writable.write(content || "");
  await writable.close();
}

async function deleteFileFromDisk(rootHandle, path){
  const parts = getPathParts(path);
  const fileName = parts[parts.length - 1];
  try{
    const parentHandle = await getDirHandleForParentPath(rootHandle, parts, { create: false });
    await parentHandle.removeEntry(fileName);
  }catch(err){
    if(err && err.name !== "NotFoundError") throw err;
  }
}

function updateSyncFolderStatusPill(){
  if(!syncFolderStatusPill) return;
  if(linkedProjectDirHandle){
    syncFolderStatusPill.textContent = `🔗 Synced to: ${linkedProjectDirHandle.name}`;
    syncFolderStatusPill.classList.remove("hidden");
  }else{
    syncFolderStatusPill.classList.add("hidden");
  }
}

if(linkSyncFolderBtn){
  linkSyncFolderBtn.addEventListener("click", async () => {
    if(!supportsFileSystemAccess){
      showToast("Your browser doesn't support linking a folder directly. Try Chrome or Edge.");
      return;
    }
    try{
      const dirHandle = await window.showDirectoryPicker({ mode: "readwrite" });
      const ok = await ensureWritePermission(dirHandle);
      if(!ok){
        showToast("Permission to write to that folder was denied");
        return;
      }
      linkedProjectDirHandle = dirHandle;
      updateSyncFolderStatusPill();
      showToast(`Linked "${dirHandle.name}" for direct sync`);
    }catch(err){
      if(err && err.name === "AbortError") return;
      showToast(err.message || "Failed to link folder");
    }
  });
}

/* ---------------------------------------------------------------------
 * Apply Changes to Folder (Project Workspace)
 * Diffs the current in-memory project against the last-synced snapshot
 * and writes only what actually changed — created, edited, or deleted
 * files — straight into the linked PC folder. No full re-export needed.
 * ------------------------------------------------------------------- */

async function pushChangesToFolder(){
  if(!projectData){
    showToast("Build or load a project first");
    return;
  }

  if(!linkedProjectDirHandle){
    showToast('No PC folder linked yet — use "Load Project from Folder" above or "Link PC Folder for Direct Sync" in the Ask AI section.');
    return;
  }

  syncCurrentEditorToMemory();

  const ok = await ensureWritePermission(linkedProjectDirHandle);
  if(!ok){
    linkedProjectDirHandle = null;
    updateSyncFolderStatusPill();
    showToast("Permission to write to the linked folder was denied");
    return;
  }

  const snapshot = lastSyncedSnapshot || {};
  const currentPaths = new Set(Object.keys(fileContents));
  const snapshotPaths = new Set(Object.keys(snapshot));

  const toWrite = [];
  const toDelete = [];

  currentPaths.forEach(path => {
    if(!snapshotPaths.has(path) || snapshot[path] !== fileContents[path]){
      toWrite.push(path);
    }
  });
  snapshotPaths.forEach(path => {
    if(!currentPaths.has(path)) toDelete.push(path);
  });

  if(!toWrite.length && !toDelete.length){
    showToast("No changes to apply — the linked folder is already up to date");
    return;
  }

  try{
    for(const path of toWrite){
      await writeFileToDisk(linkedProjectDirHandle, path, fileContents[path]);
    }
    for(const path of toDelete){
      await deleteFileFromDisk(linkedProjectDirHandle, path);
    }
    lastSyncedSnapshot = { ...fileContents };
    showToast(`Applied to "${linkedProjectDirHandle.name}": ${toWrite.length} written, ${toDelete.length} deleted`);
  }catch(err){
    showToast(err.message || "Failed to apply changes to the folder");
  }
}

if(pushChangesBtn){
  pushChangesBtn.addEventListener("click", pushChangesToFolder);
}

async function applyAIChanges(){
  if(!projectData){
    showToast("Build or load a project first");
    return;
  }

  if(!pendingChanges.length){
    showToast("Load the change list first, then paste in the code");
    return;
  }

  syncCurrentEditorToMemory();

  const toWriteToDisk = [];
  const toDeleteFromDisk = [];
  let edited = 0, created = 0, deleted = 0, skippedDeletes = 0;

  pendingChanges.forEach((change, idx) => {
    const parts = getPathParts(change.path);
    if(!parts.length) return;

    if(change.action === "delete"){
      const cb = changeListItems.querySelector(`.change-delete-checkbox[data-change-index="${idx}"]`);
      if(cb && !cb.checked){
        skippedDeletes++;
        return;
      }
      removeNodeFromStructure(projectData.structure, parts);
      delete fileContents[change.path];
      if(selectedFilePath === change.path) selectedFilePath = null;
      toDeleteFromDisk.push(change.path);
      deleted++;
    }else{
      const textarea = changeListItems.querySelector(`.change-content-input[data-change-index="${idx}"]`);
      const content = textarea ? textarea.value : "";
      const existedBefore = change.path in fileContents;
      insertFileIntoStructure(projectData.structure, parts);
      fileContents[change.path] = content;
      toWriteToDisk.push({ path: change.path, content });
      if(existedBefore) edited++; else created++;
    }
  });

  fileList = [];
  treeRoot.innerHTML = "";
  const { files, folders } = collectFilesAndFolders(projectData.structure);
  buildTree(projectData.structure, treeRoot);
  updateStats(files, folders);
  renderFileSelectList();

  if(selectedFilePath && Object.prototype.hasOwnProperty.call(fileContents, selectedFilePath)){
    editorFile.textContent = selectedFilePath;
    renderEditor(selectedFilePath);
  }else{
    selectedFilePath = null;
    editorFile.textContent = "No file selected";
    editorContainer.innerHTML = `
      <div class="empty-state" style="min-height:520px">
        Select a file from the tree to paste its code or text content.
      </div>
    `;
  }
  refreshTreeActiveState();

  let diskSynced = false;
  let diskError = null;

  if(linkedProjectDirHandle){
    const ok = await ensureWritePermission(linkedProjectDirHandle);
    if(ok){
      try{
        for(const { path, content } of toWriteToDisk){
          await writeFileToDisk(linkedProjectDirHandle, path, content);
        }
        for(const path of toDeleteFromDisk){
          await deleteFileFromDisk(linkedProjectDirHandle, path);
        }
        diskSynced = true;
        lastSyncedSnapshot = { ...fileContents };
      }catch(err){
        diskError = err;
      }
    }else{
      linkedProjectDirHandle = null;
      updateSyncFolderStatusPill();
    }
  }

  let summary = `Applied: ${created} created, ${edited} edited, ${deleted} deleted`;
  if(skippedDeletes) summary += `, ${skippedDeletes} deletion(s) skipped`;
  if(diskSynced) summary += ` — synced to "${linkedProjectDirHandle.name}"`;
  else if(diskError) summary += ` — disk sync failed: ${diskError.message}`;
  else if(!linkedProjectDirHandle) summary += `. Link a PC folder to write these changes to disk directly.`;

  showToast(summary);

  pendingChanges = [];
  changeListItems.innerHTML = "";
  changeListContainer.classList.add("hidden");
  aiChangesJsonInput.value = "";
}

if(applyChangesBtn) applyChangesBtn.addEventListener("click", applyAIChanges);

/* ---------------------------------------------------------------------
 * Load an existing project straight from a local folder (File System
 * Access API). This walks the real folder/file tree on disk and builds
 * both the scaffold structure and the file contents automatically —
 * no JSON pasting required.
 * ------------------------------------------------------------------- */

const EXCLUDED_DIR_NAMES = new Set([
  ".git", "node_modules", "__pycache__", ".venv", "venv",
  "dist", "build", ".next", ".cache", ".idea", ".vscode"
]);

const MAX_IMPORT_FILE_SIZE = 2_000_000; // 2MB, avoid choking on huge/binary files

let importedFileContents = {};

async function traverseDirectoryForImport(dirHandle, basePath=""){
  const nodes = [];

  for await (const [name, handle] of dirHandle.entries()){
    if(handle.kind === "directory"){
      if(EXCLUDED_DIR_NAMES.has(name)) continue;
      const currentPath = basePath ? `${basePath}/${name}` : name;
      const children = await traverseDirectoryForImport(handle, currentPath);
      nodes.push({ type: "folder", name, children });
    }else{
      const currentPath = basePath ? `${basePath}/${name}` : name;
      let content = "";
      try{
        const file = await handle.getFile();
        if(file.size > MAX_IMPORT_FILE_SIZE){
          content = `[File too large to import automatically: ${(file.size / 1024 / 1024).toFixed(2)} MB. Open it directly on disk if needed.]`;
        }else{
          content = await file.text();
        }
      }catch{
        content = "[Could not read this file's content — it may be a binary file.]";
      }
      importedFileContents[currentPath] = content;
      nodes.push({ type: "file", name });
    }
  }

  // Stable ordering: folders first, then files, both alphabetical.
  nodes.sort((a, b) => {
    if(a.type !== b.type) return a.type === "folder" ? -1 : 1;
    return a.name.localeCompare(b.name);
  });

  return nodes;
}

async function importProjectFromFolder(){
  if(!supportsFileSystemAccess){
    showToast("Your browser doesn't support loading a folder directly. Try Chrome or Edge.");
    return;
  }

  if(projectData){
    if(!confirm("Loading a folder will replace the current scaffold and file contents. Continue?")) return;
  }

  try{
    const dirHandle = await window.showDirectoryPicker({ mode: "readwrite" });

    showToast("Reading project folder…");
    importedFileContents = {};
    const structure = await traverseDirectoryForImport(dirHandle);

    projectData = { projectName: dirHandle.name, structure };
    fileContents = importedFileContents;
    fileList = [];
    selectedFilePath = null;
    savedDirHandle = null;
    updateFolderStatusPill();

    const writeOk = await ensureWritePermission(dirHandle);
    linkedProjectDirHandle = writeOk ? dirHandle : null;
    lastSyncedSnapshot = writeOk ? { ...fileContents } : null;
    updateSyncFolderStatusPill();

    treeRoot.innerHTML = "";

    const { files, folders } = collectFilesAndFolders(projectData.structure);
    buildTree(projectData.structure, treeRoot);

    workspaceEmpty.classList.add("hidden");
    workspace.classList.remove("hidden");
    editorFile.textContent = "No file selected";
    editorContainer.innerHTML = `
      <div class="empty-state" style="min-height:520px">
        Select a file from the tree to view or edit its content.
      </div>
    `;

    updateStats(files, folders);
    renderFileSelectList();
    aiQuestion.value = "";
    aiChangesJsonInput.value = "";
    pendingChanges = [];
    changeListItems.innerHTML = "";
    changeListContainer.classList.add("hidden");
    generatedPrompt = "";
    generatedPromptBox.textContent = 'Select files, type your message, and click "Generate AI Prompt".';

    showToast(`Loaded "${dirHandle.name}" — ${files} files, ${folders} folders${linkedProjectDirHandle ? " (linked for direct sync)" : ""}`);
  }catch(err){
    if(err && err.name === "AbortError") return; // user cancelled the picker
    showToast(err.message || "Failed to load project folder");
  }
}

if(importFromFolderBtn){
  importFromFolderBtn.addEventListener("click", importProjectFromFolder);
}

/* ---------------------------------------------------------------------
 * Save directly to a folder on disk (File System Access API).
 * Instead of zipping, this writes the real folder/file tree straight
 * into a directory the user picks from their PC — no download step.
 * ------------------------------------------------------------------- */

async function ensureWritePermission(dirHandle){
  const opts = { mode: "readwrite" };
  if((await dirHandle.queryPermission(opts)) === "granted") return true;
  if((await dirHandle.requestPermission(opts)) === "granted") return true;
  return false;
}

async function writeNodesToDirectory(nodes, dirHandle, currentPath = ""){
  for(const node of nodes){
    if(node.type === "folder"){
      const nextHandle = await dirHandle.getDirectoryHandle(node.name, { create: true });
      const nextPath = currentPath ? `${currentPath}/${node.name}` : node.name;
      await writeNodesToDirectory(node.children || [], nextHandle, nextPath);
    }else{
      const fullPath = currentPath ? `${currentPath}/${node.name}` : node.name;
      const fileHandle = await dirHandle.getFileHandle(node.name, { create: true });
      const writable = await fileHandle.createWritable();
      await writable.write(fileContents[fullPath] || "");
      await writable.close();
    }
  }
}

async function saveProjectToFolder(){
  if(!supportsFileSystemAccess){
    showToast("Your browser doesn't support saving directly to a folder. Try Chrome or Edge.");
    return;
  }
  if(!projectData){
    showToast("No project loaded");
    return;
  }

  syncCurrentEditorToMemory();

  try{
    let parentHandle = savedDirHandle;

    // Only re-prompt for a directory if we don't already have one linked,
    // or if we've lost write permission to the previously picked folder.
    if(parentHandle){
      const ok = await ensureWritePermission(parentHandle);
      if(!ok) parentHandle = null;
    }

    if(!parentHandle){
      parentHandle = await window.showDirectoryPicker({ mode: "readwrite" });
      const ok = await ensureWritePermission(parentHandle);
      if(!ok){
        showToast("Permission to write to that folder was denied");
        return;
      }
    }

    const projectFolderName = projectData.projectName || "project";
    const projectDirHandle = await parentHandle.getDirectoryHandle(projectFolderName, { create: true });

    await writeNodesToDirectory(projectData.structure, projectDirHandle);

    savedDirHandle = parentHandle;
    updateFolderStatusPill();

    showToast(`Project saved to "${parentHandle.name}/${projectFolderName}"`);
  }catch(err){
    if(err && err.name === "AbortError"){
      // User cancelled the folder picker — nothing to report.
      return;
    }
    showToast(err.message || "Failed to save to folder");
  }
}

if(saveToFolderBtn){
  saveToFolderBtn.addEventListener("click", saveProjectToFolder);
}
