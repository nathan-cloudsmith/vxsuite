import { createMemoryHistory } from 'history';
import userEvent from '@testing-library/user-event';

import { render } from '../../test/test_utils';
import { Paths } from '../config/globals';
import { screen } from '../../test/react_testing_library';
import { Ballot } from './ballot';

test('renders display settings page at appropriate route', () => {
  const history = createMemoryHistory({
    initialEntries: ['/some/initial/path'],
  });

  render(<Ballot />, { history });

  expect(history.location.pathname).toEqual('/some/initial/path');

  history.push(Paths.DISPLAY_SETTINGS);

  expect(history.location.pathname).toEqual(Paths.DISPLAY_SETTINGS);

  // Verify a few expected elements:
  screen.getByRole('heading', { name: /settings/i });
  userEvent.click(screen.getByRole('tab', { name: /size/i }));
  screen.getByRole('radio', { name: /extra-large/i });

  userEvent.click(screen.getButton(/done/i));

  expect(history.location.pathname).toEqual('/some/initial/path');
});
