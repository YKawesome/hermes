import React, { useCallback, useEffect, useState } from 'react';
import { CollapsableSection, Combobox, InlineField, RadioButtonGroup, Stack } from '@grafana/ui';
import { QueryEditorProps, SelectableValue } from '@grafana/data';
import type { ComboboxOption } from '@grafana/ui';
import { DataSource } from '../datasource';
import { MyDataSourceOptions, MyQuery, QueryType } from '../types';

type Props = QueryEditorProps<DataSource, MyQuery, MyDataSourceOptions>;

const QUERY_TYPE_OPTIONS: Array<SelectableValue<QueryType>> = [
  { label: 'Telemetry', value: 'telemetry' },
  { label: 'Events', value: 'events' },
];

function toOptions(values: string[]): Array<ComboboxOption<string>> {
  return values.map((v) => ({ label: v, value: v }));
}


export function QueryEditor({ query, onChange, onRunQuery, datasource }: Props) {
  const queryType = query.queryType ?? 'telemetry';

  // Telemetry state
  const [componentOptions, setComponentOptions] = useState<Array<ComboboxOption<string>>>([]);
  const [channelOptions, setChannelOptions] = useState<Array<ComboboxOption<string>>>([]);
  const [sourceOptions, setSourceOptions] = useState<Array<ComboboxOption<string>>>([]);
  const [keyOptions, setKeyOptions] = useState<Array<ComboboxOption<string>>>([]);

  const [componentLoading, setComponentLoading] = useState(false);
  const [channelLoading, setChannelLoading] = useState(false);
  const [sourceLoading, setSourceLoading] = useState(false);
  const [keyLoading, setKeyLoading] = useState(false);

  // Event state
  const [eventSourceOptions, setEventSourceOptions] = useState<Array<ComboboxOption<string>>>([]);
  const [eventSourceLoading, setEventSourceLoading] = useState(false);

  // --- Telemetry data loading ---

  useEffect(() => {
    if (queryType !== 'telemetry') {
      return;
    }
    setComponentLoading(true);
    datasource
      .getComponents()
      .then((values) => setComponentOptions(toOptions(values)))
      .catch(() => setComponentOptions([]))
      .finally(() => setComponentLoading(false));
  }, [datasource, queryType]);

  useEffect(() => {
    if (queryType !== 'telemetry') {
      return;
    }
    setSourceLoading(true);
    datasource
      .getSources()
      .then((values) => setSourceOptions(toOptions(values)))
      .catch(() => setSourceOptions([]))
      .finally(() => setSourceLoading(false));
  }, [datasource, queryType]);

  useEffect(() => {
    if (queryType !== 'telemetry' || !query.component) {
      setChannelOptions([]);
      return;
    }
    setChannelLoading(true);
    datasource
      .getChannels(query.component)
      .then((values) => setChannelOptions(toOptions(values)))
      .catch(() => setChannelOptions([]))
      .finally(() => setChannelLoading(false));
  }, [datasource, queryType, query.component]);

  useEffect(() => {
    if (queryType !== 'telemetry' || !query.component || !query.channel) {
      setKeyOptions([]);
      return;
    }
    setKeyLoading(true);
    datasource
      .getKeys(query.component, query.channel)
      .then((values) => setKeyOptions(toOptions(values)))
      .catch(() => setKeyOptions([]))
      .finally(() => setKeyLoading(false));
  }, [datasource, queryType, query.component, query.channel]);

  // --- Event data loading ---

  useEffect(() => {
    if (queryType !== 'events') {
      return;
    }
    setEventSourceLoading(true);
    datasource
      .getEventSources()
      .then((values) => setEventSourceOptions(toOptions(values)))
      .catch(() => setEventSourceOptions([]))
      .finally(() => setEventSourceLoading(false));
  }, [datasource, queryType]);

  // --- Handlers ---

  const onQueryTypeChange = useCallback(
    (value: QueryType) => {
      const updated = {
        ...query,
        queryType: value,
        component: undefined,
        channel: undefined,
        key: undefined,
        source: undefined,
      };
      onChange(updated);
      if (value === 'events') {
        onRunQuery();
      }
    },
    [onChange, onRunQuery, query]
  );

  const onComponentChange = useCallback(
    (option: ComboboxOption<string>) => {
      onChange({ ...query, component: option.value, channel: undefined, key: undefined });
      onRunQuery();
    },
    [onChange, onRunQuery, query]
  );

  const onChannelChange = useCallback(
    (option: ComboboxOption<string>) => {
      const updated = { ...query, channel: option.value, key: undefined };
      onChange(updated);
      if (updated.component && updated.channel) {
        onRunQuery();
      }
    },
    [onChange, onRunQuery, query]
  );

  const onSourceChange = useCallback(
    (option: ComboboxOption<string> | null) => {
      const updated = { ...query, source: option?.value ?? undefined };
      onChange(updated);
      if (queryType === 'telemetry' && updated.component && updated.channel) {
        onRunQuery();
      }
      if (queryType === 'events') {
        onRunQuery();
      }
    },
    [onChange, onRunQuery, query, queryType]
  );

  const onKeyChange = useCallback(
    (option: ComboboxOption<string> | null) => {
      const updated = { ...query, key: option?.value ?? undefined };
      onChange(updated);
      if (updated.component && updated.channel) {
        onRunQuery();
      }
    },
    [onChange, onRunQuery, query]
  );

  const onTimeOverrideFromChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      onChange({ ...query, timeOverrideFrom: e.currentTarget.value || undefined });
    },
    [onChange, query]
  );

  const onTimeOverrideToChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      onChange({ ...query, timeOverrideTo: e.currentTarget.value || undefined });
    },
    [onChange, query]
  );

  useEffect(() => {
    onRunQuery();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query.timeOverrideFrom, query.timeOverrideTo]);

  return (
    <Stack direction="column" gap={.5}>
      <div style={{ marginTop: 8, marginBottom: 8 }}>
        <RadioButtonGroup
          id="query-editor-query-type"
          options={QUERY_TYPE_OPTIONS}
          value={queryType}
          onChange={onQueryTypeChange}
          size="sm"
        />
      </div>

      {queryType === 'telemetry' && (
        <>
          <Stack gap={.5}>
            <InlineField label="Component" labelWidth={16} tooltip="FSW component or module" required>
              <Combobox
                id="query-editor-component"
                options={componentOptions}
                value={query.component ?? null}
                onChange={onComponentChange}
                loading={componentLoading}
                placeholder="Select component"
                width={28}
              />
            </InlineField>
            <InlineField label="Channel" labelWidth={16} tooltip="Telemetry channel name" required>
              <Combobox
                key={`channel-${query.component ?? ''}`}
                id="query-editor-channel"
                options={channelOptions}
                value={query.channel ?? null}
                onChange={onChannelChange}
                loading={channelLoading}
                disabled={!query.component}
                placeholder={query.component ? 'Select channel' : 'Select a component first'}
                width={28}
              />
            </InlineField>
          </Stack>
          <Stack gap={.5}>
            <InlineField label="Source" labelWidth={16} tooltip="FSW source identifier (optional)">
              <Combobox
                id="query-editor-source"
                options={sourceOptions}
                value={query.source ?? null}
                onChange={onSourceChange}
                isClearable
                loading={sourceLoading}
                placeholder="All sources"
                width={28}
              />
            </InlineField>
            {keyOptions.length > 1 && (
              <InlineField label="Key" labelWidth={16} tooltip="Value field path for compound channels">
                <Combobox
                  id="query-editor-key"
                  options={keyOptions}
                  value={query.key ?? null}
                  onChange={onKeyChange}
                  isClearable
                  loading={keyLoading}
                  placeholder="All keys"
                  width={28}
                />
              </InlineField>
            )}
          </Stack>
          <CollapsableSection label="Time override" isOpen={false}>
            <Stack gap={0}>
              <InlineField label="From" labelWidth={16} tooltip="Absolute start time (optional)">
                <input
                  type="datetime-local"
                  value={query.timeOverrideFrom ?? ''}
                  onChange={onTimeOverrideFromChange}
                  style={{ height: 32, padding: '0 8px', border: '1px solid var(--border-medium)', borderRadius: 2, background: 'var(--background-primary)', color: 'var(--text-primary)', fontSize: 14 }}
                />
              </InlineField>
              <InlineField label="To" labelWidth={16} tooltip="Absolute end time (optional)">
                <input
                  type="datetime-local"
                  value={query.timeOverrideTo ?? ''}
                  onChange={onTimeOverrideToChange}
                  style={{ height: 32, padding: '0 8px', border: '1px solid var(--border-medium)', borderRadius: 2, background: 'var(--background-primary)', color: 'var(--text-primary)', fontSize: 14 }}
                />
              </InlineField>
            </Stack>
          </CollapsableSection>
        </>
      )}

      {queryType === 'events' && (
        <>
          <Stack gap={1}>
            <InlineField label="Source" labelWidth={16} tooltip="FSW source identifier (optional)">
              <Combobox
                id="query-editor-event-source"
                options={eventSourceOptions}
                value={query.source ?? null}
                onChange={onSourceChange}
                isClearable
                loading={eventSourceLoading}
                placeholder="All sources"
                width={28}
              />
            </InlineField>
          </Stack>
          <CollapsableSection label="Time override" isOpen={false}>
            <Stack gap={0}>
              <InlineField label="From" labelWidth={16} tooltip="Absolute start time (optional)">
                <input
                  type="datetime-local"
                  value={query.timeOverrideFrom ?? ''}
                  onChange={onTimeOverrideFromChange}
                  style={{ height: 32, padding: '0 8px', border: '1px solid var(--border-medium)', borderRadius: 2, background: 'var(--background-primary)', color: 'var(--text-primary)', fontSize: 14 }}
                />
              </InlineField>
              <InlineField label="To" labelWidth={16} tooltip="Absolute end time (optional)">
                <input
                  type="datetime-local"
                  value={query.timeOverrideTo ?? ''}
                  onChange={onTimeOverrideToChange}
                  style={{ height: 32, padding: '0 8px', border: '1px solid var(--border-medium)', borderRadius: 2, background: 'var(--background-primary)', color: 'var(--text-primary)', fontSize: 14 }}
                />
              </InlineField>
            </Stack>
          </CollapsableSection>
        </>
      )}
    </Stack>
  );
}
