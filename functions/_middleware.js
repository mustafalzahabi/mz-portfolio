// ============================================================================
// Fills the public Google settings into HTML pages from Pages environment
// variables, so they're configured per deployment instead of committed:
//   GOOGLE_API_KEY    → <meta name="mz-google-api-key">    (visitors read Drive portfolios)
//   GOOGLE_CLIENT_ID  → <meta name="mz-google-client-id">  ("Sign in with Google")
// Neither is a secret (both end up in the page), but keeping them out of the
// repo lets forks and environments use their own. public/_routes.json keeps
// static assets from invoking this at all.
// ============================================================================

export async function onRequest({ next, env }) {
  const response = await next();
  if (!(response.headers.get("content-type") || "").includes("text/html")) return response;
  const values = {
    "mz-google-api-key": env.GOOGLE_API_KEY,
    "mz-google-client-id": env.GOOGLE_CLIENT_ID,
  };
  if (!Object.values(values).some(Boolean)) return response;
  return new HTMLRewriter()
    .on("meta[name]", {
      element(el) {
        const value = values[el.getAttribute("name")];
        if (value) el.setAttribute("content", value);
      },
    })
    .transform(response);
}
