import React, { useMemo } from 'react';
import { ComposedChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Line } from 'recharts';
import type { RouteData } from '../utils/gpxParser';

interface WeatherTimelineProps {
  route: RouteData;
  weatherPoints: any[];
  onHoverIndex: (index: number | null) => void;
}

const WeatherTimeline: React.FC<WeatherTimelineProps> = ({ route, weatherPoints, onHoverIndex }) => {
  const { data, wxByRouteIndex } = useMemo(() => {
    const d = route.points.map(pt => ({
      distance: pt.distance / 1000,
      elevation: Math.round(pt.ele),
      temp: undefined as number | undefined,
      isSample: false,
    }));

    const wxByRouteIndex = new Map<number, number>();
    weatherPoints.forEach((wp, wIdx) => {
      const rIdx = route.points.indexOf(wp.point);
      if (rIdx >= 0) {
        d[rIdx].temp = wp.temp;
        d[rIdx].isSample = true;
        wxByRouteIndex.set(rIdx, wIdx);
      }
    });

    // Linearly interpolate temp between sample points so the line is continuous
    const sampleIdxs = [...wxByRouteIndex.keys()].sort((a, b) => a - b);
    for (let i = 0; i < sampleIdxs.length - 1; i++) {
      const lo = sampleIdxs[i], hi = sampleIdxs[i + 1];
      const tLo = d[lo].temp!, tHi = d[hi].temp!;
      for (let j = lo + 1; j < hi; j++) {
        d[j].temp = tLo + (tHi - tLo) * ((j - lo) / (hi - lo));
      }
    }

    return { data: d, wxByRouteIndex };
  }, [route, weatherPoints]);

  return (
    <div style={{ width: '100%', height: '100%' }}>
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart
          data={data}
          margin={{ top: 10, right: 10, left: 10, bottom: 0 }}
          onMouseMove={(state) => {
            const rIdx = state.activeTooltipIndex != null ? Number(state.activeTooltipIndex) : NaN;
            if (isNaN(rIdx)) { onHoverIndex(null); return; }
            let nearest: number | null = null;
            let nearestDist = Infinity;
            wxByRouteIndex.forEach((wIdx, sRIdx) => {
              const d = Math.abs(sRIdx - rIdx);
              if (d < nearestDist) { nearestDist = d; nearest = wIdx; }
            });
            onHoverIndex(nearest);
          }}
          onMouseLeave={() => onHoverIndex(null)}
        >
          <defs>
            <linearGradient id="colorEle" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#2d5a27" stopOpacity={0.3}/>
              <stop offset="95%" stopColor="#2d5a27" stopOpacity={0}/>
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#eee" />
          <XAxis
            dataKey="distance"
            type="number"
            domain={['dataMin', 'dataMax']}
            tickFormatter={(v) => `${Number(v).toFixed(0)}km`}
            fontSize={11}
            tickLine={false}
            axisLine={false}
            stroke="#888"
          />
          <YAxis
            yAxisId="elevation"
            axisLine={false}
            tickLine={false}
            fontSize={10}
            stroke="#888"
            tickFormatter={(v) => `${Math.round(v)}m`}
          />
          <YAxis
            yAxisId="temp"
            orientation="right"
            axisLine={false}
            tickLine={false}
            fontSize={10}
            stroke="#888"
            tickFormatter={(v) => `${Math.round(v)}°C`}
          />
          <Tooltip
            contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 20px rgba(0,0,0,0.1)' }}
            labelFormatter={(label) => `${Number(label).toFixed(1)} km`}
            formatter={(value, name) => name === 'Temp' ? [`${Math.round(Number(value))}°C`, name] : [value, name]}
          />
          <Area
            yAxisId="elevation"
            type="monotone"
            dataKey="elevation"
            stroke="#2d5a27"
            fillOpacity={1}
            fill="url(#colorEle)"
            name="Elevation"
            dot={false}
            isAnimationActive={false}
          />
          <Line
            yAxisId="temp"
            type="monotone"
            dataKey="temp"
            stroke="#ff7300"
            dot={(props: any) => {
              if (!props.payload.isSample) return <g key={props.index} />;
              return <circle key={props.index} cx={props.cx} cy={props.cy} r={4} fill="#ff7300" stroke="white" strokeWidth={1.5} />;
            }}
            name="Temp"
            isAnimationActive={false}
          />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
};

export default WeatherTimeline;
