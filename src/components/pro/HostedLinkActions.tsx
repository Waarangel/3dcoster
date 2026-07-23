import { IconButton, useToast } from '../ui';
import { LinkIcon, ExternalLinkIcon } from '../ui/icons';
import { copyToClipboard } from '../../utils/clipboard';

// ---------------------------------------------------------------------------
// HostedLinkActions — G-46-6R (gap closure).
//
// The persistent Copy-link + Open-hosted-page affordance for a published
// quote. Mounted wherever `quote.publishedUrl` should stay retrievable
// (JobsManager row + PrintQuoteModal edit footer) so the hosted link is never
// lost to the one-shot 5s publish toast. D-13: this component only ever
// reads `quote.publishedUrl` — it never re-mints or re-publishes.
// ---------------------------------------------------------------------------

interface HostedLinkActionsProps {
  /** The already-published, internally-constructed quote.publishedUrl. */
  url: string;
  /** Human-readable identifier for the quote, e.g. "Q-0007". Used in aria-labels and toast copy. */
  label: string;
}

const ICON_CLASS = 'w-4 h-4';

export function HostedLinkActions({ url, label }: HostedLinkActionsProps) {
  const toast = useToast();

  const handleCopy = async (e: React.MouseEvent) => {
    e.stopPropagation();
    const copied = await copyToClipboard(url);
    if (copied) {
      toast.success(`Link copied: ${url}`);
    } else {
      toast.info(`Could not copy automatically — here's the link: ${url}`, { duration: 0 });
    }
  };

  const handleOpen = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (__IS_TAURI__) {
      try {
        const { open } = await import('@tauri-apps/plugin-shell');
        await open(url);
      } catch {
        window.open(url, '_blank', 'noopener,noreferrer');
      }
    } else {
      window.open(url, '_blank', 'noopener,noreferrer');
    }
  };

  return (
    <span className="inline-flex items-center gap-1">
      <IconButton
        label={`Copy link for ${label}`}
        icon={<LinkIcon className={ICON_CLASS} />}
        onClick={(e) => { void handleCopy(e); }}
      />
      <IconButton
        label={`Open hosted page for ${label}`}
        icon={<ExternalLinkIcon className={ICON_CLASS} />}
        onClick={(e) => { void handleOpen(e); }}
      />
    </span>
  );
}
