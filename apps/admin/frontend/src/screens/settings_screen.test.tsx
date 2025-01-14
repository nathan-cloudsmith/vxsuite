import userEvent from '@testing-library/user-event';
import { fakeKiosk } from '@votingworks/test-utils';
import { screen, waitFor, within } from '../../test/react_testing_library';

import { renderInAppContext } from '../../test/render_in_app_context';
import { SettingsScreen } from './settings_screen';
import { ApiMock, createApiMock } from '../../test/helpers/api_mock';

let mockKiosk: jest.Mocked<KioskBrowser.Kiosk>;
let apiMock: ApiMock;

beforeEach(() => {
  jest.useFakeTimers().setSystemTime(new Date('2022-06-22T00:00:00.000Z'));
  mockKiosk = fakeKiosk();
  window.kiosk = mockKiosk;
  apiMock = createApiMock();
});

afterEach(() => {
  jest.useRealTimers();
  apiMock.assertComplete();
});

test('Setting current date and time', async () => {
  renderInAppContext(<SettingsScreen />, { apiMock });

  screen.getByRole('heading', { name: 'Current Date and Time' });
  const startDateTime = 'Wed, Jun 22, 2022, 12:00 AM UTC';
  screen.getByText(startDateTime);

  // Clock setting is tested fully in libs/ui/src/set_clock.test.tsx
  userEvent.click(
    screen.getByRole('button', { name: 'Wed, Jun 22, 2022, 12:00 AM UTC' })
  );
  const modal = screen.getByRole('alertdialog');
  within(modal).getByText('Wed, Jun 22, 2022, 12:00 AM');
  userEvent.selectOptions(within(modal).getByTestId('selectYear'), '2023');
  apiMock.expectLogOut();
  userEvent.click(within(modal).getByRole('button', { name: 'Save' }));
  await waitFor(() => {
    expect(mockKiosk.setClock).toHaveBeenCalledWith({
      isoDatetime: '2023-06-22T00:00:00.000+00:00',
      // eslint-disable-next-line vx/gts-identifiers
      IANAZone: 'UTC',
    });
  });
});

test('Rebooting from USB', async () => {
  renderInAppContext(<SettingsScreen />, { apiMock });

  screen.getByRole('heading', { name: 'Software Update' });

  // Rebooting from USB is tested fully in libs/ui/src/reboot_from_usb_button.test.tsx
  userEvent.click(screen.getByRole('button', { name: 'Reboot from USB' }));
  const modal = await screen.findByRole('alertdialog');
  within(modal).getByRole('heading', { name: 'No USB Drive Detected' });
  userEvent.click(within(modal).getByRole('button', { name: 'Cancel' }));
});

test('Rebooting to BIOS', () => {
  renderInAppContext(<SettingsScreen />, { apiMock });

  screen.getByRole('heading', { name: 'Software Update' });

  // Rebooting to BIOS is tested in libs/ui/src/reboot_to_bios_button.test.tsx
  screen.getByText('Reboot to BIOS');
});
