/** Shared modifier state so the piano roll and the global shortcuts agree. */
export const keyState = {
  space: false,
  /** true when space was consumed by a pan gesture, so it must not toggle playback */
  spaceUsedForDrag: false,
}
