// Weekly progress-photo capture: permission handling, picker config and the
// base64 encoding the backend stores. Kept out of the screen so the rules for
// "what we ask for and what we upload" live in one place.
import * as ImagePicker from 'expo-image-picker';

export type PickedPhoto = { uri: string; base64?: string };

/**
 * Opens the image library and returns the picked photo, or null when the user
 * cancelled. Throws when permission is denied so the caller can surface a toast.
 */
export async function pickProgressPhoto(): Promise<PickedPhoto | null> {
  const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!perm.granted) throw new Error('Photo library permission is needed');

  const res = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images'],
    quality: 0.35,
    base64: true,
    allowsEditing: true,
    aspect: [4, 5],
  });
  if (res.canceled || !res.assets?.[0]) return null;

  const asset = res.assets[0];
  // expo-image-picker types base64 as `string | null | undefined`.
  return { uri: asset.uri, base64: asset.base64 ?? undefined };
}

/** The value stored in `progress.photo_urls`. */
export function photoToDataUrl(photo: PickedPhoto): string {
  return photo.base64 ? `data:image/jpeg;base64,${photo.base64}` : photo.uri;
}
