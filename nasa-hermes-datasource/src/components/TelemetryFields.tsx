import React, { useEffect, useState } from 'react';
import { Combobox, ComboboxOption, InlineField, MultiCombobox } from '@grafana/ui';
import { getTemplateSrv } from '@grafana/runtime';
import { DataSource } from '../datasource';
import { Aggregation, ChannelRef, KeyRef, MyQuery } from '../types';

interface TelemetryFieldsProps {
  query: MyQuery;
  onChange: (query: MyQuery) => void;
  onRunQuery: () => void;
  datasource: DataSource;
}

const AGGREGATION_OPTIONS: Array<ComboboxOption<Aggregation>> = [
  { label: 'Average', value: 'avg' },
  { label: 'Min', value: 'min' },
  { label: 'Max', value: 'max' },
  { label: 'Count', value: 'count' },
  { label: 'First', value: 'first' },
  { label: 'Last', value: 'last' },
  { label: 'Sum', value: 'sum' },
  { label: 'Derivative', value: 'deriv' },
  { label: 'Raw (none)', value: 'raw' },
];

function toOptions(values: string[]): Array<ComboboxOption<string>> {
  return values.map((v) => ({ label: v, value: v }));
}

function keyRefToValue(k: KeyRef): string {
  return JSON.stringify(k);
}

function valueToKeyRef(v: string): KeyRef {
  return JSON.parse(v) as KeyRef;
}

function toKeyOptions(entries: KeyRef[]): Array<ComboboxOption<string>> {
  return entries.map((e) => ({
    label: e.key,
    value: keyRefToValue(e),
  }));
}

function keyValues(keys: KeyRef[]): string[] {
  return keys.map(keyRefToValue);
}

function channelKeyId(component: string, channel: string): string {
  return `${component}\0${channel}`;
}

function groupKeysByChannel(entries: KeyRef[]): Record<string, KeyRef[]> {
  const grouped: Record<string, KeyRef[]> = {};
  for (const e of entries) {
    const id = channelKeyId(e.component, e.channel);
    if (!grouped[id]) {
      grouped[id] = [];
    }
    grouped[id].push(e);
  }
  return grouped;
}

function channelToKey(ch: ChannelRef): string {
  return JSON.stringify(ch);
}

function keyToChannel(key: string): ChannelRef {
  return JSON.parse(key) as ChannelRef;
}

function toChannelOptions(entries: ChannelRef[]): Array<ComboboxOption<string>> {
  return entries.map((e) => ({
    label: `${e.component}.${e.name}`,
    description: e.component,
    value: channelToKey(e),
  }));
}

function channelValuesOrOptions(channels: ChannelRef[]): Array<ComboboxOption<string>> | string[] {
  const hasVariables = channels.some(ch => ch.component.includes('$') || ch.name.includes('$'));

  if (!hasVariables) {
    return channels.map(channelToKey);
  }

  return channels.map(ch => ({
    label: `${ch.component}.${ch.name}`,
    value: channelToKey(ch),
  }));
}

export function TelemetryFields({ query, onChange, onRunQuery, datasource }: TelemetryFieldsProps) {
  const [channelOptions, setChannelOptions] = useState<Array<ComboboxOption<string>>>([]);
  const [sourceOptions, setSourceOptions] = useState<Array<ComboboxOption<string>>>([]);
  const [keysByChannel, setKeysByChannel] = useState<Record<string, KeyRef[]>>({});

  const [channelLoading, setChannelLoading] = useState(false);
  const [sourceLoading, setSourceLoading] = useState(false);
  const [keyLoading, setKeyLoading] = useState(false);

  // --- Helpers ---

  const getChannelOptionsWithVariables = async (inputValue: string): Promise<Array<ComboboxOption<string>>> => {
    const hasVariable = inputValue.includes('$');

    // don't display options when variable is detected
    if (hasVariable) {
      return [];
    }

    return channelOptions.filter(opt =>
      opt.label?.toLowerCase().includes(inputValue.toLowerCase())
    );
  };

  // --- Handlers ---

  const onChannelChange = (options: Array<ComboboxOption<string>>) => {
    const templateSrv = getTemplateSrv();

    const channels = options
      .map(({ value, label }) => {
        const valueStr = typeof value === 'string' ? value : String(value);

        if (valueStr.includes('$') || label?.includes('$')) {
          const input = label || valueStr;
          const varMatches = input.match(/\$\w+/g) || [];

          // if any variable is not resolved, return null
          for (const varName of varMatches) {
            if (templateSrv.replace(varName) === varName) {
              return null;
            }
          }

          const expanded = templateSrv.replace(input);
          const match = channelOptions.find(opt => opt.label === expanded);

          if (!match) {
            return { component: input, name: '' };
          }

          const matchedChannel = keyToChannel(match.value);

          let resultComponent = matchedChannel.component;
          let resultName = matchedChannel.name;

          for (const varName of varMatches) {
            const varValue = templateSrv.replace(varName);
            resultComponent = resultComponent.replace(varValue, varName);
            resultName = resultName.replace(varValue, varName);
          }

          return { component: resultComponent, name: resultName };
        }

        return keyToChannel(valueStr);
      })
      .filter((ch): ch is ChannelRef => ch !== null);

    const updated: MyQuery = { ...query, channels, keys: [], sources: [] };
    onChange(updated);
    if (channels.length) {
      onRunQuery();
    }
  };

  const onSourceChange = (options: Array<ComboboxOption<string>>) => {
    const updated: MyQuery = { ...query, sources: options.map(({ value }) => value) };
    onChange(updated);
    if (updated.channels && updated.channels.length) {
      onRunQuery();
    }
  };

  const onChannelKeyChange = (chComponent: string, chName: string, options: Array<ComboboxOption<string>>) => {
    const id = channelKeyId(chComponent, chName);
    const newKeys = options.map(({ value }) => valueToKeyRef(value));
    const otherKeys = (query.keys ?? []).filter(
      (k) => channelKeyId(k.component, k.channel) !== id
    );

    const channels = newKeys.length === 0
      ? (query.channels ?? []).filter((ch) => !(ch.component === chComponent && ch.name === chName))
      : query.channels;
    const updated: MyQuery = { ...query, channels, keys: [...otherKeys, ...newKeys] };
    onChange(updated);
    if (updated.channels.length) {
      onRunQuery();
    }
  };

  const onAggregationChange = (option: ComboboxOption<Aggregation>) => {
    onChange({ ...query, aggregation: option.value });
    onRunQuery();
  };

  // --- Data loading ---

  useEffect(() => {
    const loadChannels = async () => {
      setChannelLoading(true);
      datasource
        .getChannels()
        .then((entries) => setChannelOptions(toChannelOptions(entries)))
        .catch(() => setChannelOptions([]))
        .finally(() => setChannelLoading(false));
    };
    loadChannels();
  }, [datasource]);

  useEffect(() => {
    const loadSources = async () => {
      setSourceLoading(true);
      datasource
        .getSources()
        .then((values) => setSourceOptions(toOptions(values)))
        .catch(() => setSourceOptions([]))
        .finally(() => setSourceLoading(false));
    };
    loadSources();
  }, [datasource]);

  useEffect(() => {
    if (!query.channels || !query.channels.length) {
      setTimeout(() => setKeysByChannel({}), 0);
      return;
    }
    const loadKeys = async () => {
      setKeyLoading(true);
      datasource
        .getKeys(query.channels)
        .then((entries) => setKeysByChannel(groupKeysByChannel(entries)))
        .catch(() => setKeysByChannel({}))
        .finally(() => setKeyLoading(false));
    }
    loadKeys();
  }, [datasource, query.channels]);

  useEffect(() => {
    const currentKeys = query.keys ?? [];
    let added = false;
    const newKeys = [...currentKeys];
    for (const [id, chKeys] of Object.entries(keysByChannel)) {
      if (chKeys.length <= 1) {
        continue;
      }
      const hasSelection = currentKeys.some(
        (k) => channelKeyId(k.component, k.channel) === id
      );
      if (!hasSelection) {
        newKeys.push(...chKeys);
        added = true;
      }
    }
    if (added) {
      onChange({ ...query, keys: newKeys });
    }
  }, [keysByChannel, query, onChange]);

  return (
    <>
      <InlineField label="Channel" labelWidth={16} tooltip="Telemetry channel name" grow shrink required>
        <MultiCombobox
          id="query-editor-channel"
          data-testid="query-editor-channel"
          options={getChannelOptionsWithVariables}
          value={channelValuesOrOptions(query.channels ?? [])}
          onChange={onChannelChange}
          loading={channelLoading}
          placeholder="Select channel"
          prefixIcon="channel-add"
          createCustomValue={true}
          customValueDescription="Use template variable"
        />
      </InlineField>
      <InlineField label="Aggregation" labelWidth={16} tooltip="Data aggregation method used when the data interval is smaller than the requested interval. The requested interval can be found in the query options at the top of this query." grow shrink>
        <Combobox
          options={AGGREGATION_OPTIONS}
          value={query.aggregation ?? 'avg'}
          onChange={onAggregationChange}
          isClearable={false}
          prefixIcon="calculator-alt"
        />
      </InlineField>
      <InlineField label="Source" labelWidth={16} tooltip="FSW source identifier (optional)" grow shrink>
        <MultiCombobox
          id="query-editor-source"
          data-testid="query-editor-source"
          options={sourceOptions}
          value={query.sources}
          onChange={onSourceChange}
          isClearable
          loading={sourceLoading}
          placeholder="All sources"
          prefixIcon="rocket"
        />
      </InlineField>
      {Object.entries(keysByChannel)
        .filter(([, keys]) => keys.length > 1)
        .map(([id, keys]) => {
          const { component: chComp, channel: chName } = keys[0];
          const chLabel = `${chComp}.${chName}`;
          const selectedForChannel = (query.keys ?? []).filter(
            (k) => channelKeyId(k.component, k.channel) === id
          );
          return (
            <InlineField
              key={id}
              label={chLabel}
              tooltip={`Value field path for ${chLabel}`}
              grow
              shrink
            >
              <MultiCombobox
                id={`query-editor-key-${id}`}
                data-testid={`query-editor-key-${id}`}
                options={toKeyOptions(keys)}
                value={keyValues(selectedForChannel)}
                onChange={(opts) => onChannelKeyChange(chComp, chName, opts)}
                isClearable
                loading={keyLoading}
                placeholder="All keys"
                prefixIcon="key-skeleton-alt"
              />
            </InlineField>
          );
        })}
    </>
  );
}
