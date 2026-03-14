import elephant from '../assets/elephant.png';
import pyramid from '../assets/pyramid.png';
import african from '../assets/african.png';

const LEGACY_ASSET_MAP = {
  'elephant.png': elephant,
  'pyramid.png': pyramid,
  'african.png': african
};

const getFilenameFromPath = (path) => {
  const match = path.match(/([^/]+)$/);
  return match ? match[1].toLowerCase() : '';
};

export const resolvePuzzleImageUrl = (url) => {
  if (typeof url !== 'string') return url;

  const trimmedUrl = url.trim();
  if (!trimmedUrl) return trimmedUrl;

  const directFileMatch = trimmedUrl.match(/(?:^|\/)(elephant\.png|pyramid\.png|african\.png)(?:$|[?#])/i);
  if (directFileMatch) {
    return LEGACY_ASSET_MAP[directFileMatch[1].toLowerCase()] || trimmedUrl;
  }

  const legacyPathMatch = trimmedUrl.match(/(?:^|https?:\/\/[^/]+)?\/?src\/assets\/([^?#]+)/i);
  if (legacyPathMatch) {
    const filename = getFilenameFromPath(legacyPathMatch[1]);
    if (LEGACY_ASSET_MAP[filename]) {
      return LEGACY_ASSET_MAP[filename];
    }
  }

  try {
    const base = typeof window !== 'undefined' ? window.location.origin : 'http://localhost';
    const normalizedUrl = new URL(trimmedUrl, base);
    const filename = getFilenameFromPath(normalizedUrl.pathname);

    if (normalizedUrl.pathname.includes('/src/assets/') && LEGACY_ASSET_MAP[filename]) {
      return LEGACY_ASSET_MAP[filename];
    }
  } catch (_err) {
    // Keep original URL when parsing fails.
  }

  return trimmedUrl;
};

export default resolvePuzzleImageUrl;
