import { CenteredLargeProse, H1, P } from '@votingworks/ui';
import { ScreenMainCenterChild } from '../components/layout';

interface Props {
  batteryIsCharging: boolean;
  scannedBallotCount?: number;
}

export function SetupScannerScreen({
  batteryIsCharging,
  scannedBallotCount,
}: Props): JSX.Element {
  // If the power cord is plugged in, but we can't detect a scanner, it's an
  // internal wiring issue. Otherwise if we can't detect the scanner, the power
  // cord is likely not plugged in.
  return (
    <ScreenMainCenterChild ballotCountOverride={scannedBallotCount}>
      {batteryIsCharging ? (
        <CenteredLargeProse>
          <H1>Internal Connection Problem</H1>
          <P>Please ask a poll worker for help.</P>
        </CenteredLargeProse>
      ) : (
        <CenteredLargeProse>
          <H1>No Power Detected</H1>
          <P>Please ask a poll worker to plug in the power cord.</P>
        </CenteredLargeProse>
      )}
    </ScreenMainCenterChild>
  );
}

/* istanbul ignore next */
export function PowerDisconnectedPreview(): JSX.Element {
  return (
    <SetupScannerScreen batteryIsCharging={false} scannedBallotCount={42} />
  );
}

/* istanbul ignore next */
export function ScannerDisconnectedPreview(): JSX.Element {
  return <SetupScannerScreen batteryIsCharging scannedBallotCount={42} />;
}
