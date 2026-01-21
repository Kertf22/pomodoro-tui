import { TextAttributes } from "@opentui/core";
import { useTerminalDimensions } from "@opentui/react";

interface ControlsProps {
  canControl: boolean;
  isCurrentHost: boolean;
  showTransferHint: boolean;
}

export function Controls({ canControl, isCurrentHost, showTransferHint }: ControlsProps) {
  const { width } = useTerminalDimensions();
  
  // Use shorter labels on narrow terminals
  const isCompact = width < 70;
  
  const fullControls = canControl
    ? "[S]tart [P]ause [R]eset [N]ext [Q]uit [M]usic [>]station"
    : "[Q]uit [M]usic [>]station";
  
  const compactControls = canControl
    ? "[S]tart [P]ause [R]eset [N]ext [Q]uit"
    : "[Q]uit [M]usic";

  return (
    <>
      <box marginTop={1}>
        <text fg="yellow">
          {isCompact ? compactControls : fullControls}
        </text>
      </box>
      {isCurrentHost && showTransferHint && !isCompact && (
        <box>
          <text fg="yellow" attributes={TextAttributes.DIM}>
            [1-9] transfer host
          </text>
        </box>
      )}
    </>
  );
}
