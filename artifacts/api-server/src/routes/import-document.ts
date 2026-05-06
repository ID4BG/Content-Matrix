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
import { requireAuth } from "../middlewares/requireAuth";

const router: IRouter = Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 20 * 1024 * 1024 } });

interface ParsedPiece {
  title: string;
  bodyText: string;
}

function parseDocumentText(text: string): ParsedPiece[] {
  const lines = text.split("\n").map((l) => l.trim());

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

  const singleMetaPatterns: RegExp[] = [
    /^Character count/i, /^Word count/i, /^Char count/i,
    /^💡/, /^🧵/, /^📌/, /^USAGE NOTE/i, /^Thread Format/i,
    /^Best Times/i, /^THREAD NOTE/i, /^Run time/i, /^Duration/i,
    /^Format:/i, /^Estimated read/i,
    /^(Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday)/i,
    /^\(Recommended\)/i, /^Note:/i, /^Tip:/i, /^Reminder:/i,
    /^Slides \(/i, /^\[.+\]$/, /^Production Direction/i,
    /^ON SCREEN/i, /^COPY\s*[↓:]/i, /^Post all \d/i,
    /^📌 POSTING TIP/i, /^\d+\s*\/\s*\d+$/, /^\/\d+/, /^\d{1,2}$/,
    /^#[0-9A-Fa-f]{3,7}$/,
  ];

  const blockMetaPatterns: RegExp[] = [
    /^Target Audience/i,
    /^Slide Header Color/i,
  ];

  const stripLabelPatterns: RegExp[] = [
    /^🎬\s*HOOK\s*:\s*/i,
    /^📝\s*CAPTION\s*:\s*/i,
    /^📱\s*CAPTION\s*:\s*/i,
    /^Script(?:\s+Beats)?\s*:\s*/i,
    /^Hook\s*\([^)]*\)\s*:\s*/i,
    /^CTA\s*\([^)]*\)\s*:\s*/i,
  ];

  const copyLabelPattern =
    /^(?:Tweet Copy|Post Copy|Body Copy|Body|Copy|Text|Voiceover|Narration|Post Caption(?:\s*\([^)]*\))?)\s*:/i;

  return sections.map((section) => {
    const hasCopyLabel = section.lines.some((l) => copyLabelPattern.test(l));
    let hashtagLine = "";
    const bodyLines: string[] = [];
    let inCopy = !hasCopyLabel;
    let blockSkipActive = false;
    let blockSkipContentSeen = false;

    for (const line of section.lines) {
      if (!line) {
        if (blockSkipActive) {
          if (blockSkipContentSeen) { blockSkipActive = false; blockSkipContentSeen = false; }
          continue;
        }
        if (bodyLines.length && bodyLines[bodyLines.length - 1] !== "") bodyLines.push("");
        continue;
      }
      if (blockMetaPatterns.some((p) => p.test(line))) { blockSkipActive = true; blockSkipContentSeen = false; continue; }
      if (blockSkipActive) { blockSkipContentSeen = true; continue; }
      if (singleMetaPatterns.some((p) => p.test(line))) continue;
      if (/^Hashtags?\s*:/i.test(line)) { hashtagLine = line.replace(/^Hashtags?\s*:\s*/i, "").trim(); continue; }
      if (copyLabelPattern.test(line)) {
        const inline = line.replace(copyLabelPattern, "").trim();
        if (inline) bodyLines.push(inline);
        inCopy = true;
        continue;
      }
      if (!inCopy) continue;
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

    while (bodyLines.length && bodyLines[bodyLines.length - 1] === "") bodyLines.pop();
    let bodyText = bodyLines.join("\n").trim();
    if (hashtagLine) bodyText = bodyText ? `${bodyText}\n\n${hashtagLine}` : hashtagLine;
    return { title: section.title, bodyText };
  });
}

// ── POST /content-pieces/import-document ─────────────────────────────────────
// Extracts content pieces from a DOCX and also saves the full document HTML.
router.post(
  "/content-pieces/import-document",
  requireAuth,
  upload.single("file"),
  async (req, res) => {
    try {
      const userId = (req as any).userId;
      if (!req.file) return void res.status(400).json({ error: "No file uploaded" });

      const campaignId = parseInt(req.body.campaignId, 10);
      const channel = req.body.channel as string;
      if (!campaignId || !channel) return void res.status(400).json({ error: "campaignId and channel are required" });

      const [campaign] = await db.select().from(campaignsTable).where(eq(campaignsTable.id, campaignId));
      if (!campaign) return void res.status(404).json({ error: "Campaign not found" });
      if (campaign.userId !== userId) return void res.status(403).json({ error: "Only the campaign owner can import documents" });

      // Extract text for section parsing
      const textResult = await mammoth.extractRawText({ buffer: req.file.buffer });
      const parsed = parseDocumentText(textResult.value);

      if (parsed.length === 0) {
        return void res.status(422).json({
          error: "No sections found. Make sure your document has headings like 'Post 1:', 'Video 2:', 'Reel 3:', 'Carousel 4:', etc.",
        });
      }

      // Convert full doc to HTML for the document piece
      const htmlResult = await mammoth.convertToHtml({ buffer: req.file.buffer });
      const docHtml = htmlResult.value;
      const fileName = req.file.originalname || "document.docx";

      // Sequential inserts with explicit sortOrder
      const created: ContentPiece[] = [];
      for (let i = 0; i < parsed.length; i++) {
        const piece = parsed[i];
        const [row] = await db
          .insert(contentPiecesTable)
          .values({
            campaignId,
            channel: channel as any,
            title: piece.title,
            bodyText: piece.bodyText || null,
            status: "uploaded",
            sortOrder: i + 1,
          })
          .returning();
        created.push(row);
      }

      // Save the source document as a special document-type piece (sortOrder 0)
      const [docPiece] = await db
        .insert(contentPiecesTable)
        .values({
          campaignId,
          channel: channel as any,
          title: fileName,
          bodyText: docHtml,
          mediaType: "document",
          status: "uploaded",
          sortOrder: 0,
        })
        .returning();

      res.json({ count: created.length, pieces: created, documentPiece: docPiece });
    } catch (err: any) {
      req.log?.error({ err }, "import-document failed");
      res.status(500).json({ error: "Failed to parse document" });
    }
  }
);

// ── POST /content-pieces/attach-document ─────────────────────────────────────
// Attaches a document to a channel for reference viewing (no piece extraction).
router.post(
  "/content-pieces/attach-document",
  requireAuth,
  upload.single("file"),
  async (req, res) => {
    try {
      const userId = (req as any).userId;
      if (!req.file) return void res.status(400).json({ error: "No file uploaded" });

      const campaignId = parseInt(req.body.campaignId, 10);
      const channel = req.body.channel as string;
      if (!campaignId || !channel) return void res.status(400).json({ error: "campaignId and channel are required" });

      const [campaign] = await db.select().from(campaignsTable).where(eq(campaignsTable.id, campaignId));
      if (!campaign) return void res.status(404).json({ error: "Campaign not found" });
      if (campaign.userId !== userId) return void res.status(403).json({ error: "Only the campaign owner can attach documents" });

      const htmlResult = await mammoth.convertToHtml({ buffer: req.file.buffer });
      const fileName = req.file.originalname || "document.docx";

      const [docPiece] = await db
        .insert(contentPiecesTable)
        .values({
          campaignId,
          channel: channel as any,
          title: fileName,
          bodyText: htmlResult.value,
          mediaType: "document",
          status: "uploaded",
          sortOrder: 0,
        })
        .returning();

      res.json({ documentPiece: docPiece });
    } catch (err: any) {
      req.log?.error({ err }, "attach-document failed");
      res.status(500).json({ error: "Failed to attach document" });
    }
  }
);

export default router;
