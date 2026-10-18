import { guarded, github, json, HttpError } from "../lib/security.js";
export const onRequestGet = (context) =>
  guarded(context, async () => {
    const commit = new URL(context.request.url).searchParams.get("commit");
    if (!/^[a-f0-9]{40}$/.test(commit || ""))
      throw new HttpError(400, "Valid commit required.");
    const result = await github(
      context.env,
      `actions/workflows/deploy.yml/runs?head_sha=${commit}&branch=main&event=push&per_page=10`,
    );
    const run = result.workflow_runs?.[0];
    if (!run)
      return json({
        commit,
        state: "pending",
        message:
          "GitHub commit created. Waiting for deployment workflow; deployment is not yet verified.",
      });
    if (run.status !== "completed")
      return json({
        commit,
        state: "progress",
        message:
          "Deployment in progress. The public page has not yet been verified.",
      });
    if (run.conclusion !== "success")
      return json({
        commit,
        state: "failure",
        message: `Deployment failed or stopped (${run.conclusion}). Draft remains available; check GitHub Actions.`,
      });
    try {
      const r = await fetch(
        new URL(`/release.json?commit=${commit}`, context.env.PUBLIC_ORIGIN),
        { cache: "no-store", signal: AbortSignal.timeout(10000) },
      );
      const release = r.ok ? await r.json() : null;
      if (release?.commit === commit)
        return json({
          commit,
          state: "success",
          message:
            "Deployment successful. The production release matches this commit.",
        });
    } catch {}
    return json({
      commit,
      state: "pending",
      message:
        "Workflow finished, but production does not yet match this commit. Deployment is not verified; retry shortly.",
    });
  });
