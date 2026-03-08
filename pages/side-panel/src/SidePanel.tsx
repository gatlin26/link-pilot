import '@src/SidePanel.css';
import { withErrorBoundary, withSuspense } from '@extension/shared';
import { ErrorDisplay, LoadingSpinner } from '@extension/ui';
import { SidePanelView } from './SidePanelView';

const SidePanel = () => {
  return (
    <div className="sidepanel-host">
      <div className="sidepanel-canvas">
        <SidePanelView />
      </div>
    </div>
  );
};

export default withErrorBoundary(withSuspense(SidePanel, <LoadingSpinner />), ErrorDisplay);
