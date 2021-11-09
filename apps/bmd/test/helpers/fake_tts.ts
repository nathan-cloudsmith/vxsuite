import { TextToSpeech } from '../../src/config/types';

/**
 * Builds a fake `TextToSpeech` instance with mock functions.
 */
export function fakeTTS(): jest.Mocked<TextToSpeech> {
  let isMuted = true;

  return {
    speak: jest.fn().mockResolvedValue(undefined),
    stop: jest.fn(),
    mute: jest.fn(() => {
      isMuted = true;
    }),
    unmute: jest.fn(() => {
      isMuted = false;
    }),
    isMuted: jest.fn(() => isMuted),
    toggleMuted: jest.fn((muted = !isMuted) => {
      isMuted = muted;
    }),
  };
}