import React from 'react';
import RecipeSheet from './RecipeSheet';
import { MOTIONS, MOTION_CATEGORIES } from '../constants/motions';

// Motion: where the camera is. See RecipeSheet for why this and Effects share a sheet.
const ICONS = {
  Basic: 'block',
  Zoom: 'zoom-in',
  Pan: 'open-with',
  Shake: 'vibration',
  Pulse: 'favorite',
  Tilt: 'screen-rotation',
};

export default function MotionPicker(props) {
  return (
    <RecipeSheet
      {...props}
      title="Motion"
      items={MOTIONS}
      categories={MOTION_CATEGORIES}
      icons={ICONS}
    />
  );
}
