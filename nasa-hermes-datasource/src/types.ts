import { DataSourceJsonData } from '@grafana/data';
import { DataQuery } from '@grafana/schema';

export type ValueType = 'int' | 'uint' | 'float' | 'bool' | 'string' | 'enum' | 'bytes';

export const VALUE_TYPE_OPTIONS: Array<{ label: string; value: ValueType; description: string }> = [
  { label: 'Float', value: 'float', description: 'floating column (REAL)' },
  { label: 'Int', value: 'int', description: 'integral column (signed BIGINT)' },
  { label: 'Uint', value: 'uint', description: 'integral column (unsigned BIGINT)' },
  { label: 'Bool', value: 'bool', description: 'boolval column (BOOLEAN)' },
  { label: 'String', value: 'string', description: 'string column (TEXT)' },
  { label: 'Enum', value: 'enum', description: 'integral + string columns' },
  { label: 'Bytes', value: 'bytes', description: 'bytes column (BYTEA)' },
];

export interface MyQuery extends DataQuery {
  component?: string;
  channel?: string;
  source?: string;
  key?: string;
  valueType?: ValueType;
}

export const DEFAULT_QUERY: Partial<MyQuery> = {};

export interface DataPoint {
  Time: number;
  Value: number;
}

export interface DataSourceResponse {
  datapoints: DataPoint[];
}

/**
 * These are options configured for each DataSource instance
 */
export interface MyDataSourceOptions extends DataSourceJsonData {
  host?: string;
  user?: string;
  database?: string;
  ert?: boolean;
}

/**
 * Value that is used in the backend, but never sent over HTTP to the frontend
 */
export interface MySecureJsonData {
  password?: string;
}
