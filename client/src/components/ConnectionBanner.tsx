import { Banner, Button } from './ui';

/** Shown above every room phase while the realtime channel is down. */
export function ConnectionBanner({ onRetry }: { onRetry: () => void }) {
  return (
    <div className="g-stack">
      <Banner tone="warning">Connection lost. Finding your way back… Your last confirmed progress is shown until the server responds.</Banner>
      <div>
        <Button variant="secondary" icon="refresh" onClick={onRetry}>Retry connection</Button>
      </div>
    </div>
  );
}
