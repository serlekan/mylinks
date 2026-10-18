import { guarded, github, json, contentPath, decode } from "../lib/security.js";
import { validate } from "../../public/schema.js";
export const onRequestGet = (context) =>
  guarded(context, async () => {
    const file = await github(context.env, `${contentPath}?ref=main`);
    return json({
      sha: file.sha,
      data: validate(JSON.parse(decode(file.content))),
    });
  });
