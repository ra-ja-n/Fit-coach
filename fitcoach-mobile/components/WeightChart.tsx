// Lightweight weight-trend chart (react-native-svg). Clean line + dots on a
// light grid — matches the design system, no chart lib needed.
import React from 'react';
import { Text, View, useWindowDimensions } from 'react-native';
import Svg, { Circle, Line, Path, Text as SvgText } from 'react-native-svg';
import { C, TYPE } from '../theme/tokens';
import { format, parseISO } from 'date-fns';

export interface ChartPoint { date: string; value: number }

export function WeightChart({ data, unit = 'kg' }: { data: ChartPoint[]; unit?: string }) {
  const { width } = useWindowDimensions();
  const W = Math.max(width - 74, 240);
  const H = 180;
  const PL = 38, PR = 12, PT = 16, PB = 26;

  if (data.length < 2) {
    return (
      <View style={{ height: H, alignItems: 'center', justifyContent: 'center' }}>
        <Text style={TYPE.sub}>Log at least two entries to see your trend.</Text>
      </View>
    );
  }

  const vals = data.map((d) => d.value);
  let min = Math.min(...vals);
  let max = Math.max(...vals);
  if (max - min < 1) { min -= 1; max += 1; }
  const pad = (max - min) * 0.14;
  min -= pad; max += pad;

  const x = (i: number) => PL + (i * (W - PL - PR)) / (data.length - 1);
  const y = (v: number) => PT + (H - PT - PB) * (1 - (v - min) / (max - min));

  const path = data.map((p, i) => `${i === 0 ? 'M' : 'L'}${x(i).toFixed(1)},${y(p.value).toFixed(1)}`).join(' ');
  const gridVals = [min + (max - min) * 0.25, min + (max - min) * 0.5, min + (max - min) * 0.75];
  const last = data[data.length - 1];

  return (
    <Svg width={W} height={H}>
      {gridVals.map((gv, i) => (
        <Line key={i} x1={PL} x2={W - PR} y1={y(gv)} y2={y(gv)} stroke={C.lineSoft} strokeWidth={1} />
      ))}
      <Line x1={PL} x2={W - PR} y1={H - PB} y2={H - PB} stroke={C.line} strokeWidth={1} />
      <SvgText x={PL - 6} y={y(max - pad) + 4} fontSize={10} fill={C.faint} textAnchor="end">{max.toFixed(0)}</SvgText>
      <SvgText x={PL - 6} y={y(min + pad) + 4} fontSize={10} fill={C.faint} textAnchor="end">{min.toFixed(0)}</SvgText>
      <SvgText x={PL} y={H - 8} fontSize={10} fill={C.faint}>{format(parseISO(data[0].date), 'MMM d')}</SvgText>
      <SvgText x={W - PR} y={H - 8} fontSize={10} fill={C.faint} textAnchor="end">{format(parseISO(last.date), 'MMM d')}</SvgText>
      <Path d={path} fill="none" stroke={C.primary} strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" />
      {data.map((p, i) => (
        <Circle
          key={p.date + i}
          cx={x(i)}
          cy={y(p.value)}
          r={i === data.length - 1 ? 5 : 3.5}
          fill={i === data.length - 1 ? C.primary : C.surface}
          stroke={C.primary}
          strokeWidth={2}
        />
      ))}
      <SvgText x={x(data.length - 1)} y={y(last.value) - 12} fontSize={11} fontWeight={700} fill={C.primaryDark} textAnchor="end">
        {last.value} {unit}
      </SvgText>
    </Svg>
  );
}
