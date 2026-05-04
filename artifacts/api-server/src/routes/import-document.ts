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

  // Detect section boundaries: "Post 1:", "Video 3.", "Part 2 –", numbered headings like "1. Title"
  const sectionPattern =
    /^(?:(?:Post|Video|Reel|Image|Photo|Story|Content|Email|Newsletter|Blog|Chapter|Section|Article|Caption|Slide|Part|Tweet|Hook|Tip|Step|Lesson)\s*\d+[:.–\-]|\d+[.:]\s+\S)/i;

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

  const metaPatterns = [
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
    /^Estimated read/i,
    /^Monday|^Tuesday|^Wednesday|^Thursday|^Friday|^Saturday|^Sunday/i,
    /^\(Recommended\)/i,
    /^Note:/i,
    /^Tip:/i,
    /^Reminder:/i,
  ];

  const copyLabelPattern =
    /^(Tweet Copy|Caption|Body Copy|Body|Copy|Text|Script|Voiceover|Narration|Caption\/Body|Hook|Post Copy|Content|Caption \/ Body)[\s]*[:]/i;

  return sections.map((section) => {
    let hashtagLine = "";
    const bodyLines: string[] = [];
    let inCopy = false;
    let copyFound = false;

    for (const line of section.lines) {
      if (!line) {
        if (bodyLines.length > 0 && bodyLines[bodyLines.length - 1] !== "") {
          bodyLines.push("");
        }
        continue;
      }

      if (metaPatterns.some((p) => p.test(line))) continue;

      if (/^Hashtags?:/i.test(line)) {
        hashtagLine = line.replace(/^Hashtags?:\s*/i, "").trim();
        continue;
      }

      if (copyLabelPattern.test(line)) {
        inCopy = true;
        copyFound = true;
        continue;
      }

      if (inCopy || !copyFound) {
        bodyLines.push(line);
      }
    }

    while (bodyLines.length > 0 && bodyLines[bodyLines.length - 1] === "") {
      bodyLines.pop();
    }

    let bodyText = bodyLines.join("\n").trim();
    if (hashtagLine) {
      bodyText = bodyText ? `${bodyText}\n\n${hashtagLine}` : hashtagLine;
    }

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
            "No sections found. Make sure your document has headings like 'Post 1:', 'Video 2:', etc.",
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
