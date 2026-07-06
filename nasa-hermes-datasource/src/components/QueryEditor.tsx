import React, { useEffect, useState } from 'react';
import { CollapsableSection, ComboboxOption, DateTimePicker, InlineField, MultiCombobox, RadioButtonGroup } from '@grafana/ui';
import { dateTime, DateTime, QueryEditorProps, SelectableValue } from '@grafana/data';
import { DataSource } from '../datasource';
import { MyDataSourceOptions, MyQuery, QueryType, TimeField } from '../types';

type Props = QueryEditorProps<DataSource, MyQuery, MyDataSourceOptions>;

const QUERY_TYPE_OPTIONS: Array<SelectableValue<QueryType>> = [
  { label: 'Telemetry', value: 'telemetry' },
  { label: 'Events', value: 'events' },
];

const TIME_FIELD_OPTIONS: Array<SelectableValue<TimeField>> = [
  { label: 'TIME', value: 'time' },
  { label: 'ERT', value: 'ert' },
];

function toOptions(values: string[]): Array<ComboboxOption<string>> {
  return values.map((v) => ({ label: v, value: v }));
}

function toChannelOptions(entries: Array<{ component: string; name: string }>): Array<ComboboxOption<string>> {
  const nameCounts = new Map<string, number>();
  for (const e of entries) {
    nameCounts.set(e.name, (nameCounts.get(e.name) ?? 0) + 1);
  }
  return entries.map((e) => {
    const isDuplicate = (nameCounts.get(e.name) ?? 0) > 1;
    return {
      label: isDuplicate ? `${e.name} (${e.component})` : e.name,
      description: isDuplicate ? e.component : undefined,
      value: `${e.component}:${e.name}`,
    };
  });
}

function channelName(composite: string): string {
  const idx = composite.indexOf(':');
  return idx === -1 ? composite : composite.substring(idx + 1);
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

  // --- Handlers ---

  const onQueryTypeChange = (value: QueryType) => {
    const updated: MyQuery = {
      ...query,
      queryType: value,
      components: [],
      channels: [],
      keys: [],
      sources: [],
    };
    onChange(updated);
    if (value === 'events') {
      onRunQuery();
    }
  };

  const onComponentChange = (options: Array<ComboboxOption<string>>) => {
    onChange({ ...query, components: options.map(({ value }) => value), channels: [], keys: [], sources: [] });
    onRunQuery();
  };

  const onChannelChange = (options: Array<ComboboxOption<string>>) => {
    const updated: MyQuery = { ...query, channels: options.map(({ value }) => value), keys: [], sources: [] };
    onChange(updated);
    if (updated.components && updated.channels && updated.components.length && updated.channels.length) {
      onRunQuery();
    }
  };

  const onSourceChange = (options: Array<ComboboxOption<string>>) => {
    const updated: MyQuery = { ...query, sources: options.map(({ value }) => value) };
    onChange(updated);
    if (queryType === 'telemetry' && updated.components && updated.channels && updated.components.length && updated.channels.length) {
      onRunQuery();
    }
    if (queryType === 'events') {
      onRunQuery();
    }
  };

  const onKeyChange = (options: Array<ComboboxOption<string>>) => {
    const updated: MyQuery = { ...query, keys: options.map(({ value }) => value) };
    onChange(updated);
    if (updated.components && updated.channels && updated.components.length && updated.channels.length) {
      onRunQuery();
    }
  };

  const onTimeFieldChange = (value: TimeField) => {
    onChange({ ...query, timeField: value });
    onRunQuery();
  };

  const onTimeOverrideFromChange = (date?: DateTime) => {
    onChange({ ...query, timeOverrideFrom: date ? date.toISOString() : undefined });
    onRunQuery();
  };

  const onTimeOverrideToChange = (date?: DateTime) => {
    onChange({ ...query, timeOverrideTo: date ? date.toISOString() : undefined });
    onRunQuery();
  };

  // --- Telemetry data loading ---

  useEffect(() => {
    if (queryType !== 'telemetry') {
      return;
    }
    const loadComponents = async () => {
      setComponentLoading(true);
      datasource
        .getComponents()
        .then((values) => setComponentOptions(toOptions(values)))
        .catch(() => setComponentOptions([]))
        .finally(() => setComponentLoading(false));
    };
    loadComponents();
  }, [datasource, queryType]);

  useEffect(() => {
    if (queryType !== 'telemetry') {
      return;
    }
    const loadSources = async () => {
      setSourceLoading(true);
      datasource
        .getSources()
        .then((values) => setSourceOptions(toOptions(values)))
        .catch(() => setSourceOptions([]))
        .finally(() => setSourceLoading(false));
    };
    loadSources();
  }, [datasource, queryType]);

  useEffect(() => {
    if (queryType !== 'telemetry' || !query.components || !query.components.length) {
      setTimeout(() => setChannelOptions([]), 0);
      return;
    }
    const loadChannels = async () => {
      setChannelLoading(true);
      datasource
        .getChannels(query.components)
        .then((entries) => {
          const options = toChannelOptions(entries);
          setChannelOptions(options);

          // Auto select if there is only one channel
          if (options.length === 1) {
            onChannelChange(options);
          }
        })
        .catch(() => setChannelOptions([]))
        .finally(() => setChannelLoading(false));
    };
    loadChannels();
    // We do not need onChannelChange in deps
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [datasource, queryType, query.components]);

  useEffect(() => {
    if (queryType !== 'telemetry' || !query.components || !query.channels || !query.components.length || !query.channels.length) {
      setTimeout(() => setKeyOptions([]), 0);
      return;
    }
    const loadKeys = async () => {
      setKeyLoading(true);
      const channels = query.channels.map(channelName);
      datasource
        .getKeys(query.components, channels)
        .then((values) => setKeyOptions(toOptions(values)))
        .catch(() => setKeyOptions([]))
        .finally(() => setKeyLoading(false));
    }
    loadKeys();
  }, [datasource, queryType, query.components, query.channels]);

  // --- Event data loading ---

  useEffect(() => {
    if (queryType !== 'events') {
      return;
    }
    const loadEventSources = async () => {
      setEventSourceLoading(true);
      datasource
        .getEventSources()
        .then((values) => setEventSourceOptions(toOptions(values)))
        .catch(() => setEventSourceOptions([]))
        .finally(() => setEventSourceLoading(false));
    }
    loadEventSources();
  }, [datasource, queryType]);

  return (
    <>
      <div style={{ marginTop: 8, marginBottom: 8 }}>
        <RadioButtonGroup
          id="query-editor-query-type"
          options={QUERY_TYPE_OPTIONS}
          value={queryType}
          onChange={onQueryTypeChange}
          size="sm"
          fullWidth={true}
        />
      </div>

      {queryType === 'telemetry' && (
        <>
          <InlineField label="Component" labelWidth={16} tooltip="FSW component or module" required>
            <MultiCombobox
              id="query-editor-component"
              data-testid="query-editor-component"
              options={componentOptions}
              value={query.components}
              onChange={onComponentChange}
              loading={componentLoading}
              placeholder="Select component"
              width={28}
            />
          </InlineField>
          <InlineField label="Channel" labelWidth={16} tooltip="Telemetry channel name" required>
            <MultiCombobox
              key={`channel-${query.components?.join(',')}`}
              id="query-editor-channel"
              data-testid="query-editor-channel"
              options={channelOptions}
              value={query.channels}
              onChange={onChannelChange}
              loading={channelLoading}
              disabled={!query.components || !query.components.length}
              placeholder={query.components && query.components.length ? 'Select channel' : 'Select a component first'}
              width={28}
            />
          </InlineField>
          <InlineField label="Source" labelWidth={16} tooltip="FSW source identifier (optional)">
            <MultiCombobox
              id="query-editor-source"
              data-testid="query-editor-source"
              options={sourceOptions}
              value={query.sources}
              onChange={onSourceChange}
              isClearable
              loading={sourceLoading}
              placeholder="All sources"
              width={28}
            />
          </InlineField>
          {keyOptions.length > 1 && (
            <InlineField label="Key" labelWidth={16} tooltip="Value field path for compound channels">
              <MultiCombobox
                id="query-editor-key"
                data-testid="query-editor-key"
                options={keyOptions}
                value={query.keys}
                onChange={onKeyChange}
                isClearable
                loading={keyLoading}
                placeholder="All keys"
                width={28}
              />
            </InlineField>
          )}
        </>
      )}

      {queryType === 'events' && (
        <>
          <InlineField label="Source" labelWidth={16} tooltip="FSW source identifier (optional)">
            <MultiCombobox
              id="query-editor-event-source"
              data-testid="query-editor-event-source"
              options={eventSourceOptions}
              value={query.sources}
              onChange={onSourceChange}
              isClearable
              loading={eventSourceLoading}
              placeholder="All sources"
              width={28}
            />
          </InlineField>
        </>
      )}

      <div style={{ marginTop: 8, marginBottom: 8 }}>
        <RadioButtonGroup
          id="query-editor-time-field"
          options={TIME_FIELD_OPTIONS}
          value={query.timeField ?? 'time'}
          onChange={onTimeFieldChange}
          size="sm"
          fullWidth={false}
        />
      </div>
      <CollapsableSection label="Time override" isOpen={false}>
        <InlineField label="From" labelWidth={16} tooltip="Absolute start time (optional)">
          <DateTimePicker
            date={query.timeOverrideFrom ? dateTime(query.timeOverrideFrom) : undefined}
            onChange={onTimeOverrideFromChange}
            clearable
          />
        </InlineField>
        <InlineField label="To" labelWidth={16} tooltip="Absolute end time (optional)">
          <DateTimePicker
            date={query.timeOverrideTo ? dateTime(query.timeOverrideTo) : undefined}
            onChange={onTimeOverrideToChange}
            clearable
          />
        </InlineField>
      </CollapsableSection>
    </>
  );
}
