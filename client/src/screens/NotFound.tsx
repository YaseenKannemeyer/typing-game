import { SystemState } from '../components/SystemState';
import { Page } from '../components/ui';
import { navigate } from '../lib/router';

export function NotFound() {
  return (
    <Page>
      <SystemState id="404" onAction={() => navigate('/')} />
    </Page>
  );
}
