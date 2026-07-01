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
      queryType: query.queryType ?? 'telemetry',
      component: query.component ? templateSrv.replace(query.component, scopedVars) : undefined,
      channel: query.channel ? templateSrv.replace(query.channel, scopedVars) : undefined,
      source: query.source ? templateSrv.replace(query.source, scopedVars) : undefined,
      key: query.key ? templateSrv.replace(query.key, scopedVars) : undefined,
      timeOverrideFrom: query.timeOverrideFrom ? new Date(query.timeOverrideFrom).toISOString() : undefined,
      timeOverrideTo: query.timeOverrideTo ? new Date(query.timeOverrideTo).toISOString() : undefined,
    };
  }

  filterQuery(query: MyQuery): boolean {
    if (query.queryType === 'events') {
      return true;
    }
    return !!query.component && !!query.channel;
  }

  // Telemetry resources
  async getComponents(): Promise<string[]> {
    return this.getResource('telemetry/components');
  }

  async getChannels(component: string): Promise<string[]> {
    return this.getResource('telemetry/channels', { component });
  }

  async getSources(): Promise<string[]> {
    return this.getResource('telemetry/sources');
  }

  async getKeys(component: string, channel: string): Promise<string[]> {
    return this.getResource('telemetry/keys', { component, channel });
  }

  // Event resources
  async getEventSources(): Promise<string[]> {
    return this.getResource('events/sources');
  }
}
