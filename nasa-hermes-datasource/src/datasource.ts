import { DataSourceInstanceSettings, CoreApp, ScopedVars } from '@grafana/data';
import { DataSourceWithBackend, getTemplateSrv } from '@grafana/runtime';

import { MyQuery, MyDataSourceOptions, DEFAULT_QUERY } from './types';

export class DataSource extends DataSourceWithBackend<MyQuery, MyDataSourceOptions> {
  constructor(instanceSettings: DataSourceInstanceSettings<MyDataSourceOptions>) {
    super(instanceSettings);
  }

  getDefaultQuery(_: CoreApp): Partial<MyQuery> {
    return DEFAULT_QUERY;
  }

  applyTemplateVariables(query: MyQuery, scopedVars: ScopedVars) {
    const templateSrv = getTemplateSrv();
    return {
      ...query,
      component: query.component ? templateSrv.replace(query.component, scopedVars) : undefined,
      channel: query.channel ? templateSrv.replace(query.channel, scopedVars) : undefined,
      source: query.source ? templateSrv.replace(query.source, scopedVars) : undefined,
      key: query.key ? templateSrv.replace(query.key, scopedVars) : undefined,
      valueType: query.valueType,
    };
  }

  filterQuery(query: MyQuery): boolean {
    return !!query.component && !!query.channel;
  }

  async getComponents(): Promise<string[]> {
    return this.getResource('components');
  }

  async getChannels(component: string): Promise<string[]> {
    return this.getResource('channels', { component });
  }

  async getSources(): Promise<string[]> {
    return this.getResource('sources');
  }

  async getKeys(component: string, channel: string): Promise<string[]> {
    return this.getResource('keys', { component, channel });
  }
}
