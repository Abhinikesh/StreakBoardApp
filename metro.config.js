const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

config.transformer = {
  ...config.transformer,
  getTransformOptions: async () => ({
    transform: {
      inlineRequires: true,
      experimentalImportSupport: false,
    },
  }),
};

config.resolver.assetExts = [
  ...config.resolver.assetExts,
  'mp3',
  'wav',
];

module.exports = config;
