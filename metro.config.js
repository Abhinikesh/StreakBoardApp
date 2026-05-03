// metro.config.js
//
// Optimized Metro bundler config for StreakBoard (Expo SDK 54).
// Extends Expo's default config so all Expo module transforms keep working.
//
// Size / perf wins enabled here:
//   1. inlineRequires  — defers module evaluation until first use, reducing
//      JS parse cost at startup (Hermes still compiles to bytecode, but fewer
//      modules are initialised eagerly).
//   2. Minimal sourceExts — removes rarely-used extensions so the resolver
//      does fewer stat() calls during the bundle phase.

const { getDefaultConfig } = require('expo/metro-config');

/** @type {import('expo/metro-config').MetroConfig} */
const config = getDefaultConfig(__dirname);

// ── Transformer optimisations ─────────────────────────────────────────────────
config.transformer = {
  ...config.transformer,

  // Inline require calls so modules are lazily evaluated on first access.
  // This is the same technique used by Facebook's production RN apps.
  // Safe for all our code — we don't rely on module-level side-effects at startup.
  getTransformOptions: async () => ({
    transform: {
      inlineRequires: true,   // defers require() calls to first use
      experimentalImportSupport: false,
    },
  }),
};

// ── Resolver: only include extensions actually used in the project ─────────────
// Removing 'cjs', 'mjs', 'flow' shaves a handful of stat() calls per module.
config.resolver = {
  ...config.resolver,
  sourceExts: ['js', 'jsx', 'ts', 'tsx', 'json'],
  // Ensure MP3 audio files are treated as assets (not parsed as modules)
  assetExts: [
    ...config.resolver.assetExts.filter((ext) => ext !== 'svg'),
    'mp3',
    'wav', // kept as fallback in case any old reference remains
  ],
};

module.exports = config;
