// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import { describe, it, expect, afterEach } from 'vitest';
import { HoverPane } from './HoverPane';
import type { ChartDataPoint } from '../hooks/useWeatherChartData';
import { cleanup } from '@testing-library/react';

const START = new Date('2026-06-03T08:00:00Z');

const fullData: ChartDataPoint = {
  distance: 42.1,
  elevation: 1240,
  temp: 18,
  precipProb: 40,
  precipitation: 0.2,
  windSpeed: 23,
  windDeg: 270,
  time: new Date('2026-06-03T12:34:00Z').getTime(),
  isSample: true,
};

describe('HoverPane', () => {
  afterEach(() => {
    cleanup();
  });

  it('shows placeholder text when hoveredData is null', () => {
    render(<HoverPane hoveredData={null} xAxisMode="clock" startTime={START} />);
    expect(screen.getByText(/hover over charts/i)).toBeInTheDocument();
  });

  it('does not show placeholder when hoveredData is provided', () => {
    render(<HoverPane hoveredData={fullData} xAxisMode="clock" startTime={START} />);
    expect(screen.queryByText(/hover over charts/i)).not.toBeInTheDocument();
  });

  it('shows elevation in meters', () => {
    render(<HoverPane hoveredData={fullData} xAxisMode="clock" startTime={START} />);
    expect(screen.getByText(/1240 m/)).toBeInTheDocument();
  });

  it('shows temperature in °C', () => {
    render(<HoverPane hoveredData={fullData} xAxisMode="clock" startTime={START} />);
    expect(screen.getByText(/18°C/)).toBeInTheDocument();
  });

  it('shows wind speed in km/h', () => {
    render(<HoverPane hoveredData={fullData} xAxisMode="clock" startTime={START} />);
    expect(screen.getByText(/23 km\/h/)).toBeInTheDocument();
  });

  it('shows precipitation probability and amount', () => {
    render(<HoverPane hoveredData={fullData} xAxisMode="clock" startTime={START} />);
    expect(screen.getByText(/40%/)).toBeInTheDocument();
    expect(screen.getByText(/0\.2 mm/)).toBeInTheDocument();
  });

  it('shows all four data values for a fully-populated point', () => {
    render(<HoverPane hoveredData={fullData} xAxisMode="clock" startTime={START} />);
    expect(screen.getByText(/1240 m/)).toBeInTheDocument();
    expect(screen.getByText(/18°C/)).toBeInTheDocument();
    expect(screen.getByText(/23 km\/h/)).toBeInTheDocument();
    expect(screen.getByText(/40%/)).toBeInTheDocument();
  });

  it('shows dash for undefined weather values', () => {
    const sparse: ChartDataPoint = { ...fullData, temp: undefined, windSpeed: undefined };
    render(<HoverPane hoveredData={sparse} xAxisMode="clock" startTime={START} />);
    expect(screen.getAllByText('—').length).toBe(2);
  });

  it('shows elapsed time when xAxisMode is elapsed', () => {
    // fullData.time = 2026-06-03T12:34:00Z, START = 2026-06-03T08:00:00Z → 4h 34m elapsed
    render(<HoverPane hoveredData={fullData} xAxisMode="elapsed" startTime={START} />);
    expect(screen.getByText(/4h 34m/)).toBeInTheDocument();
  });

  it('shows distance as a hover row', () => {
    render(<HoverPane hoveredData={fullData} xAxisMode="clock" startTime={START} />);
    expect(screen.getByText('42.1 km')).toBeInTheDocument();
  });
});
