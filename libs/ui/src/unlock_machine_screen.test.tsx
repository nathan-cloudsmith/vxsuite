import { DateTime } from 'luxon';
import userEvent from '@testing-library/user-event';
import {
  fakeSystemAdministratorUser,
  hasTextAcrossElements,
} from '@votingworks/test-utils';
import { DippedSmartCardAuth } from '@votingworks/types';
import { act } from '@testing-library/react-hooks';

import { render, screen, waitFor } from '../test/react_testing_library';
import { UnlockMachineScreen } from './unlock_machine_screen';

beforeEach(() => {
  jest.useFakeTimers().setSystemTime(new Date('2000-01-01T00:00:00Z'));
});

const checkingPinAuthStatus: DippedSmartCardAuth.CheckingPin = {
  status: 'checking_pin',
  user: fakeSystemAdministratorUser(),
};

test('PIN submission', async () => {
  const checkPin = jest.fn();
  render(
    <UnlockMachineScreen auth={checkingPinAuthStatus} checkPin={checkPin} />
  );

  screen.getByText('- - - - - -');

  userEvent.click(screen.getButton('0'));
  screen.getByText('• - - - - -');

  userEvent.click(screen.getButton('clear'));
  screen.getByText('- - - - - -');

  userEvent.click(screen.getButton('0'));
  screen.getByText('• - - - - -');

  userEvent.click(screen.getButton('1'));
  screen.getByText('• • - - - -');

  userEvent.click(screen.getButton('2'));
  screen.getByText('• • • - - -');

  userEvent.click(screen.getButton('3'));
  screen.getByText('• • • • - -');

  userEvent.click(screen.getButton('4'));
  screen.getByText('• • • • • -');

  userEvent.click(screen.getButton('backspace'));
  screen.getByText('• • • • - -');

  userEvent.click(screen.getButton('4'));
  screen.getByText('• • • • • -');

  userEvent.click(screen.getButton('5'));
  await waitFor(() => expect(checkPin).toHaveBeenNthCalledWith(1, '012345'));
  screen.getByText('- - - - - -');
});

test('Incorrect PIN', () => {
  const checkPin = jest.fn();
  render(
    <UnlockMachineScreen
      auth={{
        ...checkingPinAuthStatus,
        wrongPinEnteredAt: new Date(),
      }}
      checkPin={checkPin}
    />
  );

  screen.getByText('Incorrect PIN. Please try again.');
});

test.each<{
  description: string;
  isWrongPinEnteredAtSet: boolean;
  expectedPromptAfterLockoutEnds: string;
}>([
  {
    description: 'card locked after incorrect PIN attempt',
    isWrongPinEnteredAtSet: true,
    expectedPromptAfterLockoutEnds: 'Incorrect PIN. Please try again.',
  },
  {
    description: 'card already locked',
    isWrongPinEnteredAtSet: false,
    expectedPromptAfterLockoutEnds: 'Enter the card PIN to unlock.',
  },
])(
  'Lockout - $description',
  ({ isWrongPinEnteredAtSet, expectedPromptAfterLockoutEnds }) => {
    const checkPin = jest.fn();
    render(
      <UnlockMachineScreen
        auth={{
          ...checkingPinAuthStatus,
          lockedOutUntil: DateTime.now().plus({ seconds: 60 }).toJSDate(),
          wrongPinEnteredAt: isWrongPinEnteredAtSet ? new Date() : undefined,
        }}
        checkPin={checkPin}
      />
    );

    screen.getByText(
      hasTextAcrossElements(/Card locked. Please try again in 01m 00s$/)
    );
    screen.getByText('- - - - - -');

    // Ensure number pad entry is ignored
    userEvent.click(screen.getButton('0'));
    screen.getByText('- - - - - -');

    act(() => {
      jest.advanceTimersByTime(1000);
    });
    screen.getByText(
      hasTextAcrossElements(/Card locked. Please try again in 00m 59s$/)
    );

    act(() => {
      jest.advanceTimersByTime(59 * 1000);
    });
    screen.getByText(expectedPromptAfterLockoutEnds);
  }
);

test('Error checking PIN', () => {
  const checkPin = jest.fn();
  render(
    <UnlockMachineScreen
      auth={{
        ...checkingPinAuthStatus,
        error: true,
        wrongPinEnteredAt: new Date(),
      }}
      checkPin={checkPin}
    />
  );

  screen.getByText('Error checking PIN. Please try again.');
});
