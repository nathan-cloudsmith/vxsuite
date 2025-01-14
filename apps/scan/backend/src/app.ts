import * as grout from '@votingworks/grout';
import { useDevDockRouter } from '@votingworks/dev-dock-backend';
import { LogEventId, Logger } from '@votingworks/logging';
import {
  BallotPackageConfigurationError,
  DEFAULT_SYSTEM_SETTINGS,
  MarkThresholds,
  PollsState,
  PrecinctSelection,
  SinglePrecinctSelection,
  Tabulation,
} from '@votingworks/types';
import {
  BooleanEnvironmentVariableName,
  isElectionManagerAuth,
  isFeatureFlagEnabled,
  singlePrecinctSelectionFor,
} from '@votingworks/utils';
import express, { Application } from 'express';
import {
  ExportDataError,
  exportCastVoteRecordReportToUsbDrive,
  ExportCastVoteRecordReportToUsbDriveError,
  readBallotPackageFromUsb,
} from '@votingworks/backend';
import { assert, ok, Result } from '@votingworks/basics';
import {
  ArtifactAuthenticatorApi,
  InsertedSmartCardAuthApi,
  InsertedSmartCardAuthMachineState,
  LiveCheck,
} from '@votingworks/auth';
import { UsbDrive, UsbDriveStatus } from '@votingworks/usb-drive';
import { backupToUsbDrive } from './backup';
import { PrecinctScannerInterpreter } from './interpret';
import {
  PrecinctScannerStateMachine,
  PrecinctScannerConfig,
  PrecinctScannerStatus,
} from './types';
import { Workspace } from './util/workspace';
import { getMachineConfig } from './machine_config';
import { DefaultMarkThresholds } from './store';
import { getScannerResults } from './util/results';

function constructAuthMachineState(
  workspace: Workspace
): InsertedSmartCardAuthMachineState {
  const electionDefinition = workspace.store.getElectionDefinition();
  const jurisdiction = workspace.store.getJurisdiction();
  const systemSettings = workspace.store.getSystemSettings();
  return {
    ...(systemSettings ?? {}),
    electionHash: electionDefinition?.electionHash,
    jurisdiction,
  };
}

function buildApi(
  auth: InsertedSmartCardAuthApi,
  artifactAuthenticator: ArtifactAuthenticatorApi,
  machine: PrecinctScannerStateMachine,
  interpreter: PrecinctScannerInterpreter,
  workspace: Workspace,
  usbDrive: UsbDrive,
  logger: Logger
) {
  const { store } = workspace;

  return grout.createApi({
    getMachineConfig,

    getAuthStatus() {
      return auth.getAuthStatus(constructAuthMachineState(workspace));
    },

    checkPin(input: { pin: string }) {
      return auth.checkPin(constructAuthMachineState(workspace), input);
    },

    logOut() {
      return auth.logOut(constructAuthMachineState(workspace));
    },

    updateSessionExpiry(input: { sessionExpiresAt: Date }) {
      return auth.updateSessionExpiry(
        constructAuthMachineState(workspace),
        input
      );
    },

    generateLiveCheckQrCodeValue() {
      const { machineId } = getMachineConfig();
      const electionDefinition = workspace.store.getElectionDefinition();
      return new LiveCheck().generateQrCodeValue({
        machineId,
        electionHash: electionDefinition?.electionHash,
      });
    },

    getUsbDriveStatus(): Promise<UsbDriveStatus> {
      return usbDrive.status();
    },

    ejectUsbDrive(): Promise<void> {
      return usbDrive.eject();
    },

    async configureFromBallotPackageOnUsbDrive(): Promise<
      Result<void, BallotPackageConfigurationError>
    > {
      assert(!store.getElectionDefinition(), 'Already configured');
      const usbDriveStatus = await usbDrive.status();
      assert(usbDriveStatus.status === 'mounted', 'No USB drive mounted');

      const authStatus = await auth.getAuthStatus(
        constructAuthMachineState(workspace)
      );
      const ballotPackageResult = await readBallotPackageFromUsb(
        authStatus,
        artifactAuthenticator,
        // TODO convert readBallotPackegFromUsb to use UsbDriveStatus
        { deviceName: 'not used', mountPoint: usbDriveStatus.mountPoint },
        logger
      );
      if (ballotPackageResult.isErr()) {
        return ballotPackageResult;
      }
      assert(isElectionManagerAuth(authStatus));
      const ballotPackage = ballotPackageResult.ok();
      const { electionDefinition, systemSettings } = ballotPackage;
      assert(systemSettings);
      let precinctSelection: SinglePrecinctSelection | undefined;
      if (electionDefinition.election.precincts.length === 1) {
        precinctSelection = singlePrecinctSelectionFor(
          electionDefinition.election.precincts[0].id
        );
      }

      store.withTransaction(() => {
        store.setElectionAndJurisdiction({
          electionData: electionDefinition.electionData,
          jurisdiction: authStatus.user.jurisdiction,
        });
        if (precinctSelection) {
          store.setPrecinctSelection(precinctSelection);
        }
        store.setSystemSettings(systemSettings);
      });

      return ok();
    },

    getConfig(): PrecinctScannerConfig {
      return {
        electionDefinition: store.getElectionDefinition(),
        systemSettings: store.getSystemSettings() ?? DEFAULT_SYSTEM_SETTINGS,
        precinctSelection: store.getPrecinctSelection(),
        markThresholdOverrides: store.getMarkThresholdOverrides(),
        isSoundMuted: store.getIsSoundMuted(),
        isTestMode: store.getTestMode(),
        isUltrasonicDisabled:
          !machine.supportsUltrasonic() || store.getIsUltrasonicDisabled(),
        pollsState: store.getPollsState(),
        ballotCountWhenBallotBagLastReplaced:
          store.getBallotCountWhenBallotBagLastReplaced(),
      };
    },

    unconfigureElection(input: { ignoreBackupRequirement?: boolean }): void {
      assert(
        input.ignoreBackupRequirement || store.getCanUnconfigure(),
        'Attempt to unconfigure without backup'
      );
      interpreter.unconfigure();
      workspace.reset();
    },

    setPrecinctSelection(input: {
      precinctSelection: PrecinctSelection;
    }): void {
      assert(
        store.getBallotsCounted() === 0,
        'Attempt to change precinct selection after ballots have been cast'
      );
      store.setPrecinctSelection(input.precinctSelection);
      workspace.resetElectionSession();
    },

    setMarkThresholdOverrides(input: {
      markThresholdOverrides?: MarkThresholds;
    }): void {
      store.setMarkThresholdOverrides(input.markThresholdOverrides);
    },

    setIsSoundMuted(input: { isSoundMuted: boolean }): void {
      store.setIsSoundMuted(input.isSoundMuted);
    },

    setIsUltrasonicDisabled(input: { isUltrasonicDisabled: boolean }): void {
      store.setIsUltrasonicDisabled(input.isUltrasonicDisabled);
    },

    setTestMode(input: { isTestMode: boolean }): void {
      workspace.resetElectionSession();
      store.setTestMode(input.isTestMode);
    },

    async setPollsState(input: { pollsState: PollsState }): Promise<void> {
      const previousPollsState = store.getPollsState();
      const newPollsState = input.pollsState;

      // Start new batch if opening polls, end batch if pausing or closing polls
      if (
        newPollsState === 'polls_open' &&
        previousPollsState !== 'polls_open'
      ) {
        const batchId = store.addBatch();
        await logger.log(LogEventId.ScannerBatchStarted, 'system', {
          disposition: 'success',
          message:
            'New scanning batch started due to polls being opened or voting being resumed.',
          batchId,
        });
      } else if (
        newPollsState !== 'polls_open' &&
        previousPollsState === 'polls_open'
      ) {
        const ongoingBatchId = store.getOngoingBatchId();
        assert(typeof ongoingBatchId === 'string');
        store.finishBatch({ batchId: ongoingBatchId });
        await logger.log(LogEventId.ScannerBatchEnded, 'system', {
          disposition: 'success',
          message:
            'Current scanning batch ended due to polls being closed or voting being paused.',
          batchId: ongoingBatchId,
        });
      }

      store.setPollsState(newPollsState);
    },

    async recordBallotBagReplaced(): Promise<void> {
      // If polls are open, we need to end current batch and start a new batch
      if (store.getPollsState() === 'polls_open') {
        const ongoingBatchId = store.getOngoingBatchId();
        assert(typeof ongoingBatchId === 'string');
        store.finishBatch({ batchId: ongoingBatchId });
        await logger.log(LogEventId.ScannerBatchEnded, 'system', {
          disposition: 'success',
          message:
            'Current scanning batch ended due to ballot bag replacement.',
          batchId: ongoingBatchId,
        });

        const batchId = store.addBatch();
        await logger.log(LogEventId.ScannerBatchStarted, 'system', {
          disposition: 'success',
          message: 'New scanning batch started due to ballot bag replacement.',
          batchId,
        });
      }

      store.setBallotCountWhenBallotBagLastReplaced(store.getBallotsCounted());
    },

    async backupToUsbDrive(): Promise<Result<void, ExportDataError>> {
      return await backupToUsbDrive(store, usbDrive);
    },

    async exportCastVoteRecordsToUsbDrive(): Promise<
      Result<void, ExportCastVoteRecordReportToUsbDriveError>
    > {
      const electionDefinition = store.getElectionDefinition();
      assert(electionDefinition);

      const exportResult = await exportCastVoteRecordReportToUsbDrive(
        {
          electionDefinition,
          isTestMode: store.getTestMode(),
          ballotsCounted: store.getBallotsCounted(),
          batchInfo: store.batchStatus(),
          getResultSheetGenerator: store.forEachResultSheet.bind(store),
          definiteMarkThreshold:
            store.getCurrentMarkThresholds()?.definite ??
            DefaultMarkThresholds.definite,
          artifactAuthenticator,
          disableOriginalSnapshots: isFeatureFlagEnabled(
            BooleanEnvironmentVariableName.DISABLE_CVR_ORIGINAL_SNAPSHOTS
          ),
        },
        // TODO Convert exportCastVoteRecordReportToUsbDrive to use libs/usb-drive
        async () => {
          const drive = await usbDrive.status();
          return drive.status === 'mounted' ? [drive] : [];
        }
      );

      if (exportResult.isOk()) {
        store.setCvrsBackedUp();
      }

      return exportResult;
    },

    async getScannerResultsByParty(): Promise<
      Tabulation.GroupList<Tabulation.ElectionResults>
    > {
      const results = await getScannerResults({ store, splitByParty: true });
      return results;
    },

    getScannerStatus(): PrecinctScannerStatus {
      const machineStatus = machine.status();
      const ballotsCounted = store.getBallotsCounted();
      const canUnconfigure = store.getCanUnconfigure();
      return {
        ...machineStatus,
        ballotsCounted,
        canUnconfigure,
      };
    },

    scanBallot(): void {
      assert(store.getPollsState() === 'polls_open');
      const electionDefinition = store.getElectionDefinition();
      const precinctSelection = store.getPrecinctSelection();
      assert(electionDefinition);
      assert(precinctSelection);
      interpreter.configure({
        electionDefinition,
        precinctSelection,
        testMode: store.getTestMode(),
        markThresholdOverrides: store.getMarkThresholdOverrides(),
        ballotImagesPath: workspace.ballotImagesPath,
      });
      machine.scan();
    },

    acceptBallot(): void {
      machine.accept();
    },

    returnBallot(): void {
      machine.return();
    },

    supportsUltrasonic(): boolean {
      return machine.supportsUltrasonic();
    },
  });
}

export type Api = ReturnType<typeof buildApi>;

export function buildApp(
  auth: InsertedSmartCardAuthApi,
  artifactAuthenticator: ArtifactAuthenticatorApi,
  machine: PrecinctScannerStateMachine,
  interpreter: PrecinctScannerInterpreter,
  workspace: Workspace,
  usbDrive: UsbDrive,
  logger: Logger
): Application {
  const app: Application = express();
  const api = buildApi(
    auth,
    artifactAuthenticator,
    machine,
    interpreter,
    workspace,
    usbDrive,
    logger
  );
  app.use('/api', grout.buildRouter(api, express));
  useDevDockRouter(app, express);
  return app;
}
