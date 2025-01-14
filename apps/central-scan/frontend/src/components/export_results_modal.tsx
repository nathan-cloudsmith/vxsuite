import React, { useContext, useState } from 'react';
import styled from 'styled-components';

import { Button, Modal, P, UsbControllerButton } from '@votingworks/ui';
import { isElectionManagerAuth } from '@votingworks/utils';

import { LogEventId } from '@votingworks/logging';
import { assert } from '@votingworks/basics';
import { AppContext } from '../contexts/app_context';
import { Loading } from './loading';
import { exportCastVoteRecords } from '../api/config';

function throwBadStatus(s: never): never {
  throw new Error(`Bad status: ${s}`);
}

export const UsbImage = styled.img`
  margin-right: auto;
  margin-left: auto;
  height: 200px;
`;

export interface Props {
  onClose: () => void;
  numberOfBallots: number;
}

enum ModalState {
  ERROR = 'error',
  SAVING = 'saving',
  DONE = 'done',
  INIT = 'init',
}

export function ExportResultsModal({
  onClose,
  numberOfBallots,
}: Props): JSX.Element {
  const [currentState, setCurrentState] = useState<ModalState>(ModalState.INIT);
  const [errorMessage, setErrorMessage] = useState('');

  const { usbDriveEject, usbDriveStatus, auth, logger } =
    useContext(AppContext);
  assert(isElectionManagerAuth(auth));
  const userRole = auth.user.role;

  async function exportResults() {
    setCurrentState(ModalState.SAVING);

    try {
      await logger.log(LogEventId.SaveCvrInit, userRole);

      await exportCastVoteRecords();

      setCurrentState(ModalState.DONE);
      await logger.log(LogEventId.SaveCvrComplete, userRole, {
        message: `Successfully saved CVR file with ${numberOfBallots} ballots.`,
        disposition: 'success',
        numberOfBallots,
      });
    } catch (error) {
      assert(error instanceof Error);
      setErrorMessage(`Failed to save CVRs. ${error.message}`);
      setCurrentState(ModalState.ERROR);
      await logger.log(LogEventId.SaveCvrComplete, userRole, {
        message: 'Error saving CVR file.',
        error: error.message,
        result: 'User shown error, CVR file not saved.',
        disposition: 'failure',
      });
    }
  }

  if (currentState === ModalState.ERROR) {
    return (
      <Modal
        title="Failed to Save CVRs"
        content={<P>{errorMessage}</P>}
        onOverlayClick={onClose}
        actions={<Button onPress={onClose}>Close</Button>}
      />
    );
  }

  if (currentState === ModalState.DONE) {
    if (usbDriveStatus === 'ejected') {
      return (
        <Modal
          title="CVRs Saved"
          content={
            <P>
              USB drive successfully ejected, you may now take it to VxAdmin for
              tabulation.
            </P>
          }
          onOverlayClick={onClose}
          actions={<Button onPress={onClose}>Close</Button>}
        />
      );
    }
    return (
      <Modal
        title="CVRs Saved"
        content={
          <P>
            CVR file saved successfully! You may now eject the USB drive and
            take it to VxAdmin for tabulation.
          </P>
        }
        onOverlayClick={onClose}
        actions={
          <React.Fragment>
            <UsbControllerButton
              small={false}
              primary
              usbDriveStatus={usbDriveStatus}
              usbDriveEject={() => usbDriveEject(userRole)}
            />
            <Button onPress={onClose}>Cancel</Button>
          </React.Fragment>
        }
      />
    );
  }

  if (currentState === ModalState.SAVING) {
    return <Modal content={<Loading />} onOverlayClick={onClose} />;
  }

  if (currentState !== ModalState.INIT) {
    throwBadStatus(currentState); // Creates a compile time check that all states are being handled.
  }

  switch (usbDriveStatus) {
    case 'absent':
    case 'ejected':
    case 'bad_format':
      // When run not through kiosk mode let the user save the file
      // on the machine for internal debugging use
      return (
        <Modal
          title="No USB Drive Detected"
          content={
            <P>
              <UsbImage src="/assets/usb-drive.svg" alt="Insert USB Image" />
              Please insert a USB drive in order to save CVRs.
            </P>
          }
          onOverlayClick={onClose}
          actions={<Button onPress={onClose}>Cancel</Button>}
        />
      );
    case 'ejecting':
    case 'mounting':
      return (
        <Modal
          content={<Loading />}
          onOverlayClick={onClose}
          actions={<Button onPress={onClose}>Cancel</Button>}
        />
      );
    case 'mounted':
      return (
        <Modal
          title="Save CVRs"
          content={
            <React.Fragment>
              <UsbImage src="/assets/usb-drive.svg" alt="Insert USB Image" />
              <P>A CVR file will be saved to the mounted USB drive.</P>
            </React.Fragment>
          }
          onOverlayClick={onClose}
          actions={
            <React.Fragment>
              <Button variant="primary" onPress={exportResults}>
                Save
              </Button>
              <Button onPress={onClose}>Cancel</Button>
            </React.Fragment>
          }
        />
      );
    default:
      // Creates a compile time check to make sure this switch statement includes all enum values for UsbDriveStatus
      throwBadStatus(usbDriveStatus);
  }
}
