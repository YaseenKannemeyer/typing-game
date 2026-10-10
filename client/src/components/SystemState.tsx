import { systemArtSvg, systemState, type SystemStateId } from '../art/gridArt';
import { TrustedSvg } from './TrustedSvg';
import { Button } from './ui';

/** 12-system state: illustration, code, title, body and one real action. */
export function SystemState({ id, onAction, actionLabel }: { id: SystemStateId; onAction: () => void; actionLabel?: string }) {
  const s = systemState(id);
  return (
    <section className="g-system-state">
      <TrustedSvg markup={systemArtSvg(id)} />
      <span className="g-eyebrow">{s.code}</span>
      <h2>{s.title}</h2>
      <p>{s.body}</p>
      <Button icon={id === 'reconnecting' ? 'refresh' : 'arrow'} onClick={onAction}>
        {actionLabel ?? s.action}
      </Button>
    </section>
  );
}
