import React, { useCallback, useContext, useState } from 'react';
import { assert, throwIllegalValue } from '@votingworks/basics';

import { Button, Modal, Loading, UsbImage, Font, P } from '@votingworks/ui';
import {
  isElectionManagerAuth,
  isSystemAdministratorAuth,
} from '@votingworks/utils';
import { AppContext } from '../contexts/app_context';

export interface FormatUsbModalProps {
  onClose: () => void;
}

type FlowState =
  | { stage: 'init' }
  | { stage: 'confirm' }
  | { stage: 'formatting' }
  | { stage: 'done' }
  | { stage: 'error'; message: string };

function FormatUsbFlow({ onClose }: FormatUsbModalProps): JSX.Element {
  const { usbDrive, auth } = useContext(AppContext);
  assert(usbDrive.status !== 'absent');
  assert(isSystemAdministratorAuth(auth) || isElectionManagerAuth(auth));
  const userRole = auth.user.role;

  const [state, setState] = useState<FlowState>({ stage: 'init' });

  const format = useCallback(async () => {
    setState({ stage: 'formatting' });
    try {
      await usbDrive.format(userRole, { action: 'eject' });
      setState({ stage: 'done' });
    } catch (error) {
      setState({ stage: 'error', message: (error as Error).message });
    }
  }, [usbDrive, userRole]);

  const { stage } = state;
  switch (stage) {
    case 'init':
      switch (usbDrive.status) {
        case 'ejecting':
        case 'mounting':
          return (
            <Modal
              content={<Loading />}
              onOverlayClick={onClose}
              actions={<Button onPress={onClose}>Cancel</Button>}
            />
          );
        case 'ejected':
        case 'bad_format':
        case 'mounted': {
          return (
            <Modal
              title="Format USB Drive"
              content={
                <P>
                  {usbDrive.status === 'bad_format'
                    ? 'The format of the inserted USB drive is not VotingWorks compatible. Would you like to format the USB drive?'
                    : 'The format of the inserted USB drive is already VotingWorks compatible. Would you like to reformat the USB drive?'}
                </P>
              }
              onOverlayClick={onClose}
              actions={
                <React.Fragment>
                  <Button
                    variant="primary"
                    onPress={() => setState({ stage: 'confirm' })}
                  >
                    Format USB
                  </Button>
                  <Button onPress={onClose}>Cancel</Button>
                </React.Fragment>
              }
            />
          );
        }
        // istanbul ignore next
        default:
          throwIllegalValue(usbDrive.status);
      }
      break;
    case 'confirm':
      return (
        <Modal
          title="Confirm Format USB Drive"
          content={
            <P>
              <Font weight="bold">Warning:</Font> formatting will delete all
              files on the USB drive. Back up USB drive files before formatting.
            </P>
          }
          onOverlayClick={onClose}
          actions={
            <React.Fragment>
              <Button variant="primary" onPress={format}>
                Format USB
              </Button>
              <Button onPress={onClose}>Close</Button>
            </React.Fragment>
          }
        />
      );
    case 'formatting':
      return <Modal content={<Loading>Formatting USB Drive</Loading>} />;
    case 'done':
      return (
        <Modal
          title="USB Drive Formatted"
          content={
            <P>
              USB drive successfully reformatted. It is now ready to use with
              VotingWorks devices.
            </P>
          }
          onOverlayClick={onClose}
          actions={<Button onPress={onClose}>Close</Button>}
        />
      );
    case 'error':
      return (
        <Modal
          title="Failed to Format USB Drive"
          content={<P>Failed to format USB drive: {state.message}</P>}
          onOverlayClick={onClose}
          actions={<Button onPress={onClose}>Close</Button>}
        />
      );
    default:
      throwIllegalValue(stage);
  }
}

export function FormatUsbModal({ onClose }: FormatUsbModalProps): JSX.Element {
  const { usbDrive } = useContext(AppContext);

  if (usbDrive.status === 'absent') {
    return (
      <Modal
        title="No USB Drive Detected"
        content={
          <P>
            <UsbImage />
            Insert a USB drive you would like to format.
          </P>
        }
        onOverlayClick={onClose}
        actions={<Button onPress={onClose}>Cancel</Button>}
      />
    );
  }

  return <FormatUsbFlow onClose={onClose} />;
}

export function FormatUsbButton(): JSX.Element {
  const [isModalOpen, setIsModalOpen] = useState(false);

  return (
    <React.Fragment>
      <Button onPress={() => setIsModalOpen(true)}>Format USB</Button>
      {isModalOpen && <FormatUsbModal onClose={() => setIsModalOpen(false)} />}
    </React.Fragment>
  );
}
