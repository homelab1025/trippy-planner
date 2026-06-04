import React from 'react';
import type { ChartDataPoint } from '../hooks/useWeatherChartData';
import { formatElapsed } from '../hooks/useWeatherChartData';

interface HoverPaneProps {
  hoveredData: ChartDataPoint | null;
  xAxisMode: 'clock' | 'elapsed';
  startTime: Date;
}

function HoverRow({ icon, value }: { icon: string; value: string }) {
  return (
    <div className="hover-row">
      <span className="hover-row-icon">{icon}</span>
      <span className="hover-row-value">{value}</span>
    </div>
  );
}

const HoverPane: React.FC<HoverPaneProps> = React.memo(({ hoveredData, xAxisMode, startTime }) => {
  if (!hoveredData) {
    return (
      <div className="hover-pane hover-pane--empty">
        <p>Hover over charts to see values here</p>
      </div>
    );
  }

  const timeStr = xAxisMode === 'clock'
    ? new Date(hoveredData.time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    : formatElapsed(hoveredData.time - startTime.getTime());

  return (
    <div className="hover-pane">
      <HoverRow icon="⏱" value={timeStr} />
      <HoverRow icon="→" value={`${hoveredData.distance.toFixed(1)} km`} />
      <HoverRow icon="↑" value={`${Math.round(hoveredData.elevation)} m`} />
      <HoverRow icon="🌡" value={hoveredData.temp != null ? `${Math.round(hoveredData.temp)}°C` : '—'} />
      <HoverRow icon="💨" value={hoveredData.windSpeed != null ? `${Math.round(hoveredData.windSpeed)} km/h` : '—'} />
      <HoverRow
        icon="🌧"
        value={hoveredData.precipProb != null
          ? `${Math.round(hoveredData.precipProb)}% · ${hoveredData.precipitation != null ? hoveredData.precipitation.toFixed(1) : '—'} mm`
          : '—'
        }
      />
    </div>
  );
});

export default HoverPane;
