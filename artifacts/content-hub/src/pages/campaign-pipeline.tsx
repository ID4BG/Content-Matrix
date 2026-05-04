import { useState, useRef } from "react";
import { useRoute, Link } from "wouter";
import { ArrowLeft, KanbanSquare, ExternalLink } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import {
  useGetCampaign,
  useListContentPieces,
  useUpdateContentPiece,
  getListContentPiecesQueryKey,
  ContentPiece,
  ContentPieceStatus,
} from "@workspace/api-client-react";
import { ChannelIcon, getChannelName } from "@/components/channel-icon";
import { useToast } from "@/hooks/use-toast";
import { format, parseISO } from "date-fns";

const COLUMNS: { status: ContentPieceStatus; label: string; bg: string; border: string; header: string; dot: string }[] = [
  {
    status: "empty",
    label: "Empty",
    bg: "bg-card",
    border: "border-border",
    header: "bg-secondary/30",
    dot: "bg-muted-foreground/40",
  },
  {
    status: "uploaded",
    label: "Uploaded",
    bg: "bg-card",
    border: "border-border",
    header: "bg-secondary/30 dark:bg-secondary/20",
    dot: "bg-gray-500",
  },
  {
    status: "in_review",
    label: "In Review",
    bg: "bg-amber-50/50 dark:bg-amber-950/30",
    border: "border-amber-200 dark:border-amber-900",
    header: "bg-amber-50 dark:bg-amber-950/50",
    dot: "bg-amber-500",
  },
  {
    status: "needs_revision",
    label: "Needs Revision",
    bg: "bg-rose-50/40 dark:bg-rose-950/30",
    border: "border-rose-200 dark:border-rose-900",
    header: "bg-rose-50 dark:bg-rose-950/50",
    dot: "bg-rose-500",
  },
  {
    status: "approved",
    label: "Approved",
    bg: "bg-blue-50/40 dark:bg-blue-950/30",
    border: "border-blue-200 dark:border-blue-900",
    header: "bg-blue-50 dark:bg-blue-950/50",
    dot: "bg-blue-500",
  },
];

function PieceCard({
  piece,
  campaignId,
  onDragStart,
}: {
  piece: ContentPiece;
  campaignId: number;
  onDragStart: (id: number) => void;
}) {
  return (
    <div
      draggable
      onDragStart={(e) => {
        e.dataTransfer.effectAllowed = "move";
        e.dataTransfer.setData("pieceId", String(piece.id));
        onDragStart(piece.id);
      }}
      className="group bg-card border border-border p-3 cursor-grab active:cursor-grabbing hover:shadow-sm hover:border-foreground/20 transition-all select-none"
    >
      <div className="flex items-start gap-2">
        <div className="mt-0.5 text-muted-foreground shrink-0">
          <ChannelIcon channel={piece.channel} className="w-3.5 h-3.5" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-xs font-semibold leading-snug truncate">
            {piece.title || getChannelName(piece.channel)}
          </p>
          <p className="text-[10px] text-muted-foreground uppercase tracking-widest font-bold mt-1">
            {getChannelName(piece.channel)}
          </p>
          {piece.scheduledDate && (
            <p className="text-[10px] text-muted-foreground mt-1">
              📅 {format(parseISO(piece.scheduledDate), "MMM d")}
            </p>
          )}
        </div>
        <Link
          href={`/campaigns/${campaignId}/pieces/${piece.id}`}
          className="opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-foreground"
          onClick={(e) => e.stopPropagation()}
        >
          <ExternalLink className="w-3 h-3" />
        </Link>
      </div>
    </div>
  );
}

function KanbanColumn({
  col,
  pieces,
  campaignId,
  dragOverStatus,
  draggingId,
  onDragStart,
  onDrop,
  onDragOver,
  onDragLeave,
}: {
  col: (typeof COLUMNS)[number];
  pieces: ContentPiece[];
  campaignId: number;
  dragOverStatus: ContentPieceStatus | null;
  draggingId: number | null;
  onDragStart: (id: number) => void;
  onDrop: (status: ContentPieceStatus) => void;
  onDragOver: (status: ContentPieceStatus) => void;
  onDragLeave: () => void;
}) {
  const isOver = dragOverStatus === col.status;
  const isDragging = draggingId !== null;

  return (
    <div
      className={`flex flex-col min-w-[220px] w-[220px] border rounded-none transition-all ${col.border} ${
        isOver ? "ring-2 ring-black ring-offset-1" : ""
      }`}
      onDragOver={(e) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = "move";
        onDragOver(col.status);
      }}
      onDragLeave={onDragLeave}
      onDrop={(e) => {
        e.preventDefault();
        onDrop(col.status);
      }}
    >
      {/* Column header */}
      <div className={`px-4 py-3 border-b ${col.border} ${col.header} flex items-center justify-between`}>
        <div className="flex items-center gap-2">
          <span className={`w-2 h-2 rounded-full ${col.dot}`} />
          <span className="text-[10px] font-bold uppercase tracking-widest">{col.label}</span>
        </div>
        <span className="text-xs font-bold text-muted-foreground bg-card/70 px-1.5 py-0.5 border border-current/10">
          {pieces.length}
        </span>
      </div>

      {/* Cards */}
      <div
        className={`flex-1 p-2 flex flex-col gap-2 min-h-[400px] transition-colors ${
          isOver && isDragging ? "bg-secondary/40" : col.bg
        }`}
      >
        {pieces.map((piece) => (
          <PieceCard
            key={piece.id}
            piece={piece}
            campaignId={campaignId}
            onDragStart={onDragStart}
          />
        ))}

        {pieces.length === 0 && (
          <div
            className={`flex-1 flex items-center justify-center border-2 border-dashed transition-colors mt-1 ${
              isOver ? "border-black/40 bg-secondary/30" : "border-border/40"
            }`}
            style={{ minHeight: "80px" }}
          >
            <span className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/50">
              {isOver ? "Drop here" : "No pieces"}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}

export default function CampaignPipeline() {
  const [, params] = useRoute("/campaigns/:id/pipeline");
  const campaignId = parseInt(params?.id ?? "0");
  const { toast } = useToast();
  const qc = useQueryClient();

  const { data: campaign } = useGetCampaign(campaignId);
  const { data: pieces = [], isLoading } = useListContentPieces({ campaignId });
  const updatePiece = useUpdateContentPiece();

  const [draggingId, setDraggingId] = useState<number | null>(null);
  const [dragOverStatus, setDragOverStatus] = useState<ContentPieceStatus | null>(null);
  const leaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const piecesByStatus = COLUMNS.reduce<Record<ContentPieceStatus, ContentPiece[]>>(
    (acc, col) => {
      acc[col.status] = pieces.filter((p) => p.status === col.status);
      return acc;
    },
    {} as Record<ContentPieceStatus, ContentPiece[]>
  );

  const handleDragStart = (id: number) => {
    setDraggingId(id);
  };

  const handleDragOver = (status: ContentPieceStatus) => {
    if (leaveTimerRef.current) clearTimeout(leaveTimerRef.current);
    setDragOverStatus(status);
  };

  const handleDragLeave = () => {
    leaveTimerRef.current = setTimeout(() => setDragOverStatus(null), 80);
  };

  const handleDrop = (targetStatus: ContentPieceStatus) => {
    setDragOverStatus(null);
    if (!draggingId) return;

    const piece = pieces.find((p) => p.id === draggingId);
    if (!piece || piece.status === targetStatus) {
      setDraggingId(null);
      return;
    }

    updatePiece.mutate(
      { id: draggingId, data: { status: targetStatus } },
      {
        onSuccess: () => {
          qc.invalidateQueries({ queryKey: getListContentPiecesQueryKey({ campaignId }) });
          toast({
            title: "Status updated",
            description: `"${piece.title || getChannelName(piece.channel)}" moved to ${
              COLUMNS.find((c) => c.status === targetStatus)?.label
            }`,
          });
        },
        onError: () =>
          toast({ title: "Failed to update status", variant: "destructive" }),
      }
    );

    setDraggingId(null);
  };

  const totalPieces   = pieces.length;
  const approvedCount = pieces.filter((p) => p.status === "approved").length;
  const progress      = totalPieces > 0 ? Math.round((approvedCount / totalPieces) * 100) : 0;

  return (
    <div className="space-y-8">
      <Link
        href={`/campaigns/${campaignId}`}
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
      >
        <ArrowLeft className="w-4 h-4" />
        Back to Campaign
      </Link>

      <header className="pb-8 border-b border-border/50">
        <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-2">
          {campaign?.title ?? "Campaign"} · Pipeline
        </p>
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
          <div className="flex items-center gap-3">
            <KanbanSquare className="w-8 h-8 text-muted-foreground/50" />
            <h1 className="text-4xl font-bold tracking-tight">Status Pipeline</h1>
          </div>

          {/* Progress bar */}
          <div className="flex flex-col gap-1.5 min-w-[200px]">
            <div className="flex items-center justify-between text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
              <span>Progress</span>
              <span className="text-foreground">{progress}%</span>
            </div>
            <div className="h-2 bg-secondary border border-border w-full">
              <div
                className="h-full bg-black transition-all duration-500"
                style={{ width: `${progress}%` }}
              />
            </div>
            <p className="text-[10px] text-muted-foreground">
              {approvedCount} of {totalPieces} piece{totalPieces !== 1 ? "s" : ""} approved
            </p>
          </div>
        </div>
      </header>

      {/* Instruction */}
      <p className="text-xs text-muted-foreground font-medium flex items-center gap-2">
        <span className="inline-block w-4 h-0.5 bg-muted-foreground/40" />
        Drag pieces between columns to update their status
        <span className="inline-block w-4 h-0.5 bg-muted-foreground/40" />
      </p>

      {/* Board */}
      {isLoading ? (
        <div className="flex gap-4 overflow-x-auto pb-4">
          {COLUMNS.map((col) => (
            <div
              key={col.status}
              className="min-w-[220px] w-[220px] h-[500px] border border-border animate-pulse bg-secondary/20"
            />
          ))}
        </div>
      ) : (
        <div
          className="flex gap-4 overflow-x-auto pb-6"
          onDragEnd={() => {
            setDraggingId(null);
            setDragOverStatus(null);
          }}
        >
          {COLUMNS.map((col) => (
            <KanbanColumn
              key={col.status}
              col={col}
              pieces={piecesByStatus[col.status] ?? []}
              campaignId={campaignId}
              dragOverStatus={dragOverStatus}
              draggingId={draggingId}
              onDragStart={handleDragStart}
              onDrop={handleDrop}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
            />
          ))}
        </div>
      )}

      {/* Summary strip */}
      {!isLoading && (
        <div className="grid grid-cols-5 border border-border bg-card divide-x divide-border">
          {COLUMNS.map((col) => {
            const count = piecesByStatus[col.status]?.length ?? 0;
            return (
              <div key={col.status} className="p-3 text-center">
                <div className="flex items-center justify-center gap-1.5 mb-1">
                  <span className={`w-1.5 h-1.5 rounded-full ${col.dot}`} />
                  <span className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground">
                    {col.label}
                  </span>
                </div>
                <p className="text-xl font-bold">{count}</p>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
