import fetchMock from 'fetch-mock';
import { act } from 'react-dom/test-utils';
import { electionSampleDefinition } from '@votingworks/fixtures';
import {
  fakeElectionManagerUser,
  fakeKiosk,
  fakeSessionExpiresAt,
  fakeSystemAdministratorUser,
  fakeUsbDrive,
  hasTextAcrossElements,
  suppressingConsoleOutput,
} from '@votingworks/test-utils';
import { MemoryHardware } from '@votingworks/utils';
import { typedAs, sleep, ok } from '@votingworks/basics';
import { Scan } from '@votingworks/api';
import {
  DEFAULT_SYSTEM_SETTINGS,
  ElectionDefinition,
} from '@votingworks/types';
import userEvent from '@testing-library/user-event';
import {
  render,
  waitFor,
  within,
  fireEvent,
  screen,
} from '../test/react_testing_library';
import { App } from './app';
import { MachineConfigResponse } from './config/types';
import { createMockApiClient, MockApiClient, setAuthStatus } from '../test/api';

let mockApiClient: MockApiClient;

beforeEach(() => {
  jest.restoreAllMocks();

  window.kiosk = undefined;

  mockApiClient = createMockApiClient();
  setAuthStatus(mockApiClient, {
    status: 'logged_out',
    reason: 'machine_locked',
  });
  mockApiClient.getSystemSettings
    .expectCallWith()
    .resolves(DEFAULT_SYSTEM_SETTINGS);

  fetchMock.config.fallbackToNetwork = true;
  fetchMock.get(
    '/central-scanner/scan/status',
    typedAs<Scan.GetScanStatusResponse>({
      canUnconfigure: true,
      batches: [],
      adjudication: { adjudicated: 0, remaining: 0 },
    }),
    { overwriteRoutes: true }
  );
  fetchMock.get(
    '/machine-config',
    typedAs<MachineConfigResponse>({
      machineId: '0001',
      codeVersion: 'TEST',
    })
  );

  const oldWindowLocation = window.location;
  Object.defineProperty(window, 'location', {
    value: {
      ...oldWindowLocation,
      href: '/',
    },
    configurable: true,
  });
});

afterEach(() => {
  mockApiClient.assertComplete();
  expect(fetchMock.done()).toEqual(true);
  expect(fetchMock.calls('unmatched')).toEqual([]);
});

function expectConfigureFromBallotPackageOnUsbDrive() {
  mockApiClient.configureFromBallotPackageOnUsbDrive
    .expectCallWith()
    .resolves(ok(electionSampleDefinition));
  mockApiClient.getSystemSettings
    .expectCallWith()
    .resolves(DEFAULT_SYSTEM_SETTINGS);
  mockApiClient.getElectionDefinition
    .expectCallWith()
    .resolves(electionSampleDefinition);
}

export async function authenticateAsSystemAdministrator(
  lockScreenText = 'VxCentralScan is Locked'
): Promise<void> {
  // First verify that we're logged out
  await screen.findByText(lockScreenText);

  setAuthStatus(mockApiClient, {
    status: 'logged_in',
    user: fakeSystemAdministratorUser(),
    sessionExpiresAt: fakeSessionExpiresAt(),
    programmableCard: { status: 'no_card' },
  });
  await screen.findByText('Lock Machine');
}

export async function authenticateAsElectionManager(
  electionDefinition: ElectionDefinition,
  lockScreenText = 'VxCentralScan is Locked',
  postAuthText = 'Lock Machine'
): Promise<void> {
  // First verify that we're logged out
  await screen.findByText(lockScreenText);

  setAuthStatus(mockApiClient, {
    status: 'logged_in',
    user: fakeElectionManagerUser({
      electionHash: electionDefinition.electionHash,
    }),
    sessionExpiresAt: fakeSessionExpiresAt(),
  });
  await screen.findByText(postAuthText);
}

test('renders without crashing', async () => {
  mockApiClient.getTestMode.expectCallWith().resolves(true);
  mockApiClient.getElectionDefinition
    .expectCallWith()
    .resolves(electionSampleDefinition);

  const hardware = MemoryHardware.buildStandard();
  render(<App apiClient={mockApiClient} hardware={hardware} />);
  await waitFor(() => fetchMock.called());
});

test('shows a "test ballot mode" button if the app is in Official Ballot Mode', async () => {
  mockApiClient.getTestMode.expectCallWith().resolves(false);
  mockApiClient.getElectionDefinition
    .expectCallWith()
    .resolves(electionSampleDefinition);

  const hardware = MemoryHardware.buildStandard();
  render(<App apiClient={mockApiClient} hardware={hardware} />);
  await authenticateAsElectionManager(electionSampleDefinition);

  mockApiClient.getMarkThresholdOverrides.expectCallWith().resolves(null);
  userEvent.click(screen.getByText('Admin'));

  screen.getByText('Toggle to Test Ballot Mode');

  await waitFor(() => {
    mockApiClient.assertComplete();
  });
});

test('shows an "official ballot mode" button if the app is in Test Mode', async () => {
  mockApiClient.getTestMode.expectCallWith().resolves(true);
  mockApiClient.getElectionDefinition
    .expectCallWith()
    .resolves(electionSampleDefinition);

  const hardware = MemoryHardware.buildStandard();
  render(<App apiClient={mockApiClient} hardware={hardware} />);
  await authenticateAsElectionManager(electionSampleDefinition);

  mockApiClient.getMarkThresholdOverrides.expectCallWith().resolves(null);
  userEvent.click(screen.getByText('Admin'));

  screen.getByText('Toggle to Official Ballot Mode');

  await waitFor(() => {
    mockApiClient.assertComplete();
  });
});

test('clicking Scan Batch will scan a batch', async () => {
  mockApiClient.getTestMode.expectCallWith().resolves(true);
  mockApiClient.getElectionDefinition
    .expectCallWith()
    .resolves(electionSampleDefinition);

  const scanBatchResponseBody: Scan.ScanBatchResponse = {
    status: 'error',
    errors: [{ type: 'scan-error', message: 'interpreter not ready' }],
  };
  fetchMock.postOnce('/central-scanner/scan/scanBatch', {
    body: scanBatchResponseBody,
  });

  const mockAlert = jest.fn();
  window.alert = mockAlert;
  const hardware = MemoryHardware.buildStandard();

  await act(async () => {
    const { getByText } = render(
      <App apiClient={mockApiClient} hardware={hardware} />
    );
    await authenticateAsElectionManager(electionSampleDefinition);
    fireEvent.click(getByText('Scan New Batch'));
  });

  expect(mockAlert).toHaveBeenCalled();
  mockAlert.mockClear();

  fetchMock.postOnce(
    '/central-scanner/scan/scanBatch',
    { body: { status: 'ok', batchId: 'foobar' } },
    { overwriteRoutes: true }
  );

  expect(mockAlert).not.toHaveBeenCalled();
});

test('clicking "Save CVRs" shows modal and makes a request to export', async () => {
  const mockKiosk = fakeKiosk();
  window.kiosk = mockKiosk;

  mockApiClient.getTestMode.expectCallWith().resolves(true);
  mockApiClient.getElectionDefinition
    .expectCallWith()
    .resolves(electionSampleDefinition);
  const scanStatusResponseBody: Scan.GetScanStatusResponse = {
    canUnconfigure: false,
    batches: [
      {
        id: 'test-batch',
        batchNumber: 1,
        label: 'Batch 1',
        count: 2,
        startedAt: '2021-05-13T13:19:42.353Z',
      },
    ],
    adjudication: { adjudicated: 0, remaining: 0 },
  };
  fetchMock
    .getOnce(
      '/central-scanner/scan/status',
      { body: scanStatusResponseBody },
      { overwriteRoutes: true }
    )
    .postOnce('/central-scanner/scan/export-to-usb-drive', {
      body: { status: 'ok' },
    });

  const hardware = MemoryHardware.buildStandard();

  render(<App apiClient={mockApiClient} hardware={hardware} />);
  await authenticateAsElectionManager(electionSampleDefinition);
  mockKiosk.getUsbDriveInfo.mockResolvedValue([fakeUsbDrive()]);

  userEvent.click(await screen.findByText('Save CVRs'));
  const modal = await screen.findByRole('alertdialog');
  userEvent.click(await within(modal).findByText('Save'));
  await within(modal).findByText('CVRs Saved');
  userEvent.click(within(modal).getByText('Cancel'));

  expect(screen.queryByRole('alertdialog')).toEqual(null);
});

test('configuring election from usb ballot package works end to end', async () => {
  mockApiClient.getTestMode.expectCallWith().resolves(true);
  mockApiClient.getElectionDefinition.expectCallWith().resolves(null);

  const mockKiosk = fakeKiosk();
  window.kiosk = mockKiosk;

  const hardware = MemoryHardware.buildStandard();
  const { getByText } = render(
    <App apiClient={mockApiClient} hardware={hardware} />
  );
  await authenticateAsElectionManager(
    electionSampleDefinition,
    'VxCentralScan is Not Configured',
    'VxCentralScan is Not Configured'
  );

  // Insert USB drive
  mockKiosk.getUsbDriveInfo.mockResolvedValue([fakeUsbDrive()]);
  expectConfigureFromBallotPackageOnUsbDrive();

  await screen.findByText('No ballots have been scanned.');

  getByText('General Election');
  getByText(/Franklin County,/);
  getByText(/State of Hamilton/);
  screen.getByText(hasTextAcrossElements('Machine ID0001'));

  // Remove USB drive
  mockKiosk.getUsbDriveInfo.mockResolvedValue([]);

  mockApiClient.getMarkThresholdOverrides.expectCallWith().resolves(null);
  fireEvent.click(getByText('Admin'));
  getByText('Admin Actions');
  expect(
    screen.getButton('Delete Election Data from VxCentralScan')
  ).toBeEnabled();
  fireEvent.click(getByText('Delete Election Data from VxCentralScan'));
  await screen.findByText('Delete all election data?');
  fireEvent.click(getByText('Yes, Delete Election Data'));
  getByText('Are you sure?');

  mockApiClient.unconfigure
    .expectCallWith({ ignoreBackupRequirement: false })
    .resolves();
  mockApiClient.getElectionDefinition.expectCallWith().resolves(null);
  mockApiClient.getSystemSettings
    .expectCallWith()
    .resolves(DEFAULT_SYSTEM_SETTINGS);
  mockApiClient.getTestMode.expectCallWith().resolves(true);
  fireEvent.click(getByText('I am sure. Delete all election data.'));
  getByText('Deleting election data');
  await act(async () => {
    await sleep(1000);
    getByText('Insert a USB drive containing a ballot package.');
  });
});

test('authentication works', async () => {
  const hardware = MemoryHardware.buildStandard();
  hardware.setBatchScannerConnected(false);

  mockApiClient.getTestMode.expectCallWith().resolves(true);
  mockApiClient.getElectionDefinition
    .expectCallWith()
    .resolves(electionSampleDefinition);

  render(<App apiClient={mockApiClient} hardware={hardware} />);

  await screen.findByText('VxCentralScan is Locked');

  // Disconnect card reader
  act(() => {
    hardware.setCardReaderConnected(false);
  });
  await screen.findByText('Card Reader Not Detected');
  act(() => {
    hardware.setCardReaderConnected(true);
  });
  await screen.findByText('VxCentralScan is Locked');

  // Insert an election manager card and enter the wrong PIN.
  setAuthStatus(mockApiClient, {
    status: 'checking_pin',
    user: fakeElectionManagerUser(electionSampleDefinition),
  });
  await screen.findByText('Enter the card PIN to unlock.');
  mockApiClient.checkPin.expectCallWith({ pin: '111111' }).resolves();
  fireEvent.click(screen.getByText('1'));
  fireEvent.click(screen.getByText('1'));
  fireEvent.click(screen.getByText('1'));
  fireEvent.click(screen.getByText('1'));
  fireEvent.click(screen.getByText('1'));
  fireEvent.click(screen.getByText('1'));
  setAuthStatus(mockApiClient, {
    status: 'checking_pin',
    user: fakeElectionManagerUser(electionSampleDefinition),
    wrongPinEnteredAt: new Date(),
  });
  await screen.findByText('Incorrect PIN. Please try again.');

  // Remove card and insert an invalid card, e.g. a pollworker card.
  setAuthStatus(mockApiClient, {
    status: 'logged_out',
    reason: 'machine_locked',
  });
  await screen.findByText('VxCentralScan is Locked');
  setAuthStatus(mockApiClient, {
    status: 'logged_out',
    reason: 'user_role_not_allowed',
  });
  await screen.findByText('Invalid Card');
  setAuthStatus(mockApiClient, {
    status: 'logged_out',
    reason: 'machine_locked',
  });

  // Insert election manager card and enter correct PIN.
  setAuthStatus(mockApiClient, {
    status: 'checking_pin',
    user: fakeElectionManagerUser(electionSampleDefinition),
  });
  await screen.findByText('Enter the card PIN to unlock.');
  mockApiClient.checkPin.expectCallWith({ pin: '123456' }).resolves();
  fireEvent.click(screen.getByText('1'));
  fireEvent.click(screen.getByText('2'));
  fireEvent.click(screen.getByText('3'));
  fireEvent.click(screen.getByText('4'));
  fireEvent.click(screen.getByText('5'));
  fireEvent.click(screen.getByText('6'));

  // 'Remove Card' screen is shown after successful authentication.
  setAuthStatus(mockApiClient, {
    status: 'remove_card',
    user: fakeElectionManagerUser(electionSampleDefinition),
    sessionExpiresAt: fakeSessionExpiresAt(),
  });
  await screen.findByText('Remove card to continue.');
  screen.getByText('VxCentralScan Unlocked');

  // Machine is unlocked when card removed
  setAuthStatus(mockApiClient, {
    status: 'logged_in',
    user: fakeElectionManagerUser(electionSampleDefinition),
    sessionExpiresAt: fakeSessionExpiresAt(),
  });
  await screen.findByText('No Scanner');

  // Lock the machine
  mockApiClient.logOut.expectCallWith().resolves();
  fireEvent.click(screen.getByText('Lock Machine'));
  setAuthStatus(mockApiClient, {
    status: 'logged_out',
    reason: 'machine_locked',
  });
  await screen.findByText('VxCentralScan is Locked');
});

test('system administrator can log in and unconfigure machine', async () => {
  mockApiClient.getTestMode.expectCallWith().resolves(true);
  mockApiClient.getElectionDefinition
    .expectCallWith()
    .resolves(electionSampleDefinition);

  const hardware = MemoryHardware.buildStandard();
  render(<App apiClient={mockApiClient} hardware={hardware} />);

  await authenticateAsSystemAdministrator();

  screen.getButton('Reboot from USB');
  screen.getButton('Reboot to BIOS');
  const unconfigureMachineButton = screen.getButton('Unconfigure Machine');

  userEvent.click(unconfigureMachineButton);
  const modal = await screen.findByRole('alertdialog');

  mockApiClient.unconfigure
    .expectCallWith({ ignoreBackupRequirement: true })
    .resolves();
  mockApiClient.getElectionDefinition.expectCallWith().resolves(null);
  mockApiClient.getSystemSettings
    .expectCallWith()
    .resolves(DEFAULT_SYSTEM_SETTINGS);
  mockApiClient.getTestMode.expectCallWith().resolves(true);
  userEvent.click(within(modal).getButton('Yes, Delete Election Data'));
  await waitFor(() => expect(screen.queryByRole('alertdialog')).toBeNull());
});

test('election manager cannot auth onto machine with different election hash', async () => {
  mockApiClient.getTestMode.expectCallWith().resolves(true);
  mockApiClient.getElectionDefinition
    .expectCallWith()
    .resolves(electionSampleDefinition);

  const hardware = MemoryHardware.buildStandard();
  render(<App apiClient={mockApiClient} hardware={hardware} />);

  await screen.findByText('VxCentralScan is Locked');
  setAuthStatus(mockApiClient, {
    status: 'logged_out',
    reason: 'election_manager_wrong_election',
  });
  await screen.findByText(
    'The inserted Election Manager card is programmed for another election and cannot be used to unlock this machine. ' +
      'Please insert a valid Election Manager or System Administrator card.'
  );
});

test('error boundary', async () => {
  mockApiClient.getTestMode.expectCallWith().resolves(true);
  mockApiClient.getElectionDefinition
    .expectCallWith()
    .resolves(electionSampleDefinition);

  const hardware = MemoryHardware.buildStandard();
  await suppressingConsoleOutput(async () => {
    render(<App apiClient={mockApiClient} hardware={hardware} />);

    await authenticateAsElectionManager(electionSampleDefinition);

    mockApiClient.logOut.expectCallWith().throws(new Error('Whoa!'));
    userEvent.click(screen.getByText('Lock Machine'));
    await screen.findByText('Something went wrong');
  });
});
