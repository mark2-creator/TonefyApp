import React from 'react';
import RecipeSheet from './RecipeSheet';
import { EFFECTS, EFFECT_CATEGORIES } from '../constants/effects';

// Effects: something HAPPENING on the footage, as opposed to a grade (Filters), a
// camera move (Motion) or a join (Transitions). The Effects tab used to list seven
// filter names, which is why the app looked like it had no effects at all.
const ICONS = {
  Basic: 'block',
  Glitch: 'broken-image',
  Light: 'flare',
  Trails: 'blur-linear',
  Retro: 'videocam',
  Distort: 'waves',
  Colour: 'palette',
  Mirror: 'flip',
  Atmosphere: 'filter-drama',
};

export default function EffectPicker(props) {
  return (
    <RecipeSheet
      {...props}
      title="Effects"
      items={EFFECTS}
      categories={EFFECT_CATEGORIES}
      icons={ICONS}
    />
  );
}
