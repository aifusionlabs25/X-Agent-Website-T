import assert from "node:assert/strict";
import {
  buildTavusCallbackUrl,
  resolvePublicCallbackOrigin,
} from "../lib/xagent/tavusCallbackUrl.mjs";

assert.equal(
  resolvePublicCallbackOrigin("x-agent-website-t-git-demo-robs-projects-e72bad73.vercel.app", {}),
  "https://x-agent-website-t.vercel.app",
);

assert.equal(
  resolvePublicCallbackOrigin("127.0.0.1:3001", {}),
  "http://127.0.0.1:3001",
);

assert.equal(
  resolvePublicCallbackOrigin("preview.example.vercel.app", {
    XAGENT_TAVUS_CALLBACK_BASE_URL: "https://public.example.com",
  }),
  "https://public.example.com",
);

const halCallback = buildTavusCallbackUrl({
  host: "x-agent-website-t-git-hal-robs-projects-e72bad73.vercel.app",
  agentSlug: "hal",
  token: "callback-token",
  envSource: {},
});

assert.equal(
  halCallback,
  "https://x-agent-website-t.vercel.app/api/webhook?agent=hal&token=callback-token",
);

console.log("Tavus callback URL checks passed");
