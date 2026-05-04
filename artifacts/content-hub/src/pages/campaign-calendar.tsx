import { useState } from "react";
import { useRoute, Link } from "wouter";
import { ChevronLeft, ChevronRight, ArrowLeft, CalendarDays } from "lucide-react";
import {
  startOfMonth, endOfMonth, startOfWeek, endOfWeek,
  eachDayOfInterval, isSameDay, isSameMonth,
  format, addMonths, subMonths, parseISO,
} from "date-fns";
import {
  useGetCampaign,
  useListContentPieces,
  ContentPieceStatus,
} from "@workspace/api-client-react";
import { ChannelIcon, getChannelName } from "@/components/channel-icon";
import { Button } from "@/components/ui/button";

const STATUS_DOT: Record<ContentPieceStatus, string> = {
  empty:          "bg-muted-foreground/40",
  uploaded:       "bg-gray-500",
  in_review:      "bg-amber-500",
  needs_revision: "bg-rose-500",
  approved:       "bg-blue-500",
};

const STATUS_RING: Record<ContentPieceStatus, string> = {
  empty:          "border-muted-foreground/30",
  uploaded:       "border-gray-300",
  in_review:      "border-amber-200",
  needs_revision: "border-rose-200",
  approved:       "border-blue-200",
};

const STATUS_BG: Record<ContentPieceStatus, string> = {
  empty:          "bg-card hover:bg-secondary/50",
  uploaded:       "bg-secondary/30 hover:bg-secondary/50 dark:bg-secondary/20",
  in_review:      "bg-amber-50 hover:bg-amber-100/80 dark:bg-amber-950/40 dark:hover:bg-amber-950/60",
  needs_revision: "bg-rose-50 hover:bg-rose-100/80 dark:bg-rose-950/40 dark:hover:bg-rose-950/60",
  approved:       "bg-blue-50 hover:bg-blue-100/80 dark:bg-blue-950/40 dark:hover:bg-blue-950/60",
};

export default function CampaignCalendar() {
  const [, params] = useRoute("/campaigns/:id/calendar");
  const campaignId = parseInt(params?.id ?? "0");
  const [currentMonth, setCurrentMonth] = useState(new Date());

  const { data: campaign } = useGetCampaign(campaignId);
  const { data: pieces = [] } = useListContentPieces({ campaignId });

  const scheduled = pieces.filter(p => p.scheduledDate);

  const monthStart = startOfMonth(currentMonth);
  const monthEnd   = endOfMonth(currentMonth);
  const calStart   = startOfWeek(monthStart, { weekStartsOn: 1 });
  const calEnd     = endOfWeek(monthEnd,   { weekStartsOn: 1 });
  const days       = eachDayOfInterval({ start: calStart, end: calEnd });
  const weeks      = Math.ceil(days.length / 7);

  const piecesForDay = (day: Date) =>
    scheduled.filter(p => isSameDay(parseISO(p.scheduledDate!), day));

  const totalScheduled = scheduled.length;
  const approvedCount  = scheduled.filter(p => p.status === "approved").length;
  const reviewCount    = scheduled.filter(p => p.status === "in_review").length;

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
          {campaign?.title ?? "Campaign"} · Calendar
        </p>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <h1 className="text-4xl font-bold tracking-tight">Content Calendar</h1>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="icon"
              className="rounded-none"
              onClick={() => setCurrentMonth(m => subMonths(m, 1))}
            >
              <ChevronLeft className="w-4 h-4" />
            </Button>
            <span className="text-base font-bold min-w-[160px] text-center">
              {format(currentMonth, "MMMM yyyy")}
            </span>
            <Button
              variant="outline"
              size="icon"
              className="rounded-none"
              onClick={() => setCurrentMonth(m => addMonths(m, 1))}
            >
              <ChevronRight className="w-4 h-4" />
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="rounded-none ml-2 text-xs font-semibold uppercase tracking-wider"
              onClick={() => setCurrentMonth(new Date())}
            >
              Today
            </Button>
          </div>
        </div>
      </header>

      {/* Stats Strip */}
      <div className="grid grid-cols-3 border border-border bg-card divide-x divide-border">
        <div className="p-4 text-center">
          <p className="text-2xl font-bold">{totalScheduled}</p>
          <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mt-1">Scheduled</p>
        </div>
        <div className="p-4 text-center">
          <p className="text-2xl font-bold text-blue-600">{approvedCount}</p>
          <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mt-1">Approved</p>
        </div>
        <div className="p-4 text-center">
          <p className="text-2xl font-bold text-amber-600">{reviewCount}</p>
          <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mt-1">In Review</p>
        </div>
      </div>

      {/* Calendar Grid */}
      <div className="border border-border bg-card overflow-hidden">
        {/* Weekday headers */}
        <div className="grid grid-cols-7 border-b border-border bg-secondary/20">
          {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map(d => (
            <div
              key={d}
              className="py-3 text-center text-[10px] font-bold uppercase tracking-widest text-muted-foreground border-r last:border-r-0 border-border"
            >
              {d}
            </div>
          ))}
        </div>

        {/* Day cells */}
        {Array.from({ length: weeks }).map((_, week) => (
          <div key={week} className="grid grid-cols-7 border-b last:border-b-0 border-border">
            {days.slice(week * 7, week * 7 + 7).map((day, i) => {
              const dayPieces  = piecesForDay(day);
              const inMonth    = isSameMonth(day, currentMonth);
              const isToday    = isSameDay(day, new Date());
              const overflow   = dayPieces.length > 3 ? dayPieces.length - 3 : 0;
              const visible    = dayPieces.slice(0, 3);

              return (
                <div
                  key={i}
                  className={`min-h-[130px] flex flex-col border-r last:border-r-0 border-border ${
                    inMonth ? "bg-card" : "bg-secondary/20"
                  }`}
                >
                  {/* Day number */}
                  <div className="px-2 pt-2 pb-1 flex items-center justify-between">
                    <span
                      className={`text-xs font-bold w-6 h-6 flex items-center justify-center ${
                        isToday
                          ? "bg-black text-white"
                          : inMonth
                          ? "text-foreground"
                          : "text-muted-foreground/50"
                      }`}
                    >
                      {format(day, "d")}
                    </span>
                    {dayPieces.length > 0 && (
                      <span className="text-[9px] font-bold text-muted-foreground bg-secondary px-1.5 py-0.5">
                        {dayPieces.length}
                      </span>
                    )}
                  </div>

                  {/* Pieces */}
                  <div className="flex flex-col gap-0.5 px-1 pb-1 flex-1">
                    {visible.map(piece => (
                      <Link
                        key={piece.id}
                        href={`/campaigns/${campaignId}/pieces/${piece.id}`}
                        className={`flex items-center gap-1 px-1.5 py-1 border text-[10px] font-semibold truncate transition-colors ${
                          STATUS_BG[piece.status as ContentPieceStatus] ?? "bg-card hover:bg-secondary/50"
                        } ${STATUS_RING[piece.status as ContentPieceStatus] ?? "border-border"}`}
                      >
                        <span
                          className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                            STATUS_DOT[piece.status as ContentPieceStatus] ?? "bg-muted-foreground/40"
                          }`}
                        />
                        <ChannelIcon channel={piece.channel} className="w-2.5 h-2.5 shrink-0" />
                        <span className="truncate">{piece.title || getChannelName(piece.channel)}</span>
                      </Link>
                    ))}
                    {overflow > 0 && (
                      <span className="text-[9px] font-bold text-muted-foreground px-1.5 mt-0.5">
                        +{overflow} more
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        ))}
      </div>

      {/* Legend */}
      <div className="flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
        <div className="flex items-center gap-1.5">
          <CalendarDays className="w-3.5 h-3.5" />
          <span className="font-semibold">Status key:</span>
        </div>
        {(["empty", "uploaded", "in_review", "needs_revision", "approved"] as ContentPieceStatus[]).map(s => (
          <div key={s} className="flex items-center gap-1.5">
            <span className={`w-2 h-2 rounded-full ${STATUS_DOT[s]}`} />
            <span className="capitalize">{s.replace("_", " ")}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
