import '@src/SidePanel.css';
import { withErrorBoundary, withSuspense } from '@extension/shared';
import { ErrorDisplay, LoadingSpinner } from '@extension/ui';
import { PopupView } from '../../popup/src/Popup';

const SidePanel = () => {
  return (
    <div className="sidepanel-host">
      <div className="sidepanel-canvas">
        <PopupView layout="side-panel" />
      </div>
    </div>
  );
};

export default withErrorBoundary(withSuspense(SidePanel, <LoadingSpinner />), ErrorDisplay);
