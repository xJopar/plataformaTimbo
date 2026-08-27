export type UsageEventMetadataFieldDefinition =
  | {
      name: string;
      required: boolean;
      type: 'string';
      maxLength: number;
      allowedValues?: readonly string[];
    }
  | {
      name: string;
      required: boolean;
      type: 'uuid';
    }
  | {
      name: string;
      required: boolean;
      type: 'number';
    }
  | {
      name: string;
      required: boolean;
      type: 'boolean';
    };

export interface UsageEventTargetDefinition {
  targetType: string;
  required: boolean;
  maxIdLength: number;
}

export interface UsageEventCatalogEntry {
  appKey: string;
  target?: UsageEventTargetDefinition;
  metadataFields: readonly UsageEventMetadataFieldDefinition[];
}

export type UsageEventCatalog = Readonly<Record<string, UsageEventCatalogEntry>>;

export const USAGE_EVENT_CATALOG = Symbol('USAGE_EVENT_CATALOG');

export const PRODUCT_USAGE_EVENT_CATALOG: UsageEventCatalog = {
  'hello-world.joke_requested': {
    appKey: 'hello-world',
    metadataFields: [],
  },
  'lista-precios.catalog_opened': {
    appKey: 'lista-precios',
    metadataFields: [],
  },
  'lista-precios.model_viewed': {
    appKey: 'lista-precios',
    target: { targetType: 'vehicle_model', required: true, maxIdLength: 256 },
    metadataFields: [
      { name: 'brand', required: true, type: 'string', maxLength: 80 },
      { name: 'model', required: true, type: 'string', maxLength: 120 },
    ],
  },
  'lista-precios.consultation_started': {
    appKey: 'lista-precios',
    target: { targetType: 'vehicle_model', required: true, maxIdLength: 256 },
    metadataFields: [
      { name: 'brand', required: true, type: 'string', maxLength: 80 },
      { name: 'model', required: true, type: 'string', maxLength: 120 },
    ],
  },
};
