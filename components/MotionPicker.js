import React from 'react';
import RecipeSheet from './RecipeSheet';
import { MOTION_PREVIEW_VERSION } from '../constants/motionPreviewVersion';
import { MOTIONS, MOTION_CATEGORIES } from '../constants/motions';

// Motion: where the camera is. See RecipeSheet for why this and Effects share a sheet.
export default function MotionPicker(props) {
  return (
    <RecipeSheet
      {...props}
      title="Motion"
      items={MOTIONS}
      categories={MOTION_CATEGORIES}
      previewBase={`${props.backend}/motions`}
      version={MOTION_PREVIEW_VERSION}
    />
  );
}
