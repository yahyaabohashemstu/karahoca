const DANGEROUS_URL_PATTERN = /^(javascript:|data:text\/html|vbscript:)/i;

const sanitizeSvgNode = (node: Element) => {
  node.querySelectorAll('script, foreignObject').forEach((element) => element.remove());

  node.querySelectorAll('*').forEach((element) => {
    for (const attribute of Array.from(element.attributes)) {
      const attributeName = attribute.name.toLowerCase();
      const attributeValue = attribute.value.trim();

      if (attributeName.startsWith('on')) {
        element.removeAttribute(attribute.name);
        continue;
      }

      if (
        (attributeName === 'href' || attributeName === 'xlink:href' || attributeName === 'src') &&
        DANGEROUS_URL_PATTERN.test(attributeValue)
      ) {
        element.removeAttribute(attribute.name);
      }
    }
  });
};

export const createSanitizedSvgElement = (rawSvg: string): SVGSVGElement | null => {
  try {
    const parser = new DOMParser();
    const documentNode = parser.parseFromString(rawSvg, 'image/svg+xml');

    if (documentNode.querySelector('parsererror')) {
      return null;
    }

    const svgRoot = documentNode.documentElement;
    if (!svgRoot || svgRoot.tagName.toLowerCase() !== 'svg') {
      return null;
    }

    sanitizeSvgNode(svgRoot);
    const importedNode = document.importNode(svgRoot, true);
    if (!(importedNode instanceof SVGElement) || importedNode.tagName.toLowerCase() !== 'svg') {
      return null;
    }

    return importedNode as unknown as SVGSVGElement;
  } catch {
    return null;
  }
};

export const mountSanitizedSvg = (container: Element, rawSvg: string): SVGSVGElement | null => {
  const svgElement = createSanitizedSvgElement(rawSvg);
  container.replaceChildren();

  if (!svgElement) {
    return null;
  }

  container.appendChild(svgElement);
  return svgElement;
};

export const loadSanitizedSvgIntoContainer = async (container: Element, assetUrl: string) => {
  const response = await fetch(assetUrl);
  if (!response.ok) {
    throw new Error(`Failed to load SVG asset (${response.status})`);
  }

  const rawSvg = await response.text();
  return mountSanitizedSvg(container, rawSvg);
};
