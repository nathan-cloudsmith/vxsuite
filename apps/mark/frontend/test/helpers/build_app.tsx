import { fakeLogger, Logger } from '@votingworks/logging';
import { MemoryHardware, MemoryStorage } from '@votingworks/utils';
import { render, RenderResult } from '../react_testing_library';
import { App } from '../../src/app';
import { ScreenReader, TextToSpeech } from '../../src/config/types';
import { AriaScreenReader } from '../../src/utils/ScreenReader';
import { fakeTts } from './fake_tts';
import { createApiMock } from './mock_api_client';

export function buildApp(apiMock: ReturnType<typeof createApiMock>): {
  mockTts: TextToSpeech;
  screenReader: ScreenReader;
  storage: MemoryStorage;
  logger: Logger;
  hardware: MemoryHardware;
  reload: () => void;
  renderApp: () => RenderResult;
} {
  const mockTts = fakeTts();
  const screenReader = new AriaScreenReader(mockTts);
  const logger = fakeLogger();
  const hardware = MemoryHardware.build({
    connectCardReader: true,
    connectPrinter: true,
    connectAccessibleController: true,
  });
  const storage = new MemoryStorage();
  const reload = jest.fn();
  function renderApp() {
    return render(
      <App
        hardware={hardware}
        storage={storage}
        reload={reload}
        logger={logger}
        apiClient={apiMock.mockApiClient}
        screenReader={screenReader}
      />
    );
  }

  return {
    mockTts,
    screenReader,
    logger,
    hardware,
    storage,
    reload,
    renderApp,
  };
}
