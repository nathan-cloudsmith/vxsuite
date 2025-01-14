import { CenteredLargeProse, H1, LoadingAnimation, P } from '@votingworks/ui';
import { ScreenMainCenterChild } from '../components/layout';

export function ScanProcessingScreen(): JSX.Element {
  return (
    <ScreenMainCenterChild>
      <LoadingAnimation />
      <CenteredLargeProse>
        <H1>Please wait…</H1>
        <P>Scanning the marks on your ballot.</P>
      </CenteredLargeProse>
    </ScreenMainCenterChild>
  );
}

/* istanbul ignore next */
export function DefaultPreview(): JSX.Element {
  return <ScanProcessingScreen />;
}
