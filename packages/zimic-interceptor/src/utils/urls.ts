// Base URLs match URLs by prefix, so a URL extending the last path segment of a base URL also matches. A base URL at the
// root path is a bare origin, though, so the origins must also be equal to not match other ports or hosts.
export function isURLUnderBaseURL(url: string, baseURL: string) {
  return url.startsWith(baseURL) && new URL(url).origin === new URL(baseURL).origin;
}
