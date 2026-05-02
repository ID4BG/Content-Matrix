import { ContentPieceChannel, CampaignStatus, ContentPieceStatus } from "@workspace/api-client-react";
import { SiInstagram, SiYoutube, SiFacebook, SiReddit, SiThreads } from "react-icons/si";
import { FileText, Linkedin } from "lucide-react";

export function ChannelIcon({ channel, className = "w-5 h-5" }: { channel: ContentPieceChannel; className?: string }) {
  switch (channel) {
    case "instagram_reel":
      return <SiInstagram className={className} />;
    case "linkedin_post":
      return <Linkedin className={className} />;
    case "youtube_long":
    case "youtube_short":
      return <SiYoutube className={className} />;
    case "facebook_carousel":
    case "facebook_group_post":
      return <SiFacebook className={className} />;
    case "reddit_post":
      return <SiReddit className={className} />;
    case "threads_post":
      return <SiThreads className={className} />;
    case "source_article":
      return <FileText className={className} />;
    default:
      return <FileText className={className} />;
  }
}

const CHANNEL_NAMES: Record<ContentPieceChannel, string> = {
  instagram_reel: "Instagram",
  linkedin_post: "LinkedIn",
  youtube_long: "YouTube Long",
  youtube_short: "YouTube Short",
  facebook_carousel: "Facebook Carousel",
  facebook_group_post: "Facebook Group",
  reddit_post: "Reddit",
  threads_post: "Threads",
  source_article: "Source Article",
};

export function getChannelName(channel: ContentPieceChannel): string {
  return CHANNEL_NAMES[channel] ?? channel.split("_").map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(" ");
}

export function StatusBadge({ status }: { status: CampaignStatus | ContentPieceStatus }) {
  const getBadgeStyle = (status: string) => {
    switch (status) {
      case "draft":
      case "empty":
        return "bg-muted text-muted-foreground border-transparent";
      case "uploaded":
        return "bg-secondary text-secondary-foreground border-transparent";
      case "in_review":
        return "bg-amber-100 text-amber-900 border-transparent dark:bg-amber-900/30 dark:text-amber-200";
      case "needs_revision":
        return "bg-rose-100 text-rose-900 border-transparent dark:bg-rose-900/30 dark:text-rose-200";
      case "approved":
        return "bg-blue-100 text-blue-900 border-transparent dark:bg-blue-900/30 dark:text-blue-200";
      case "published":
        return "bg-emerald-100 text-emerald-900 border-transparent dark:bg-emerald-900/30 dark:text-emerald-200";
      default:
        return "bg-muted text-muted-foreground border-transparent";
    }
  };

  const formattedStatus = status.split("_").map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(" ");

  return (
    <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold tracking-wide border ${getBadgeStyle(status)}`}>
      {formattedStatus}
    </span>
  );
}
