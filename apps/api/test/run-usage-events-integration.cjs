process.env.USAGE_EVENTS_INTEGRATION_TEST_RUN = '1';
process.env.DATABASE_TEST_ENVIRONMENT = 'development';
process.argv.push(
  '--config',
  'jest.integration.config.js',
  '--runInBand',
  'test/usage-events.integration-spec.ts',
);

require('../../../node_modules/jest/bin/jest.js');
