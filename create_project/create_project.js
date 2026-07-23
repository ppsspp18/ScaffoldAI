/* ---------------------------------------------------------------------
 * create_project.js
 * Page-specific behavior for create_project.html (Create New Project).
 * Shared workspace/editor/Ask-AI logic lives in app.js — this file only
 * adds small conveniences specific to the "start from a JSON scaffold"
 * workflow.
 * ------------------------------------------------------------------- */

document.addEventListener("DOMContentLoaded", () => {
  const jsonInputEl = document.getElementById("jsonInput");
  if (jsonInputEl) {
    jsonInputEl.focus();
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
