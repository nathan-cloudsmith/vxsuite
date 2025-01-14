import { assert } from '@votingworks/basics';

import { fakeLogger, LogEventId } from '@votingworks/logging';
import { Server } from 'http';
import { dirSync } from 'tmp';
import {
  buildMockArtifactAuthenticator,
  buildMockDippedSmartCardAuth,
} from '@votingworks/auth';
import { start } from './server';
import { createWorkspace } from './util/workspace';
import { PORT } from './globals';
import { buildApp } from './app';
import { createMockUsb } from '../test/app';

beforeEach(() => {
  jest.restoreAllMocks();
});

test('starts with default logger and port', async () => {
  const auth = buildMockDippedSmartCardAuth();
  const artifactAuthenticator = buildMockArtifactAuthenticator();
  const workspace = createWorkspace(dirSync().name);
  const logger = fakeLogger();
  const { usb } = createMockUsb();
  const app = buildApp({ auth, artifactAuthenticator, workspace, logger, usb });

  // don't actually listen
  jest.spyOn(app, 'listen').mockImplementationOnce((_port, onListening) => {
    onListening?.();
    return undefined as unknown as Server;
  });
  jest.spyOn(console, 'log').mockImplementation();

  // start up the server
  await start({ app, workspace });

  expect(app.listen).toHaveBeenCalledWith(PORT, expect.anything());

  // eslint-disable-next-line no-console
  expect(console.log).toHaveBeenCalled();
});

test('start with config options', async () => {
  const auth = buildMockDippedSmartCardAuth();
  const artifactAuthenticator = buildMockArtifactAuthenticator();
  const workspace = createWorkspace(dirSync().name);
  const logger = fakeLogger();
  const { usb } = createMockUsb();
  const app = buildApp({ auth, artifactAuthenticator, workspace, logger, usb });

  // don't actually listen
  jest.spyOn(app, 'listen').mockImplementationOnce((_port, onListening) => {
    onListening?.();
    return undefined as unknown as Server;
  });
  jest.spyOn(console, 'log').mockImplementation();

  // start up the server
  await start({ app, workspace, port: 3005, logger });

  expect(app.listen).toHaveBeenCalledWith(3005, expect.anything());
  expect(logger.log).toHaveBeenCalled();
});

test('errors on start with no workspace', async () => {
  const auth = buildMockDippedSmartCardAuth();
  const artifactAuthenticator = buildMockArtifactAuthenticator();
  const workspace = createWorkspace(dirSync().name);
  const logger = fakeLogger();
  const { usb } = createMockUsb();
  const app = buildApp({ auth, artifactAuthenticator, workspace, logger, usb });

  // start up the server
  try {
    await start({
      app,
      workspace: undefined,
      logger,
    });
  } catch (err: unknown) {
    assert(err instanceof Error);
    expect(err.message).toMatch(
      'workspace path could not be determined; pass a workspace or run with ADMIN_WORKSPACE'
    );
    expect(logger.log).toHaveBeenCalledWith(
      LogEventId.AdminServiceConfigurationMessage,
      'system',
      {
        message: expect.stringContaining(
          'workspace path could not be determined'
        ),
        disposition: 'failure',
      }
    );
  }
});
