import { Router, type IRouter } from "express";
import { createRequire } from "module";
import multer from "multer";
import { db } from "@workspace/db";

const require = createRequire(import.meta.url);
// eslint-disable-next-line @typescript-eslint/no-require-imports
const mammoth = require("mammoth") as typeof import("mammoth");
import { contentPiecesTable, campaignsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import type { ContentPiece } from "@workspace/db";

const router: IRouter = Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 20 * 1024 * 1024 } });

interface ParsedPiece {
  title: string;
  bodyText: string;
}

function parseDocumentText(text: string): ParsedPiece[] {
  const lines = text.split("\n").map((l) => l.trim());

  // Match section headers:
  //   "Post 1: Title"    "Video 2. Title"    "Reel 3 — Title"
  //   "CAROUSEL 1  Title" (space after number, no colon)
  const sectionPattern =
    /^(?:Post|Video|Reel|Image|Photo|Story|Content|Email|Newsletter|Blog|Chapter|Section|Article|Part|Tweet|Hook|Tip|Step|Lesson|Carousel)\s+\d+[\s:.–\-]/i;

  const sections: { title: string; lines: string[] }[] = [];
  let current: { title: string; lines: string[] } | null = null;

  for (const line of lines) {
    if (sectionPattern.test(line)) {
      if (current) sections.push(current);
      current = { title: line, lines: [] };
    } else if (current) {
      current.lines.push(line);
    }
  }
  if (current) sections.push(current);
  if (sections.length === 0) return [];

  // Lines that are purely production/meta — always skip
  const metaPatterns: RegExp[] = [
    /^Character count/i,
    /^Word count/i,
    /^Char count/i,
    /^💡/,
    /^🧵/,
    /^📌/,
    /^USAGE NOTE/i,
    /^Thread Format/i,
    /^Best Times/i,
    /^THREAD NOTE/i,
    /^Run time/i,
    /^Duration/i,
    /^Format:/i,
    /^Estimated read/i,
    /^(Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday)/i,
    /^\(Recommended\)/i,
    /^Note:/i,
    /^Tip:/i,
    /^Reminder:/i,
    /^Target Audience/i,
    /^Slide Header Color/i,
    /^Slides \(/i,
    /^\[.+\]$/,         // [designer / director notes in brackets]
    /^Production Direction/i,
    /^ON SCREEN/i,      // videographer instruction lines
    /^COPY\s*[↓:]/i,
    /^Post all \d/i,    // "Post all 4 tweets as a thread…"
    /^📌 POSTING TIP/i,
    /^\d+\s*\/\s*\d+$/, // "1/6" slide-number lines
    /^\/\d+/,           // "/6" second-half of split slide numbers
  ];

  // For video formats (no explicit copy label): strip these label prefixes but
  // keep whatever content follows on the same line. Content on the NEXT line is
  // collected naturally.
  const stripLabelPatterns: RegExp[] = [
    /^🎬\s*HOOK\s*:\s*/i,        // Instagram "🎬 HOOK: text"
    /^📝\s*CAPTION\s*:\s*/i,     // Instagram "📝 CAPTION: text"
    /^📱\s*CAPTION\s*:\s*/i,     // TikTok   "📱 CAPTION: text"
    /^Script(?:\s+Beats)?\s*:\s*/i, // "Script:" / "Script Beats:" — label only
    /^Hook\s*\([^)]*\)\s*:\s*/i,    // "Hook (First 2 seconds…):" — label only
    /^CTA\s*\([^)]*\)\s*:\s*/i,     // "CTA (End Screen):" / "CTA (End of Video):" — label only
  ];

  // Copy labels used by Twitter, LinkedIn, Facebook.
  // When present, we only collect body content AFTER this label.
  const copyLabelPattern =
    /^(?:Tweet Copy|Post Copy|Post Caption(?:\s*\([^)]*\))?|Body Copy|Body|Copy|Text|Voiceover|Narration|Content)\s*:/i;

  return sections.map((section) => {
    // Does this section have an explicit copy-label? (text-first formats)
    const hasCopyLabel = section.lines.some((l) => copyLabelPattern.test(l));

    let hashtagLine = "";
    const bodyLines: string[] = [];

    // Text-first (Twitter / LinkedIn / Facebook): collect only after the label.
    // Video / full-section (Reels / TikTok): collect everything that isn't meta.
    let inCopy = !hasCopyLabel;

    for (const line of section.lines) {
      if (!line) {
        if (bodyLines.length && bodyLines[bodyLines.length - 1] !== "") bodyLines.push("");
        continue;
      }

      // Always skip pure meta lines
      if (metaPatterns.some((p) => p.test(line))) continue;

      // Hashtag lines — extract and handle
      if (/^Hashtags?\s*:/i.test(line)) {
        const tags = line.replace(/^Hashtags?\s*:\s*/i, "").trim();
        if (hasCopyLabel) {
          // For text formats: collect separately and append at the end
          hashtagLine = tags;
        } else {
          // For video formats: inline as part of the body
          if (tags) bodyLines.push(tags);
        }
        continue;
      }

      // Copy label (text formats only)
      if (copyLabelPattern.test(line)) {
        const inline = line.replace(copyLabelPattern, "").trim();
        if (inline) bodyLines.push(inline);
        inCopy = true;
        continue;
      }

      if (!inCopy) continue;

      // Strip known label prefixes from video-format lines, keep inline content
      let strippedByLabel = false;
      for (const pattern of stripLabelPatterns) {
        if (pattern.test(line)) {
          const content = line.replace(pattern, "").trim();
          if (content) bodyLines.push(content);
          // No content inline (e.g. "Script Beats:") → next lines collected normally
          strippedByLabel = true;
          break;
        }
      }
      if (!strippedByLabel) bodyLines.push(line);
    }

    // Trim trailing blank lines
    while (bodyLines.length && bodyLines[bodyLines.length - 1] === "") bodyLines.pop();

    let bodyText = bodyLines.join("\n").trim();
    if (hashtagLine) bodyText = bodyText ? `${bodyText}\n\n${hashtagLine}` : hashtagLine;

    return { title: section.title, bodyText };
  });
}

router.post(
  "/content-pieces/import-document",
  upload.single("file"),
  async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: "No file uploaded" });
      }

      const campaignId = parseInt(req.body.campaignId, 10);
      const channel = req.body.channel as string;

      if (!campaignId || !channel) {
        return res.status(400).json({ error: "campaignId and channel are required" });
      }

      const [campaign] = await db
        .select()
        .from(campaignsTable)
        .where(eq(campaignsTable.id, campaignId));

      if (!campaign) {
        return res.status(404).json({ error: "Campaign not found" });
      }

      const result = await mammoth.extractRawText({ buffer: req.file.buffer });
      const text = result.value;

      const parsed = parseDocumentText(text);

      if (parsed.length === 0) {
        return res.status(422).json({
          error:
            "No sections found. Make sure your document has headings like 'Post 1:', 'Video 2:', 'Reel 3:', 'Carousel 4:', etc.",
        });
      }

      // Sequential inserts so DB IDs — and therefore display order — match
      // the document order exactly.
      const created: ContentPiece[] = [];
      for (const piece of parsed) {
        const [row] = await db
          .insert(contentPiecesTable)
          .values({
            campaignId,
            channel: channel as any,
            title: piece.title,
            bodyText: piece.bodyText || null,
            status: "uploaded",
          })
          .returning();
        created.push(row);
      }

      res.json({ count: created.length, pieces: created });
    } catch (err: any) {
      req.log?.error({ err }, "import-document failed");
      res.status(500).json({ error: "Failed to parse document" });
    }
  }
);

export default router;
