import {
  electionMinimalExhaustiveSample,
  electionMinimalExhaustiveSampleDefinition,
  electionMinimalExhaustiveSampleWithReportingUrlDefinition,
  electionSample2,
  electionSample2Definition,
} from '@votingworks/fixtures';
import {
  expectPrint,
  hasTextAcrossElements,
  fakeKiosk,
} from '@votingworks/test-utils';
import {
  ALL_PRECINCTS_SELECTION,
  singlePrecinctSelectionFor,
  MemoryHardware,
  buildElectionResultsFixture,
} from '@votingworks/utils';
import {
  ElectionDefinition,
  PrecinctReportDestination,
  PrecinctSelection,
  Tabulation,
} from '@votingworks/types';

import userEvent from '@testing-library/user-event';
import { fakeLogger } from '@votingworks/logging';
import {
  act,
  render,
  screen,
  waitFor,
  within,
} from '../test/react_testing_library';
import { App } from './app';
import {
  ApiMock,
  createApiMock,
  statusNoPaper,
} from '../test/helpers/mock_api_client';

let apiMock: ApiMock;

function renderApp({
  connectPrinter,
  precinctReportDestination,
}: {
  connectPrinter: boolean;
  precinctReportDestination?: PrecinctReportDestination;
}) {
  const hardware = MemoryHardware.build({
    connectPrinter,
    connectCardReader: true,
    connectPrecinctScanner: true,
  });
  const logger = fakeLogger();
  render(
    <App
      hardware={hardware}
      logger={logger}
      apiClient={apiMock.mockApiClient}
      precinctReportDestination={precinctReportDestination}
    />
  );
  return { hardware, logger };
}

const GENERAL_ELECTION_RESULTS = [
  buildElectionResultsFixture({
    election: electionSample2,
    cardCounts: {
      bmd: 0,
      hmpb: [100],
    },
    includeGenericWriteIn: true,
    contestResultsSummaries: {
      president: {
        type: 'candidate',
        ballots: 100,
        officialOptionTallies: {
          'jackie-chan': 70,
          'marie-curie': 30,
        },
      },
    },
  }),
];

const PRIMARY_ELECTION_RESULTS = [
  {
    partyId: '0',
    ...buildElectionResultsFixture({
      election: electionMinimalExhaustiveSample,
      cardCounts: {
        bmd: 0,
        hmpb: [80],
      },
      includeGenericWriteIn: true,
      contestResultsSummaries: {
        'best-animal-mammal': {
          type: 'candidate',
          ballots: 80,
          undervotes: 8,
          overvotes: 2,
          officialOptionTallies: {
            otter: 70,
          },
        },
        fishing: {
          type: 'yesno',
          ballots: 80,
          undervotes: 20,
          yesTally: 40,
          noTally: 20,
        },
      },
    }),
  },
  {
    partyId: '1',
    ...buildElectionResultsFixture({
      election: electionMinimalExhaustiveSample,
      cardCounts: {
        bmd: 0,
        hmpb: [70],
      },
      includeGenericWriteIn: true,
      contestResultsSummaries: {
        'best-animal-fish': {
          type: 'candidate',
          ballots: 70,
          officialOptionTallies: {
            seahorse: 70,
          },
        },
        fishing: {
          type: 'yesno',
          ballots: 70,
          undervotes: 10,
          yesTally: 30,
          noTally: 30,
        },
      },
    }),
  },
];

beforeEach(() => {
  jest.useFakeTimers();
  apiMock = createApiMock();
  apiMock.expectGetMachineConfig();
  apiMock.expectGetUsbDriveStatus('mounted');
  apiMock.removeCard(); // Set a default auth state of no card inserted.

  const kiosk = fakeKiosk();
  window.kiosk = kiosk;
});

afterEach(() => {
  apiMock.mockApiClient.assertComplete();
});

async function closePolls({
  electionDefinition,
  latestScannerResultsByParty,
  precinctSelection,
  removeCardAfter = true,
}: {
  electionDefinition: ElectionDefinition;
  latestScannerResultsByParty?: Tabulation.GroupList<Tabulation.ElectionResults>;
  precinctSelection: PrecinctSelection;
  removeCardAfter?: boolean;
}): Promise<void> {
  if (latestScannerResultsByParty) {
    apiMock.expectGetScannerResultsByParty(latestScannerResultsByParty);
  }
  apiMock.expectExportCastVoteRecordsToUsbDrive();
  apiMock.authenticateAsPollWorker(electionDefinition);
  await screen.findByText('Do you want to close the polls?');
  apiMock.expectSetPollsState('polls_closed_final');
  apiMock.expectGetConfig({
    electionDefinition,
    precinctSelection,
    pollsState: 'polls_closed_final',
  });
  userEvent.click(await screen.findByText('Yes, Close the Polls'));
  await screen.findByText('Polls are closed.');
  if (removeCardAfter) {
    apiMock.removeCard();
    await screen.findByText('Voting is complete.');
  }
}

test('polls open, All Precincts, primary election + check additional report', async () => {
  const electionDefinition = electionMinimalExhaustiveSampleDefinition;
  const { election } = electionDefinition;
  apiMock.expectGetConfig({ electionDefinition });
  apiMock.expectGetScannerStatus(statusNoPaper);
  renderApp({
    connectPrinter: true,
    precinctReportDestination: 'laser-printer',
  });
  await screen.findByText('Polls Closed');

  // Open the polls
  apiMock.expectGetScannerResultsByParty([]);
  apiMock.authenticateAsPollWorker(electionDefinition);
  await screen.findByText('Do you want to open the polls?');
  apiMock.expectSetPollsState('polls_open');
  apiMock.expectGetConfig({ electionDefinition, pollsState: 'polls_open' });
  userEvent.click(screen.getByText('Yes, Open the Polls'));
  await screen.findByText('Polls are open.');

  async function checkReport() {
    await expectPrint((printedElement) => {
      // correct number of sub-reports
      expect(
        printedElement.getAllByText(
          'TEST Polls Opened Report for All Precincts'
        )
      ).toHaveLength(election.parties.length + 1);

      // check mammal zero report: title, total ballots, number of contests
      const mReport = printedElement.getByTestId('tally-report-0-undefined');
      within(mReport).getByText('Mammal Party Example Primary Election:');
      within(within(mReport).getByTestId('total-ballots')).getByText('0');
      expect(within(mReport).getAllByTestId(/results-table-/)).toHaveLength(2);

      // check fish zero report: title, total ballots, number of contests
      const fishReport = printedElement.getByTestId('tally-report-1-undefined');
      within(fishReport).getByText('Fish Party Example Primary Election:');
      within(within(fishReport).getByTestId('total-ballots')).getByText('0');
      expect(within(fishReport).getAllByTestId(/results-table-/)).toHaveLength(
        2
      );

      // check nonpartisan zero report: title, total ballots, number of contests
      const npReport = printedElement.getByTestId(
        'tally-report-undefined-undefined'
      );
      within(npReport).getByText(
        'Example Primary Election Nonpartisan Contests:'
      );
      within(within(npReport).getByTestId('total-ballots')).getByText('0');
      expect(within(npReport).getAllByTestId(/results-table-/)).toHaveLength(3);

      // Check that there are no QR code pages since we are opening polls, even though reporting is turned on.
      expect(
        printedElement.queryAllByText('Automatic Election Results Reporting')
      ).toHaveLength(0);
    });
  }
  await checkReport();

  userEvent.click(screen.getByText('Print Additional Polls Opened Report'));
  await screen.findByText('Printing Report…');
  await screen.findByText('Polls are open.');
  await checkReport();
});

test('polls closed, primary election, single precinct + quickresults on', async () => {
  const electionDefinition =
    electionMinimalExhaustiveSampleWithReportingUrlDefinition;
  const { election } = electionDefinition;
  const precinctSelection = singlePrecinctSelectionFor('precinct-1');
  apiMock.expectGetConfig({
    electionDefinition,
    pollsState: 'polls_open',
    precinctSelection,
  });
  apiMock.expectGetScannerStatus({ ...statusNoPaper, ballotsCounted: 3 });
  renderApp({
    connectPrinter: true,
    precinctReportDestination: 'laser-printer',
  });
  await screen.findByText(/Insert Your Ballot/i);

  // Close the polls
  await closePolls({
    electionDefinition,
    latestScannerResultsByParty: PRIMARY_ELECTION_RESULTS,
    precinctSelection: ALL_PRECINCTS_SELECTION,
  });

  await expectPrint((printedElement) => {
    // correct number of sub-reports
    expect(
      printedElement.getAllByText('TEST Polls Closed Report for Precinct 1')
    ).toHaveLength(election.parties.length + 1);

    // check mammal zero report: title, total ballots, number of contests
    const mReport = printedElement.getByTestId('tally-report-0-precinct-1');
    within(mReport).getByText('Mammal Party Example Primary Election:');
    within(within(mReport).getByTestId('total-ballots')).getByText('80');
    expect(within(mReport).getAllByTestId(/results-table-/)).toHaveLength(2);
    within(within(mReport).getByTestId('best-animal-mammal-otter')).getByText(
      '70'
    );

    // check fish zero report: title, total ballots, number of contests
    const fReport = printedElement.getByTestId('tally-report-1-precinct-1');
    within(fReport).getByText('Fish Party Example Primary Election:');
    within(within(fReport).getByTestId('total-ballots')).getByText('70');
    expect(within(fReport).getAllByTestId(/results-table-/)).toHaveLength(2);
    within(within(fReport).getByTestId('best-animal-fish-seahorse')).getByText(
      '70'
    );

    // check nonpartisan zero report: title, total ballots, number of contests
    const npReport = printedElement.getByTestId(
      'tally-report-undefined-precinct-1'
    );
    within(npReport).getByText(
      'Example Primary Election Nonpartisan Contests:'
    );
    within(within(npReport).getByTestId('total-ballots')).getByText('150');
    expect(within(npReport).getAllByTestId(/results-table-/)).toHaveLength(3);
    within(within(npReport).getByTestId('fishing-yes')).getByText('70');

    expect(
      printedElement.queryAllByText('Automatic Election Results Reporting')
    ).toHaveLength(1);
  });
});

test('polls open, general election, single precinct', async () => {
  const electionDefinition = electionSample2Definition;
  const precinctSelection = singlePrecinctSelectionFor('23');
  apiMock.expectGetConfig({
    electionDefinition,
    pollsState: 'polls_closed_initial',
    precinctSelection,
  });
  apiMock.expectGetScannerStatus(statusNoPaper);
  renderApp({
    connectPrinter: true,
    precinctReportDestination: 'laser-printer',
  });
  await screen.findByText('Polls Closed');

  // Open the polls
  apiMock.expectGetScannerResultsByParty([]);
  apiMock.authenticateAsPollWorker(electionDefinition);
  await screen.findByText('Do you want to open the polls?');
  apiMock.expectSetPollsState('polls_open');
  apiMock.expectGetConfig({ electionDefinition, pollsState: 'polls_open' });
  userEvent.click(screen.getByText('Yes, Open the Polls'));
  await screen.findByText('Polls are open.');

  await expectPrint((printedElement) => {
    printedElement.getByText('TEST Polls Opened Report for Center Springfield');
    printedElement.getByText('General Election:');
    within(printedElement.getByTestId('total-ballots')).getByText('0');
    expect(printedElement.getAllByTestId(/results-table-/)).toHaveLength(27);
  });
});

test('polls closed, general election, all precincts', async () => {
  const electionDefinition = electionSample2Definition;
  apiMock.expectGetConfig({
    electionDefinition,
    pollsState: 'polls_open',
  });
  apiMock.expectGetScannerStatus({ ...statusNoPaper, ballotsCounted: 2 });
  renderApp({
    connectPrinter: true,
    precinctReportDestination: 'laser-printer',
  });
  await screen.findByText(/Insert Your Ballot/i);

  // Close the polls
  await closePolls({
    electionDefinition,
    latestScannerResultsByParty: GENERAL_ELECTION_RESULTS,
    precinctSelection: ALL_PRECINCTS_SELECTION,
  });

  await expectPrint((printedElement) => {
    printedElement.getByText('TEST Polls Closed Report for All Precincts');
    printedElement.getByText('General Election:');
    within(printedElement.getByTestId('total-ballots')).getByText('100');
    expect(printedElement.getAllByTestId(/results-table-/)).toHaveLength(27);
    within(printedElement.getByTestId('president-jackie-chan')).getByText('70');
  });
});

test('polls paused', async () => {
  jest.useFakeTimers().setSystemTime(new Date('2022-10-31T16:23:00.000Z'));
  const electionDefinition = electionSample2Definition;
  apiMock.expectGetConfig({
    electionDefinition,
    precinctSelection: singlePrecinctSelectionFor('23'),
    pollsState: 'polls_open',
  });
  apiMock.expectGetScannerStatus({ ...statusNoPaper, ballotsCounted: 2 });
  renderApp({
    connectPrinter: true,
    precinctReportDestination: 'laser-printer',
  });
  await screen.findByText(/Insert Your Ballot/i);

  // Pause the polls
  apiMock.expectGetScannerResultsByParty(GENERAL_ELECTION_RESULTS);
  apiMock.authenticateAsPollWorker(electionDefinition);
  await screen.findByText('Do you want to close the polls?');
  userEvent.click(await screen.findByText('No'));
  apiMock.expectSetPollsState('polls_paused');
  apiMock.expectGetConfig({
    electionDefinition,
    precinctSelection: singlePrecinctSelectionFor('23'),
    pollsState: 'polls_paused',
  });
  userEvent.click(await screen.findByText('Pause Voting'));
  await screen.findByText('Voting paused.');

  await expectPrint((printedElement) => {
    // Check heading
    printedElement.getByText(
      'TEST Voting Paused Report for Center Springfield'
    );
    printedElement.getByText('Voting Paused:');
    // Check contents
    printedElement.getByText(hasTextAcrossElements('Ballots Scanned Count2'));
    printedElement.getByText(hasTextAcrossElements('Polls StatusPaused'));
    printedElement.getByText(
      hasTextAcrossElements('Time Voting PausedMon, Oct 31, 2022, 4:23 PM')
    );
  });
});

test('polls unpaused', async () => {
  jest.useFakeTimers().setSystemTime(new Date('2022-10-31T16:23:00.000Z'));
  const electionDefinition = electionSample2Definition;
  apiMock.expectGetConfig({
    electionDefinition,
    precinctSelection: singlePrecinctSelectionFor('23'),
    pollsState: 'polls_paused',
  });
  apiMock.expectGetScannerStatus({ ...statusNoPaper, ballotsCounted: 2 });
  renderApp({
    connectPrinter: true,
    precinctReportDestination: 'laser-printer',
  });
  await screen.findByText('Polls Paused');

  // Unpause the polls
  apiMock.expectGetScannerResultsByParty(GENERAL_ELECTION_RESULTS);
  apiMock.authenticateAsPollWorker(electionDefinition);
  await screen.findByText('Do you want to resume voting?');
  userEvent.click(await screen.findByText('Yes, Resume Voting'));
  apiMock.expectSetPollsState('polls_open');
  apiMock.expectGetConfig({
    electionDefinition,
    precinctSelection: singlePrecinctSelectionFor('23'),
    pollsState: 'polls_open',
  });
  await screen.findByText('Voting resumed.');

  await expectPrint((printedElement) => {
    // Check heading
    printedElement.getByText(
      'TEST Voting Resumed Report for Center Springfield'
    );
    printedElement.getByText('Voting Resumed:');
    // Check contents
    printedElement.getByText(hasTextAcrossElements('Ballots Scanned Count2'));
    printedElement.getByText(hasTextAcrossElements('Polls StatusOpen'));
    printedElement.getByText(
      hasTextAcrossElements('Time Voting ResumedMon, Oct 31, 2022, 4:23 PM')
    );
  });
});

test('polls closed from paused', async () => {
  const electionDefinition = electionSample2Definition;
  apiMock.expectGetConfig({
    electionDefinition,
    pollsState: 'polls_paused',
  });
  apiMock.expectGetScannerStatus({ ...statusNoPaper, ballotsCounted: 2 });
  renderApp({
    connectPrinter: true,
    precinctReportDestination: 'laser-printer',
  });
  await screen.findByText('Polls Paused');

  // Close the polls
  apiMock.expectGetScannerResultsByParty(GENERAL_ELECTION_RESULTS);
  apiMock.expectExportCastVoteRecordsToUsbDrive();
  apiMock.authenticateAsPollWorker(electionDefinition);
  await screen.findByText('Do you want to resume voting?');
  userEvent.click(screen.getByText('No'));
  apiMock.expectSetPollsState('polls_closed_final');
  apiMock.expectGetConfig({
    electionDefinition,
    precinctSelection: singlePrecinctSelectionFor('23'),
    pollsState: 'polls_closed_final',
  });
  userEvent.click(await screen.findByText('Close Polls'));
  await screen.findByText('Polls are closed.');

  await expectPrint((printedElement) => {
    printedElement.getByText('TEST Polls Closed Report for All Precincts');
    printedElement.getByText('General Election:');
    within(printedElement.getByTestId('total-ballots')).getByText('100');
    expect(printedElement.getAllByTestId(/results-table-/)).toHaveLength(27);
    within(printedElement.getByTestId('president-jackie-chan')).getByText('70');
  });
});

test('must have printer attached to open polls (thermal printer)', async () => {
  const electionDefinition = electionSample2Definition;
  apiMock.expectGetConfig({
    electionDefinition,
    precinctSelection: singlePrecinctSelectionFor('23'),
    pollsState: 'polls_closed_initial',
  });
  apiMock.expectGetScannerStatus({ ...statusNoPaper, ballotsCounted: 2 });
  const { hardware } = renderApp({
    connectPrinter: false,
    precinctReportDestination: 'thermal-sheet-printer',
  });
  await screen.findByText('Polls Closed');

  // Opening the polls should require a printer
  apiMock.expectGetScannerResultsByParty(GENERAL_ELECTION_RESULTS);
  apiMock.authenticateAsPollWorker(electionDefinition);
  await screen.findByText('Do you want to open the polls?');
  const openButton = screen.getButton('Yes, Open the Polls');
  expect(openButton).toBeDisabled();
  screen.getByText('Attach printer to continue.');

  act(() => {
    hardware.setPrinterConnected(true);
  });

  await waitFor(() => expect(openButton).toBeEnabled());
  expect(
    screen.queryByText('Attach printer to continue.')
  ).not.toBeInTheDocument();
});

test('must have printer attached to close polls (thermal printer)', async () => {
  const electionDefinition = electionSample2Definition;
  apiMock.expectGetConfig({
    electionDefinition,
    precinctSelection: singlePrecinctSelectionFor('23'),
    pollsState: 'polls_open',
  });
  apiMock.expectGetScannerStatus({ ...statusNoPaper, ballotsCounted: 2 });
  const { hardware } = renderApp({
    connectPrinter: false,
    precinctReportDestination: 'thermal-sheet-printer',
  });
  await screen.findByText(/Insert Your Ballot/);

  // Opening the polls should require a printer
  apiMock.expectGetScannerResultsByParty(GENERAL_ELECTION_RESULTS);
  apiMock.authenticateAsPollWorker(electionDefinition);
  await screen.findByText('Do you want to close the polls?');
  const openButton = screen.getButton('Yes, Close the Polls');
  expect(openButton).toBeDisabled();
  screen.getByText('Attach printer to continue.');

  act(() => {
    hardware.setPrinterConnected(true);
  });

  await waitFor(() => expect(openButton).toBeEnabled());
  expect(
    screen.queryByText('Attach printer to continue.')
  ).not.toBeInTheDocument();
});
