import { randomUUID } from "expo-crypto";

export type SplitTextType = "paragraph" | "dot" | "comma" | "space";

export interface SplitTextResult {
  text: string;
  type: SplitTextType;
}

// Cấu trúc dữ liệu lồng nhau
// Dot, Comma, Space là ngang hàng và nằm trong ParagraphSegment
export interface SpaceSegment {
  text: string;
  type: "space";
  id: string;
}

export interface CommaSegment {
  text: string;
  type: "comma";
  id: string;
}

export interface DotSegment {
  text: string;
  type: "dot";
  id: string;
}

// Union type cho các segment con của Paragraph
export type ParagraphChildSegment = DotSegment | CommaSegment | SpaceSegment;

export interface ParagraphSegment {
  text: string;
  type: "paragraph";
  segments: ParagraphChildSegment[];
  id: string;
}

export type NestedSplitTextResult = ParagraphSegment[];

/** biome-ignore-all lint/suspicious/noControlCharactersInRegex: <explanation> */
export function generateUUID() {
  return randomUUID();
}

/**
 * Làm sạch text để loại bỏ các ký tự đặc biệt có thể gây lỗi với TTS API
 * @param text - Text cần làm sạch
 * @returns Text đã được làm sạch
 */
function sanitizeTextForTTS(text: string): string {
  if (!text || typeof text !== "string") {
    return "";
  }

  return (
    text
      // Loại bỏ control characters (trừ \n, \r, \t)
      .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, "")
      // Loại bỏ zero-width characters
      .replace(/[\u200B-\u200D\uFEFF]/g, "")
      // Loại bỏ các ký tự không in được (trừ space và các ký tự tiếng Việt)
      .replace(/[\u0000-\u001F\u007F-\u009F]/g, "")
      // Thay thế nhiều khoảng trắng liên tiếp bằng một khoảng trắng
      .replace(/[ \t]+/g, " ")
      // Loại bỏ khoảng trắng ở đầu và cuối mỗi dòng
      .replace(/^[ \t]+|[ \t]+$/gm, "")
      // Loại bỏ các dòng trống
      .replace(/\n\s*\n/g, "\n")
      .replace(/\.{3,}/g, "…") // gom ...
      .replace(/-{2,}/g, ", ") // -- → ,
      .replace(/\s*-\s*/g, " ") // - → ,
      .replace(/[!?]{2,}/g, "?") // ??? → ?
      .replace(/\n{2,}/g, "\n") // nhiều newline → 1
      .replace(/:/g, "") // loại bỏ :
      .replace(/"/g, "") // loại bỏ .
      .trim()
  );
}

/**
 * Phân tách một đoạn text dài thành cấu trúc lồng nhau:
 * Paragraph -> [Dot, Comma, Space] (Dot, Comma, Space là ngang hàng)
 *
 * @param text - Đoạn text cần phân tách
 * @param minLength - Giá trị tối thiểu (độ dài tối đa cho mỗi đoạn)
 * @returns Mảng ParagraphSegment chứa các segment ngang hàng (Dot, Comma, Space)
 */
export function splitTextNested(
  text: string,
  minLength: number
): NestedSplitTextResult {
  if (!text || typeof text !== "string") {
    return [];
  }

  if (minLength <= 0) {
    const trimmed = text.trim();
    if (trimmed.length === 0) return [];
    const sanitized = sanitizeTextForTTS(trimmed);
    if (!sanitized) return [];
    return [
      {
        text: sanitized,
        type: "paragraph",
        segments: [],
        id: generateUUID(),
      },
    ];
  }

  /**
   * Xử lý một đoạn text và trả về mảng các segment (Dot, Comma, Space)
   */
  function processSegment(segmentText: string): ParagraphChildSegment[] {
    const trimmed = segmentText.trim();
    if (!trimmed) return [];

    const segments: ParagraphChildSegment[] = [];

    // Bước 1: Thử split theo dấu chấm "."
    const periodRegex = /\.(?=\s|$)/g;
    const periodMatches = [...trimmed.matchAll(periodRegex)];

    if (periodMatches.length > 0) {
      let lastIndex = 0;

      for (const match of periodMatches) {
        const pos = match.index!;
        const beforePeriod = trimmed.substring(lastIndex, pos).trim();
        if (beforePeriod) {
          const dotText = `${beforePeriod}.`;
          // Nếu Dot đạt điều kiện, thêm vào segments
          if (dotText.length <= minLength) {
            const sanitized = sanitizeTextForTTS(dotText);
            if (sanitized) {
              segments.push({
                text: sanitized,
                type: "dot",
                id: generateUUID(),
              });
            }
          } else {
            // Nếu Dot không đạt, tiếp tục xử lý (split theo dấu phẩy hoặc khoảng trắng)
            const subSegments = processCommaOrSpace(dotText);
            segments.push(...subSegments);
          }
        }
        lastIndex = pos + 1;
      }

      // Phần còn lại sau dấu chấm cuối cùng
      const remaining = trimmed.substring(lastIndex).trim();
      if (remaining) {
        if (remaining.length <= minLength) {
          // Phần còn lại không có dấu chấm, kiểm tra dấu phẩy để xác định type
          const commaRegex = /,(?=\s|$)/g;
          if (commaRegex.test(remaining)) {
            // Có dấu phẩy nhưng đạt điều kiện, tạo CommaSegment
            const sanitized = sanitizeTextForTTS(remaining);
            if (sanitized) {
              segments.push({
                text: sanitized,
                type: "comma",
                id: generateUUID(),
              });
            }
          } else {
            // Không có dấu phẩy, tạo SpaceSegment
            const sanitized = sanitizeTextForTTS(remaining);
            if (sanitized) {
              segments.push({
                text: sanitized,
                type: "space",
                id: generateUUID(),
              });
            }
          }
        } else {
          // Phần còn lại dài hơn, tiếp tục xử lý
          const subSegments = processCommaOrSpace(remaining);
          segments.push(...subSegments);
        }
      }

      return segments;
    }

    // Bước 2: Không có dấu chấm, thử split theo dấu phẩy
    return processCommaOrSpace(trimmed);
  }

  /**
   * Xử lý split theo dấu phẩy hoặc khoảng trắng
   */
  function processCommaOrSpace(segmentText: string): ParagraphChildSegment[] {
    const trimmed = segmentText.trim();
    if (!trimmed) return [];

    // Nếu đoạn đã đạt yêu cầu, trả về SpaceSegment (vì không có dấu chấm/phẩy)
    if (trimmed.length <= minLength) {
      const sanitized = sanitizeTextForTTS(trimmed);
      return sanitized
        ? [{ text: sanitized, type: "space", id: generateUUID() }]
        : [];
    }

    const segments: ParagraphChildSegment[] = [];
    const commaRegex = /,(?=\s|$)/g;
    const commaMatches = [...trimmed.matchAll(commaRegex)];

    if (commaMatches.length > 0) {
      let lastIndex = 0;

      for (const match of commaMatches) {
        const pos = match.index!;
        const beforeComma = trimmed.substring(lastIndex, pos).trim();
        if (beforeComma) {
          const commaText = `${beforeComma},`;
          // Nếu Comma đạt điều kiện, thêm vào segments
          if (commaText.length <= minLength) {
            const sanitized = sanitizeTextForTTS(commaText);
            if (sanitized) {
              segments.push({
                text: sanitized,
                type: "comma",
                id: generateUUID(),
              });
            }
          } else {
            // Nếu Comma không đạt, tiếp tục split theo khoảng trắng
            const spaceSegments = processSpaceOnly(commaText);
            segments.push(...spaceSegments);
          }
        }
        lastIndex = pos + 1;
      }

      // Phần còn lại sau dấu phẩy cuối cùng
      const remaining = trimmed.substring(lastIndex).trim();
      if (remaining) {
        if (remaining.length <= minLength) {
          // Phần còn lại đạt điều kiện, tạo SpaceSegment
          segments.push({
            text: remaining,
            type: "space",
            id: generateUUID(),
          });
        } else {
          const spaceSegments = processSpaceOnly(remaining);
          segments.push(...spaceSegments);
        }
      }

      return segments;
    }

    // Bước 3: Không có dấu phẩy, split theo khoảng trắng
    return processSpaceOnly(trimmed);
  }

  /**
   * Xử lý split theo khoảng trắng (tạo SpaceSegment)
   */
  function processSpaceOnly(segmentText: string): SpaceSegment[] {
    const trimmed = segmentText.trim();
    if (!trimmed) return [];

    if (trimmed.length <= minLength) {
      const sanitized = sanitizeTextForTTS(trimmed);
      return sanitized
        ? [{ text: sanitized, type: "space", id: generateUUID() }]
        : [];
    }

    const words = trimmed.split(/\s+/).filter((w) => w.length > 0);

    if (words.length === 0) {
      const sanitized = sanitizeTextForTTS(trimmed);
      return sanitized
        ? [{ text: sanitized, type: "space", id: generateUUID() }]
        : [];
    }

    const spaceSegments: SpaceSegment[] = [];
    let currentChunk = "";

    for (const word of words) {
      const testChunk = currentChunk ? `${currentChunk} ${word}` : word;

      if (testChunk.length <= minLength - 1) {
        currentChunk = testChunk;
      } else {
        if (currentChunk) {
          const sanitized = sanitizeTextForTTS(currentChunk);
          if (sanitized) {
            spaceSegments.push({
              text: sanitized,
              type: "space",
              id: generateUUID(),
            });
          }
        }
        currentChunk = word;
      }
    }

    if (currentChunk) {
      const sanitized = sanitizeTextForTTS(currentChunk);
      if (sanitized) {
        spaceSegments.push({
          text: sanitized,
          type: "space",
          id: generateUUID(),
        });
      }
    }

    return spaceSegments;
  }

  /**
   * Xử lý các đoạn Paragraph (split theo \n)
   */
  function processParagraphSegments(fullText: string): ParagraphSegment[] {
    const trimmed = fullText.trim();
    if (!trimmed) return [];

    // Split theo \n để tạo mảng Paragraph
    const paragraphSegments = trimmed
      .split("\n")
      .filter((seg) => seg.trim().length > 0);

    return paragraphSegments
      .map((paragraph) => {
        const trimmedParagraph = paragraph.trim();
        const sanitizedParagraph = sanitizeTextForTTS(trimmedParagraph);

        if (!sanitizedParagraph) return null;

        // Nếu Paragraph đã đạt yêu cầu, không tạo con
        if (sanitizedParagraph.length <= minLength) {
          return {
            text: sanitizedParagraph,
            type: "paragraph" as const,
            segments: [],
            id: generateUUID(),
          };
        }

        // Nếu Paragraph dài hơn, tiếp tục split
        const segments = processSegment(sanitizedParagraph);
        return {
          text: sanitizedParagraph,
          type: "paragraph" as const,
          segments,
          id: generateUUID(),
        };
      })
      .filter((p): p is ParagraphSegment => p !== null);
  }

  // Bắt đầu xử lý từ đoạn text gốc
  return processParagraphSegments(text);
}

/**
 * Chuyển mảng ParagraphSegment thành mảng string phẳng để TTS đọc
 */
export function flattenParagraphs(segments: ParagraphSegment[]): string[] {
  const items: string[] = [];
  for (const p of segments) {
    if (p.segments.length === 0) {
      items.push(p.text);
    } else {
      for (const seg of p.segments) {
        items.push(seg.text);
      }
    }
  }
  return items;
}

/**
 * Parse nội dung chương thành mảng các đoạn văn cho TTS
 */
export function chapterContentToParagraphs(
  content: string,
  chunkMaxLength: number = 500
): string[] {
  const nested = splitTextNested(content, chunkMaxLength);
  return flattenParagraphs(nested);
}
