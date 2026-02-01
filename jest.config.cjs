
module.exports = {
  preset: 'jest-expo',
  transformIgnorePatterns: [
    'node_modules/(?!((jest-)?react-native|@react-native(-community)?)|expo(nent)?|@expo(nent)?/.*|@expo-google-fonts/.*|react-navigation|@react-navigation/.*|@unimodules/.*|unimodules|sentry-expo|native-base|react-native-svg|expo-sqlite)',
  ],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/client/$1',
  },
  testMatch: ['**/client/**/*.test.(ts|tsx|js)'],
};
