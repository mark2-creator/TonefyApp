import React from 'react';
import Svg, { Path, Defs, LinearGradient, Stop, RadialGradient } from 'react-native-svg';

// Real platform marks, drawn as vector paths.
//
// The export page was using MaterialIcons stand-ins: `camera-alt` for Instagram and
// `music-note` for TikTok. A generic camera glyph next to the word Instagram reads as
// a placeholder, which is the opposite of what a "post to" row needs to convey - the
// whole job of that row is to be instantly recognisable.
//
// Vector rather than PNG assets: these are already-installed react-native-svg paths,
// so they cost nothing to ship, stay sharp at any size, and can be recoloured. Each
// carries its own brand colour by default because that is most of the recognition.

export function TikTokLogo({ size = 22 }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      {/* The mark's offset cyan/red pair is the recognisable part, so it is drawn as
          three passes rather than flattened to one colour. */}
      <Path
        d="M16.6 5.82A4.28 4.28 0 0 1 15.54 3h-3.09v12.4a2.59 2.59 0 1 1-1.78-2.46V9.79a5.83 5.83 0 1 0 4.87 5.75V9.01a7.35 7.35 0 0 0 4.28 1.38V7.3a4.28 4.28 0 0 1-3.22-1.48z"
        fill="#25F4EE" translateX={-1.2}
      />
      <Path
        d="M16.6 5.82A4.28 4.28 0 0 1 15.54 3h-3.09v12.4a2.59 2.59 0 1 1-1.78-2.46V9.79a5.83 5.83 0 1 0 4.87 5.75V9.01a7.35 7.35 0 0 0 4.28 1.38V7.3a4.28 4.28 0 0 1-3.22-1.48z"
        fill="#FE2C55" translateX={1.2}
      />
      <Path
        d="M16.6 5.82A4.28 4.28 0 0 1 15.54 3h-3.09v12.4a2.59 2.59 0 1 1-1.78-2.46V9.79a5.83 5.83 0 1 0 4.87 5.75V9.01a7.35 7.35 0 0 0 4.28 1.38V7.3a4.28 4.28 0 0 1-3.22-1.48z"
        fill="#FFFFFF"
      />
    </Svg>
  );
}

export function InstagramLogo({ size = 22 }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Defs>
        <RadialGradient id="ig" cx="30%" cy="107%" r="150%">
          <Stop offset="0%" stopColor="#FDF497" />
          <Stop offset="25%" stopColor="#FD5949" />
          <Stop offset="60%" stopColor="#D6249F" />
          <Stop offset="100%" stopColor="#285AEB" />
        </RadialGradient>
      </Defs>
      <Path
        d="M12 2.16c3.2 0 3.58.01 4.85.07 1.17.05 1.8.25 2.23.41.56.22.96.48 1.38.9.42.42.68.82.9 1.38.16.42.36 1.06.41 2.23.06 1.27.07 1.65.07 4.85s-.01 3.58-.07 4.85c-.05 1.17-.25 1.8-.41 2.23-.22.56-.48.96-.9 1.38-.42.42-.82.68-1.38.9-.42.16-1.06.36-2.23.41-1.27.06-1.65.07-4.85.07s-3.58-.01-4.85-.07c-1.17-.05-1.8-.25-2.23-.41-.56-.22-.96-.48-1.38-.9-.42-.42-.68-.82-.9-1.38-.16-.42-.36-1.06-.41-2.23C2.17 15.58 2.16 15.2 2.16 12s.01-3.58.07-4.85c.05-1.17.25-1.8.41-2.23.22-.56.48-.96.9-1.38.42-.42.82-.68 1.38-.9.42-.16 1.06-.36 2.23-.41C8.42 2.17 8.8 2.16 12 2.16zM12 0C8.74 0 8.33.01 7.05.07 5.78.13 4.9.33 4.14.63a5.9 5.9 0 0 0-2.13 1.38A5.9 5.9 0 0 0 .63 4.14c-.3.76-.5 1.64-.56 2.91C.01 8.33 0 8.74 0 12s.01 3.67.07 4.95c.06 1.27.26 2.15.56 2.91a5.9 5.9 0 0 0 1.38 2.13 5.9 5.9 0 0 0 2.13 1.38c.76.3 1.64.5 2.91.56C8.33 23.99 8.74 24 12 24s3.67-.01 4.95-.07c1.27-.06 2.15-.26 2.91-.56a5.9 5.9 0 0 0 2.13-1.38 5.9 5.9 0 0 0 1.38-2.13c.3-.76.5-1.64.56-2.91.06-1.28.07-1.69.07-4.95s-.01-3.67-.07-4.95c-.06-1.27-.26-2.15-.56-2.91a5.9 5.9 0 0 0-1.38-2.13A5.9 5.9 0 0 0 19.86.63c-.76-.3-1.64-.5-2.91-.56C15.67.01 15.26 0 12 0z"
        fill="url(#ig)"
      />
      <Path
        d="M12 5.84A6.16 6.16 0 1 0 18.16 12 6.16 6.16 0 0 0 12 5.84zm0 10.16A4 4 0 1 1 16 12a4 4 0 0 1-4 4z"
        fill="url(#ig)"
      />
      <Path d="M19.85 5.6a1.44 1.44 0 1 1-1.44-1.44 1.44 1.44 0 0 1 1.44 1.44z" fill="url(#ig)" />
    </Svg>
  );
}

export function FacebookLogo({ size = 22 }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path
        d="M24 12.07C24 5.4 18.63 0 12 0S0 5.4 0 12.07C0 18.1 4.39 23.1 10.13 24v-8.44H7.08v-3.49h3.05V9.41c0-3.02 1.79-4.69 4.53-4.69 1.31 0 2.68.24 2.68.24v2.97h-1.51c-1.49 0-1.96.93-1.96 1.89v2.25h3.33l-.53 3.49h-2.8V24C19.61 23.1 24 18.1 24 12.07z"
        fill="#1877F2"
      />
      <Path
        d="M16.67 15.56l.53-3.49h-3.33V9.82c0-.96.47-1.89 1.96-1.89h1.51V4.96s-1.37-.24-2.68-.24c-2.74 0-4.53 1.67-4.53 4.69v2.66H7.08v3.49h3.05V24a12.2 12.2 0 0 0 3.74 0v-8.44h2.8z"
        fill="#FFFFFF"
      />
    </Svg>
  );
}

export function YouTubeLogo({ size = 22 }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path
        d="M23.5 6.19a3.02 3.02 0 0 0-2.12-2.14C19.5 3.55 12 3.55 12 3.55s-7.5 0-9.38.5A3.02 3.02 0 0 0 .5 6.19C0 8.08 0 12 0 12s0 3.92.5 5.81a3.02 3.02 0 0 0 2.12 2.14c1.88.5 9.38.5 9.38.5s7.5 0 9.38-.5a3.02 3.02 0 0 0 2.12-2.14C24 15.92 24 12 24 12s0-3.92-.5-5.81z"
        fill="#FF0000"
      />
      <Path d="M9.55 15.57V8.43L15.82 12l-6.27 3.57z" fill="#FFFFFF" />
    </Svg>
  );
}

export const PLATFORM_LOGOS = {
  tiktok: TikTokLogo,
  instagram: InstagramLogo,
  facebook: FacebookLogo,
  youtube: YouTubeLogo,
};
