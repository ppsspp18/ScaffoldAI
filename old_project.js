/* ---------------------------------------------------------------------
 * old_project.js
 * Page-specific behavior for old_project.html (Update Your Project).
 * Shared workspace/editor/Ask-AI logic lives in app.js — this file only
 * adds small conveniences specific to the "load an existing project"
 * workflow (loading from a local folder or a previously saved project
 * JSON, instead of pasting a scaffold JSON).
 * ------------------------------------------------------------------- */

document.addEventListener("DOMContentLoaded", () => {
  const supportsFileSystemAccess = "showDirectoryPicker" in window;
  const importFromFolderBtn = document.getElementById("importFromFolderBtn");

  if (!supportsFileSystemAccess && importFromFolderBtn) {
    // app.js already disables the folder-based buttons it knows about when
    // the File System Access API isn't available, but on this page the
    // "Load Project from Folder" control is a styled div rather than a
    // <button>, so make that unsupported state visually clear here too.
    importFromFolderBtn.style.opacity = "0.5";
    importFromFolderBtn.style.cursor = "not-allowed";
    importFromFolderBtn.title = "Not supported in this browser. Try Chrome, Edge, or another Chromium-based browser.";
  }
});
