import { CustomVariableSupport, DataQueryRequest, DataSourceInstanceSettings, CoreApp, MetricFindValue, ScopedVars } from '@grafana/data';
import { DataSourceWithBackend, getTemplateSrv } from '@grafana/runtime';
import { DataQuery } from '@grafana/schema';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { MyQuery, MyDataSourceOptions, DEFAULT_QUERY, ChannelRef, KeyRef, withDefaults } from './types';
import { buildQuery } from 'query';
import { VariableQueryEditor } from './components/VariableQueryEditor';

export class DataSource extends DataSourceWithBackend<MyQuery, MyDataSourceOptions> {
  constructor(instanceSettings: DataSourceInstanceSettings<MyDataSourceOptions>) {
    super(instanceSettings);
    this.variables = new HermesVariableSupport(this);
  }

  query(request: DataQueryRequest<MyQuery>) {
    // Build raw SQL for each target if not already provided
    request.targets.forEach((target) => {
      const filled = withDefaults(target);
      Object.assign(target, filled);
      if (!target.rawSql) {
        target.rawSql = buildQuery(target, request);
      }
    });

    return super.query(request).pipe(
      map((response) => {
        for (const result of response.data) {
          const query = request.targets.find((t) => t.refId === result.refId);
          if (query?.queryType === 'events' && query.sources?.length) {
            result.fields = result.fields.filter((f: { name: string }) => f.name !== 'source');
          }
        }
        return response;
      })
    );
  }

  getDefaultQuery(_: CoreApp): Partial<MyQuery> {
    return DEFAULT_QUERY;
  }

  applyTemplateVariables(query: MyQuery, scopedVars: ScopedVars) {
    const templateSrv = getTemplateSrv();
    return {
      ...query,
      channels: query.channels?.map(ch => ({
        component: templateSrv.replace(ch.component, scopedVars),
        name: templateSrv.replace(ch.name, scopedVars),
      })) ?? [],
      sources: query.sources?.map(s => templateSrv.replace(s, scopedVars)) ?? [],
      keys: query.keys?.map(k => ({
        component: templateSrv.replace(k.component, scopedVars),
        channel: templateSrv.replace(k.channel, scopedVars),
        key: templateSrv.replace(k.key, scopedVars),
      })) ?? [],
    };
  }

  filterQuery(query: MyQuery): boolean {
    if (query.rawSql) {
      return true;
    }

    if (query.queryType === 'events') {
      return true;
    }

    return !!(query.channels && query.channels.length);
  }

  // Telemetry resources
  async getChannels(): Promise<ChannelRef[]> {
    return this.getResource('telemetry/channels');
  }

  async getSources(): Promise<string[]> {
    return this.getResource('telemetry/sources');
  }

  async getKeys(channels: ChannelRef[]): Promise<KeyRef[]> {
    const components = [...new Set(channels.map(ch => ch.component))];
    const names = channels.map(ch => ch.name);
    return this.getResource('telemetry/keys', { components, channels: names });
  }

  async getEventSources(): Promise<string[]> {
    return this.getResource('events/sources');
  }

}

export interface VariableQuery extends DataQuery {
  queryType: string;
}

export class HermesVariableSupport extends CustomVariableSupport<DataSource, VariableQuery> {
  private datasource: DataSource;

  constructor(datasource: DataSource) {
    super();
    this.datasource = datasource;
  }

  editor = VariableQueryEditor;

  query(request: DataQueryRequest<VariableQuery>): Observable<{ data: MetricFindValue[] }> {
    const queryType = request.targets[0]?.queryType ?? 'channels';
    return new Observable((subscriber) => {
      this.execute(queryType).then((data) => {
        subscriber.next({ data });
        subscriber.complete();
      }).catch((err) => subscriber.error(err));
    });
  }

  private async execute(queryType: string): Promise<MetricFindValue[]> {
    switch (queryType) {
      case 'components': {
        const chs = await this.datasource.getChannels();
        return [...new Set(chs.map(c => c.component))].map(v => ({ text: v }));
      }
      case 'channels': {
        const chs = await this.datasource.getChannels();
        return chs.map(c => ({ text: `${c.component}/${c.name}`, value: c.name }));
      }
      case 'sources':
        return (await this.datasource.getSources()).map(v => ({ text: v }));
      case 'event_sources':
        return (await this.datasource.getEventSources()).map(v => ({ text: v }));
      default:
        return [];
    }
  }
}
