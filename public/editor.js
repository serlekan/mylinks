import { validate, validateDraft, limits, MAX_BYTES } from "./schema.js";
const $ = (id) => document.getElementById(id);
const clone = structuredClone;
const fields = ["name", "eyebrow", "status", "intro", "footer"];
let model,
  published,
  baseSha = null,
  service = false,
  working = false,
  saved = "",
  commit = null;
const key = () => `mylinks-draft-${published.repository}`;
const show = (message, bad = false) => {
  $("feedback").hidden = false;
  $("feedback").className = `feedback${bad ? " error" : ""}`;
  $("feedback").textContent = message;
};
const status = (message) => {
  $("deployment-status").hidden = false;
  $("deployment-status").textContent = message;
};
function capture() {
  fields.forEach((k) => (model.profile[k] = $(`profile-${k}`).value));
  model.appearance = { accent: $("accent").value, cards: $("cards").value };
  document.querySelectorAll(".editor-card").forEach((card) => {
    const link = model.links.find((l) => l.id === card.dataset.id);
    for (const f of ["title", "description", "url", "enabled"]) {
      const input = card.querySelector(`[data-field="${f}"]`);
      link[f] = f === "enabled" ? input.checked : input.value;
    }
  });
  return model;
}
function update() {
  const changed = JSON.stringify(model) !== saved;
  $("dirty").textContent = changed
    ? "Unsaved changes · preview only"
    : "No unsaved changes";
  $("preview").contentWindow?.postMessage(
    { type: "mylinks-preview", data: model },
    location.origin,
  );
}
function move(from, to) {
  capture();
  if (to < 0 || to >= model.links.length || from === to) return;
  const [item] = model.links.splice(from, 1);
  model.links.splice(to, 0, item);
  renderLinks();
  update();
  document
    .querySelectorAll(".editor-card")
    [to]?.querySelector("button")
    ?.focus();
  show(`Link moved to position ${to + 1}.`);
}
function button(label, action, disabled = false) {
  const b = document.createElement("button");
  b.type = "button";
  b.className = "btn";
  b.textContent = label;
  b.disabled = disabled;
  b.onclick = action;
  return b;
}
function renderLinks() {
  $("editor-links").replaceChildren();
  model.links.forEach((link, index) => {
    const card = document.createElement("article");
    card.className = "editor-card";
    card.dataset.id = link.id;
    const head = document.createElement("div");
    head.className = "editor-card-head";
    const handle = document.createElement("span");
    handle.textContent = `⠿ Link ${String(index + 1).padStart(2, "0")}`;
    handle.className = "drag-handle";
    handle.draggable = true;
    handle.title = "Drag to reorder";
    handle.addEventListener("dragstart", (e) => {
      capture();
      e.dataTransfer.setData("text/plain", link.id);
      e.dataTransfer.effectAllowed = "move";
    });
    card.addEventListener("dragover", (e) => {
      e.preventDefault();
      e.dataTransfer.dropEffect = "move";
    });
    card.addEventListener("drop", (e) => {
      e.preventDefault();
      const from = model.links.findIndex(
        (l) => l.id === e.dataTransfer.getData("text/plain"),
      );
      if (from >= 0) move(from, index);
    });
    const controls = document.createElement("div");
    controls.className = "bar";
    controls.append(
      button("Move up", () => move(index, index - 1), index === 0),
      button(
        "Move down",
        () => move(index, index + 1),
        index === model.links.length - 1,
      ),
    );
    const remove = button("Remove", () => {
      if (
        !confirm(`Remove “${link.title || "Untitled link"}” from this draft?`)
      )
        return;
      capture();
      model.links.splice(index, 1);
      renderLinks();
      update();
      $("add-link").focus();
    });
    remove.classList.add("danger");
    controls.append(remove);
    head.append(handle, controls);
    card.append(head);
    const grid = document.createElement("div");
    grid.className = "form-grid";
    for (const f of ["title", "url", "description", "enabled"]) {
      const label = document.createElement("label");
      label.className =
        f === "enabled"
          ? "checkline"
          : `field${f === "description" ? " wide" : ""}`;
      const input = document.createElement(
        f === "description" ? "textarea" : "input",
      );
      input.dataset.field = f;
      if (f === "enabled") {
        input.type = "checkbox";
        input.checked = link.enabled;
        label.append(input, document.createTextNode("Visible to visitors"));
      } else {
        if (f !== "description") input.type = f === "url" ? "url" : "text";
        input.value = link[f] || "";
        input.maxLength = limits[f];
        label.append(
          document.createTextNode(
            f === "url" ? "Destination URL" : f[0].toUpperCase() + f.slice(1),
          ),
          input,
        );
      }
      grid.append(label);
    }
    card.append(grid);
    $("editor-links").append(card);
  });
  $("add-link").disabled = model.links.length >= 100;
}
function render() {
  fields.forEach((k) => ($(`profile-${k}`).value = model.profile[k]));
  $("repository").value = model.repository;
  $("accent").value = model.appearance?.accent || "lime";
  $("cards").value = model.appearance?.cards || "rounded";
  renderLinks();
  update();
}
async function api(path, init = {}) {
  const response = await fetch(`/api/${path}`, {
    ...init,
    cache: "no-store",
    headers: { "Content-Type": "application/json", ...init.headers },
    signal: AbortSignal.timeout(20000),
  });
  let data;
  try {
    data = await response.json();
  } catch {
    throw Error(
      "Owner service unavailable. Your edits are preserved; export JSON for recovery.",
    );
  }
  if (!response.ok)
    throw Error(data.error || `Owner service HTTP ${response.status}.`);
  return data;
}
async function checkDeployment() {
  if (!commit) return;
  try {
    const d = await api(`status?commit=${encodeURIComponent(commit)}`);
    status(d.message);
    if (!["success", "failure"].includes(d.state))
      setTimeout(() => {
        if (commit === d.commit) checkDeployment();
      }, 10000);
  } catch {
    status(
      "Deployment status unavailable. Commit exists; deployment has not been verified. Use Check deployment to retry.",
    );
  }
}
async function publish() {
  if (working || !service) return;
  let data;
  try {
    data = validate(capture());
  } catch (e) {
    show(e.message, true);
    return;
  }
  working = true;
  $("publish").disabled = true;
  $("editor-fields").disabled = true;
  status("Publishing requested · checking the repository version…");
  // Save recovery before any network operation. Storage failure does not prevent publishing.
  try {
    localStorage.setItem(key(), JSON.stringify({ data, baseSha, published }));
  } catch {}
  try {
    const result = await api("publish", {
      method: "POST",
      headers: { "If-Match": baseSha },
      body: JSON.stringify(data),
    });
    baseSha = result.sha;
    commit = result.commit;
    published = clone(data);
    model = clone(data);
    saved = JSON.stringify(model);
    update();
    try {
      localStorage.setItem(
        key(),
        JSON.stringify({ data: model, baseSha, published }),
      );
    } catch {}
    const link = $("commit-link");
    link.href = `https://github.com/${published.repository}/commit/${commit}`;
    link.hidden = false;
    $("check-status").disabled = false;
    status(
      `GitHub commit created: ${commit.slice(0, 12)}. Waiting for deployment…`,
    );
    show("Changes committed. Public deployment is being checked.");
    checkDeployment();
  } catch (e) {
    show(
      `${e.message} Draft retained. Export JSON before resolving conflicts.`,
      true,
    );
    status(
      "Publishing failed or response was lost. Check GitHub before retrying.",
    );
  } finally {
    working = false;
    $("editor-fields").disabled = false;
    $("publish").disabled = !service;
  }
}
async function init() {
  try {
    const r = await fetch("./data.json", { cache: "no-store" });
    if (!r.ok) throw Error("Published data unavailable.");
    published = validate(await r.json());
    model = clone(published);
    model.appearance ||= { accent: "lime", cards: "rounded" };
    saved = JSON.stringify(model);
    render();
    $("editor-fields").disabled = false;
  } catch (e) {
    show(e.message, true);
    $("dirty").textContent =
      "Editor unavailable. Reload to retry; saved drafts have not been removed.";
    return;
  }
  $("editor-fields").addEventListener("input", () => {
    capture();
    update();
  });
  $("editor-fields").addEventListener("change", () => {
    capture();
    update();
  });
  $("add-link").onclick = () => {
    capture();
    model.links.push({
      id: crypto.randomUUID(),
      title: "New link",
      url: "",
      description: "",
      enabled: false,
    });
    renderLinks();
    update();
    document
      .querySelector('.editor-card:last-child [data-field="title"]')
      .focus();
  };
  $("save-draft").onclick = () => {
    try {
      validateDraft(capture());
      localStorage.setItem(
        key(),
        JSON.stringify({ data: model, baseSha, published }),
      );
      saved = JSON.stringify(model);
      update();
      show(
        "Draft saved in this browser. It is not public. Incomplete fields are preserved.",
      );
    } catch {
      show(
        "Browser storage is unavailable or full. Keep this tab open and export after completing required fields.",
        true,
      );
    }
  };
  $("restore-draft").onclick = () => {
    try {
      const text = localStorage.getItem(key());
      if (!text) throw Error("No saved draft in this browser.");
      const draft = JSON.parse(text);
      const data = draft.data || draft;
      // Own saved drafts may contain incomplete fields; validate structure without requiring publishable content.
      validateDraft(data);
      if (
        JSON.stringify(model) !== saved &&
        !confirm("Replace your unsaved edits with the saved draft?")
      )
        return;
      model = data;
      if (draft.published && draft.baseSha) {
        baseSha = draft.baseSha;
        published = validate(draft.published);
      }
      saved = JSON.stringify(model);
      render();
      show("Draft restored. It is not public.");
    } catch (e) {
      show(e.message, true);
    }
  };
  $("download-json").onclick = () => {
    try {
      const data = validate(capture());
      const url = URL.createObjectURL(
        new Blob([JSON.stringify(data, null, 2) + "\n"], {
          type: "application/json",
        }),
      );
      const a = document.createElement("a");
      a.href = url;
      a.download = "data.json";
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      show(
        "JSON downloaded. Commit as public/data.json on main; deployment must then succeed.",
      );
    } catch (e) {
      show(e.message, true);
    }
  };
  $("import-json").onclick = () => $("import-file").click();
  $("import-file").onchange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    try {
      if (file.size > MAX_BYTES) throw Error("File exceeds 128 KiB.");
      const data = validate(JSON.parse(await file.text()));
      if (data.repository !== published.repository)
        throw Error("Imported repository does not match this site.");
      if (
        JSON.stringify(model) !== saved &&
        !confirm("Replace your unsaved edits with this import?")
      )
        return;
      model = data;
      render();
      show("JSON imported into this draft. It is not public.");
    } catch (e) {
      show(e.message, true);
    } finally {
      $("import-file").value = "";
    }
  };
  $("discard").onclick = async () => {
    if (
      !confirm(
        "Discard edits and load the latest published version? Your saved draft will remain available.",
      )
    )
      return;
    try {
      const r = await fetch("./data.json", { cache: "no-store" });
      if (!r.ok) throw Error("Published content unavailable; edits retained.");
      const data = validate(await r.json());
      published = data;
      model = clone(data);
      model.appearance ||= { accent: "lime", cards: "rounded" };
      saved = JSON.stringify(model);
      baseSha = null;
      service = false;
      $("publish").disabled = true;
      render();
      show("Published version restored.");
      await connect();
    } catch (e) {
      show(e.message, true);
    }
  };
  for (const mode of ["desktop", "mobile"])
    $(`${mode}-preview`).onclick = () => {
      $("preview-wrap").classList.toggle("mobile", mode === "mobile");
      $("desktop-preview").setAttribute(
        "aria-pressed",
        String(mode === "desktop"),
      );
      $("mobile-preview").setAttribute(
        "aria-pressed",
        String(mode === "mobile"),
      );
    };
  $("publish").onclick = publish;
  $("check-status").onclick = checkDeployment;
  await connect();
}
async function connect() {
  try {
    const session = await api("session");
    if (JSON.stringify(session.data) !== JSON.stringify(published))
      throw Error(
        "Repository differs from the live deployment. Export your draft and wait for deployment before publishing.",
      );
    baseSha = session.sha;
    service = true;
    $("publish").disabled = false;
    $("service-status").textContent =
      "Owner verified. Publishing uses server credentials and checks for conflicting updates.";
  } catch (e) {
    service = false;
    $("publish").disabled = true;
    $("service-status").textContent =
      `${e.message} Save/export remain available.`;
  }
}
window.addEventListener("message", (e) => {
  if (
    e.origin === location.origin &&
    e.source === $("preview").contentWindow &&
    e.data?.type === "mylinks-ready" &&
    model
  )
    update();
});
window.addEventListener("beforeunload", (e) => {
  if (model && (JSON.stringify(model) !== saved || working)) {
    e.preventDefault();
    e.returnValue = "";
  }
});
window.addEventListener("storage", (e) => {
  if (published && e.key === key())
    show(
      "Another tab changed the saved draft. Export your edits before restoring it.",
      true,
    );
});
init();
