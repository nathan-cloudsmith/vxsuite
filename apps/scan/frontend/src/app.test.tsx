import {
  singlePrecinctSelectionFor,
  MemoryHardware,
  buildElectionResultsFixture,
} from '@votingworks/utils';
import { fakeLogger, LogEventId } from '@votingworks/logging';
import userEvent from '@testing-library/user-event';
import {
  fakeKiosk,
  advanceTimersAndPromises,
  expectPrint,
  fakeSystemAdministratorUser,
  mockOf,
  hasTextAcrossElements,
} from '@votingworks/test-utils';
import {
  electionSampleDefinition,
  electionMinimalExhaustiveSampleDefinition,
} from '@votingworks/fixtures';
import {
  AdjudicationReason,
  SheetInterpretation,
  getDisplayElectionHash,
} from '@votingworks/types';
import { err, ok } from '@votingworks/basics';

import type { PrecinctScannerConfig } from '@votingworks/scan-backend';
import { waitFor, screen, within, render } from '../test/react_testing_library';
import {
  BALLOT_BAG_CAPACITY,
  POLLING_INTERVAL_FOR_SCANNER_STATUS_MS,
} from './config/globals';
import { scannerStatus } from '../test/helpers/helpers';
import { REPRINT_REPORT_TIMEOUT_SECONDS } from './screens/poll_worker_screen';
import { SELECT_PRECINCT_TEXT } from './screens/election_manager_screen';
import {
  ApiMock,
  createApiMock,
  statusNoPaper,
} from '../test/helpers/mock_api_client';
import { App, AppProps } from './app';
import { DisplaySettingsManager } from './components/display_settings_manager';

jest.mock(
  './components/display_settings_manager',
  (): typeof import('./components/display_settings_manager') => ({
    DisplaySettingsManager: jest.fn(),
  })
);

let apiMock: ApiMock;

jest.setTimeout(20000);

let kiosk = fakeKiosk();

function renderApp(props: Partial<AppProps> = {}) {
  const hardware = MemoryHardware.build({
    connectPrinter: true,
    connectCardReader: true,
    connectPrecinctScanner: true,
  });
  const logger = fakeLogger();
  render(
    <App
      hardware={hardware}
      logger={logger}
      apiClient={apiMock.mockApiClient}
      {...props}
    />
  );
  return { hardware, logger };
}

/**
 * HACK: The modal library we're using applies an `aria-hidden` attribute
 * to the root element when a modal is open and removes it when the modal
 * is closed, but this isn't happening in the jest environment, for some
 * reason. Works as expected in production.
 * We're removing the attribute here to make sure our getByRole queries work
 * properly.
 */
async function hackActuallyCleanUpReactModal() {
  await waitFor(() => {
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
  });

  window.document.body.firstElementChild?.removeAttribute('aria-hidden');
}

beforeEach(() => {
  jest.useFakeTimers();

  kiosk = fakeKiosk();
  window.kiosk = kiosk;

  apiMock = createApiMock();
  apiMock.expectGetMachineConfig();
  apiMock.removeCard(); // Set a default auth state of no card inserted.

  mockOf(DisplaySettingsManager).mockReturnValue(null);
});

afterEach(() => {
  apiMock.mockApiClient.assertComplete();

  mockOf(DisplaySettingsManager).mockReset();
});

test('shows setup card reader screen when there is no card reader', async () => {
  apiMock.expectGetConfig();
  apiMock.expectGetUsbDriveStatus('mounted');
  apiMock.expectGetScannerStatus(statusNoPaper);
  const hardware = MemoryHardware.build({ connectCardReader: false });
  renderApp({ hardware });
  await screen.findByText('Card Reader Not Detected');
});

test('shows insert USB Drive screen when there is no USB drive', async () => {
  apiMock.expectGetConfig();
  apiMock.expectGetUsbDriveStatus('no_drive');
  apiMock.expectGetScannerStatus(statusNoPaper);
  renderApp();
  await screen.findByText('No USB Drive Detected');
});

test('app can load and configure from a usb stick', async () => {
  apiMock.authenticateAsElectionManager(electionSampleDefinition);
  apiMock.expectCheckUltrasonicSupported(false);

  apiMock.expectGetConfig({
    electionDefinition: undefined,
  });
  apiMock.expectGetUsbDriveStatus('no_drive');
  apiMock.expectGetScannerStatus(statusNoPaper);
  renderApp();
  await screen.findByText('VxScan is Not Configured');
  await screen.findByText('Insert a USB drive containing a ballot package.');

  // Insert a USB with no ballot package
  apiMock.expectGetUsbDriveStatus('mounted');
  apiMock.mockApiClient.configureFromBallotPackageOnUsbDrive
    .expectCallWith()
    .resolves(err('no_ballot_package_on_usb_drive'));
  apiMock.expectGetConfig({
    electionDefinition: undefined,
  });
  await screen.findByText('No ballot package found on the inserted USB drive.');

  // Remove the USB
  apiMock.expectGetUsbDriveStatus('no_drive');
  await screen.findByText('Insert a USB drive containing a ballot package.');

  // Insert a USB with a ballot package
  apiMock.expectGetUsbDriveStatus('mounted');
  apiMock.mockApiClient.configureFromBallotPackageOnUsbDrive
    .expectCallWith()
    .resolves(ok());
  apiMock.expectGetConfig({ electionDefinition: electionSampleDefinition });
  await screen.findByText('Configuring VxScan from USB drive…');

  // Select precinct
  await screen.findByText('Election Manager Settings');
  screen.getByText(SELECT_PRECINCT_TEXT);
  apiMock.expectSetPrecinct(singlePrecinctSelectionFor('23'));
  apiMock.expectGetConfig({
    precinctSelection: singlePrecinctSelectionFor('23'),
  });
  userEvent.selectOptions(await screen.findByTestId('selectPrecinct'), '23');
  apiMock.removeCard();

  await screen.findByText('Polls Closed');
});

test('election manager must set precinct', async () => {
  apiMock.expectCheckUltrasonicSupported(false);
  apiMock.expectGetConfig({
    precinctSelection: undefined,
  });
  apiMock.expectGetUsbDriveStatus('mounted');
  apiMock.expectGetScannerStatus(statusNoPaper);
  renderApp();
  await screen.findByText('No Precinct Selected');

  // Poll Worker card does nothing
  apiMock.authenticateAsPollWorker(electionSampleDefinition);
  await screen.findByText('No Precinct Selected');
  apiMock.removeCard();
  await advanceTimersAndPromises(1);

  // Insert Election Manager card and set precinct
  apiMock.authenticateAsElectionManager(electionSampleDefinition);
  await screen.findByText('Election Manager Settings');
  screen.getByText(SELECT_PRECINCT_TEXT);
  apiMock.expectSetPrecinct(singlePrecinctSelectionFor('23'));
  apiMock.expectGetConfig({
    precinctSelection: singlePrecinctSelectionFor('23'),
  });
  userEvent.selectOptions(await screen.findByTestId('selectPrecinct'), '23');
  apiMock.removeCard();
  // Confirm precinct is set and correct
  await screen.findByText('Polls Closed');
  screen.getByText('Center Springfield,');

  // Poll Worker card can be used to open polls now
  apiMock.expectGetScannerResultsByParty([]);
  apiMock.authenticateAsPollWorker(electionSampleDefinition);
  await screen.findByText('Do you want to open the polls?');
});

test('election manager and poll worker configuration', async () => {
  const electionDefinition = electionSampleDefinition;
  let config: Partial<PrecinctScannerConfig> = { electionDefinition };
  apiMock.expectCheckUltrasonicSupported(false);
  apiMock.expectGetConfig(config);
  apiMock.expectGetScannerStatus(statusNoPaper);
  apiMock.expectGetUsbDriveStatus('mounted');
  const { logger } = renderApp();
  await screen.findByText('Polls Closed');

  // Change mode as Election Manager
  apiMock.authenticateAsElectionManager(electionDefinition);
  await screen.findByText('Election Manager Settings');
  apiMock.expectGetScannerStatus(statusNoPaper);
  apiMock.expectSetTestMode(false);
  config = { ...config, isTestMode: false };

  await hackActuallyCleanUpReactModal();

  apiMock.expectGetConfig(config);
  userEvent.click(
    await screen.findByRole('option', {
      name: 'Official Ballot Mode',
      selected: false,
    })
  );
  await waitFor(() =>
    screen.findByRole('option', {
      name: 'Official Ballot Mode',
      selected: true,
    })
  );

  // Change precinct as Election Manager
  const precinct = electionDefinition.election.precincts[0];
  const precinctSelection = singlePrecinctSelectionFor(precinct.id);
  apiMock.expectGetScannerStatus(statusNoPaper);
  apiMock.expectSetPrecinct(precinctSelection);
  config = { ...config, precinctSelection };
  apiMock.expectGetConfig(config);
  userEvent.selectOptions(
    await screen.findByTestId('selectPrecinct'),
    precinct.id
  );
  await screen.findByDisplayValue(precinct.name);
  expect(logger.log).toHaveBeenCalledWith(
    LogEventId.PrecinctConfigurationChanged,
    'election_manager',
    expect.objectContaining({
      disposition: 'success',
      message: expect.stringContaining('Center Springfield'),
    })
  );
  apiMock.removeCard();
  await advanceTimersAndPromises(1);

  // Open the polls
  apiMock.expectGetScannerStatus(statusNoPaper);
  apiMock.expectGetScannerResultsByParty([]);
  apiMock.authenticateAsPollWorker(electionDefinition);
  await screen.findByText('Do you want to open the polls?');

  apiMock.expectGetScannerStatus(statusNoPaper);
  apiMock.expectSetPollsState('polls_open');
  config = { ...config, pollsState: 'polls_open' };
  apiMock.expectGetConfig(config);
  userEvent.click(await screen.findByText('Yes, Open the Polls'));
  await expectPrint();
  await screen.findByText(
    'Remove the poll worker card if you have printed all necessary reports.'
  );
  apiMock.removeCard();
  await advanceTimersAndPromises(1);

  // Change precinct as Election Manager with polls open
  apiMock.expectGetScannerStatus(statusNoPaper);
  apiMock.expectSetPrecinct(singlePrecinctSelectionFor('20'));
  config = {
    ...config,
    precinctSelection: singlePrecinctSelectionFor('20'),
    pollsState: 'polls_closed_initial',
  };
  apiMock.expectGetConfig(config);
  apiMock.authenticateAsElectionManager(electionDefinition);
  await screen.findByText('Election Manager Settings');
  userEvent.click(screen.getByText('Change Precinct'));
  screen.getByText(/WARNING/);
  userEvent.selectOptions(await screen.findByTestId('selectPrecinct'), '20');
  userEvent.click(screen.getByText('Confirm'));
  await waitFor(() => {
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
  });
  await waitFor(() => {
    expect(logger.log).toHaveBeenCalledWith(
      LogEventId.PrecinctConfigurationChanged,
      'election_manager',
      expect.objectContaining({
        disposition: 'success',
        message: expect.stringContaining('South Springfield'),
      })
    );
  });
  apiMock.removeCard();
  await screen.findByText('Polls Closed');
  await screen.findByText('South Springfield,');

  // Open the polls again
  apiMock.expectGetScannerStatus(statusNoPaper);
  apiMock.authenticateAsPollWorker(electionDefinition);
  await screen.findByText('Do you want to open the polls?');
  apiMock.expectSetPollsState('polls_open');
  config = {
    ...config,
    pollsState: 'polls_open',
  };
  apiMock.expectGetConfig(config);
  userEvent.click(await screen.findByText('Yes, Open the Polls'));

  await hackActuallyCleanUpReactModal();

  await expectPrint();
  await screen.findByText(
    'Remove the poll worker card if you have printed all necessary reports.'
  );
  apiMock.removeCard();
  await advanceTimersAndPromises(1);

  // Remove card and insert election manager card to unconfigure
  apiMock.expectGetScannerStatus({
    ...statusNoPaper,
    canUnconfigure: true,
    ballotsCounted: 1,
  });
  apiMock.authenticateAsElectionManager(electionDefinition);
  await screen.findByText('Election Manager Settings');
  // Confirm we can't unconfigure just by changing precinct
  expect(await screen.findByTestId('selectPrecinct')).toBeDisabled();

  userEvent.click(screen.getByRole('tab', { name: /data/i }));

  userEvent.click(
    await screen.findByText('Delete All Election Data from VxScan')
  );
  await screen.findByText(
    'Do you want to remove all election information and data from this machine?'
  );
  userEvent.click(await screen.findByText('Cancel'));
  expect(
    screen.queryByText(
      'Do you want to remove all election information and data from this machine?'
    )
  ).toBeNull();

  // Actually unconfigure
  apiMock.mockApiClient.unconfigureElection.expectCallWith({}).resolves();
  apiMock.expectGetConfig({ electionDefinition: undefined });
  apiMock.mockApiClient.ejectUsbDrive.expectCallWith().resolves();
  apiMock.expectGetUsbDriveStatus('ejected');
  userEvent.click(
    await screen.findByText('Delete All Election Data from VxScan')
  );
  userEvent.click(await screen.findByText('Yes, Delete All'));
  await screen.findByText('Loading');
  await screen.findByText('VxScan is Not Configured');
});

const statusBallotCounted = scannerStatus({
  state: 'no_paper',
  ballotsCounted: 1,
});

async function scanBallot() {
  apiMock.expectGetScannerStatus(scannerStatus({ state: 'ready_to_scan' }));
  apiMock.mockApiClient.scanBallot.expectCallWith().resolves();
  jest.advanceTimersByTime(POLLING_INTERVAL_FOR_SCANNER_STATUS_MS);
  await screen.findByText(/Please wait/);

  apiMock.expectGetScannerStatus(scannerStatus({ state: 'scanning' }));
  jest.advanceTimersByTime(POLLING_INTERVAL_FOR_SCANNER_STATUS_MS);

  apiMock.expectGetScannerStatus(scannerStatus({ state: 'ready_to_accept' }));
  apiMock.mockApiClient.acceptBallot.expectCallWith().resolves();
  jest.advanceTimersByTime(POLLING_INTERVAL_FOR_SCANNER_STATUS_MS);

  apiMock.expectGetScannerStatus(scannerStatus({ state: 'accepted' }));
  jest.advanceTimersByTime(POLLING_INTERVAL_FOR_SCANNER_STATUS_MS);
  await screen.findByText('Your ballot was counted!');

  apiMock.expectGetScannerStatus(statusBallotCounted);
  jest.advanceTimersByTime(POLLING_INTERVAL_FOR_SCANNER_STATUS_MS);
  await screen.findByText(/Insert Your Ballot/i);
  expect(screen.getByTestId('ballot-count').textContent).toEqual('1');
}

const mockMammalPartyResults = buildElectionResultsFixture({
  election: electionMinimalExhaustiveSampleDefinition.election,
  cardCounts: {
    bmd: 1,
    hmpb: [],
  },
  contestResultsSummaries: {
    'best-animal-mammal': {
      type: 'candidate',
      ballots: 1,
      officialOptionTallies: {
        horse: 1,
      },
    },
  },
  includeGenericWriteIn: true,
});

test('voter can cast a ballot that scans successfully ', async () => {
  const electionDefinition = electionMinimalExhaustiveSampleDefinition;
  apiMock.expectCheckUltrasonicSupported(false);
  apiMock.expectGetConfig({
    pollsState: 'polls_open',
    electionDefinition,
  });
  apiMock.expectGetUsbDriveStatus('mounted');
  apiMock.expectGetScannerStatus(statusNoPaper);
  renderApp();
  await screen.findByText(/Insert Your Ballot/i);
  screen.getByText('Scan one ballot sheet at a time.');
  screen.getByText('Example Primary Election');
  screen.getByText(/Sample County/);
  screen.getByText(/State of Sample/);
  screen.getByText('Election ID');
  within(screen.getByText('Election ID').parentElement!).getByText(
    getDisplayElectionHash(electionDefinition)
  );

  await scanBallot();

  // Insert a pollworker card
  apiMock.expectGetScannerStatus(statusBallotCounted);
  apiMock.expectGetScannerResultsByParty([
    {
      partyId: '0',
      ...mockMammalPartyResults,
    },
  ]);
  apiMock.expectExportCastVoteRecordsToUsbDrive();
  apiMock.authenticateAsPollWorker(electionSampleDefinition);
  await screen.findByText('Do you want to close the polls?');

  // Close Polls
  apiMock.expectSetPollsState('polls_closed_final');
  apiMock.expectGetConfig({
    pollsState: 'polls_closed_final',
  });
  userEvent.click(await screen.findByText('Yes, Close the Polls'));
  await screen.findByText('Closing Polls…');
  await screen.findByText('Polls are closed.');
  await expectPrint((printResult) => {
    expect(
      printResult.getAllByText(`TEST Polls Closed Report for All Precincts`)
    ).toHaveLength(3); // report for each party and a non-partisan report

    // confirm results are in report
    const mammalReport = printResult.getByTestId('tally-report-0-undefined');
    within(mammalReport).getByText(hasTextAcrossElements('Horse1'));
  });

  // Simulate unmounted usb drive
  apiMock.expectGetUsbDriveStatus('ejected');
  await advanceTimersAndPromises(2);
  // Remove the usb drive
  apiMock.expectGetUsbDriveStatus('no_drive');
  await advanceTimersAndPromises(2);

  // Remove pollworker card
  apiMock.removeCard();
  await advanceTimersAndPromises(1);

  // Insert Election Manager Card
  apiMock.authenticateAsElectionManager(electionSampleDefinition);
  await screen.findByText('Election Manager Settings');

  userEvent.click(screen.getByRole('tab', { name: /data/i }));

  userEvent.click(await screen.findByText('Save CVRs'));
  await screen.findByText('No USB Drive Detected');
  userEvent.click(await screen.findByText('Cancel'));
  expect(screen.queryByText('No USB Drive Detected')).toBeNull();

  // Insert Usb Drive
  apiMock.expectGetUsbDriveStatus('mounted');
  await waitFor(() => {
    expect(screen.getButton('Save CVRs')).toBeEnabled();
  });
  userEvent.click(await screen.findButton('Save CVRs'));
  await screen.findByRole('heading', { name: 'Save CVRs' });

  apiMock.expectExportCastVoteRecordsToUsbDrive();
  userEvent.click(await screen.findByText('Save'));
  await screen.findByText('CVRs Saved to USB Drive');

  apiMock.mockApiClient.ejectUsbDrive.expectCallWith().resolves();
  apiMock.expectGetUsbDriveStatus('ejected');
  userEvent.click(await screen.findByText('Eject USB'));
  await waitFor(() => {
    expect(screen.queryByText('Eject USB')).toBeNull();
  });
});

test('voter can cast a ballot that needs review and adjudicate as desired', async () => {
  apiMock.expectGetConfig({ pollsState: 'polls_open' });
  apiMock.expectGetUsbDriveStatus('mounted');
  apiMock.expectGetScannerStatus(statusNoPaper);
  renderApp();
  await screen.findByText(/Insert Your Ballot/i);

  const interpretation: SheetInterpretation = {
    type: 'NeedsReviewSheet',
    reasons: [{ type: AdjudicationReason.BlankBallot }],
  };
  apiMock.expectGetScannerStatus(scannerStatus({ state: 'ready_to_scan' }));
  apiMock.mockApiClient.scanBallot.expectCallWith().resolves();
  jest.advanceTimersByTime(POLLING_INTERVAL_FOR_SCANNER_STATUS_MS);
  await screen.findByText(/Please wait/);

  apiMock.expectGetScannerStatus(scannerStatus({ state: 'scanning' }));
  jest.advanceTimersByTime(POLLING_INTERVAL_FOR_SCANNER_STATUS_MS);

  apiMock.expectGetScannerStatus(
    scannerStatus({ state: 'needs_review', interpretation })
  );
  jest.advanceTimersByTime(POLLING_INTERVAL_FOR_SCANNER_STATUS_MS);
  await screen.findByText('No votes were found when scanning this ballot.');
  userEvent.click(screen.getByRole('button', { name: 'Cast Ballot As Is' }));
  await screen.findByText('Are you sure?');

  apiMock.mockApiClient.acceptBallot.expectCallWith().resolves();
  apiMock.expectGetScannerStatus(
    scannerStatus({ state: 'accepting_after_review', interpretation })
  );
  apiMock.expectGetScannerStatus(
    scannerStatus({ state: 'accepted', interpretation })
  );
  userEvent.click(
    screen.getByRole('button', { name: 'Yes, Cast Ballot As Is' })
  );
  jest.advanceTimersByTime(POLLING_INTERVAL_FOR_SCANNER_STATUS_MS);
  await screen.findByText('Your ballot was counted!');

  apiMock.expectGetScannerStatus(
    scannerStatus({ state: 'no_paper', ballotsCounted: 1 })
  );
  jest.advanceTimersByTime(POLLING_INTERVAL_FOR_SCANNER_STATUS_MS);
  await screen.findByText(/Insert Your Ballot/i);
  expect(screen.getByTestId('ballot-count').textContent).toEqual('1');
});

test('voter tries to cast ballot that is rejected', async () => {
  apiMock.expectGetConfig({ pollsState: 'polls_open' });
  apiMock.expectGetUsbDriveStatus('mounted');
  apiMock.expectGetScannerStatus(statusNoPaper);
  renderApp();
  await screen.findByText(/Insert Your Ballot/i);

  apiMock.expectGetScannerStatus(scannerStatus({ state: 'ready_to_scan' }));
  apiMock.mockApiClient.scanBallot.expectCallWith().resolves();
  jest.advanceTimersByTime(POLLING_INTERVAL_FOR_SCANNER_STATUS_MS);
  await screen.findByText(/Please wait/);

  apiMock.expectGetScannerStatus(scannerStatus({ state: 'scanning' }));
  apiMock.expectGetScannerStatus(
    scannerStatus({
      state: 'rejected',
      interpretation: {
        type: 'InvalidSheet',
        reason: 'invalid_election_hash',
      },
    })
  );
  jest.advanceTimersByTime(POLLING_INTERVAL_FOR_SCANNER_STATUS_MS);
  await screen.findByText('Ballot Not Counted');
  screen.getByText(
    'The ballot does not match the election this scanner is configured for.'
  );

  // When the voter removes the ballot return to the insert ballot screen
  apiMock.expectGetScannerStatus(statusNoPaper);
  await screen.findByText(/Insert Your Ballot/i);
});

test('voter can cast another ballot while the success screen is showing', async () => {
  apiMock.expectGetConfig({ pollsState: 'polls_open' });
  apiMock.expectGetUsbDriveStatus('mounted');
  apiMock.expectGetScannerStatus(
    scannerStatus({ state: 'accepted', ballotsCounted: 1 })
  );
  renderApp();
  await screen.findByText('Your ballot was counted!');
  expect(screen.getByTestId('ballot-count').textContent).toEqual('1');

  apiMock.expectGetScannerStatus(scannerStatus({ state: 'ready_to_scan' }));
  apiMock.mockApiClient.scanBallot.expectCallWith().resolves();
  jest.advanceTimersByTime(POLLING_INTERVAL_FOR_SCANNER_STATUS_MS);
  await screen.findByText(/Please wait/);

  apiMock.expectGetScannerStatus(scannerStatus({ state: 'scanning' }));
  apiMock.expectGetScannerStatus(
    scannerStatus({
      state: 'needs_review',
      interpretation: {
        type: 'NeedsReviewSheet',
        reasons: [{ type: AdjudicationReason.BlankBallot }],
      },
    })
  );
  jest.advanceTimersByTime(POLLING_INTERVAL_FOR_SCANNER_STATUS_MS);
  await screen.findByText('No votes were found when scanning this ballot.');
});

test('scanning is not triggered when polls closed or cards present', async () => {
  apiMock.expectGetConfig();
  apiMock.expectGetUsbDriveStatus('mounted');
  apiMock.expectGetScannerStatus(scannerStatus({ state: 'ready_to_scan' }));
  renderApp();
  await screen.findByText('Polls Closed');
  apiMock.expectGetScannerResultsByParty([]);
  apiMock.authenticateAsPollWorker(electionSampleDefinition);
  await screen.findByText('Do you want to open the polls?');
  // Open Polls
  apiMock.expectSetPollsState('polls_open');
  apiMock.expectGetConfig({ pollsState: 'polls_open' });
  userEvent.click(screen.getByText('Yes, Open the Polls'));
  await expectPrint();
  await screen.findByText('Polls are open.');

  // Once we remove the poll worker card, scanning should start
  apiMock.mockApiClient.scanBallot.expectCallWith().resolves();
  apiMock.expectGetScannerStatus(scannerStatus({ state: 'ready_to_scan' }));
  apiMock.removeCard();
  jest.advanceTimersByTime(POLLING_INTERVAL_FOR_SCANNER_STATUS_MS);
  await screen.findByText(/Please wait/);
});

test('poll worker can open and close polls without scanning any ballots', async () => {
  apiMock.expectGetConfig({ pollsState: 'polls_closed_initial' });
  apiMock.expectGetUsbDriveStatus('mounted');
  apiMock.expectGetScannerStatus(statusNoPaper);
  renderApp();
  await screen.findByText('Polls Closed');

  // Open Polls Flow
  apiMock.expectGetScannerResultsByParty([]);
  apiMock.authenticateAsPollWorker(electionSampleDefinition);
  await screen.findByText('Do you want to open the polls?');
  apiMock.expectSetPollsState('polls_open');
  apiMock.expectGetConfig({ pollsState: 'polls_open' });
  userEvent.click(screen.getByRole('button', { name: 'Yes, Open the Polls' }));
  await screen.findByText('Polls are open.');
  await expectPrint();
  userEvent.click(
    screen.getByRole('button', { name: 'Print Additional Polls Opened Report' })
  );
  await screen.findByText('Printing Report…');
  await expectPrint();
  await advanceTimersAndPromises(REPRINT_REPORT_TIMEOUT_SECONDS);
  await screen.findByText('Polls are open.');
  screen.getByRole('button', { name: 'Print Additional Polls Opened Report' });
  screen.getByText('Remove the poll worker card', { exact: false });
  apiMock.removeCard();
  await screen.findByText(/Insert Your Ballot/i);

  // Close Polls Flow
  apiMock.authenticateAsPollWorker(electionSampleDefinition);
  await screen.findByText('Do you want to close the polls?');
  apiMock.expectSetPollsState('polls_closed_final');
  apiMock.expectGetConfig({ pollsState: 'polls_closed_final' });
  userEvent.click(screen.getByRole('button', { name: 'Yes, Close the Polls' }));
  await screen.findByText('Polls are closed.');
  await expectPrint();
  userEvent.click(
    screen.getByRole('button', { name: 'Print Additional Polls Closed Report' })
  );
  await screen.findByText('Printing Report…');
  await expectPrint();
  await advanceTimersAndPromises(REPRINT_REPORT_TIMEOUT_SECONDS);
  await screen.findByText('Polls are closed.');
  screen.getByRole('button', { name: 'Print Additional Polls Closed Report' });
  screen.getByText('Remove the poll worker card', { exact: false });
  apiMock.removeCard();
  await screen.findByText('Polls Closed');
});

test('open polls, scan ballot, close polls, save results', async () => {
  const electionDefinition = electionMinimalExhaustiveSampleDefinition;
  apiMock.expectGetConfig({
    electionDefinition,
  });
  apiMock.expectGetUsbDriveStatus('mounted');
  apiMock.expectGetScannerStatus(statusNoPaper);
  renderApp();
  await screen.findByText('Polls Closed');
  // Open Polls Flow
  apiMock.expectGetScannerResultsByParty([]);
  apiMock.authenticateAsPollWorker(electionDefinition);
  await screen.findByText('Do you want to open the polls?');
  apiMock.expectSetPollsState('polls_open');
  apiMock.expectGetConfig({ pollsState: 'polls_open', electionDefinition });
  userEvent.click(await screen.findByText('Yes, Open the Polls'));
  await expectPrint();
  await screen.findByText(
    'Remove the poll worker card if you have printed all necessary reports.'
  );
  apiMock.removeCard();
  await screen.findByText(/Insert Your Ballot/i);

  await scanBallot();

  // Close Polls
  apiMock.expectGetScannerResultsByParty([
    {
      partyId: '0',
      ...mockMammalPartyResults,
    },
  ]);
  apiMock.expectExportCastVoteRecordsToUsbDrive();
  apiMock.authenticateAsPollWorker(electionDefinition);
  await screen.findByText('Do you want to close the polls?');
  apiMock.expectSetPollsState('polls_closed_final');
  apiMock.expectGetConfig({
    pollsState: 'polls_closed_final',
    electionDefinition,
  });
  userEvent.click(await screen.findByText('Yes, Close the Polls'));
  await screen.findByText('Closing Polls…');
  await screen.findByText('Polls are closed.');
  await screen.findByText(
    'Remove the poll worker card if you have printed all necessary reports.'
  );
  await expectPrint((printResult) => {
    expect(
      printResult.getAllByText(`TEST Polls Closed Report for All Precincts`)
    ).toHaveLength(3); // report for each party and a non-partisan report

    // confirm scanned results are in report
    const mammalReport = printResult.getByTestId('tally-report-0-undefined');
    within(mammalReport).getByText(hasTextAcrossElements('Horse1'));
  });

  apiMock.expectGetScannerStatus(statusNoPaper);
  apiMock.removeCard();
  await screen.findByText('Polls Closed');
});

test('poll worker can open, pause, unpause, and close poll without scanning any ballots', async () => {
  apiMock.expectGetConfig();
  apiMock.expectGetUsbDriveStatus('mounted');
  apiMock.expectGetScannerStatus(statusNoPaper);
  renderApp();
  await screen.findByText('Polls Closed');

  // Open Polls
  apiMock.expectGetScannerResultsByParty([]);
  apiMock.authenticateAsPollWorker(electionSampleDefinition);
  await screen.findByText('Do you want to open the polls?');
  apiMock.expectSetPollsState('polls_open');
  apiMock.expectGetConfig({ pollsState: 'polls_open' });
  userEvent.click(await screen.findByText('Yes, Open the Polls'));
  await expectPrint();
  await screen.findByText(
    'Remove the poll worker card if you have printed all necessary reports.'
  );
  apiMock.removeCard();
  await screen.findByText(/Insert Your Ballot/i);

  // Pause Voting Flow
  apiMock.authenticateAsPollWorker(electionSampleDefinition);
  await screen.findByText('Do you want to close the polls?');
  userEvent.click(await screen.findByText('No'));
  apiMock.expectSetPollsState('polls_paused');
  apiMock.expectGetConfig({ pollsState: 'polls_paused' });
  userEvent.click(await screen.findByText('Pause Voting'));
  await screen.findByText('Pausing Voting…');
  await expectPrint();
  await screen.findByText(
    'Remove the poll worker card if you have printed all necessary reports.'
  );
  apiMock.removeCard();
  await screen.findByText('Polls Paused');

  // Resume Voting Flow
  apiMock.authenticateAsPollWorker(electionSampleDefinition);
  await screen.findByText('Do you want to resume voting?');
  apiMock.expectSetPollsState('polls_open');
  apiMock.expectGetConfig({ pollsState: 'polls_open' });
  userEvent.click(await screen.findByText('Yes, Resume Voting'));
  await expectPrint();
  await screen.findByText(
    'Remove the poll worker card if you have printed all necessary reports.'
  );
  apiMock.removeCard();
  await screen.findByText(/Insert Your Ballot/i);

  // Close Polls Flow
  apiMock.authenticateAsPollWorker(electionSampleDefinition);
  await screen.findByText('Do you want to close the polls?');
  apiMock.expectSetPollsState('polls_closed_final');
  apiMock.expectGetConfig({ pollsState: 'polls_closed_final' });
  userEvent.click(await screen.findByText('Yes, Close the Polls'));
  await screen.findByText('Closing Polls…');
  await expectPrint();
  await screen.findByText(
    'Remove the poll worker card if you have printed all necessary reports.'
  );
  apiMock.removeCard();
  await screen.findByText('Polls Closed');
});

test('system administrator can log in and unconfigure machine', async () => {
  apiMock.expectGetConfig();
  apiMock.expectGetUsbDriveStatus('mounted');
  apiMock.expectGetScannerStatus(statusNoPaper);
  renderApp();

  apiMock.authenticateAsSystemAdministrator();

  await screen.findByRole('button', { name: 'Reboot from USB' });
  screen.getByRole('button', { name: 'Reboot to BIOS' });
  const unconfigureMachineButton = screen.getByRole('button', {
    name: 'Unconfigure Machine',
  });

  apiMock.mockApiClient.unconfigureElection
    .expectCallWith({ ignoreBackupRequirement: true })
    .resolves();
  apiMock.expectGetConfig({ electionDefinition: undefined });
  userEvent.click(unconfigureMachineButton);
  const modal = await screen.findByRole('alertdialog');
  userEvent.click(
    within(modal).getByRole('button', {
      name: 'Yes, Delete Election Data',
    })
  );
  await waitFor(() => expect(screen.queryByRole('alertdialog')).toBeNull());

  apiMock.removeCard();
});

test('system administrator allowed to log in on unconfigured machine', async () => {
  apiMock.expectGetConfig({ electionDefinition: undefined });
  apiMock.expectGetUsbDriveStatus('mounted');
  apiMock.expectGetScannerStatus(statusNoPaper);
  renderApp();

  apiMock.setAuthStatus({
    status: 'checking_pin',
    user: fakeSystemAdministratorUser(),
  });
  await screen.findByText('Enter the card PIN to unlock.');
});

test('system administrator sees system administrator screen after logging in to unconfigured machine', async () => {
  apiMock.expectGetConfig({ electionDefinition: undefined });
  apiMock.expectGetUsbDriveStatus('mounted');
  apiMock.expectGetScannerStatus(statusNoPaper);
  apiMock.authenticateAsSystemAdministrator();
  renderApp();

  await screen.findByRole('button', { name: 'Reboot from USB' });
});

test('system administrator can reset polls to paused', async () => {
  apiMock.expectGetConfig({
    pollsState: 'polls_closed_final',
  });
  apiMock.expectGetUsbDriveStatus('mounted');
  apiMock.expectGetScannerStatus(statusNoPaper);
  renderApp();
  await screen.findByText('Polls Closed');

  apiMock.authenticateAsSystemAdministrator();

  userEvent.click(
    await screen.findByRole('button', { name: 'Reset Polls to Paused' })
  );
  const modal = await screen.findByRole('alertdialog');
  apiMock.expectSetPollsState('polls_paused');
  apiMock.expectGetConfig({ pollsState: 'polls_paused' });
  userEvent.click(
    await within(modal).findByRole('button', { name: 'Reset Polls to Paused' })
  );
  await waitFor(() =>
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument()
  );
  apiMock.removeCard();
  await screen.findByText('Polls Paused');
});

test('election manager cannot auth onto machine with different election hash', async () => {
  apiMock.expectGetConfig();
  apiMock.expectGetUsbDriveStatus('mounted');
  apiMock.expectGetScannerStatus(statusNoPaper);
  renderApp();

  apiMock.setAuthStatus({
    status: 'logged_out',
    reason: 'election_manager_wrong_election',
  });
  await screen.findByText('Invalid Card');
});

test('replace ballot bag flow', async () => {
  apiMock.expectGetConfig({
    pollsState: 'polls_open',
  });
  apiMock.expectGetUsbDriveStatus('mounted');
  apiMock.expectGetScannerStatus(statusNoPaper);
  const { logger } = renderApp();
  await screen.findByText(/Insert Your Ballot/i);

  await scanBallot();

  // should go to modal after accepted screen
  apiMock.expectGetScannerStatus(
    scannerStatus({
      state: 'no_paper',
      ballotsCounted: BALLOT_BAG_CAPACITY,
    })
  );
  jest.advanceTimersByTime(POLLING_INTERVAL_FOR_SCANNER_STATUS_MS);
  await screen.findByText('Ballot Bag Full');

  // Insert a pollworker card to enter confirmation step
  apiMock.authenticateAsPollWorker(electionSampleDefinition);
  await advanceTimersAndPromises(1);
  await screen.findByText('Ballot Bag Replaced?');

  // Removing card at this point returns to initial screen
  apiMock.removeCard();
  await advanceTimersAndPromises(1);
  await screen.findByText('Ballot Bag Full');

  // Can confirm with pollworker card
  apiMock.authenticateAsPollWorker(electionSampleDefinition);
  await advanceTimersAndPromises(1);
  await screen.findByText('Ballot Bag Replaced?');
  userEvent.click(screen.getByText('Yes, New Ballot Bag is Ready'));

  // Prompted to remove card
  await advanceTimersAndPromises(1);
  await screen.findByText('Remove card to resume voting.');

  // Removing card returns to voter screen
  apiMock.mockApiClient.recordBallotBagReplaced.expectCallWith().resolves();
  apiMock.expectGetConfig({
    pollsState: 'polls_open',
    ballotCountWhenBallotBagLastReplaced: BALLOT_BAG_CAPACITY,
  });
  apiMock.removeCard();
  await advanceTimersAndPromises(3);
  await screen.findByText(/Insert Your Ballot/i);

  expect(logger.log).toHaveBeenCalledWith(
    LogEventId.BallotBagReplaced,
    'poll_worker',
    expect.anything()
  );

  // Does not prompt again if new threshold hasn't been reached
  apiMock.expectGetScannerStatus(
    scannerStatus({
      state: 'no_paper',
      ballotsCounted: BALLOT_BAG_CAPACITY * 2 - 1,
    })
  );
  await advanceTimersAndPromises(1);
  await screen.findByText(/Insert Your Ballot/i);

  // Prompts again if new threshold has been reached
  apiMock.expectGetScannerStatus(
    scannerStatus({
      state: 'no_paper',
      ballotsCounted: BALLOT_BAG_CAPACITY * 2,
    })
  );
  await advanceTimersAndPromises(1);
  await screen.findByText('Ballot Bag Full');
});

test('renders DisplaySettingsManager', async () => {
  apiMock.expectGetConfig({ pollsState: 'polls_open' });
  apiMock.expectGetUsbDriveStatus('mounted');
  apiMock.expectGetScannerStatus(statusNoPaper);

  renderApp();
  await screen.findByText(/insert your ballot/i);

  expect(mockOf(DisplaySettingsManager)).toBeCalled();
});
