import { useEffect, useRef, useState } from 'react';
import type { Delivery } from '../../game/delivery';

/** Presentation only: acknowledgements and retry state come from the queue. */
export function DeliveryStatus({ delivery, timeUp }: { delivery: Delivery | null; timeUp: boolean }) {
  const status = delivery?.status;
  const previous = useRef(status);
  const [announcement, setAnnouncement] = useState('');
  const retryCopy = timeUp ? 'Retrying your final locked lines.' : 'Keep typing. Retrying delivery.';

  useEffect(() => {
    if (status === 'retrying') setAnnouncement(retryCopy);
    else if (status === 'rejected') setAnnouncement('Typing submission rejected. Official results may exclude unaccepted progress.');
    else if (status === 'late') setAnnouncement('Race closed with lines unconfirmed. Official results may not include them.');
    else if (status === 'synced' && previous.current === 'retrying') setAnnouncement('Delivery restored. Locked lines received.');
    previous.current = status;
  }, [status, retryCopy]);

  if (!delivery) return null;
  const n = delivery.unsentLines;
  const lines = `${n} locked ${n === 1 ? 'line' : 'lines'}`;
  let title = 'Locked lines received';
  let detail = '';
  if (status === 'sending') title = `Sending ${lines}…`;
  if (status === 'retrying') { title = `${lines} awaiting confirmation`; detail = retryCopy; }
  if (status === 'rejected') {
    title = n ? 'Line submission rejected' : 'Typing submission rejected';
    detail = 'Official results may exclude unaccepted progress.';
  }
  if (status === 'late') { title = n ? `Race closed · ${lines} unconfirmed` : 'Race closed'; detail = 'Official results may not include these lines.'; }

  return (
    <div className={`race-delivery is-${status}`}>
      <p><span className="race-delivery-marker" aria-hidden="true" /><strong>{title}</strong>{detail && <span className="race-delivery-detail">{detail}</span>}</p>
      <span className="g-sr race-delivery-announcement" role="status" aria-live="polite" aria-atomic="true">{announcement}</span>
    </div>
  );
}
