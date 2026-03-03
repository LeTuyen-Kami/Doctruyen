/**
 * Extract story data from EPUB file.
 * EPUB is a ZIP archive containing content.opf (metadata + spine) and XHTML chapters.
 * Based on EPUB_TO_MARKDOWN.md guide.
 */
import { XMLParser } from "fast-xml-parser";
import JSZip from "jszip";
import type { StoryJSON } from "@/src/db/import-story";

const HTML_ENTITIES: Record<string, string> = {
  "&nbsp;": " ",
  "&amp;": "&",
  "&lt;": "<",
  "&gt;": ">",
  "&quot;": '"',
  "&#39;": "'",
  "&apos;": "'",
  "&hellip;": "…",
  "&mdash;": "—",
  "&ndash;": "–",
};

function decodeHtmlEntities(text: string): string {
  let result = text;
  for (const [entity, char] of Object.entries(HTML_ENTITIES)) {
    result = result.replace(new RegExp(entity, "g"), char);
  }
  // Decode numeric entities &#123; and &#x7B;
  result = result.replace(/&#(\d+);/g, (_, num) =>
    String.fromCharCode(parseInt(num, 10))
  );
  result = result.replace(/&#x([0-9a-fA-F]+);/g, (_, hex) =>
    String.fromCharCode(parseInt(hex, 16))
  );
  return result;
}

/**
 * Strip HTML tags and extract plain text.
 * Handles common block elements (p, div, br) to preserve paragraphs.
 */
function htmlToPlainText(html: string): string {
  if (!html || typeof html !== "string") return "";

  let text = html
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, "")
    .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, "")
    .replace(/<head\b[^<]*(?:(?!<\/head>)<[^<]*)*<\/head>/gi, "");

  // Block elements -> newline
  text = text.replace(/<\s*(p|div|br|h[1-6]|li|tr)[^>]*\/?>/gi, "\n");
  text = text.replace(/<\s*\/\s*(p|div|h[1-6]|li|tr)[^>]*>/gi, "\n");

  // Remove all remaining tags
  text = text.replace(/<[^>]+>/g, "");

  text = decodeHtmlEntities(text);

  return text
    .split(/\n+/)
    .map((p) => p.trim())
    .filter(Boolean)
    .join("\n\n");
}

function base64ToUint8Array(base64: string): Uint8Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

/**
 * Chapter split patterns for EPUBs that merge multiple chapters in one file.
 */
const CHAPTER_PATTERNS = [
  /Chương\s+\d+/gi,
  /Chapter\s+\d+/gi,
  /第\s*\d+\s*章/gi,
  /(?:^|\n\n+)\s*\d+\.\s+/gm,
];

/**
 * Check if content looks like a table of contents (danh sách chương).
 * TOC typically has many short lines, each a chapter title.
 */
function looksLikeToc(content: string): boolean {
  if (!content || content.length < 50) return false;
  const lines = content.split(/\n+/).map((l) => l.trim()).filter(Boolean);
  if (lines.length < 5) return false;

  // Count lines that look like chapter titles: "Chương 1", "Chapter 1", "1. Title"
  const chapterLikePattern = /^(?:Chương|Chapter|Ch\.|第)\s*\d+|^\d+[\.\s]/m;
  let chapterLikeCount = 0;
  for (const line of lines) {
    if (chapterLikePattern.test(line) || line.length < 80) {
      chapterLikeCount++;
    }
  }
  // If > 40% of lines are chapter-like or short, likely TOC
  return chapterLikeCount / lines.length > 0.4;
}

/**
 * Check if this is front matter to skip: cover, title page, very short intro.
 */
function isFrontMatterToSkip(content: string, href: string): boolean {
  const lowerHref = href.toLowerCase();
  if (
    lowerHref.includes("cover") ||
    lowerHref.includes("titlepage") ||
    lowerHref.includes("toc") ||
    lowerHref.includes("nav")
  ) {
    return true;
  }
  // Very short content = likely cover/title page
  return content.trim().length < 200;
}

function splitMergedChapters(
  content: string,
  chapterTitle: string
): { title: string; content: string }[] {
  if (!content || content.length < 500) {
    return content ? [{ title: chapterTitle, content }] : [];
  }

  for (const pattern of CHAPTER_PATTERNS) {
    const matches = content.match(pattern);
    if (matches && matches.length > 1) {
      const parts: { title: string; content: string }[] = [];
      let lastIndex = 0;

      for (let i = 0; i < matches.length; i++) {
        const match = matches[i];
        const idx = content.indexOf(match, lastIndex);
        if (idx === -1) continue;

        const start = idx;
        const end =
          i < matches.length - 1
            ? content.indexOf(matches[i + 1], start)
            : content.length;
        const chunk = content.slice(start, end).trim();

        if (chunk.length > 100) {
          parts.push({
            title: match.trim(),
            content: chunk,
          });
        }
        lastIndex = end;
      }

      if (parts.length > 1) return parts;
    }
  }

  // If content is very long but no pattern found, split by paragraphs
  if (content.length > 10000) {
    const paragraphs = content.split(/\n\n+/);
    const chunkSize = Math.ceil(paragraphs.length / Math.ceil(content.length / 3000));
    const parts: { title: string; content: string }[] = [];
    for (let i = 0; i < paragraphs.length; i += chunkSize) {
      const chunk = paragraphs.slice(i, i + chunkSize).join("\n\n");
      if (chunk.trim().length > 100) {
        parts.push({
          title: `Chương ${parts.length + 1}`,
          content: chunk.trim(),
        });
      }
    }
    if (parts.length > 1) return parts;
  }

  return [{ title: chapterTitle, content }];
}

export interface EpubExtractResult {
  success: true;
  data: StoryJSON;
}

export interface EpubExtractError {
  success: false;
  error: string;
}

export async function extractEpubToStoryJSON(
  epubBase64OrBuffer: string | ArrayBuffer | Uint8Array
): Promise<EpubExtractResult | EpubExtractError> {
  try {
    let buffer: ArrayBuffer | Uint8Array;
    if (typeof epubBase64OrBuffer === "string") {
      buffer = base64ToUint8Array(epubBase64OrBuffer);
    } else if (epubBase64OrBuffer instanceof Uint8Array) {
      buffer = epubBase64OrBuffer;
    } else {
      buffer = epubBase64OrBuffer;
    }

    if (!buffer.byteLength) {
      return { success: false, error: "File EPUB rỗng hoặc không hợp lệ" };
    }

    const zip = await JSZip.loadAsync(buffer);
    const parser = new XMLParser({
      ignoreAttributes: false,
      attributeNamePrefix: "@_",
    });

    // 1. Find content.opf from META-INF/container.xml
    const containerFile = zip.file("META-INF/container.xml");
    if (!containerFile) {
      return { success: false, error: "EPUB không hợp lệ: thiếu container.xml" };
    }

    const containerXml = await containerFile.async("string");
    const container = parser.parse(containerXml);
    const rootfiles = container?.container?.rootfiles ?? container?.rootfiles;
    const rootfileRaw = rootfiles?.rootfile ?? rootfiles?.[0];
    const rootfile = Array.isArray(rootfileRaw) ? rootfileRaw[0] : rootfileRaw;
    const opfPath =
      rootfile?.["@_full-path"] ?? rootfile?.["full-path"] ?? "content.opf";

    const opfDir = opfPath.includes("/") ? opfPath.replace(/\/[^/]+$/, "/") : "";

    // 2. Parse content.opf
    const opfFile = zip.file(opfPath);
    if (!opfFile) {
      return { success: false, error: "EPUB không hợp lệ: không tìm thấy content.opf" };
    }

    const opfXml = await opfFile.async("string");
    const opf = parser.parse(opfXml);

    const pkg = opf?.package ?? opf;
    const metadata = pkg?.metadata ?? {};
    const manifest = pkg?.manifest ?? {};
    const spine = pkg?.spine ?? {};

    // Metadata - handle various XML structures
    const getMeta = (obj: unknown, ...keys: string[]): string => {
      const o = obj as Record<string, unknown>;
      for (const k of keys) {
        const v = o?.[k];
        if (typeof v === "string") return v;
        if (v && typeof v === "object" && "#text" in (v as object)) {
          return String((v as { "#text": string })["#text"] ?? "");
        }
      }
      return "";
    };

    const title =
      getMeta(metadata, "title", "dc:title") || "Không có tiêu đề";
    const author =
      getMeta(metadata, "creator", "dc:creator") || "Tác giả không xác định";
    const description =
      getMeta(metadata, "description", "dc:description") || "";

    // Manifest: id -> { href, "media-type", properties }
    const manifestItems: Record<
      string,
      { href: string; "media-type"?: string; properties?: string }
    > = {};
    const rawManifest = manifest.item ?? manifest;
    const items = Array.isArray(rawManifest) ? rawManifest : [rawManifest];
    for (const item of items) {
      if (item && item["@_id"]) {
        const props = item["@_properties"] ?? item?.properties ?? "";
        manifestItems[item["@_id"]] = {
          href: item["@_href"] ?? item.href ?? "",
          "media-type": item["@_media-type"] ?? item["media-type"],
          properties: typeof props === "string" ? props : "",
        };
      }
    }

    // Spine: reading order (with itemref properties)
    const spineItemref = spine.itemref ?? spine;
    const spineItems = Array.isArray(spineItemref) ? spineItemref : [spineItemref];
    const spineEntries = spineItems
      .map((r: { "@_idref"?: string; idref?: string; "@_properties"?: string; properties?: string }) => ({
        id: r?.["@_idref"] ?? r?.idref ?? "",
        properties: r?.["@_properties"] ?? r?.properties ?? "",
      }))
      .filter((e): e is { id: string; properties: string } => Boolean(e.id));

    // TOC for chapter titles: map href -> label (from nav/ncx, exclude nav/toc items)
    const tocByHref = new Map<string, string>();
    const nav = pkg?.nav ?? pkg?.["ncx:navMap"] ?? pkg?.guide;
    if (nav) {
      const collectToc = (node: unknown): void => {
        if (!node) return;
        const n = node as {
          navLabel?: { text?: string };
          content?: { "@_src"?: string };
          navPoint?: unknown[];
        };
        const label = n.navLabel?.text;
        const src = typeof n.content === "object" && n.content
          ? (n.content as { "@_src"?: string })["@_src"]
          : undefined;
        if (label && src) {
          const cleanHref = src.split("#")[0];
          tocByHref.set(cleanHref, label);
        }
        if (Array.isArray(n.navPoint)) {
          n.navPoint.forEach(collectToc);
        }
      };
      const navPoints = nav.navPoint ?? (Array.isArray(nav) ? nav : [nav]);
      (Array.isArray(navPoints) ? navPoints : [navPoints]).forEach(collectToc);
    }

    // 3. Load each spine item and extract text (skip nav, TOC, cover, title page)
    const chapters: { id: string; title: string; content: string }[] = [];
    let chapterIndex = 0;

    for (const entry of spineEntries) {
      const { id, properties: itemrefProps } = entry;
      const manifestItem = manifestItems[id];
      if (!manifestItem) continue;

      // Skip nav document (TOC) - from manifest or spine itemref
      const manifestProps = (manifestItem.properties ?? "").toLowerCase();
      const refProps = (itemrefProps ?? "").toLowerCase();
      if (
        manifestProps.includes("nav") ||
        refProps.includes("nav") ||
        manifestProps.includes("toc")
      ) {
        continue;
      }

      let href = manifestItem.href;
      if (opfDir && !href.startsWith("/")) {
        href = opfDir + href;
      }
      const hrefForSkip = href;
      href = href.split("#")[0];

      const mediaType = manifestItem["media-type"] ?? "";
      if (
        !mediaType.includes("html") &&
        !mediaType.includes("xml") &&
        !href.match(/\.(xhtml|html|htm)$/i)
      ) {
        continue;
      }

      const file = zip.file(href) ?? zip.file(decodeURIComponent(href));
      if (!file) continue;

      const html = await file.async("string");
      const text = htmlToPlainText(html);

      if (!text.trim()) continue;

      // Skip front matter: cover, title page, very short
      if (isFrontMatterToSkip(text, hrefForSkip)) continue;

      // Skip content that looks like TOC (danh sách chương)
      if (looksLikeToc(text)) continue;

      // Get chapter title from TOC by href (try full path and basename)
      const hrefBasename = href.split("/").pop() ?? href;
      const defaultTitle =
        tocByHref.get(href) ??
        tocByHref.get(hrefBasename) ??
        `Chương ${chapters.length + 1}`;

      const splits = splitMergedChapters(text, defaultTitle);

      for (const split of splits) {
        chapters.push({
          id: `ch-${chapterIndex}-${chapters.length}`,
          title: split.title,
          content: split.content,
        });
      }
      chapterIndex++;
    }

    if (chapters.length === 0) {
      return { success: false, error: "Không tìm thấy chương nào trong file EPUB" };
    }

    const storyId = `epub-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;

    const data: StoryJSON = {
      id: storyId,
      title,
      author,
      description,
      chapters,
    };

    return { success: true, data };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { success: false, error: `Lỗi đọc EPUB: ${msg}` };
  }
}
