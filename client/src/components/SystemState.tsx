import { systemArtSvg, systemState, type SystemStateId } from '../art/gridArt';
import { TrustedSvg } from './TrustedSvg';
import { Button } from './ui';

/** 12-system state: illustration, code, title, body and one real action. Always the page body, so the title is the h1. */
export function SystemState({ id, onAction, actionLabel }: { id: SystemStateId; onAction: () => void; actionLabel?: string }) {
  const s = systemState(id);
  return (
    <section className="g-system-state">
      <TrustedSvg markup={systemArtSvg(id)} />
      <span className="g-eyebrow">{s.code}</span>
      <h1>{s.title}</h1>
      <p>{s.body}</p>
      <Button icon={id === 'reconnecting' ? 'refresh' : 'arrow'} onClick={onAction}>
        {actionLabel ?? s.action}
      </Button>
    </section>
  );
}
