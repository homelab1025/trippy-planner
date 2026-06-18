import React from 'react';
import type { ChartDataPoint } from '../hooks/useWeatherChartData';
import { formatElapsed } from '../hooks/useWeatherChartData';

const PANE_WIDTH_PX = 110;

interface HoverPaneProps {
  hoveredData: ChartDataPoint | null;
  xAxisMode: 'clock' | 'elapsed';
  startTime: Date;
}

function HoverRow({ icon, value }: { icon: string; value: string }) {
  return (
    <div className="grid grid-cols-[20px_1fr] gap-1 mb-1 items-center">
      <span className="text-center text-[0.8rem]">{icon}</span>
      <span className="whitespace-nowrap">{value}</span>
    </div>
  );
}

const HoverPane: React.FC<HoverPaneProps> = React.memo(({ hoveredData, xAxisMode, startTime }) => {
  if (!hoveredData) {
    return (
      <div style={{ width: PANE_WIDTH_PX }} className="hover-pane flex-shrink-0 flex flex-col pl-2 text-xs border-l border-base-300 ml-2 items-center justify-center text-center text-base-content/40">
        <p>Hover over charts to see values here</p>
      </div>
    );
  }

  const timeStr = xAxisMode === 'clock'
    ? new Date(hoveredData.time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    : formatElapsed(hoveredData.time - startTime.getTime());

  return (
    <div style={{ width: PANE_WIDTH_PX }} className="hover-pane flex-shrink-0 flex flex-col pl-2 text-xs border-l border-base-300 ml-2">
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

export { HoverPane };
