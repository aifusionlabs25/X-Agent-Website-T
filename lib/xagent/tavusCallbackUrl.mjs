const DEFAULT_PRODUCTION_ORIGIN = "https://x-agent-website-t.vercel.app";

/**
 * @typedef {Record<string, string | undefined>} EnvSource
 */

function clean(value) {
  return String(value ?? "").replace(/^\uFEFF/, "").trim();
}

function withProtocol(value) {
  const trimmed = clean(value).replace(/\/$/, "");
  if (!trimmed) return "";
  return /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
}

function originFromHost(host) {
  const trimmed = clean(host);
  if (!trimmed) return "";
  const protocol = trimmed.includes("localhost") || trimmed.includes("127.0.0.1") ? "http" : "https";
  return `${protocol}://${trimmed}`;
}

/**
 * @param {string | null | undefined} host
 * @param {EnvSource} [envSource]
 */
export function resolvePublicCallbackOrigin(host, envSource = process.env) {
  const configuredOrigin =
    withProtocol(envSource.XAGENT_TAVUS_CALLBACK_BASE_URL)
    || withProtocol(envSource.NEXT_PUBLIC_SITE_URL)
    || withProtocol(envSource.SITE_URL)
    || withProtocol(envSource.VERCEL_PROJECT_PRODUCTION_URL);

  if (configuredOrigin) return configuredOrigin;

  const hostOrigin = originFromHost(host);
  if (!hostOrigin) return "";

  if (
    /\.vercel\.app$/i.test(clean(host))
    && !/^https:\/\/x-agent-website-t\.vercel\.app$/i.test(hostOrigin)
  ) {
    return DEFAULT_PRODUCTION_ORIGIN;
  }

  return hostOrigin;
}

/**
 * @param {{
 *   host?: string | null;
 *   agentSlug?: string;
 *   token?: string;
 *   envSource?: EnvSource;
 * }} [options]
 */
export function buildTavusCallbackUrl({
  host,
  agentSlug,
  token,
  envSource = process.env,
} = {}) {
  const origin = resolvePublicCallbackOrigin(host, envSource);
  if (!origin) return undefined;

  const url = new URL("/api/webhook", origin);
  if (agentSlug) {
    url.searchParams.set("agent", agentSlug);
  }
  if (token) {
    url.searchParams.set("token", token);
  }
  return url.toString();
}
