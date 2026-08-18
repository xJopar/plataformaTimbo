process.env.USERS_INTEGRATION_TEST_RUN = '1';
process.argv.push('--config', 'jest.integration.config.js', '--runInBand');

require('../../../node_modules/jest/bin/jest.js');
