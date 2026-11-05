/**
 * Preview session rules. These keys live in sessionStorage on this device.
 * They are not an account, and this preview never writes them anywhere else.
 *
 * Title screen
 * ------------
 * The real app shows the title only on launch, never when the player switches
 * tabs and comes back. sessionStorage survives those visibility changes for
 * the life of the tab and clears when the tab closes, which is the launch
 * boundary we want.
 *
 * Key: life-ascension.preview.titleSeen
 * Set when the player taps TAP TO BEGIN.
 * While it is set, /preview/title continues straight to /preview/home.
 * A visibilitychange or pageshow must not clear the flag. If the flag is
 * already set, those events skip the title instead of replaying it.
 *
 * TODO: a future setting may skip the title screen. Not built.
 */

export const TITLE_SEEN_KEY = 'life-ascension.preview.titleSeen';

/** Local preview gear choice so Home and Adventure show the same held item. */
export const MAIN_HAND_STORAGE_KEY = 'life-ascension.preview.mainHandId';

export const TITLE_SCREEN_BEHAVIOR =
  'The title screen shows on launch only. The sessionStorage flag life-ascension.preview.titleSeen survives tab switches and is never cleared on visibilitychange. While the flag is set, /preview/title continues to /preview/home.';

export const TITLE_SKIP_SETTING_TODO = 'TODO: a future setting may skip the title screen. Not built.';
