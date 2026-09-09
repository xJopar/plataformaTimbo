import type { UsageEventCatalog } from '../src/modules/usage-events/usage-event-catalog';

// Esta definición vive bajo test/ para que ningún módulo productivo pueda habilitarla.
export const USAGE_EVENTS_TEST_CATALOG: UsageEventCatalog = {
  'test.screen_opened': {
    appKey: 'test-app',
    target: {
      targetType: 'screen',
      required: false,
      maxIdLength: 64,
    },
    metadataFields: [
      {
        name: 'screen',
        required: true,
        type: 'string',
        maxLength: 16,
        allowedValues: ['home', 'details'],
      },
      {
        name: 'sequence',
        required: false,
        type: 'number',
      },
      {
        name: 'confirmed',
        required: false,
        type: 'boolean',
      },
      {
        name: 'relatedId',
        required: false,
        type: 'uuid',
      },
      {
        name: 'payload',
        required: false,
        type: 'string',
        maxLength: 3072,
      },
    ],
  },
};
