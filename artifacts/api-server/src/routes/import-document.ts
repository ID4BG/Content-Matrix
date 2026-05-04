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
  //   "Post 1: Title"     "Video 2. Title"     "Reel 3 — Title"
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

  // ── Single-line meta: always skip the matched line ───────────────────────
  const singleMetaPatterns: RegExp[] = [
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
    /^Slides \(/i,         // "Slides (6 total — 1080×1080px each):"
    /^\[.+\]$/,            // [designer / director notes]
    /^Production Direction/i,
    /^ON SCREEN/i,         // videographer instructions
    /^COPY\s*[↓:]/i,
    /^Post all \d/i,       // "Post all 4 tweets as a thread…"
    /^📌 POSTING TIP/i,
    /^\d+\s*\/\s*\d+$/,   // "1/6" slide-number on one line
    /^\/\d+/,              // "/6" second half of split slide numbers
    /^\d{1,2}$/,           // standalone "1", "2" … "12" — slide indices
    /^#[0-9A-Fa-f]{3,7}$/, // standalone hex colours like "#1E3A5F"
  ];

  // ── Block-meta: skip the label AND all content until the block drains ────
  // Pattern fires → blockSkip=true; next non-empty content line is skipped;
  // the following empty line clears blockSkip.
  const blockMetaPatterns: RegExp[] = [
    /^Target Audience/i,       // Facebook: audience descriptor that follows
    /^Slide Header Color/i,    // Facebook: hex colour value that follows
  ];

  // ── Label prefixes to strip (keep inline content / next lines naturally) ─
  const stripLabelPatterns: RegExp[] = [
    /^🎬\s*HOOK\s*:\s*/i,               // Instagram "🎬 HOOK: text"
    /^📝\s*CAPTION\s*:\s*/i,            // Instagram "📝 CAPTION: text"
    /^📱\s*CAPTION\s*:\s*/i,            // TikTok   "📱 CAPTION: text"
    /^Script(?:\s+Beats)?\s*:\s*/i,     // "Script:" / "Script Beats:"
    /^Hook\s*\([^)]*\)\s*:\s*/i,        // "Hook (First 2 seconds…):"
    /^CTA\s*\([^)]*\)\s*:\s*/i,         // "CTA (End Screen):" / "CTA (End of Video):"
    /^Post Caption(?:\s*\([^)]*\))?\s*:\s*/i, // Facebook "Post Caption (paste…):"
  ];

  // ── Copy labels: only collect body content AFTER these (text formats) ────
  // Facebook's "Post Caption" is intentionally NOT here — it goes via
  // stripLabelPatterns so slide content before it is also collected.
  const copyLabelPattern =
    /^(?:Tweet Copy|Post Copy|Body Copy|Body|Copy|Text|Voiceover|Narration)\s*:/i;

  return sections.map((section) => {
    const hasCopyLabel = section.lines.some((l) => copyLabelPattern.test(l));

    let hashtagLine = "";
    const bodyLines: string[] = [];
    let inCopy = !hasCopyLabel; // text formats start closed; video/carousel open

    // Block-skip state: skip the label AND the content block that follows it.
    // The block ends after we've consumed one non-empty content line then an empty.
    let blockSkipActive = false;
    let blockSkipContentSeen = false;

    for (const line of section.lines) {
      // ── Empty line handling ──────────────────────────────────────────────
      if (!line) {
        if (blockSkipActive) {
          if (blockSkipContentSeen) {
            // Content consumed → end block on this empty line
            blockSkipActive = false;
            blockSkipContentSeen = false;
          }
          // Always skip empty lines while inside a block-skip
          continue;
        }
        // Normal empty: add at most one blank separator
        if (bodyLines.length && bodyLines[bodyLines.length - 1] !== "") {
          bodyLines.push("");
        }
        continue;
      }

      // ── Block-meta: skip label AND subsequent content block ──────────────
      if (blockMetaPatterns.some((p) => p.test(line))) {
        blockSkipActive = true;
        blockSkipContentSeen = false;
        continue;
      }
      if (blockSkipActive) {
        blockSkipContentSeen = true;
        continue; // skip block content
      }

      // ── Single-line meta: skip just this line ───────────────────────────
      if (singleMetaPatterns.some((p) => p.test(line))) continue;

      // ── Hashtag lines ────────────────────────────────────────────────────
      if (/^Hashtags?\s*:/i.test(line)) {
        hashtagLine = line.replace(/^Hashtags?\s*:\s*/i, "").trim();
        continue;
      }

      // ── Copy label (text formats: Twitter / LinkedIn) ────────────────────
      if (copyLabelPattern.test(line)) {
        const inline = line.replace(copyLabelPattern, "").trim();
        if (inline) bodyLines.push(inline);
        inCopy = true;
        continue;
      }

      if (!inCopy) continue;

      // ── Strip-label prefixes (video / carousel formats) ──────────────────
      let strippedByLabel = false;
      for (const pattern of stripLabelPatterns) {
        if (pattern.test(line)) {
          const content = line.replace(pattern, "").trim();
          if (content) bodyLines.push(content);
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

      // Sequential inserts preserve document order in DB IDs
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
