function excludeURLParams(url: URL) {
  url.hash = '';
  url.search = '';
  url.username = '';
  url.password = '';
  return url;
}

export default excludeURLParams;
