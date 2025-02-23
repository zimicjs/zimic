function joinURL(...parts: (URL | string)[]) {
  return parts
    .map((part, index) => {
      const isFirstPart = index === 0;
      const isLastPart = index === parts.length - 1;

      let partAsString = part.toString();

      if (!isFirstPart) {
        partAsString = partAsString.replace(/^\//, '');
      }
      if (!isLastPart) {
        partAsString = partAsString.replace(/\/$/, '');
      }

      return partAsString;
    })
    .filter((part) => part.length > 0)
    .join('/');
}

export default joinURL;
