import React, { useState } from 'react';
import styled from 'styled-components';

import {
  Button,
  Prose,
  Loading,
  Modal,
  UsbControllerButton,
  P,
} from '@votingworks/ui';
import { throwIllegalValue } from '@votingworks/basics';

import type { UsbDriveStatus } from '@votingworks/usb-drive';
import {
  ejectUsbDrive,
  exportCastVoteRecordsToUsbDrive,
  legacyUsbDriveStatus,
} from '../api';

const UsbImage = styled.img`
  margin: 0 auto;
  height: 200px;
`;

export interface ExportResultsModalProps {
  onClose: () => void;
  usbDrive: UsbDriveStatus;
}

enum ModalState {
  ERROR = 'error',
  SAVING = 'saving',
  DONE = 'done',
  INIT = 'init',
}

export function ExportResultsModal({
  onClose,
  usbDrive,
}: ExportResultsModalProps): JSX.Element {
  const exportMutation = exportCastVoteRecordsToUsbDrive.useMutation();
  const ejectUsbDriveMutation = ejectUsbDrive.useMutation();
  const [currentState, setCurrentState] = useState<ModalState>(ModalState.INIT);
  const [errorMessage, setErrorMessage] = useState('');

  function exportResults() {
    setCurrentState(ModalState.SAVING);
    exportMutation.mutate(undefined, {
      onSuccess: (result) => {
        if (result.isErr()) {
          setErrorMessage(`Failed to save CVRs. ${result.err().message}`);
          setCurrentState(ModalState.ERROR);
        } else {
          setCurrentState(ModalState.DONE);
        }
      },
    });
  }

  if (currentState === ModalState.ERROR) {
    return (
      <Modal
        title="Failed to Save CVRs"
        content={
          <Prose>
            <P>{errorMessage}</P>
          </Prose>
        }
        onOverlayClick={onClose}
        actions={<Button onPress={onClose}>Close</Button>}
      />
    );
  }

  if (currentState === ModalState.DONE) {
    if (usbDrive.status === 'ejected') {
      return (
        <Modal
          title="USB Drive Ejected"
          content={
            <Prose>
              <P>You may now take the USB Drive to VxAdmin for tabulation.</P>
            </Prose>
          }
          onOverlayClick={onClose}
          actions={<Button onPress={onClose}>Close</Button>}
        />
      );
    }
    return (
      <Modal
        title="CVRs Saved to USB Drive"
        content={
          <Prose>
            <P>
              You may now eject the USB drive and take it to VxAdmin for
              tabulation.
            </P>
          </Prose>
        }
        onOverlayClick={onClose}
        actions={
          <React.Fragment>
            <UsbControllerButton
              small={false}
              primary
              usbDriveStatus={legacyUsbDriveStatus(usbDrive)}
              usbDriveEject={() => ejectUsbDriveMutation.mutate()}
              disabled={ejectUsbDriveMutation.isLoading}
            />
            <Button onPress={onClose}>Cancel</Button>
          </React.Fragment>
        }
      />
    );
  }

  if (currentState === ModalState.SAVING) {
    return (
      <Modal
        content={<Loading>Saving CVRs</Loading>}
        onOverlayClick={onClose}
      />
    );
  }

  /* istanbul ignore next - compile time check */
  if (currentState !== ModalState.INIT) {
    throwIllegalValue(currentState);
  }

  switch (usbDrive.status) {
    case 'no_drive':
    case 'ejected':
    case 'error':
      return (
        <Modal
          centerContent
          title="No USB Drive Detected"
          content={
            <Prose textCenter>
              <P>
                Please insert a USB drive in order to save CVRs.
                <UsbImage src="/assets/usb-drive.svg" alt="Insert USB Image" />
              </P>
            </Prose>
          }
          onOverlayClick={onClose}
          actions={<Button onPress={onClose}>Cancel</Button>}
        />
      );
    case 'mounted':
      return (
        <Modal
          title="Save CVRs"
          content={
            <Prose>
              <UsbImage src="/assets/usb-drive.svg" alt="Insert USB Image" />
              <P>
                A CVR file will automatically be saved to the default location
                on the mounted USB drive.
              </P>
            </Prose>
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
    /* istanbul ignore next - compile time check */
    default:
      throwIllegalValue(usbDrive, 'status');
  }
}
