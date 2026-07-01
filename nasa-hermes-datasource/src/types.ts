import { DataSourceJsonData } from '@grafana/data';
import { DataQuery } from '@grafana/schema';

export type QueryType = 'telemetry' | 'events';

export interface MyQuery extends DataQuery {
  queryType: QueryType;
  component?: string;
  channel?: string;
  source?: string;
  key?: string;
  timeOverrideFrom?: string;
  timeOverrideTo?: string;
}

export const DEFAULT_QUERY: Partial<MyQuery> = { queryType: 'telemetry' };

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
