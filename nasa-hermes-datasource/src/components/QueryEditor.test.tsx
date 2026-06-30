import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { QueryEditor } from './QueryEditor';
import { DataSource } from '../datasource';
import { MyQuery } from '../types';
import { QueryEditorProps } from '@grafana/data';
import { MyDataSourceOptions } from '../types';

beforeAll(() => {
  global.IntersectionObserver = class IntersectionObserver {
    constructor() {}
    observe() {}
    unobserve() {}
    disconnect() {}
  } as any;

  HTMLCanvasElement.prototype.getContext = (() => ({
    measureText: (text: string) => ({ width: text.length * 8 }),
  })) as any;
});

function mockDatasource(overrides?: Partial<DataSource>): DataSource {
  return {
    getComponents: jest.fn().mockResolvedValue(['CDH', 'Sensors', 'Power']),
    getChannels: jest.fn().mockResolvedValue(['Temperature', 'Voltage']),
    getSources: jest.fn().mockResolvedValue(['fsw-1', 'fsw-2']),
    getKeys: jest.fn().mockResolvedValue(['value', 'value.x', 'value.y']),
    ...overrides,
  } as unknown as DataSource;
}

function buildProps(
  overrides?: Partial<QueryEditorProps<DataSource, MyQuery, MyDataSourceOptions>>
): QueryEditorProps<DataSource, MyQuery, MyDataSourceOptions> {
  return {
    query: { refId: 'A' } as MyQuery,
    onChange: jest.fn(),
    onRunQuery: jest.fn(),
    datasource: mockDatasource(),
    ...overrides,
  } as QueryEditorProps<DataSource, MyQuery, MyDataSourceOptions>;
}

describe('QueryEditor', () => {
  it('renders all five dropdowns', async () => {
    render(<QueryEditor {...buildProps()} />);

    expect(screen.getByRole('combobox', { name: /Component/ })).toBeInTheDocument();
    expect(screen.getByRole('combobox', { name: /Channel/ })).toBeInTheDocument();
    expect(screen.getByRole('combobox', { name: /Source/ })).toBeInTheDocument();
    expect(screen.getByRole('combobox', { name: /Key/ })).toBeInTheDocument();
    expect(screen.getByRole('combobox', { name: /Value type/ })).toBeInTheDocument();
  });

  it('loads component options on mount', async () => {
    const ds = mockDatasource();
    render(<QueryEditor {...buildProps({ datasource: ds })} />);

    await waitFor(() => {
      expect(ds.getComponents).toHaveBeenCalledTimes(1);
    });
  });

  it('loads source options on mount', async () => {
    const ds = mockDatasource();
    render(<QueryEditor {...buildProps({ datasource: ds })} />);

    await waitFor(() => {
      expect(ds.getSources).toHaveBeenCalledTimes(1);
    });
  });

  it('loads channels when component is set', async () => {
    const ds = mockDatasource();
    render(
      <QueryEditor
        {...buildProps({
          datasource: ds,
          query: { refId: 'A', component: 'CDH' } as MyQuery,
        })}
      />
    );

    await waitFor(() => {
      expect(ds.getChannels).toHaveBeenCalledWith('CDH');
    });
  });

  it('does not load channels when component is not set', async () => {
    const ds = mockDatasource();
    render(<QueryEditor {...buildProps({ datasource: ds })} />);

    await waitFor(() => {
      expect(ds.getComponents).toHaveBeenCalled();
    });

    expect(ds.getChannels).not.toHaveBeenCalled();
  });

  it('loads keys when component and channel are set', async () => {
    const ds = mockDatasource();
    render(
      <QueryEditor
        {...buildProps({
          datasource: ds,
          query: { refId: 'A', component: 'CDH', channel: 'Temperature' } as MyQuery,
        })}
      />
    );

    await waitFor(() => {
      expect(ds.getKeys).toHaveBeenCalledWith('CDH', 'Temperature');
    });
  });

  it('does not load keys when channel is not set', async () => {
    const ds = mockDatasource();
    render(
      <QueryEditor
        {...buildProps({
          datasource: ds,
          query: { refId: 'A', component: 'CDH' } as MyQuery,
        })}
      />
    );

    await waitFor(() => {
      expect(ds.getChannels).toHaveBeenCalled();
    });

    expect(ds.getKeys).not.toHaveBeenCalled();
  });

  it('displays existing query values', () => {
    render(
      <QueryEditor
        {...buildProps({
          query: {
            refId: 'A',
            component: 'CDH',
            channel: 'Temperature',
            source: 'fsw-1',
            key: 'value.x',
            valueType: 'int',
          } as MyQuery,
        })}
      />
    );

    expect(screen.getByDisplayValue('CDH')).toBeInTheDocument();
    expect(screen.getByDisplayValue('Temperature')).toBeInTheDocument();
    expect(screen.getByDisplayValue('fsw-1')).toBeInTheDocument();
    expect(screen.getByDisplayValue('value.x')).toBeInTheDocument();
    expect(screen.getByDisplayValue('Int')).toBeInTheDocument();
  });

  it('handles resource fetch errors gracefully', async () => {
    const ds = mockDatasource({
      getComponents: jest.fn().mockRejectedValue(new Error('Network error')),
      getSources: jest.fn().mockRejectedValue(new Error('Network error')),
    });
    render(<QueryEditor {...buildProps({ datasource: ds })} />);

    await waitFor(() => {
      expect(ds.getComponents).toHaveBeenCalled();
    });

    // Should render without crashing — dropdowns still present
    expect(screen.getByRole('combobox', { name: /Component/ })).toBeInTheDocument();
  });

  it('does not load channels or keys when no component is selected', async () => {
    const ds = mockDatasource();
    render(<QueryEditor {...buildProps({ datasource: ds })} />);

    await waitFor(() => {
      expect(ds.getComponents).toHaveBeenCalled();
    });

    expect(ds.getChannels).not.toHaveBeenCalled();
    expect(ds.getKeys).not.toHaveBeenCalled();
  });
});
