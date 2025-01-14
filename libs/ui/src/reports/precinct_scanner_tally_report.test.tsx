import {
  electionMinimalExhaustiveSample,
  electionMinimalExhaustiveSampleDefinition,
  electionFamousNames2021Fixtures,
} from '@votingworks/fixtures';
import { PartyId } from '@votingworks/types';
import {
  ALL_PRECINCTS_SELECTION,
  buildElectionResultsFixture,
  singlePrecinctSelectionFor,
} from '@votingworks/utils';
import { render, screen, within } from '../../test/react_testing_library';

import { PrecinctScannerTallyReport } from './precinct_scanner_tally_report';

afterEach(() => {
  window.kiosk = undefined;
});

const {
  election: generalElection,
  electionDefinition: generalElectionDefinition,
} = electionFamousNames2021Fixtures;

const pollsTransitionedTime = new Date(2021, 8, 19, 11, 5).getTime();
const currentTime = new Date(2021, 8, 19, 11, 6).getTime();

const generalElectionResults = buildElectionResultsFixture({
  election: generalElectionDefinition.election,
  cardCounts: {
    bmd: 100,
    hmpb: [],
  },
  contestResultsSummaries: {
    'board-of-alderman': {
      type: 'candidate',
      undervotes: 120,
      overvotes: 0,
      ballots: 100,
      officialOptionTallies: {
        'helen-keller': 280,
      },
    },
  },
  includeGenericWriteIn: true,
});

test('renders as expected for a single precinct in a general election', () => {
  render(
    <PrecinctScannerTallyReport
      pollsTransitionedTime={pollsTransitionedTime}
      currentTime={currentTime}
      precinctScannerMachineId="SC-01-000"
      electionDefinition={generalElectionDefinition}
      precinctSelection={singlePrecinctSelectionFor(
        generalElection.precincts[0].id
      )}
      pollsTransition="open_polls"
      isLiveMode={false}
      scannedElectionResults={generalElectionResults}
      contests={generalElection.contests}
    />
  );
  expect(screen.queryByText('Party')).toBeNull();
  screen.getByText('TEST Polls Opened Report for North Lincoln');
  const electionTitle = screen.getByText('Lincoln Municipal General Election:');
  expect(electionTitle.parentElement).toHaveTextContent(
    'Lincoln Municipal General Election: Jun 6, 2021, Franklin County, State of Hamilton'
  );
  const eventDate = screen.getByText('Polls Opened:');
  expect(eventDate.parentNode).toHaveTextContent(
    'Polls Opened: Sep 19, 2021, 11:05 AM'
  );
  const printedAt = screen.getByText('Report Printed:');
  expect(printedAt.parentElement).toHaveTextContent(
    'Report Printed: Sep 19, 2021, 11:06 AM'
  );
  const scannerId = screen.getByText('Scanner ID:');
  expect(scannerId.parentElement).toHaveTextContent('Scanner ID: SC-01-000');

  within(screen.getByTestId('bmd')).getByText('100');
  const boardOfAlderman = screen.getByTestId('results-table-board-of-alderman');
  within(boardOfAlderman).getByText(/100 ballots cast/);
  within(boardOfAlderman).getByText(/0 overvotes/);
  within(boardOfAlderman).getByText(/120 undervotes/);
  within(screen.getByTestId('board-of-alderman-helen-keller')).getByText('280');
  within(screen.getByTestId('board-of-alderman-steve-jobs')).getByText('0');
  within(screen.getByTestId('board-of-alderman-nikola-tesla')).getByText('0');

  within(screen.getByTestId('results-table-mayor')).getByText(/0 ballots cast/);
  within(screen.getByTestId('results-table-controller')).getByText(
    /0 ballots cast/
  );
});

const primaryElectionResults = buildElectionResultsFixture({
  election: electionMinimalExhaustiveSample,
  cardCounts: {
    bmd: 100,
    hmpb: [],
  },
  contestResultsSummaries: {
    'best-animal-mammal': {
      type: 'candidate',
      undervotes: 20,
      overvotes: 0,
      ballots: 100,
      officialOptionTallies: {
        horse: 80,
      },
    },
  },
  includeGenericWriteIn: true,
});

test('renders as expected for all precincts in a primary election', () => {
  render(
    <PrecinctScannerTallyReport
      pollsTransitionedTime={pollsTransitionedTime}
      currentTime={currentTime}
      precinctScannerMachineId="SC-01-000"
      electionDefinition={electionMinimalExhaustiveSampleDefinition}
      precinctSelection={ALL_PRECINCTS_SELECTION}
      pollsTransition="open_polls"
      isLiveMode
      scannedElectionResults={primaryElectionResults}
      contests={electionMinimalExhaustiveSample.contests.filter(
        (c) => c.type === 'yesno' || c.partyId === '0'
      )}
      partyId={'0' as PartyId}
    />
  );
  screen.getByText('Official Polls Opened Report for All Precincts');
  const electionTitle = screen.getByText(
    'Mammal Party Example Primary Election:'
  );
  expect(electionTitle.parentElement).toHaveTextContent(
    'Mammal Party Example Primary Election: Sep 8, 2021, Sample County, State of Sample'
  );
  const eventDate = screen.getByText('Polls Opened:');
  expect(eventDate.parentNode).toHaveTextContent(
    'Polls Opened: Sep 19, 2021, 11:05 AM'
  );
  const printedAt = screen.getByText('Report Printed:');
  expect(printedAt.parentElement).toHaveTextContent(
    'Report Printed: Sep 19, 2021, 11:06 AM'
  );
  expect(screen.queryByTestId('results-table-best-animal-fish')).toBeNull();
  const scannerId = screen.getByText('Scanner ID:');
  expect(scannerId.parentElement).toHaveTextContent('Scanner ID: SC-01-000');

  within(screen.getByTestId('bmd')).getByText('100');
  expect(screen.queryByTestId('results-table-best-animal-fish')).toBeNull();
  const bestAnimal = screen.getByTestId('results-table-best-animal-mammal');
  within(bestAnimal).getByText(/100 ballots cast/);
  within(bestAnimal).getByText(/0 overvotes/);
  within(bestAnimal).getByText(/20 undervotes/);
  within(screen.getByTestId('best-animal-mammal-otter')).getByText('0');
  within(screen.getByTestId('best-animal-mammal-horse')).getByText('80');
  within(screen.getByTestId('best-animal-mammal-fox')).getByText('0');
  expect(within(bestAnimal).queryByText('Write-In')).toBeNull();
});

test('displays only passed contests', () => {
  render(
    <PrecinctScannerTallyReport
      pollsTransitionedTime={pollsTransitionedTime}
      currentTime={currentTime}
      precinctScannerMachineId="SC-01-000"
      electionDefinition={electionMinimalExhaustiveSampleDefinition}
      precinctSelection={ALL_PRECINCTS_SELECTION}
      pollsTransition="open_polls"
      isLiveMode
      scannedElectionResults={primaryElectionResults}
      contests={electionMinimalExhaustiveSample.contests.filter(
        (c) => c.id === 'best-animal-mammal'
      )}
      partyId={'0' as PartyId}
    />
  );

  screen.getByTestId('results-table-best-animal-mammal');
  expect(screen.getAllByTestId(/results-table-/)).toHaveLength(1);
});
