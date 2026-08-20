import React from 'react';
import RecipeSheet from './RecipeSheet';
import { EFFECT_PREVIEW_VERSION } from '../constants/effectPreviewVersion';
import { EFFECTS, EFFECT_CATEGORIES } from '../constants/effects';

// Effects: something HAPPENING on the footage, as opposed to a grade (Filters), a
// camera move (Motion) or a join (Transitions). The Effects tab used to list seven
// filter names, which is why the app looked like it had no effects at all.
export default function EffectPicker(props) {
  return (
    <RecipeSheet
      {...props}
      title="Effects"
      items={EFFECTS}
      categories={EFFECT_CATEGORIES}
      previewBase={`${props.backend}/effects`}
      version={EFFECT_PREVIEW_VERSION}
    />
  );
}
