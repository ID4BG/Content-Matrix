import { Router, type IRouter } from "express";
import { createRequire } from "module";
import multer from "multer";
import { db } from "@workspace/db";

const require = createRequire(import.meta.url);
// eslint-disable-next-line @typescript-eslint/no-require-imports
const mammoth = require("mammoth") as typeof import("mammoth");
import { contentPiecesTable, campaignsTable } from "@workspace/db";
import { eq } from "drizzle-orm";

const router: IRouter = Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 20 * 1024 * 1024 } });

interface ParsedPiece {
  title: string;
  bodyText: string;
}

function parseDocumentText(text: string): ParsedPiece[] {
  const lines = text.split("\n").map((l) => l.trim());

  // Match section headers like:
  //   "Post 1: Title"      "Video 2. Title"      "Reel 3 — Title"
  //   "CAROUSEL 1  Title"  (no colon, space after number)
  //   "Tweet 4: Title"
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

  // Lines that are metadata / production notes — always skip
  const metaPatterns: RegExp[] = [
    /^Character count/i,
    /^Word count/i,
    /^Char count/i,
    /^💡/,
    /^🧵/,
    /^📌/,
    /^🎬/,
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
    /^\[.+\]$/, // [designer/director notes]
    /^Script Beats/i,
    /^Script:/i,
    /^Production Direction/i,
    /^CTA \(/i,
    /^Hook \(/i,
    /^ON SCREEN/i,
    /^COPY\s*[↓:]/i,
    /^Post all \d/i, // "Post all 4 tweets as a thread"
    /^📌 POSTING TIP/i,
    /^\d+\s*\/\s*\d+$/, // "1/6" or "1 / 6" slide numbers
    /^\/\d+/, // "/6" second half of split slide numbers
    /^\[/, // any [bracket] line
  ];

  // Emoji caption labels: 📝 CAPTION: or 📱 CAPTION:
  // These are the preferred body source for Instagram Reels and TikTok
  const emojiCaptionPattern = /^(?:📝|📱)\s*CAPTION\s*:/i;

  // Text labels that mark the start of post body copy
  // Handles: "Tweet Copy:", "Post Copy:", "Post Caption (paste...above...):", "Body Copy:", etc.
  const copyLabelPattern =
    /^(?:Tweet Copy|Post Copy|Post Caption(?:\s*\([^)]*\))?|Body Copy|Body|Caption|Copy|Text|Voiceover|Narration|Hook|Content)\s*:/i;

  return sections.map((section) => {
    // ── Pass 1: look for an emoji caption (Instagram / TikTok) ──────────────
    let emojiCaptionBody = "";
    let emojiHashtags = "";
    let emojiCaptionFound = false;

    for (let i = 0; i < section.lines.length; i++) {
      const line = section.lines[i];
      if (!emojiCaptionPattern.test(line)) continue;

      emojiCaptionFound = true;
      // Content may start on the same line after the label
      const inline = line.replace(emojiCaptionPattern, "").trim();
      const captionLines: string[] = inline ? [inline] : [];

      // Collect remaining lines until we hit a "Hashtags:" label or end
      for (let j = i + 1; j < section.lines.length; j++) {
        const next = section.lines[j];
        if (/^Hashtags?\s*:/i.test(next)) {
          emojiHashtags = next.replace(/^Hashtags?\s*:\s*/i, "").trim();
          break;
        }
        // skip production meta but keep plain text (including inline hashtag lines)
        if (metaPatterns.some((p) => p.test(next))) continue;
        captionLines.push(next);
      }

      // Trim trailing blank lines
      while (captionLines.length && captionLines[captionLines.length - 1] === "") captionLines.pop();
      emojiCaptionBody = captionLines.join("\n").trim();
      break;
    }

    if (emojiCaptionFound && emojiCaptionBody) {
      let bodyText = emojiCaptionBody;
      if (emojiHashtags) bodyText += `\n\n${emojiHashtags}`;
      return { title: section.title, bodyText };
    }

    // ── Pass 2: text copy-label extraction (Twitter, LinkedIn, Facebook) ────
    let hashtagLine = "";
    const bodyLines: string[] = [];

    // Pre-scan: does this section have any explicit copy label?
    const hasCopyLabel = section.lines.some((l) => copyLabelPattern.test(l));

    // If a copy label exists we only collect AFTER it; otherwise collect everything non-meta
    let inCopy = !hasCopyLabel;

    for (const line of section.lines) {
      if (!line) {
        if (bodyLines.length && bodyLines[bodyLines.length - 1] !== "") bodyLines.push("");
        continue;
      }

      if (metaPatterns.some((p) => p.test(line))) continue;

      if (/^Hashtags?\s*:/i.test(line)) {
        hashtagLine = line.replace(/^Hashtags?\s*:\s*/i, "").trim();
        continue;
      }

      if (copyLabelPattern.test(line)) {
        // Anything on the same line after the label starts the body
        const inline = line.replace(copyLabelPattern, "").trim();
        if (inline) bodyLines.push(inline);
        inCopy = true;
        continue;
      }

      if (inCopy) bodyLines.push(line);
    }

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

      const created = await Promise.all(
        parsed.map(async (piece) => {
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
          return row;
        })
      );

      res.json({ count: created.length, pieces: created });
    } catch (err: any) {
      req.log?.error({ err }, "import-document failed");
      res.status(500).json({ error: "Failed to parse document" });
    }
  }
);

export default router;
