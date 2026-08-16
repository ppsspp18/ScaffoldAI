/* ---------------------------------------------------------------------
 * ScaffoldAI — single page app.
 *
 * Two features only:
 *   1) Copy Project Structure — the folder/file tree as plain text.
 *   2) Copy Files as Text     — full contents of the checked files,
 *                                each labeled with its path.
 *
 * Memory/scale fix: the old version eagerly read every file's content
 * into memory the moment a folder was loaded, and capped any single
 * file at 2MB. That's what made large projects slow or fail outright.
 * Here, loading a folder only builds the lightweight tree (names +
 * handles/File refs) — nothing is read from disk until you actually
 * click "Copy Files as Text", and then only the files you checked are
 * read, one at a time, streamed straight into the output. There's no
 * artificial cap on how many files you can select.
 * ------------------------------------------------------------------- */

const EXCLUDED_DIR_NAMES = new Set([
  ".git", "node_modules", "__pycache__", ".venv", "venv",
  "dist", "build", ".next", ".cache", ".idea", ".vscode"
]);

// Extensions we skip reading as text (binary/likely-huge, no value as text).
const BINARY_EXTENSIONS = new Set([
  "png","jpg","jpeg","gif","webp","bmp","ico","svgz","tiff",
  "mp3","wav","ogg","flac","m4a",
  "mp4","mov","avi","mkv","webm",
  "zip","tar","gz","rar","7z","bz2",
  "pdf","doc","docx","xls","xlsx","ppt","pptx",
  "woff","woff2","ttf","otf","eot",
  "exe","dll","so","dylib","bin","class","o","a",
  "pyc","pyo",
  "db","sqlite","sqlite3"
]);

// Soft per-file size guard so one pathological file can't stall the
// browser tab. Non-fatal: the file is just noted and skipped, every
// other checked file still gets copied.
const MAX_TEXT_FILE_SIZE = 8_000_000; // 8MB

const supportsFileSystemAccess = "showDirectoryPicker" in window;

// ---- DOM ----
const importFromFolderBtn = document.getElementById("importFromFolderBtn");
const folderInputFallback = document.getElementById("folderInputFallback");
const refreshBtn = document.getElementById("refreshBtn");
const resetBtn = document.getElementById("resetBtn");

const statProject = document.getElementById("statProject");
const statFiles = document.getElementById("statFiles");
const statFolders = document.getElementById("statFolders");

const treeEmpty = document.getElementById("treeEmpty");
const treeLoaded = document.getElementById("treeLoaded");
const treeRoot = document.getElementById("treeRoot");
const fileSearch = document.getElementById("fileSearch");
const clearSearchBtn = document.getElementById("clearSearchBtn");
const selectAllBtn = document.getElementById("selectAllBtn");
const selectNoneBtn = document.getElementById("selectNoneBtn");
const selectionPill = document.getElementById("selectionPill");

const copyStructureBtn = document.getElementById("copyStructureBtn");
const copyFilesAsTextBtn = document.getElementById("copyFilesAsTextBtn");
const copyProgress = document.getElementById("copyProgress");

const toast = document.getElementById("toast");

// ---- State ----
let projectData = null; // { projectName, structure: [nodes] }
let fileCount = 0;
let folderCount = 0;
let lastDirHandle = null; // FileSystemDirectoryHandle, kept for Refresh (FS Access API only)

if (!supportsFileSystemAccess) {
  importFromFolderBtn.title = "Using folder picker fallback (works in most browsers).";
}

function showToast(message) {
  toast.textContent = message;
  toast.classList.add("show");
  clearTimeout(showToast._t);
  showToast._t = setTimeout(() => toast.classList.remove("show"), 2600);
}

async function copyTextToClipboard(text, successMessage = "Copied") {
  try {
    await navigator.clipboard.writeText(text);
    showToast(successMessage);
  } catch {
    // Fallback for very large payloads / permission issues.
    try {
      const ta = document.createElement("textarea");
      ta.value = text;
      ta.style.position = "fixed";
      ta.style.opacity = "0";
      document.body.appendChild(ta);
      ta.focus();
      ta.select();
      document.execCommand("copy");
      document.body.removeChild(ta);
      showToast(successMessage);
    } catch {
      showToast("Clipboard copy failed — the result may be too large for your browser's clipboard.");
    }
  }
}

/* ------------------------- Loading a project ------------------------- */

// File System Access API: recursively builds a lightweight tree. Only
// names/handles are stored — no file content is read here.
async function traverseDirectoryForTree(dirHandle, basePath = "") {
  const nodes = [];

  for await (const [name, handle] of dirHandle.entries()) {
    const currentPath = basePath ? `${basePath}/${name}` : name;

    if (handle.kind === "directory") {
      if (EXCLUDED_DIR_NAMES.has(name)) continue;
      const children = await traverseDirectoryForTree(handle, currentPath);
      nodes.push({ type: "folder", name, path: currentPath, children, checked: true, expanded: true });
      folderCount++;
    } else {
      nodes.push({ type: "file", name, path: currentPath, handle, checked: true });
      fileCount++;
    }
  }

  nodes.sort((a, b) => {
    if (a.type !== b.type) return a.type === "folder" ? -1 : 1;
    return a.name.localeCompare(b.name);
  });

  return nodes;
}

// Fallback for browsers without the File System Access API: builds the
// same tree shape from a flat FileList (webkitdirectory), storing the
// File object directly on each leaf (still not read yet).
function buildTreeFromFileList(fileList) {
  const root = [];
  const folderIndex = new Map(); // path -> node.children array

  const files = Array.from(fileList).filter(f => {
    const rel = f.webkitRelativePath || f.name;
    const parts = rel.split("/");
    return !parts.some(p => EXCLUDED_DIR_NAMES.has(p));
  });

  for (const file of files) {
    const rel = file.webkitRelativePath || file.name;
    const parts = rel.split("/");
    let children = root;
    let pathSoFar = "";

    for (let i = 1; i < parts.length - 1; i++) {
      const part = parts[i];
      pathSoFar = pathSoFar ? `${pathSoFar}/${part}` : part;
      let existing = folderIndex.get(pathSoFar);
      if (!existing) {
        const folderNode = { type: "folder", name: part, path: pathSoFar, children: [], checked: true, expanded: true };
        children.push(folderNode);
        existing = folderNode.children;
        folderIndex.set(pathSoFar, existing);
        folderCount++;
      }
      children = existing;
    }

    const fileName = parts[parts.length - 1];
    const filePath = parts.slice(1).join("/") || fileName;
    children.push({ type: "file", name: fileName, path: filePath, file, checked: true });
    fileCount++;
  }

  const sortTree = (nodes) => {
    nodes.sort((a, b) => {
      if (a.type !== b.type) return a.type === "folder" ? -1 : 1;
      return a.name.localeCompare(b.name);
    });
    nodes.forEach(n => { if (n.type === "folder") sortTree(n.children); });
  };
  sortTree(root);

  return root;
}

async function importProjectFromFolder() {
  if (projectData) {
    if (!confirm("Loading a new folder will replace the currently loaded project. Continue?")) return;
  }

  fileCount = 0;
  folderCount = 0;

  if (supportsFileSystemAccess) {
    try {
      const dirHandle = await window.showDirectoryPicker();
      showToast("Reading project folder…");
      const structure = await traverseDirectoryForTree(dirHandle);
      projectData = { projectName: dirHandle.name, structure };
      lastDirHandle = dirHandle;
      finishLoad();
    } catch (err) {
      if (err && err.name === "AbortError") return;
      showToast(err.message || "Failed to load project folder");
    }
  } else {
    folderInputFallback.click();
  }
}

folderInputFallback.addEventListener("change", () => {
  const fileList = folderInputFallback.files;
  if (!fileList || fileList.length === 0) return;

  fileCount = 0;
  folderCount = 0;

  const firstRel = fileList[0].webkitRelativePath || "";
  const projectName = firstRel.split("/")[0] || "project";
  const structure = buildTreeFromFileList(fileList);
  projectData = { projectName, structure };
  lastDirHandle = null;
  finishLoad();
  folderInputFallback.value = "";
});

function finishLoad() {
  treeEmpty.classList.add("hidden");
  treeLoaded.classList.remove("hidden");
  statProject.textContent = projectData.projectName;
  statFiles.textContent = String(fileCount);
  statFolders.textContent = String(folderCount);
  renderTree();
  updateSelectionPill();
  updateRefreshButton();
  showToast(`Loaded "${projectData.projectName}" — ${fileCount} files, ${folderCount} folders`);
}

function updateRefreshButton() {
  if (!refreshBtn) return;
  refreshBtn.disabled = !projectData;
  refreshBtn.title = lastDirHandle
    ? "Re-read this folder from disk"
    : (supportsFileSystemAccess ? "" : "Re-pick the folder to refresh (browser doesn't support direct re-reading)");
}

if (importFromFolderBtn) importFromFolderBtn.addEventListener("click", importProjectFromFolder);

// Collects checked/unchecked + expanded state keyed by path, so a
// refresh can re-apply selections to files that still exist.
function collectTreeState(nodes, out = new Map()) {
  for (const node of nodes) {
    out.set(node.path, { checked: !!node.checked, expanded: node.expanded });
    if (node.type === "folder") collectTreeState(node.children, out);
  }
  return out;
}

function applyTreeState(nodes, stateMap) {
  for (const node of nodes) {
    const prev = stateMap.get(node.path);
    if (prev) {
      node.checked = prev.checked;
      if (node.type === "folder" && prev.expanded !== undefined) node.expanded = prev.expanded;
    }
    if (node.type === "folder") applyTreeState(node.children, stateMap);
  }
}

async function refreshProject() {
  if (!projectData) return;

  if (!lastDirHandle) {
    showToast("Can't refresh directly — please pick the folder again to reload it.");
    if (supportsFileSystemAccess) {
      importProjectFromFolder();
    } else {
      folderInputFallback.click();
    }
    return;
  }

  const previousState = collectTreeState(projectData.structure);

  refreshBtn.disabled = true;
  const originalLabel = refreshBtn.textContent;
  refreshBtn.textContent = "🔄 Refreshing…";

  try {
    fileCount = 0;
    folderCount = 0;
    const structure = await traverseDirectoryForTree(lastDirHandle);
    applyTreeState(structure, previousState);
    refreshFolderCheckedStates(structure);

    projectData = { projectName: lastDirHandle.name, structure };
    statProject.textContent = projectData.projectName;
    statFiles.textContent = String(fileCount);
    statFolders.textContent = String(folderCount);
    renderTree(fileSearch ? fileSearch.value : "");
    updateSelectionPill();
    showToast(`Refreshed "${projectData.projectName}" — ${fileCount} files, ${folderCount} folders`);
  } catch (err) {
    showToast(err.message || "Failed to refresh project folder");
  } finally {
    refreshBtn.disabled = false;
    refreshBtn.textContent = originalLabel;
  }
}

if (refreshBtn) refreshBtn.addEventListener("click", refreshProject);

if (resetBtn) resetBtn.addEventListener("click", () => {
  if (projectData && !confirm("Reset ScaffoldAI and clear the currently loaded project?")) return;
  projectData = null;
  fileCount = 0;
  folderCount = 0;
  lastDirHandle = null;
  statProject.textContent = "—";
  statFiles.textContent = "0";
  statFolders.textContent = "0";
  treeRoot.innerHTML = "";
  treeLoaded.classList.add("hidden");
  treeEmpty.classList.remove("hidden");
  if (fileSearch) fileSearch.value = "";
  updateRefreshButton();
  showToast("Reset");
});

/* ------------------------------ Tree UI ------------------------------ */

function setCheckedDeep(node, checked) {
  node.checked = checked;
  if (node.type === "folder") {
    node.children.forEach(child => setCheckedDeep(child, checked));
  }
}

function refreshFolderCheckedStates(nodes) {
  // Returns { allChecked, anyChecked } for this level, propagating up.
  let allChecked = true;
  let anyChecked = false;

  for (const node of nodes) {
    if (node.type === "folder") {
      const result = refreshFolderCheckedStates(node.children);
      node.checked = result.allChecked;
      node._indeterminate = !result.allChecked && result.anyChecked;
      if (!node.checked) allChecked = false;
      if (node.checked || result.anyChecked) anyChecked = true;
    } else {
      if (!node.checked) allChecked = false;
      if (node.checked) anyChecked = true;
    }
  }

  if (nodes.length === 0) allChecked = false;
  return { allChecked, anyChecked };
}

function countSelectedFiles(nodes, counter = { count: 0 }) {
  for (const node of nodes) {
    if (node.type === "file") {
      if (node.checked) counter.count++;
    } else {
      countSelectedFiles(node.children, counter);
    }
  }
  return counter.count;
}

function updateSelectionPill() {
  if (!projectData) {
    selectionPill.classList.add("hidden");
    return;
  }
  const selected = countSelectedFiles(projectData.structure);
  selectionPill.textContent = `${selected} of ${fileCount} files selected`;
  selectionPill.classList.remove("hidden");
}

function renderTree(filterText = "") {
  treeRoot.innerHTML = "";
  if (!projectData) return;

  const query = filterText.trim().toLowerCase();

  function matches(node) {
    if (!query) return true;
    if (node.path.toLowerCase().includes(query)) return true;
    if (node.type === "folder") {
      return node.children.some(matches);
    }
    return false;
  }

  function buildList(nodes, container) {
    for (const node of nodes) {
      if (query && !matches(node)) continue;

      const li = document.createElement("li");
      const row = document.createElement("div");
      row.className = "tree-node";

      if (node.type === "folder") {
        const toggle = document.createElement("span");
        toggle.className = "node-toggle";
        toggle.textContent = node.expanded === false ? "▶" : "▼";
        toggle.addEventListener("click", () => {
          node.expanded = node.expanded === false ? true : false;
          renderTree(fileSearch ? fileSearch.value : "");
        });
        row.appendChild(toggle);
      } else {
        const spacer = document.createElement("span");
        spacer.className = "node-toggle";
        row.appendChild(spacer);
      }

      const checkbox = document.createElement("input");
      checkbox.type = "checkbox";
      checkbox.checked = !!node.checked;
      checkbox.indeterminate = !!node._indeterminate;
      checkbox.addEventListener("change", () => {
        setCheckedDeep(node, checkbox.checked);
        refreshFolderCheckedStates(projectData.structure);
        renderTree(fileSearch ? fileSearch.value : "");
        updateSelectionPill();
      });
      row.appendChild(checkbox);

      const icon = document.createElement("span");
      icon.className = "icon";
      icon.textContent = node.type === "folder" ? "📁" : "📄";
      row.appendChild(icon);

      const name = document.createElement("span");
      name.className = "node-name";
      name.textContent = node.name;
      row.appendChild(name);

      li.appendChild(row);

      if (node.type === "folder" && node.expanded !== false) {
        const childUl = document.createElement("ul");
        childUl.className = "tree-children";
        buildList(node.children, childUl);
        li.appendChild(childUl);
      }

      container.appendChild(li);
    }
  }

  buildList(projectData.structure, treeRoot);
}

if (fileSearch) {
  fileSearch.addEventListener("input", () => renderTree(fileSearch.value));
}
if (clearSearchBtn) {
  clearSearchBtn.addEventListener("click", () => {
    fileSearch.value = "";
    renderTree("");
  });
}

if (selectAllBtn) {
  selectAllBtn.addEventListener("click", () => {
    if (!projectData) return;
    projectData.structure.forEach(n => setCheckedDeep(n, true));
    refreshFolderCheckedStates(projectData.structure);
    renderTree(fileSearch ? fileSearch.value : "");
    updateSelectionPill();
  });
}
if (selectNoneBtn) {
  selectNoneBtn.addEventListener("click", () => {
    if (!projectData) return;
    projectData.structure.forEach(n => setCheckedDeep(n, false));
    refreshFolderCheckedStates(projectData.structure);
    renderTree(fileSearch ? fileSearch.value : "");
    updateSelectionPill();
  });
}

/* --------------------------- Copy: Structure --------------------------- */

function buildStructureText(nodes, prefix = "") {
  const lines = [];
  nodes.forEach((node, index) => {
    const isLast = index === nodes.length - 1;
    const connector = isLast ? "└── " : "├── ";
    lines.push(prefix + connector + node.name + (node.type === "folder" ? "/" : ""));
    if (node.type === "folder") {
      const nextPrefix = prefix + (isLast ? "    " : "│   ");
      lines.push(...buildStructureText(node.children, nextPrefix));
    }
  });
  return lines;
}

if (copyStructureBtn) {
  copyStructureBtn.addEventListener("click", async () => {
    if (!projectData) return;
    const lines = [`${projectData.projectName}/`, ...buildStructureText(projectData.structure)];
    await copyTextToClipboard(lines.join("\n"), "Project structure copied");
  });
}

/* ------------------------- Copy: Files as Text ------------------------- */

function getExtension(name) {
  const idx = name.lastIndexOf(".");
  return idx === -1 ? "" : name.slice(idx + 1).toLowerCase();
}

function flattenCheckedFiles(nodes, out = []) {
  for (const node of nodes) {
    if (node.type === "file") {
      if (node.checked) out.push(node);
    } else {
      flattenCheckedFiles(node.children, out);
    }
  }
  return out;
}

async function readFileNodeText(node) {
  if (node.handle) {
    const file = await node.handle.getFile();
    return { size: file.size, file };
  }
  if (node.file) {
    return { size: node.file.size, file: node.file };
  }
  throw new Error("No readable reference for this file");
}

if (copyFilesAsTextBtn) {
  copyFilesAsTextBtn.addEventListener("click", async () => {
    if (!projectData) return;

    const files = flattenCheckedFiles(projectData.structure);
    if (files.length === 0) {
      showToast("No files checked — tick some files in the tree first.");
      return;
    }

    copyFilesAsTextBtn.disabled = true;
    copyProgress.classList.remove("hidden");

    // Streamed, one file at a time — no upper bound on file count and
    // no upfront bulk read, so this scales to very large selections.
    const chunks = [];
    let skipped = 0;

    for (let i = 0; i < files.length; i++) {
      const node = files[i];
      copyProgress.textContent = `Reading files… ${i + 1} / ${files.length} (${node.path})`;

      const ext = getExtension(node.name);
      if (BINARY_EXTENSIONS.has(ext)) {
        chunks.push(`==== ${node.path} ====\n[Skipped — binary file type (.${ext})]`);
        skipped++;
        continue;
      }

      try {
        const { size, file } = await readFileNodeText(node);
        if (size > MAX_TEXT_FILE_SIZE) {
          chunks.push(`==== ${node.path} ====\n[Skipped — file is ${(size / 1_000_000).toFixed(1)}MB, over the ${(MAX_TEXT_FILE_SIZE / 1_000_000).toFixed(0)}MB text-copy limit]`);
          skipped++;
          continue;
        }
        const text = await file.text();
        chunks.push(`==== ${node.path} ====\n${text}`);
      } catch (err) {
        chunks.push(`==== ${node.path} ====\n[Could not read this file: ${(err && err.message) || err}]`);
        skipped++;
      }

      // Yield to the UI thread periodically so large batches don't freeze the tab.
      if (i % 15 === 0) await new Promise(r => setTimeout(r, 0));
    }

    const output = chunks.join("\n\n");
    copyProgress.textContent = "";
    copyProgress.classList.add("hidden");
    copyFilesAsTextBtn.disabled = false;

    const summary = skipped > 0
      ? `Copied ${files.length - skipped} of ${files.length} files as text (${skipped} skipped)`
      : `Copied ${files.length} file${files.length === 1 ? "" : "s"} as text`;

    await copyTextToClipboard(output, summary);
  });
}

/* ------------------------------ Help popup ------------------------------ */

const helpIcon = document.getElementById("helpIcon");
const helpPopup = document.getElementById("helpPopup");
const helpOverlay = document.getElementById("helpOverlay");
const closeHelpBtn = document.getElementById("closeHelpBtn");

function toggleHelp(show) {
  if (show === undefined) show = !helpPopup.classList.contains("show");
  if (show) {
    helpPopup.classList.add("show");
    if (helpOverlay) helpOverlay.classList.add("show");
  } else {
    helpPopup.classList.remove("show");
    if (helpOverlay) helpOverlay.classList.remove("show");
  }
}

if (helpIcon && helpPopup) {
  helpIcon.addEventListener("click", (e) => {
    e.stopPropagation();
    toggleHelp();
  });
  if (closeHelpBtn) closeHelpBtn.addEventListener("click", () => toggleHelp(false));
  if (helpOverlay) helpOverlay.addEventListener("click", () => toggleHelp(false));
  document.addEventListener("click", (e) => {
    if (!helpIcon.contains(e.target) && !helpPopup.contains(e.target)) toggleHelp(false);
  });
}
