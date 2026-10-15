// ⚽🚗 Axend Turbo — comandi: vedi il README in cima a manager.ts.
export { TurboInput, autoOrient, type InputDevice, type InputFrame } from './manager';
export { TouchControls, createTouchState, assistView, touchBoostAnchor, useLandscape, useTouchScale, type TouchControlsProps, type TouchState, type TouchButtonId } from './touch';
export { KeyboardInput, DEFAULT_KEYS, keyLabel, padLabel, loadKeyMap, saveKeyMap } from './keyboard';
export { GamepadInput, DEFAULT_PAD, loadPadMap, savePadMap, radialDeadzone } from './gamepad';
export { loadTurboPrefs, saveTurboPrefs, defaultPrefs, isCoarsePointer, DEFAULT_PHONE, type PhonePrefs, type TurboPrefs } from './prefs';
export { ACTION_INFO, actionLabel, type ActionInfo, type ActionGroup } from './labels';
export { mapToBindings, type KeyAction, type KeyMap, type ActionFlags, type RawInput } from './types';
