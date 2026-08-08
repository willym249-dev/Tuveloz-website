module.exports = function babelConfig(api) {
  api.cache(true);

  return {
    // `jsxImportSource: 'nativewind'` is what lets every JSX element accept a
    // `className` prop. `nativewind/babel` compiles the Tailwind output.
    presets: [['babel-preset-expo', { jsxImportSource: 'nativewind' }], 'nativewind/babel'],
    // No plugins list on purpose: babel-preset-expo already injects the
    // react-native-worklets plugin (required by Reanimated 4) when the package
    // is installed, and adding it twice breaks the build.
  };
};
