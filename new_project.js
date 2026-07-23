/* ---------------------------------------------------------------------
 * new_project.js
 * Page-specific behavior for new_project.html (Create New Project).
 * Shared workspace/editor/Ask-AI logic lives in app.js — this file only
 * adds small conveniences specific to the "start from a JSON scaffold"
 * workflow.
 * ------------------------------------------------------------------- */

document.addEventListener("DOMContentLoaded", () => {
  const jsonInputEl = document.getElementById("jsonInput");
  if (jsonInputEl) {
    // Let the user start typing/pasting JSON immediately on page load.
    jsonInputEl.focus();
  }
});
