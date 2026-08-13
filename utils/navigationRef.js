import { createNavigationContainerRef } from '@react-navigation/native';

// Lets code outside a screen component (module-level helpers like
// promptUpgrade in EditVideoScreen.js) trigger navigation, the same
// imperative-ref pattern BrandedAlert already uses for showAlert. A
// separate file rather than living in App.js - App.js imports every screen,
// so a screen importing the ref back out of App.js would be circular.
export const navigationRef = createNavigationContainerRef();
