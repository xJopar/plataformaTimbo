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

// El primer productor se incorpora en su propio ticket. Hasta entonces, cualquier nombre es
// rechazado deliberadamente: el módulo no ofrece una taxonomía genérica en producción.
export const EMPTY_USAGE_EVENT_CATALOG: UsageEventCatalog = {};
