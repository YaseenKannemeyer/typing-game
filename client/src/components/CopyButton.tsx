import type { IconName } from '../art/gridArt';
import { useToast } from './Toasts';
import { Button } from './ui';

/** Copies a real value (room code / invite link) with the kit's toast feedback. */
export function CopyButton({ text, label, icon = 'copy' }: { text: string; label: string; icon?: IconName }) {
  const toast = useToast();
  return (
    <Button
      variant="secondary"
      icon={icon}
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text);
          toast('Copied to clipboard.', 'success');
        } catch {
          toast('Copy unavailable. Select and copy the visible value.', 'warning');
        }
      }}
    >
      {label}
    </Button>
  );
}
