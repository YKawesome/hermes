import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { QueryEditor } from './QueryEditor';
import { DataSource } from '../datasource';
import { MyDataSourceOptions, MyQuery } from '../types';
import { QueryEditorProps } from '@grafana/data';

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
    getEventSources: jest.fn().mockResolvedValue(['fsw-1', 'fsw-2']),
    ...overrides,
  } as unknown as DataSource;
}

function buildProps(
  overrides?: Partial<QueryEditorProps<DataSource, MyQuery, MyDataSourceOptions>>
): QueryEditorProps<DataSource, MyQuery, MyDataSourceOptions> {
  return {
    query: { refId: 'A', queryType: 'telemetry' } as MyQuery,
    onChange: jest.fn(),
    onRunQuery: jest.fn(),
    datasource: mockDatasource(),
    ...overrides,
  } as QueryEditorProps<DataSource, MyQuery, MyDataSourceOptions>;
}

describe('QueryEditor — Telemetry', () => {
  it('renders query type toggle and telemetry dropdowns', async () => {
    render(<QueryEditor {...buildProps()} />);

    expect(screen.getByRole('radio', { name: /Telemetry/ })).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: /Events/ })).toBeInTheDocument();
    expect(screen.getByRole('combobox', { name: /Component/ })).toBeInTheDocument();
    expect(screen.getByRole('combobox', { name: /Channel/ })).toBeInTheDocument();
    expect(screen.getByRole('combobox', { name: /Source/ })).toBeInTheDocument();
  });

  it('shows Key dropdown for compound channels', async () => {
    const ds = mockDatasource({
      getKeys: jest.fn().mockResolvedValue(['value', 'value.x', 'value.y']),
    });
    render(
      <QueryEditor
        {...buildProps({
          datasource: ds,
          query: { refId: 'A', queryType: 'telemetry', component: 'CDH', channel: 'Attitude' } as MyQuery,
        })}
      />
    );

    await waitFor(() => {
      expect(screen.getByRole('combobox', { name: /Key/ })).toBeInTheDocument();
    });
  });

  it('hides Key dropdown for scalar channels', async () => {
    const ds = mockDatasource({
      getKeys: jest.fn().mockResolvedValue(['value']),
    });
    render(
      <QueryEditor
        {...buildProps({
          datasource: ds,
          query: { refId: 'A', queryType: 'telemetry', component: 'CDH', channel: 'Temperature' } as MyQuery,
        })}
      />
    );

    await waitFor(() => {
      expect(ds.getKeys).toHaveBeenCalled();
    });

    expect(screen.queryByRole('combobox', { name: /Key/ })).not.toBeInTheDocument();
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
          query: { refId: 'A', queryType: 'telemetry', component: 'CDH' } as MyQuery,
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
          query: { refId: 'A', queryType: 'telemetry', component: 'CDH', channel: 'Temperature' } as MyQuery,
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
          query: { refId: 'A', queryType: 'telemetry', component: 'CDH' } as MyQuery,
        })}
      />
    );

    await waitFor(() => {
      expect(ds.getChannels).toHaveBeenCalled();
    });

    expect(ds.getKeys).not.toHaveBeenCalled();
  });

  it('displays existing telemetry query values', async () => {
    const ds = mockDatasource({
      getKeys: jest.fn().mockResolvedValue(['value', 'value.x', 'value.y']),
    });
    render(
      <QueryEditor
        {...buildProps({
          datasource: ds,
          query: {
            refId: 'A',
            queryType: 'telemetry',
            component: 'CDH',
            channel: 'Attitude',
            source: 'fsw-1',
            key: 'value.x',
          } as MyQuery,
        })}
      />
    );

    expect(screen.getByDisplayValue('CDH')).toBeInTheDocument();
    expect(screen.getByDisplayValue('Attitude')).toBeInTheDocument();
    expect(screen.getByDisplayValue('fsw-1')).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByDisplayValue('value.x')).toBeInTheDocument();
    });
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

  it('does not load event resources when in telemetry mode', async () => {
    const ds = mockDatasource();
    render(<QueryEditor {...buildProps({ datasource: ds })} />);

    await waitFor(() => {
      expect(ds.getComponents).toHaveBeenCalled();
    });

    expect(ds.getEventSources).not.toHaveBeenCalled();
  });
});

describe('QueryEditor — Events', () => {
  it('renders only source dropdown when queryType is events', async () => {
    render(
      <QueryEditor
        {...buildProps({
          query: { refId: 'A', queryType: 'events' } as MyQuery,
        })}
      />
    );

    expect(screen.getByRole('combobox', { name: /Source/ })).toBeInTheDocument();
    expect(screen.queryByRole('combobox', { name: /Component/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('combobox', { name: /Event name/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('combobox', { name: /Severity/ })).not.toBeInTheDocument();
  });

  it('hides telemetry fields when queryType is events', async () => {
    render(
      <QueryEditor
        {...buildProps({
          query: { refId: 'A', queryType: 'events' } as MyQuery,
        })}
      />
    );

    expect(screen.queryByRole('combobox', { name: /Channel/ })).not.toBeInTheDocument();
  });

  it('loads event sources on mount', async () => {
    const ds = mockDatasource();
    render(
      <QueryEditor
        {...buildProps({
          datasource: ds,
          query: { refId: 'A', queryType: 'events' } as MyQuery,
        })}
      />
    );

    await waitFor(() => {
      expect(ds.getEventSources).toHaveBeenCalledTimes(1);
    });
  });

  it('does not load telemetry resources when in events mode', async () => {
    const ds = mockDatasource();
    render(
      <QueryEditor
        {...buildProps({
          datasource: ds,
          query: { refId: 'A', queryType: 'events' } as MyQuery,
        })}
      />
    );

    await waitFor(() => {
      expect(ds.getEventSources).toHaveBeenCalled();
    });

    expect(ds.getComponents).not.toHaveBeenCalled();
    expect(ds.getChannels).not.toHaveBeenCalled();
    expect(ds.getSources).not.toHaveBeenCalled();
    expect(ds.getKeys).not.toHaveBeenCalled();
  });

  it('displays existing event source value', async () => {
    render(
      <QueryEditor
        {...buildProps({
          query: {
            refId: 'A',
            queryType: 'events',
            source: 'fsw-1',
          } as MyQuery,
        })}
      />
    );

    expect(screen.getByDisplayValue('fsw-1')).toBeInTheDocument();
  });

  it('handles event source fetch errors gracefully', async () => {
    const ds = mockDatasource({
      getEventSources: jest.fn().mockRejectedValue(new Error('Network error')),
    });
    render(
      <QueryEditor
        {...buildProps({
          datasource: ds,
          query: { refId: 'A', queryType: 'events' } as MyQuery,
        })}
      />
    );

    await waitFor(() => {
      expect(ds.getEventSources).toHaveBeenCalled();
    });

    expect(screen.getByRole('combobox', { name: /Source/ })).toBeInTheDocument();
  });
});
