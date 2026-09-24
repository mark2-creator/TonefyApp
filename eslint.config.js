// https://docs.expo.dev/guides/using-eslint/
const { defineConfig } = require('eslint/config');
const expoConfig = require('eslint-config-expo/flat');

module.exports = defineConfig([
  expoConfig,
  {
    // .bak_* are recovery snapshots kept on disk deliberately and are not part of the
    // build; dist is generated. Linting either is noise that hides real findings.
    //
    // .webcheck/ is scratch written by scripts/check-website-js.py - it is the harness
    // that guard builds to run eslint against the WEBSITE's inline scripts, so it is
    // neither app code nor bundled. It is gitignored, but a flat config does NOT read
    // .gitignore, so `npx eslint .` linted it anyway and reported 5 no-var errors from
    // Sep 18 onward. That matters more than the noise: the gate this project relies on
    // is "eslint --quiet must be SILENT, so any error is new and real", and a scratch
    // directory was quietly making it red - which is exactly the always-red lint the
    // rules below were written to avoid.
    ignores: ['dist/*', 'android/*', 'ios/*', '**/*.bak_*', 'scratchpad/*', '.webcheck/*'],
  },
  {
    settings: {
      // @expo/vector-icons is installed under expo's own node_modules rather than at the
      // top level, so the default resolver cannot see it and reported all 39 of this
      // app's imports of it as unresolved - enough noise to bury anything real. This is
      // a resolver fix rather than adding it as a direct dependency, which would risk a
      // second copy of the icon fonts at a different version.
      'import/resolver': {
        node: { moduleDirectory: ['node_modules', 'node_modules/expo/node_modules'] },
      },
    },
    rules: {
      // The one that matters, and the reason this was set up: an identifier that
      // resolves at bundle time and throws only when the line runs. `expo export`
      // bundles it happily and it grey-screens on a device - which is how a deleted
      // useState declaration shipped while three call sites kept using its setter.
      'no-undef': 'error',
      // Real bug shape: a duplicate key silently overrides the first, so the value you
      // are reading is not the one you are looking at. Two were found on setup.
      'no-dupe-keys': 'error',
      // Warnings, deliberately not errors. This codebase has ~120 of them and they are
      // style rather than defects; making them errors would mean either a large sweep
      // now or a lint that is always red and therefore ignored.
      'no-unused-vars': 'warn',
      'react-hooks/exhaustive-deps': 'warn',
      'react/no-unescaped-entities': 'warn',
      'import/no-named-as-default': 'off',
    },
  },
]);
