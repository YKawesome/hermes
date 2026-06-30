import React, { useCallback, useEffect, useState } from 'react';
import { Combobox, InlineField, Stack } from '@grafana/ui';
import { QueryEditorProps } from '@grafana/data';
import type { ComboboxOption } from '@grafana/ui';
import { DataSource } from '../datasource';
import { MyDataSourceOptions, MyQuery, VALUE_TYPE_OPTIONS, ValueType } from '../types';

type Props = QueryEditorProps<DataSource, MyQuery, MyDataSourceOptions>;

function toOptions(values: string[]): Array<ComboboxOption<string>> {
  return values.map((v) => ({ label: v, value: v }));
}

export function QueryEditor({ query, onChange, onRunQuery, datasource }: Props) {
  const [componentOptions, setComponentOptions] = useState<Array<ComboboxOption<string>>>([]);
  const [channelOptions, setChannelOptions] = useState<Array<ComboboxOption<string>>>([]);
  const [sourceOptions, setSourceOptions] = useState<Array<ComboboxOption<string>>>([]);
  const [keyOptions, setKeyOptions] = useState<Array<ComboboxOption<string>>>([]);

  const [componentLoading, setComponentLoading] = useState(false);
  const [channelLoading, setChannelLoading] = useState(false);
  const [sourceLoading, setSourceLoading] = useState(false);
  const [keyLoading, setKeyLoading] = useState(false);

  // Load components on mount
  useEffect(() => {
    setComponentLoading(true);
    datasource
      .getComponents()
      .then((values) => setComponentOptions(toOptions(values)))
      .catch(() => setComponentOptions([]))
      .finally(() => setComponentLoading(false));
  }, [datasource]);

  // Load sources on mount
  useEffect(() => {
    setSourceLoading(true);
    datasource
      .getSources()
      .then((values) => setSourceOptions(toOptions(values)))
      .catch(() => setSourceOptions([]))
      .finally(() => setSourceLoading(false));
  }, [datasource]);

  // Load channels when component changes
  useEffect(() => {
    if (!query.component) {
      setChannelOptions([]);
      return;
    }
    setChannelLoading(true);
    datasource
      .getChannels(query.component)
      .then((values) => setChannelOptions(toOptions(values)))
      .catch(() => setChannelOptions([]))
      .finally(() => setChannelLoading(false));
  }, [datasource, query.component]);

  // Load keys when component + channel are set
  useEffect(() => {
    if (!query.component || !query.channel) {
      setKeyOptions([]);
      return;
    }
    setKeyLoading(true);
    datasource
      .getKeys(query.component, query.channel)
      .then((values) => setKeyOptions(toOptions(values)))
      .catch(() => setKeyOptions([]))
      .finally(() => setKeyLoading(false));
  }, [datasource, query.component, query.channel]);

  const onComponentChange = useCallback(
    (option: ComboboxOption<string>) => {
      onChange({ ...query, component: option.value, channel: undefined, key: undefined });
    },
    [onChange, query]
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
      if (updated.component && updated.channel) {
        onRunQuery();
      }
    },
    [onChange, onRunQuery, query]
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

  const onValueTypeChange = useCallback(
    (option: ComboboxOption<string> | null) => {
      const updated = { ...query, valueType: (option?.value as ValueType) ?? undefined };
      onChange(updated);
      if (updated.component && updated.channel) {
        onRunQuery();
      }
    },
    [onChange, onRunQuery, query]
  );

  return (
    <Stack direction="column" gap={0}>
      <Stack gap={0}>
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
            id="query-editor-channel"
            options={channelOptions}
            value={query.channel ?? null}
            onChange={onChannelChange}
            loading={channelLoading}
            disabled={!query.component}
            placeholder="Select channel"
            width={28}
          />
        </InlineField>
      </Stack>
      <Stack gap={0}>
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
        <InlineField label="Key" labelWidth={16} tooltip="Value field path (optional, defaults to value)">
          <Combobox
            id="query-editor-key"
            options={keyOptions}
            value={query.key ?? null}
            onChange={onKeyChange}
            isClearable
            loading={keyLoading}
            disabled={!query.component || !query.channel}
            placeholder="Default (value)"
            width={28}
          />
        </InlineField>
      </Stack>
      <Stack gap={0}>
        <InlineField label="Value type" labelWidth={16} tooltip="Column type to return (defaults to floating)">
          <Combobox
            id="query-editor-value-type"
            options={VALUE_TYPE_OPTIONS}
            value={query.valueType ?? null}
            onChange={onValueTypeChange}
            isClearable
            placeholder="Default (floating)"
            width={28}
          />
        </InlineField>
      </Stack>
    </Stack>
  );
}
