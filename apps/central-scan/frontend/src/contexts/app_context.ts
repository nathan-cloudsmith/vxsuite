import { LoggingUserRole, LogSource, Logger } from '@votingworks/logging';
import { DippedSmartCardAuth, ElectionDefinition } from '@votingworks/types';
import { UsbDriveStatus } from '@votingworks/ui';
import { createContext } from 'react';
import { MachineConfig } from '../config/types';

export interface AppContextInterface {
  usbDriveStatus: UsbDriveStatus;
  usbDriveEject: (currentUser: LoggingUserRole) => void;
  machineConfig: MachineConfig;
  electionDefinition?: ElectionDefinition;
  electionHash?: string;
  auth: DippedSmartCardAuth.AuthStatus;
  logger: Logger;
}

const appContext: AppContextInterface = {
  usbDriveStatus: 'absent',
  usbDriveEject: () => undefined,
  machineConfig: {
    machineId: '0000',
    codeVersion: '',
  },
  electionDefinition: undefined,
  electionHash: undefined,
  logger: new Logger(LogSource.VxCentralScanFrontend),
  auth: {
    status: 'logged_out',
    reason: 'machine_locked',
  },
};

export const AppContext = createContext(appContext);
