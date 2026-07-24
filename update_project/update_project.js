/* ---------------------------------------------------------------------
 * update_project.js
 * Page-specific behavior for update_project.html (Update Your Project).
 * Shared workspace/editor/Ask-AI logic (including the New File / New
 * Folder / delete-node manual management flows) lives in app.js — this
 * file only adds small conveniences specific to the "load an existing
 * project" workflow (loading from a local folder or a previously saved
 * project JSON, instead of pasting a scaffold JSON).
 * ------------------------------------------------------------------- */

document.addEventListener("DOMContentLoaded", () => {
  const supportsFileSystemAccess = "showDirectoryPicker" in window;
  const importFromFolderBtn = document.getElementById("importFromFolderBtn");

  if (!supportsFileSystemAccess && importFromFolderBtn) {
    importFromFolderBtn.style.opacity = "0.5";
    importFromFolderBtn.style.cursor = "not-allowed";
    importFromFolderBtn.title = "Not supported in this browser. Try Chrome, Edge, or another Chromium-based browser.";
  }

  const helpIcon = document.getElementById("helpIcon");
  const helpPopup = document.getElementById("helpPopup");
  const helpOverlay = document.getElementById("helpOverlay");
  const closeHelpBtn = document.getElementById("closeHelpBtn");

  function toggleHelp(show) {
    if (show === undefined) {
      show = !helpPopup.classList.contains("show");
    }
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
    if (closeHelpBtn) {
      closeHelpBtn.addEventListener("click", () => toggleHelp(false));
    }
    if (helpOverlay) {
      helpOverlay.addEventListener("click", () => toggleHelp(false));
    }
    document.addEventListener("click", (e) => {
      if (!helpIcon.contains(e.target) && !helpPopup.contains(e.target)) {
        toggleHelp(false);
      }
    });
  }
});
