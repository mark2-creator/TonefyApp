import React, { useMemo } from 'react';
import { View, Text, TextInput, StyleSheet } from 'react-native';
import CaptionText, { captionMetrics } from './CaptionText';
import {
  resolveCaptionStyle, captionHighlight, activeWordIndex, withAlpha,
} from '../constants/captionStyles';
import { fontFamilyFor } from '../constants/fonts';

// What a text overlay LOOKS like on the canvas, including the caret while it is being
// typed into. Lifted out of EditVideoScreen so the Thumbnail screen can put the same
// editable text on its own canvas.
//
// It was already self-contained - 158 lines whose only outside references are the four
// imports above, with no reference to the screen's styles or state - so this is a move,
// not a refactor. Its own helper `withCaret` lives inside it and travelled with it.
//
// Kept as ONE definition on purpose. This component is what makes a caption on the
// canvas match the burned-in export, via captionMetrics; a second copy for thumbnails
// would be a second thing to keep in step, and this project's history is a list of what
// happens when two definitions of one thing drift.

function TextOverlayContent({
  overlay, maxWidth, boxWidth, playhead = 0, editing = false, onChangeText, onEndEditing,
}) {
  // An auto-caption is drawn by the shared caption renderer from its style spec;
  // a manual text overlay has no style and keeps the plain path. The overlay's own
  // font, size and colour win over the style's, so editing a caption in the text
  // sheet does what it appears to.
  const captionStyle = overlay.captionStyleId ? resolveCaptionStyle(overlay.captionStyleId) : null;
  const renderStyle = useMemo(
    () => (captionStyle && overlay.font ? { ...captionStyle, font: overlay.font } : captionStyle),
    [captionStyle, overlay.font]
  );
  // undefined for 'Default' and for the legacy Bold/Italic/Mono values, which are
  // weight and slant on the system face rather than families of their own.
  const overlayFamily = fontFamilyFor(overlay.font);
  const bg = overlay.background && overlay.background.enabled ? overlay.background : null;

  // Which word the chip is on. -1 for every style that does not chip a word, and
  // for a playhead outside the phrase - both of which render as plain text.
  const activeWord = useMemo(
    () => (renderStyle && captionHighlight(renderStyle)
      ? activeWordIndex(overlay.words, playhead)
      : -1),
    [renderStyle, overlay.words, playhead]
  );

  // An overlay emptied while editing collapses to nothing, and nothing cannot be
  // tapped - so there would be no way back to the caret you were just using.
  const editingBox = editing ? { minWidth: overlay.size * 4, minHeight: overlay.size } : null;

  // caretColor null (the default) is the original trick: content stays fully
  // visible and the TextInput sits on top with color:'transparent', so a
  // stroked/glowing caption style keeps every layer while being typed into -
  // there is no way for a plain TextInput to reproduce those layers, so for
  // a styled caption the alternative below is not an option.
  //
  // A real caretColor switches to the opposite trick: hide `content` (opacity
  // 0, not unmounted, so it still sizes editingBox exactly as before) and let
  // the TextInput itself be the one visible copy, in the real colour. This is
  // for plain overlays only, which have no stroke/glow/box to lose - turning
  // autoCorrect/spellCheck off (still on below) was meant to stop a keyboard's
  // own composing-span highlight from painting over a transparent value in
  // its own colour, but at least one Android keyboard kept doing it anyway.
  // Rather than chase every OEM keyboard's composing behaviour, this sidesteps
  // it: there is no wrong colour for the keyboard to paint over a value that
  // is already showing in the right one.
  function withCaret(content, metrics, caretColor = null) {
    if (!editing) return content;
    return (
      <View style={editingBox}>
        <View style={caretColor ? { opacity: 0 } : null}>{content}</View>
        <TextInput
          style={[
            StyleSheet.absoluteFill,
            metrics,
            // Android puts padding on an input and none on a Text, which
            // would offset the caret from the glyphs it is meant to sit on.
            { color: caretColor || 'transparent', padding: 0, margin: 0, textAlignVertical: 'top' },
          ]}
          value={overlay.text}
          // onChangeText is the stable setOverlayText(key, text) itself now
          // (not a per-render closure over this overlay's key), so the key
          // has to be supplied here instead - RN's TextInput only ever
          // passes the new text string.
          onChangeText={text => onChangeText(overlay.key, text)}
          onBlur={onEndEditing}
          onSubmitEditing={onEndEditing}
          autoFocus
          multiline
          blurOnSubmit
          scrollEnabled={false}
          allowFontScaling={false}
          selectionColor="#2ECC71"
          cursorColor="#2ECC71"
          underlineColorAndroid="transparent"
          autoCorrect={false}
          spellCheck={false}
          accessibilityLabel="Edit overlay text"
        />
      </View>
    );
  }

  if (renderStyle) {
    return withCaret(
      <CaptionText
        style={renderStyle}
        text={overlay.text}
        size={overlay.size}
        color={overlay.captionColorOverride}
        align="center"
        maxWidth={maxWidth}
        activeWord={activeWord}
      />,
      captionMetrics(renderStyle, overlay.size, 'center')
    );
  }

  const plainMetrics = {
    fontSize: overlay.size,
    ...(overlayFamily
      // A loaded family already carries the weight it was downloaded at, and
      // asking Android to synthesise more on top of a single registered face
      // is what makes a custom font silently fall back to the system one.
      ? { fontFamily: overlayFamily }
      : {
        fontWeight: overlay.font === 'Bold' ? 'bold' : 'normal',
        fontStyle: overlay.font === 'Italic' ? 'italic' : 'normal',
      }),
    textAlign: 'center',
  };

  const plain = (
    <Text style={{
      ...plainMetrics,
      color: overlay.color,
      // A chip already separates the text from the frame, and the drop shadow
      // under it only muddies the chip's own edge.
      ...(bg ? null : {
        textShadowColor: '#000',
        textShadowRadius: 4,
        textShadowOffset: { width: 1, height: 1 },
      }),
    }}>{overlay.text}</Text>
  );

  // The chip hugs the words rather than the overlay's column, so a short line does
  // not sit in a box the width of the frame. Same reasoning as the caption chip,
  // and the export draws it from the same four numbers - which is why the geometry
  // is scaled by size/18 here too. The server's `sscale` is exactly that, so a
  // chip specified at the 18pt base lands identically in the burned-in video;
  // rendering it unscaled would leave the preview right only at size 18.
  const bgScale = overlay.size / 18;
  return withCaret(
    bg
      ? (
        <View style={{
          alignSelf: 'center',
          // A dragged box width caps the chip the same way it already hugs
          // short text - maxWidth, not width, so one short word still sits
          // in a chip sized to itself rather than stretched to the box.
          ...(boxWidth ? { maxWidth: boxWidth } : null),
          backgroundColor: withAlpha(bg.color, bg.opacity),
          borderRadius: bg.radius * bgScale,
          paddingHorizontal: bg.padX * bgScale,
          paddingVertical: bg.padY * bgScale,
        }}>
          {plain}
        </View>
      )
      // No chip to hug - an exact width, not a cap, so the text block stays
      // centred within the full box a side-handle drag set rather than
      // shrinking back to whatever its shortest line happens to need.
      : (boxWidth ? <View style={{ width: boxWidth }}>{plain}</View> : plain),
    plainMetrics,
    overlay.color
  );
}

export default TextOverlayContent;
