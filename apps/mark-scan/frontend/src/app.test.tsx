import {
  fakeKiosk,
  mockOf,
  suppressingConsoleOutput,
} from '@votingworks/test-utils';
import { MemoryHardware, MemoryStorage } from '@votingworks/utils';

import fetchMock from 'fetch-mock';
import { electionSampleDefinition } from '@votingworks/fixtures';
import { useDisplaySettingsManager } from '@votingworks/mark-flow-ui';
import userEvent from '@testing-library/user-event';
import { fireEvent, screen, waitFor } from '../test/react_testing_library';
import {
  setElectionInStorage,
  setStateInStorage,
} from '../test/helpers/election';
import { fakeTts } from '../test/helpers/fake_tts';
import { advanceTimersAndPromises } from '../test/helpers/timers';
import { render } from '../test/test_utils';
import { App } from './app';
import { AriaScreenReader } from './utils/ScreenReader';
import { ApiMock, createApiMock } from '../test/helpers/mock_api_client';
import { buildApp } from '../test/helpers/build_app';

jest.mock(
  '@votingworks/mark-flow-ui',
  (): typeof import('@votingworks/mark-flow-ui') => ({
    ...jest.requireActual('@votingworks/mark-flow-ui'),
    useDisplaySettingsManager: jest.fn(),
  })
);

let apiMock: ApiMock;

beforeEach(() => {
  jest.useFakeTimers();
  apiMock = createApiMock();
});

afterEach(() => {
  apiMock.mockApiClient.assertComplete();
  mockOf(useDisplaySettingsManager).mockReset();
});

it('will throw an error when using default api', async () => {
  fetchMock.get('/api', {
    body: {
      machineId: '0002',
      codeVersion: '3.14',
    },
  });
  const hardware = MemoryHardware.buildStandard();

  await suppressingConsoleOutput(async () => {
    render(<App hardware={hardware} />);
    await screen.findByText('Something went wrong');
  });
});

it('Displays error boundary if the api returns an unexpected error', async () => {
  apiMock.expectGetSystemSettings();
  apiMock.expectGetElectionDefinition(null);
  apiMock.expectGetMachineConfigToError();
  apiMock.expectGetPrecinctSelection();
  const storage = new MemoryStorage();
  const hardware = MemoryHardware.buildStandard();
  await suppressingConsoleOutput(async () => {
    render(
      <App
        hardware={hardware}
        storage={storage}
        apiClient={apiMock.mockApiClient}
        reload={jest.fn()}
      />
    );
    await advanceTimersAndPromises();
    screen.getByText('Something went wrong');
  });
});

it('prevents context menus from appearing', async () => {
  apiMock.expectGetMachineConfig();
  apiMock.expectGetSystemSettings();
  apiMock.expectGetElectionDefinition(null);
  apiMock.expectGetPrecinctSelection();
  render(<App apiClient={apiMock.mockApiClient} reload={jest.fn()} />);

  const { oncontextmenu } = window;

  if (oncontextmenu) {
    const event = new MouseEvent('contextmenu');

    jest.spyOn(event, 'preventDefault');
    oncontextmenu.call(window, event);

    expect(event.preventDefault).toHaveBeenCalledTimes(1);
  }

  await advanceTimersAndPromises();
});

it('uses kiosk storage when in kiosk-browser', async () => {
  const kiosk = fakeKiosk();
  apiMock.expectGetMachineConfig();
  apiMock.expectGetSystemSettings();
  apiMock.expectGetElectionDefinition(null);
  apiMock.expectGetPrecinctSelection();
  window.kiosk = kiosk;
  render(<App apiClient={apiMock.mockApiClient} reload={jest.fn()} />);
  await advanceTimersAndPromises();
  expect(kiosk.storage.get).toHaveBeenCalled();
  delete window.kiosk;
});

it('changes screen reader settings based on keyboard inputs', async () => {
  const mockTts = fakeTts();
  apiMock.expectGetMachineConfig();
  apiMock.expectGetSystemSettings();
  apiMock.expectGetElectionDefinition(null);
  apiMock.expectGetPrecinctSelection();
  const screenReader = new AriaScreenReader(mockTts);
  jest.spyOn(screenReader, 'toggle');
  jest.spyOn(screenReader, 'changeVolume');

  render(<App screenReader={screenReader} apiClient={apiMock.mockApiClient} />);

  await advanceTimersAndPromises();

  // check that 'r' toggles the screen reader
  expect(screenReader.toggle).toHaveBeenCalledTimes(0);
  fireEvent.keyDown(screen.getByRole('main'), { key: 'r' });
  await waitFor(() => {
    expect(screenReader.toggle).toHaveBeenCalledTimes(1);
  });

  // check that 'F17' changes volume
  expect(screenReader.changeVolume).toHaveBeenCalledTimes(0);
  fireEvent.keyDown(screen.getByRole('main'), { key: 'F17' });
  await waitFor(() => {
    expect(screenReader.changeVolume).toHaveBeenCalledTimes(1);
  });
});

it('uses display settings management hook', async () => {
  apiMock.expectGetMachineConfig();
  apiMock.expectGetSystemSettings();
  apiMock.expectGetElectionDefinition(null);
  apiMock.expectGetPrecinctSelection();

  const { storage, renderApp } = buildApp(apiMock);
  await setElectionInStorage(storage);
  await setStateInStorage(storage);
  renderApp();

  await advanceTimersAndPromises();

  expect(mockOf(useDisplaySettingsManager)).toBeCalled();
});

// This test is only really here to provide coverage for the default value for
// `App`'s `reload` prop.
it('uses window.location.reload by default', async () => {
  // Stub location in a way that's good enough for this test, but not good
  // enough for general `window.location` use.
  const reload = jest.fn();
  apiMock.expectGetMachineConfig();
  apiMock.expectGetSystemSettings();
  apiMock.expectGetElectionDefinition(null);
  jest.spyOn(window, 'location', 'get').mockReturnValue({
    ...window.location,
    reload,
  });

  // Set up in an already-configured state.
  const electionDefinition = electionSampleDefinition;
  const hardware = MemoryHardware.buildStandard();
  const storage = new MemoryStorage();
  apiMock.expectGetPrecinctSelectionResolvesDefault(
    electionDefinition.election
  );

  await setElectionInStorage(storage, electionDefinition);
  await setStateInStorage(storage, {
    pollsState: 'polls_closed_initial',
  });

  render(
    <App
      hardware={hardware}
      apiClient={apiMock.mockApiClient}
      storage={storage}
    />
  );

  await advanceTimersAndPromises();

  // Force refresh
  apiMock.setAuthStatusPollWorkerLoggedIn(electionDefinition);
  await advanceTimersAndPromises();
  userEvent.click(await screen.findByText('Reset Accessible Controller'));
  expect(reload).toHaveBeenCalledTimes(1);
});
