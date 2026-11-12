// Page script for the pieces the kit does not draw: the install command's copy button.
// Everything else (entrances, hovers, loops, moments, the phone menu) is the kit's.

// Install commands: copy on click, then say so for a moment.
for (const button of document.querySelectorAll("[data-copy]")) {
  const hint = button.querySelector("[data-copy-hint]");
  button.addEventListener("click", async () => {
    try {
      await navigator.clipboard.writeText(button.dataset.copy);
      hint.textContent = "Copied";
    } catch {
      hint.textContent = "Selected, copy it"; // clipboard blocked (e.g. not https): select the command instead
      getSelection().selectAllChildren(button.querySelector("code"));
    }
    setTimeout(() => (hint.textContent = "Copy"), 1600);
  });
}
