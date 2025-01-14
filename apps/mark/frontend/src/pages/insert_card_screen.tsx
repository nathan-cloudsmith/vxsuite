import React, { useEffect } from 'react';
import {
  ElectionDefinition,
  PollsState,
  PrecinctSelection,
} from '@votingworks/types';
import {
  Main,
  Screen,
  Prose,
  TestMode,
  ElectionInfoBar,
  InsertCardImage,
  H1,
  P,
  Caption,
  Icons,
  Font,
} from '@votingworks/ui';

import { throwIllegalValue } from '@votingworks/basics';
import { triggerAudioFocus } from '../utils/trigger_audio_focus';

interface Props {
  appPrecinct: PrecinctSelection;
  electionDefinition: ElectionDefinition;
  showNoChargerAttachedWarning: boolean;
  isLiveMode: boolean;
  pollsState: PollsState;
  showNoAccessibleControllerWarning: boolean;
}

export function InsertCardScreen({
  appPrecinct,
  electionDefinition,
  showNoChargerAttachedWarning,
  isLiveMode,
  pollsState,
  showNoAccessibleControllerWarning,
}: Props): JSX.Element {
  useEffect(triggerAudioFocus, []);

  const mainText = (() => {
    switch (pollsState) {
      case 'polls_closed_initial':
        return (
          <React.Fragment>
            <H1>Polls Closed</H1>
            <P>Insert Poll Worker card to open.</P>
          </React.Fragment>
        );
      case 'polls_open':
        return <H1>Insert Card</H1>;
      case 'polls_paused':
        return (
          <React.Fragment>
            <H1>Voting Paused</H1>
            <P>Insert Poll Worker card to resume voting.</P>
          </React.Fragment>
        );
      case 'polls_closed_final':
        return (
          <React.Fragment>
            <H1>Polls Closed</H1>
            <P>Voting is complete.</P>
          </React.Fragment>
        );
      /* istanbul ignore next - compile time check for completeness */
      default:
        throwIllegalValue(pollsState);
    }
  })();

  return (
    <Screen white>
      {!isLiveMode && <TestMode />}
      <Main centerChild>
        <Prose textCenter id="audiofocus">
          {showNoChargerAttachedWarning && (
            <Caption color="warning">
              <Icons.Warning /> <Font weight="bold">No Power Detected.</Font>{' '}
              Please ask a poll worker to plug in the power cord for this
              machine.
            </Caption>
          )}
          <P>
            <InsertCardImage />
          </P>
          {mainText}
          {showNoAccessibleControllerWarning && (
            <Caption>
              Voting with an accessible controller is not currently available.
            </Caption>
          )}
        </Prose>
      </Main>
      <ElectionInfoBar
        electionDefinition={electionDefinition}
        precinctSelection={appPrecinct}
      />
    </Screen>
  );
}
