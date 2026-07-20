import React from 'react';
import { Combobox, ComboboxOption, InlineField } from '@grafana/ui';
import { VariableQuery } from '../datasource';

const QUERY_OPTIONS: ComboboxOption[] = [
  { label: 'Components', value: 'components' },
  { label: 'Channels', value: 'channels' },
  { label: 'Sources', value: 'sources' },
  { label: 'Event sources', value: 'event_sources' },
];

interface Props {
  query: VariableQuery;
  onChange: (query: VariableQuery, definition: string) => void;
}

export function VariableQueryEditor({ query, onChange }: Props) {
  return (
    <InlineField label="Query type" labelWidth={20}>
      <Combobox
        options={QUERY_OPTIONS}
        value={query.queryType || 'channels'}
        onChange={(opt) => {
          if (opt?.value) {
            onChange({ ...query, queryType: opt.value }, opt.value);
          }
        }}
        width={30}
      />
    </InlineField>
  );
}
