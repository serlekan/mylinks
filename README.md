# MyLinks

A lightweight, open-source link-in-bio website: a distinctive one-page hub, a visual link manager, and optional publish-to-GitHub workflow. Built with plain HTML, CSS, JavaScript, and JSON. No framework, database, paid link-in-bio platform, or build step is required.

**Live example:** https://serlekan-links.pages.dev/  
**Source:** https://github.com/serlekan/mylinks

## Features

- Responsive dark design with an accent color; accessible labels, keyboard focus, and reduced-motion support.
- Add, edit, remove, reorder, show, or hide links without editing HTML.
- Edit your name, introduction, status, tagline, and GitHub repository.
- Save a local browser draft, restore it, download `data.json`, or import an existing JSON file.
- Publish from `/editor.html` directly to an authorized GitHub repository using a **fine-grained personal access token**.
- Safe URL validation: public links must be `http://` or `https://`, never JavaScript URLs. User-controlled labels/descriptions are inserted as text, not executable HTML.
- Deploy to an *existing* Cloudflare Pages Direct Upload project using GitHub Actions and Wrangler.
- Reusable for personal profiles, freelancers, makers, agencies, and community projects.

## How it works

```text
public/data.json  →  public/app.js  →  public/index.html  →  visitors
                                ↘  public/editor.html + editor.js
                                    ↓
                         draft / download / GitHub API commit
                                    ↓
                     GitHub Actions → Cloudflare Pages (optional)
```

The website reads `public/data.json` every time the page loads. The editor modifies an **in-memory copy** until you save a draft, download JSON, or commit it. **Saving a draft does not publish anything.** The published site changes after the new JSON file is deployed.

## Quick start (clone and use)

1. Fork this repository or clone it:

   ```bash
   git clone https://github.com/serlekan/mylinks.git
   cd mylinks
   ```

2. Open `public/data.json`. Change `repository` to **your** `owner/repo`, set your `profile`, and replace the sample `links`. Commit the personalized version to your repository.
3. Run a local server from the `public/` folder:

   ```bash
   cd public
   python -m http.server 8000
   ```

   Then open `http://localhost:8000/` for the public page or `http://localhost:8000/editor.html` for the editor. Windows users can use `py -m http.server 8000` instead.

4. To host it, upload **the contents of `public/`** to a static host. Cloudflare Pages, GitHub Pages, Netlify, and any HTTP static-file server work. No install or build is required.
5. To automate publication, follow the Cloudflare section below.

**Do not open the HTML as `file:///...` for editing:** browsers commonly block JSON fetches from local files. Use a local HTTP server as above.

## Editing your links

Open `/editor.html` on a trusted copy of your website.

- **Add link:** creates a hidden new card; enter its title, URL, and optional description, then check “Visible to visitors.”
- **Edit:** change fields directly. Use ↑ and ↓ to control ordering.
- **Hide:** uncheck “Visible to visitors” without deleting the item.
- **Remove:** deletes it from the current draft; nothing changes publicly until you publish.
- **Save draft:** writes only non-secret page data to your browser's localStorage. Each repository has its own draft key.
- **Restore draft:** reloads the local draft for the repository shown in the editor.
- **Download data.json:** saves the current page settings and links to your computer. Replace `public/data.json` in the repo manually if you do not want browser-based publishing.
- **Import JSON:** loads a previously exported `data.json` into the editor.

Changes are checked before saving/exporting/publishing: names and titles cannot be empty, IDs must be unique, and link destinations must be HTTP(S) URLs without embedded credentials.

### Publish from the editor to GitHub

1. Configure `repository` inside `public/data.json` with the exact `owner/repository` name. Commit this initial setup through GitHub first.
2. In GitHub → **Settings → Developer settings → Personal access tokens → Fine-grained tokens**, create a token restricted to that repository, with **Contents: Read and write**. Use the shortest reasonable expiry. Never use a full-account token when a repository-scoped one will do.
3. Open `/editor.html` from **your own trusted domain**. Edit the page, then paste that token into the password field and click **Publish to GitHub**.
4. The editor fetches the current `public/data.json` and its Git blob SHA, rejects stale concurrent edits, and commits your updated JSON to `main`.
5. The editor clears the token input after the request. **Tokens are not saved to localStorage, exported with JSON, or committed.** They are sent only to `https://api.github.com` using the GitHub REST Contents API.
6. The resulting commit is **not a successful deployment**. Check the **Actions** tab for deployment status, or deploy the updated `public/` folder manually.

If another commit changed `data.json` since you loaded the editor, publishing stops instead of overwriting the newer copy. Download your draft, reload, and reapply/re-import changes after resolving conflicts.

**Security limits:** Anyone can view the editor HTML, but GitHub denies publishing without write permission. The editor is not an authentication service, and it does not create a secret admin password. Do not paste a token into another person's fork, an untrusted domain, or a machine you do not control. If you do not trust browser token entry, use **Download data.json** and the GitHub web interface instead. GitHub tokens should be revoked when no longer needed. Never embed tokens in `data.json`, HTML, or public Git history.

## JSON configuration

Edit `public/data.json`:

```json
{
  "version": 1,
  "profile": {
    "name": "Your Name",
    "eyebrow": "Builder · Creator",
    "status": "Available",
    "intro": "A short introduction.",
    "footer": "What you're working on."
  },
  "repository": "your-username/mylinks",
  "links": [
    {
      "id": "portfolio",
      "title": "Portfolio",
      "description": "Selected projects",
      "url": "https://example.com",
      "enabled": true
    }
  ]
}
```

Every link needs a unique stable `id`, a `title`, an absolute HTTP(S) `url`, and a boolean `enabled`. `description` is optional. Hidden items remain in JSON but are excluded from the public page. The `repository` value tells the editor where to publish; it does **not** grant access.

To customize colors, edit the CSS variables at the top of `public/styles.css`. To change layout/behavior, edit `public/index.html`, `public/app.js`, and corresponding editor files.

## Cloudflare Pages deployment

### A. Manual Direct Upload (no automation)

- In Cloudflare → **Workers & Pages**, create a **Direct Upload** Pages project, or open one you already own.
- Upload the **contents of `public/`** to production. The folder contains the complete static site.
- When you edit JSON in GitHub later, Cloudflare **will not** update on its own unless you configure GitHub Actions or perform another manual upload.

### B. Automatic deployment to an existing Direct Upload project

This repository includes `.github/workflows/deploy.yml` for Cloudflare's supported Wrangler continuous-integration flow. **You do not need to replace an existing `*.pages.dev` project.**

In your GitHub repository → **Settings → Secrets and variables → Actions**:

1. Add repository **secret** `CLOUDFLARE_API_TOKEN`: a Cloudflare token limited to the necessary account with **Cloudflare Pages: Edit** permissions.
2. Add repository **secret** `CLOUDFLARE_ACCOUNT_ID`: the account ID from your Cloudflare dashboard. It is treated as a secret here for consistency, though it is not an authentication token.
3. Add repository **variable** `CF_PAGES_PROJECT`: the **existing Pages project name** (for this project, `serlekan-links`; for clones, use their own project name).
4. Ensure the Pages project's **production branch is `main`**. If it is not, adjust your branch settings or workflow.
5. Push any change to `public/` on `main`, or use **Actions → Deploy Cloudflare Pages → Run workflow** to trigger the initial deployment.

The workflow runs `npm test` before deploy, then executes `wrangler pages deploy public --project-name=<project> --branch=main` through `cloudflare/wrangler-action@v4`.

**Important:** Existing Direct Upload projects cannot be converted into native Git-integrated Pages projects in place. GitHub Actions + Wrangler is a separate, fully supported integration that preserves your existing Pages project and hostname.

If `CF_PAGES_PROJECT` is unset, the validation workflow runs but deployment is skipped. If it is set and a Cloudflare secret is missing/invalid, deployment fails; examine the Actions logs. Do not put Cloudflare tokens in a public file.

### C. Other hosts

- **GitHub Pages:** publish the `public/` directory using your build/deployment method. The editor's GitHub save updates the repo but does not itself configure GitHub Pages.
- **Netlify / other static hosts:** set the publish directory to `public`, and connect its build integration if you want automatic publication.
- **Cloudflare with Git integration (new projects):** choose `public` as output folder and no build command. This does not apply to an existing Direct Upload project.

## Development and validation

This project uses Node's built-in test runner and has no runtime package dependencies.

```bash
npm test
node --check public/app.js
node --check public/editor.js
```

`npm test` validates the JSON schema, link data, URLs, duplicate identifiers, and required static files. Inspect the public page and editor at desktop/mobile sizes as a final acceptance check before publication.

## Common problems

| Symptom | Cause / fix |
| --- | --- |
| Page says links cannot load | Ensure `data.json` exists next to `index.html` and open over HTTP rather than `file://`. |
| GitHub returns 401 | Token is invalid/expired. Create a repository-scoped fine-grained token. |
| GitHub returns 403 or 404 | Token may not have access to the repo, or `repository` contains the wrong owner/name. |
| Editor says GitHub data changed | Download your draft, reload, resolve the newer version, then republish. |
| GitHub commit succeeded but site did not change | Check **Actions**; Cloudflare secrets/project variable and target production branch must be configured. |
| A `C:\\Users\\...\\file.html` link does not work | Local Windows paths are not public URLs. Deploy the file somewhere reachable via HTTPS and use that URL. |
| Link is not visible | Verify `enabled: true`, valid URL, and completed deployment. |

## Project layout

```text
mylinks/
  .github/workflows/deploy.yml  # Validate and deploy to Cloudflare
  public/
    index.html                  # Public landing page
    app.js                      # Renders validated links
    editor.html                 # Management UI
    editor.js                   # Drafts, editing, GitHub publishing
    styles.css                  # Shared responsive theme
    data.json                   # Profile and link data
    _headers                    # Cloudflare security headers
  scripts/validate.mjs          # Node-based checks
  package.json
  README.md
  LICENSE
```

## Contributions

Issues and pull requests are welcome. Keep the project dependency-free where possible, maintain keyboard accessibility, avoid sending tokens to third-party endpoints, and make it clear whether a button saves a draft or actually publishes a change.

## License

MIT — see [LICENSE](LICENSE).

## Official references

- [Cloudflare Pages: continuous integration for Direct Upload](https://developers.cloudflare.com/pages/how-to/use-direct-upload-with-continuous-integration/)
- [Cloudflare Pages: Direct Upload](https://developers.cloudflare.com/pages/get-started/direct-upload/)
- [GitHub REST API: create/update repository file](https://docs.github.com/en/rest/repos/contents#create-or-update-file-contents)
- [GitHub fine-grained personal access tokens](https://docs.github.com/en/authentication/keeping-your-account-and-data-secure/managing-your-personal-access-tokens)
