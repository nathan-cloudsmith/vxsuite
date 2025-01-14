import {
  MemoryStorage,
  MemoryHardware,
  singlePrecinctSelectionFor,
} from '@votingworks/utils';
import { Route } from 'react-router-dom';
import {
  getBallotStyle,
  getContestDistrictName,
  getContests,
  vote,
} from '@votingworks/types';
import { expectPrintToPdf, PrintRenderResult } from '@votingworks/test-utils';

import { electionWithMsEitherNeitherDefinition } from '@votingworks/fixtures';
import { assert, assertDefined, find } from '@votingworks/basics';
import userEvent from '@testing-library/user-event';
import { PrintPage } from './pages/print_page';
import {
  fireEvent,
  render,
  screen,
  within,
} from '../test/react_testing_library';
import { App } from './app';

import { render as renderWithBallotContext } from '../test/test_utils';
import { withMarkup } from '../test/helpers/with_markup';
import { advanceTimersAndPromises } from '../test/helpers/timers';

import {
  setElectionInStorage,
  setStateInStorage,
} from '../test/helpers/election';
import { ApiMock, createApiMock } from '../test/helpers/mock_api_client';

let apiMock: ApiMock;
const electionDefinition = electionWithMsEitherNeitherDefinition;
const { election } = electionDefinition;

beforeEach(() => {
  jest.useFakeTimers();
  window.location.href = '/';
  apiMock = createApiMock();
});

afterEach(() => {
  apiMock.mockApiClient.assertComplete();
});

const eitherNeitherContestId = '750000015';
const pickOneContestId = '750000016';
const eitherNeitherContest = find(
  election.contests,
  (c) => c.id === eitherNeitherContestId
);
const pickOneContest = find(
  election.contests,
  (c) => c.id === pickOneContestId
);
assert(eitherNeitherContest.type === 'yesno');
assert(pickOneContest.type === 'yesno');

const ballotStyleId = '1';
const precinctId = '6526';

function expectPrintedVotes(
  printedElement: PrintRenderResult,
  expectedVotes: {
    eitherNeither: string;
    pickOne: string;
  }
) {
  const getByTextWithMarkup = withMarkup(printedElement.getAllByText);
  // Because eitherNeitherContest and pickOneContest have the same title in the
  // fixture we're using, we have to use their index to get the correct one.
  const eitherNeitherContestReviewTitle = getByTextWithMarkup(
    eitherNeitherContest.title
  )[0];
  expect(
    eitherNeitherContestReviewTitle?.nextSibling?.textContent?.trim()
  ).toEqual(expectedVotes.eitherNeither);
  const pickOneContestReviewTitle = getByTextWithMarkup(
    pickOneContest.title
  )[1];
  expect(pickOneContestReviewTitle?.nextSibling?.textContent?.trim()).toEqual(
    expectedVotes.pickOne
  );
}

test('Renders Ballot with EitherNeither: blank', async () => {
  apiMock.expectPrintBallot();
  renderWithBallotContext(<Route path="/print" component={PrintPage} />, {
    apiMock,
    ballotStyleId,
    precinctId,
    route: '/print',
    electionDefinition,
    votes: vote(
      getContests({
        ballotStyle: getBallotStyle({
          election,
          ballotStyleId,
        })!,
        election,
      }),
      {
        [eitherNeitherContestId]: [],
        [pickOneContestId]: [],
      }
    ),
  });

  await expectPrintToPdf((printedElement) => {
    expectPrintedVotes(printedElement, {
      eitherNeither: '[no selection]',
      pickOne: '[no selection]',
    });
  });
});

test('Renders Ballot with EitherNeither: Either & blank', async () => {
  apiMock.expectPrintBallot();
  renderWithBallotContext(<Route path="/print" component={PrintPage} />, {
    apiMock,
    ballotStyleId,
    precinctId,
    route: '/print',
    electionDefinition,
    votes: vote(
      getContests({
        ballotStyle: getBallotStyle({
          election,
          ballotStyleId,
        })!,
        election,
      }),
      {
        [eitherNeitherContestId]: ['yes'],
        [pickOneContestId]: [],
      }
    ),
  });
  await expectPrintToPdf((printedElement) => {
    expectPrintedVotes(printedElement, {
      eitherNeither: assertDefined(eitherNeitherContest.yesOption).label,
      pickOne: '[no selection]',
    });
  });
});

test('Renders Ballot with EitherNeither: Neither & firstOption', async () => {
  apiMock.expectPrintBallot();
  renderWithBallotContext(<Route path="/print" component={PrintPage} />, {
    apiMock,
    ballotStyleId,
    precinctId,
    route: '/print',
    electionDefinition,
    votes: vote(
      getContests({
        ballotStyle: getBallotStyle({
          election,
          ballotStyleId,
        })!,
        election,
      }),
      {
        [eitherNeitherContestId]: ['no'],
        [pickOneContestId]: ['yes'],
      }
    ),
  });
  await expectPrintToPdf((printedElement) => {
    expectPrintedVotes(printedElement, {
      eitherNeither: assertDefined(eitherNeitherContest.noOption).label,
      pickOne: assertDefined(pickOneContest.yesOption).label,
    });
  });
});

test('Renders Ballot with EitherNeither: blank & secondOption', async () => {
  apiMock.expectPrintBallot();
  renderWithBallotContext(<Route path="/print" component={PrintPage} />, {
    apiMock,
    ballotStyleId,
    precinctId,
    route: '/print',
    electionDefinition,
    votes: vote(
      getContests({
        ballotStyle: getBallotStyle({
          election,
          ballotStyleId,
        })!,
        election,
      }),
      {
        [eitherNeitherContestId]: [],
        [pickOneContestId]: ['no'],
      }
    ),
  });
  await expectPrintToPdf((printedElement) => {
    expectPrintedVotes(printedElement, {
      eitherNeither: '[no selection]',
      pickOne: assertDefined(pickOneContest.noOption).label,
    });
  });
});

test('Can vote on a Mississippi Either Neither Contest', async () => {
  // ====================== BEGIN CONTEST SETUP ====================== //
  const hardware = MemoryHardware.buildStandard();
  const storage = new MemoryStorage();
  apiMock.expectGetMachineConfig();
  apiMock.expectGetSystemSettings();
  apiMock.expectGetElectionDefinition(null);
  apiMock.expectGetPrecinctSelection(singlePrecinctSelectionFor(precinctId));

  await setElectionInStorage(storage, electionDefinition);
  await setStateInStorage(storage);

  render(
    <App
      hardware={hardware}
      storage={storage}
      apiClient={apiMock.mockApiClient}
      reload={jest.fn()}
    />
  );

  // Start voter session
  apiMock.setAuthStatusCardlessVoterLoggedIn({
    ballotStyleId: '2',
    precinctId,
  });
  await advanceTimersAndPromises();

  // Go to First Contest
  userEvent.click(await screen.findByText('Start Voting'));
  await advanceTimersAndPromises();

  // ====================== END CONTEST SETUP ====================== //

  const getByTextWithMarkup = withMarkup(screen.getByText);

  // Advance to multi-seat contest
  while (!screen.queryByText(eitherNeitherContest.title)) {
    fireEvent.click(screen.getByText('Next'));
    await advanceTimersAndPromises();
  }

  // Select and Unselect Options
  fireEvent.click(
    screen.getByText(assertDefined(eitherNeitherContest.yesOption).label)
  );
  fireEvent.click(
    screen.getByText(assertDefined(eitherNeitherContest.noOption).label)
  );
  await advanceTimersAndPromises(); // allow "deselection" timer to run
  fireEvent.click(
    screen.getByText(assertDefined(eitherNeitherContest.noOption).label)
  );
  await advanceTimersAndPromises(); // allow "deselection" timer to run

  fireEvent.click(
    screen.getByText(assertDefined(pickOneContest.yesOption).label)
  );
  fireEvent.click(
    screen.getByText(assertDefined(pickOneContest.noOption).label)
  );
  await advanceTimersAndPromises(); // allow "deselection" timer to run
  fireEvent.click(
    screen.getByText(assertDefined(pickOneContest.noOption).label)
  );
  await advanceTimersAndPromises(); // allow "deselection" timer to run

  // Go to Review Screen
  while (!screen.queryByText('Review Your Votes')) {
    fireEvent.click(screen.getByText('Next'));
    await advanceTimersAndPromises();
  }

  // Confirm there is no vote
  const districtName = getContestDistrictName(election, eitherNeitherContest);
  let contestReviewTitle = getByTextWithMarkup(
    `${districtName}${eitherNeitherContest.title}`
  );
  expect(contestReviewTitle?.nextSibling?.textContent?.trim()).toEqual(
    'You may still vote in this contest.'
  );

  // Go to Contest Screen
  fireEvent.click(contestReviewTitle);
  await advanceTimersAndPromises();

  // Go to Review Screen with no votes
  fireEvent.click(screen.getByText('Review'));
  await advanceTimersAndPromises();
  contestReviewTitle = getByTextWithMarkup(
    `${districtName}${eitherNeitherContest.title}`
  );
  const reviewVote = contestReviewTitle.nextSibling;
  expect(reviewVote?.textContent?.trim()).toEqual(
    'You may still vote in this contest.'
  );

  // Go to Contest Screen
  fireEvent.click(contestReviewTitle);
  await advanceTimersAndPromises();

  // Vote for either and first option
  fireEvent.click(
    screen.getByText(assertDefined(eitherNeitherContest.yesOption).label)
  );
  fireEvent.click(
    screen.getByText(assertDefined(pickOneContest.yesOption).label)
  );

  // Go to Review Screen to confirm votes
  fireEvent.click(screen.getByText('Review'));
  await advanceTimersAndPromises();
  contestReviewTitle = getByTextWithMarkup(
    `${districtName}${eitherNeitherContest.title}`
  );
  assert(contestReviewTitle.parentElement);
  const eitherAndFirstVotes = within(
    contestReviewTitle.parentElement
  ).getAllByRole('listitem');
  expect(eitherAndFirstVotes[0]).toHaveTextContent(
    'FOR APPROVAL OF EITHER Initiative No. 65 OR Alternative Measure No. 65 A'
  );
  expect(eitherAndFirstVotes[1]).toHaveTextContent(
    'FOR Initiative Measure No. 65'
  );

  // Go to Contest Screen
  fireEvent.click(contestReviewTitle);
  await advanceTimersAndPromises();

  // Vote for neither and second option
  fireEvent.click(
    screen.getByText(assertDefined(eitherNeitherContest.noOption).label)
  );
  fireEvent.click(
    screen.getByText(assertDefined(pickOneContest.noOption).label)
  );

  // Go to Review Screen to confirm votes
  fireEvent.click(screen.getByText('Review'));
  await advanceTimersAndPromises();
  contestReviewTitle = getByTextWithMarkup(
    `${districtName}${eitherNeitherContest.title}`
  );
  assert(contestReviewTitle.parentElement);
  const neitherAndSecondVotes = within(
    contestReviewTitle.parentElement
  ).getAllByRole('listitem');
  expect(neitherAndSecondVotes[0]).toHaveTextContent(
    'AGAINST BOTH Initiative Measure No. 65 AND Alternative Measure No. 65 A'
  );
  expect(neitherAndSecondVotes[1]).toHaveTextContent(
    'FOR Alternative Measure 65 A'
  );

  // Go to Contest Screen
  fireEvent.click(contestReviewTitle);
  await advanceTimersAndPromises();

  // Vote for none and second option
  fireEvent.click(
    screen.getByText(assertDefined(eitherNeitherContest.noOption).label)
  );

  // Go to Review Screen to confirm votes
  fireEvent.click(screen.getByText('Review'));
  await advanceTimersAndPromises();
  contestReviewTitle = getByTextWithMarkup(
    `${districtName}${eitherNeitherContest.title}`
  );
  assert(contestReviewTitle.parentElement);
  within(contestReviewTitle.parentElement).getByText(
    'You may still vote in this contest.'
  );
  const noneAndSecondVote = within(contestReviewTitle.parentElement).getByRole(
    'listitem'
  );
  expect(noneAndSecondVote).toHaveTextContent('FOR Alternative Measure 65 A');

  // Go to Contest Screen
  fireEvent.click(contestReviewTitle);
  await advanceTimersAndPromises();

  // Vote for either and no option
  fireEvent.click(
    screen.getByText(assertDefined(eitherNeitherContest.yesOption).label)
  );
  fireEvent.click(
    screen.getByText(assertDefined(pickOneContest.noOption).label)
  );

  // Go to Review Screen to confirm votes
  fireEvent.click(screen.getByText('Review'));
  await advanceTimersAndPromises();
  contestReviewTitle = getByTextWithMarkup(
    `${districtName}${eitherNeitherContest.title}`
  );
  assert(contestReviewTitle.parentElement);
  const eitherAndNoneVote = within(contestReviewTitle.parentElement).getByRole(
    'listitem'
  );
  expect(eitherAndNoneVote).toHaveTextContent(
    'FOR APPROVAL OF EITHER Initiative No. 65 OR Alternative Measure No. 65 A'
  );
  within(contestReviewTitle.parentElement).getByText(
    'You may still vote in this contest.'
  );
});
