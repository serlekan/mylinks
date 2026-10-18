import { validate } from "./schema.js";
import { render } from "./render.js";
const preview =
  new URLSearchParams(location.search).has("preview") &&
  window.parent !== window;
if (preview) {
  document.querySelector(".manage-link").hidden = true;
  window.addEventListener("message", (event) => {
    if (
      event.origin !== location.origin ||
      event.source !== window.parent ||
      event.data?.type !== "mylinks-preview"
    )
      return;
    try {
      render(event.data.data);
    } catch {
      /* Retain last usable preview during incomplete edits. */
    }
  });
  window.parent.postMessage({ type: "mylinks-ready" }, location.origin);
} else {
  try {
    const r = await fetch("./data.json", { cache: "no-store" });
    if (!r.ok) throw Error("Unavailable");
    render(validate(await r.json()));
  } catch {
    const notice = document.getElementById("notice");
    notice.hidden = false;
    notice.textContent =
      "Updates could not load. Showing the last built page. Reload to try again.";
    document.getElementById("links").setAttribute("aria-busy", "false");
  }
}
