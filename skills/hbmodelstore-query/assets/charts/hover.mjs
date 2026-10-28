// Keep ECharts' native axis line/tooltip; add a silent band behind visible bars.
// No extra axes, series, data points or setOption calls during pointer movement.
export function bindBarHover({ chart, echarts, isDark = () => false }) {
  const zr = chart.getZr(), bands = new Map();
  const clear = () => {
    for (const band of bands.values()) zr.remove(band);
    bands.clear();
  };
  const update = event => {
    const active = new Set(), model = chart.getModel();
    const pointers = Object.values(model.getComponent('axisPointer')?.coordSysAxesInfo?.axesInfo ?? {});
    model.eachSeriesByType('bar', series => {
      const coord = series.coordinateSystem;
      if (coord?.type !== 'cartesian2d') return;
      const axis = coord.getBaseAxis();
      const info = event.axesInfo?.find(a =>
        a.axisDim === axis.dim && a.axisIndex === axis.index);
      if (!info) return;
      const pointer = pointers.find(p => p.axis === axis)?.axisPointerModel;
      if (!pointer || pointer.get('type') === 'none' || pointer.get('show') === false) return;
      const rect = coord.getArea(), key = `${axis.dim}:${axis.index}:${coord.model.id}`;
      if (active.has(key)) return; // A grouped/stacked category gets one band.
      const center = axis.toGlobalCoord(axis.dataToCoord(info.value, true));
      const width = axis.type === 'category' ? axis.getBandWidth()
        : series.getData().getLayout('bandWidth');
      if (!Number.isFinite(center) || !Number.isFinite(width) || width <= 0) return;
      const horizontal = axis.dim === 'x';
      const start = horizontal ? rect.x : rect.y;
      const end = start + (horizontal ? rect.width : rect.height);
      const lo = Math.max(start, center - width / 2), hi = Math.min(end, center + width / 2);
      if (hi <= lo) return;
      active.add(key);
      let band = bands.get(key);
      if (!band) {
        band = new echarts.graphic.Rect({
          name: 'hb-bar-hover-band', silent: true,
          zlevel: series.get('zlevel') ?? 0, z: (series.get('z') ?? 2) - 0.5
        });
        bands.set(key, band); zr.add(band);
      }
      band.attr({
        shape: horizontal
          ? { x: lo, y: rect.y, width: hi - lo, height: rect.height }
          : { x: rect.x, y: lo, width: rect.width, height: hi - lo },
        style: { fill: isDark() ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)' }
      });
    });
    for (const [key, band] of bands) if (!active.has(key)) {
      zr.remove(band); bands.delete(key);
    }
  };
  chart.on('updateAxisPointer', update);
  const clearEvents = ['hideTip', 'legendselectchanged', 'datazoom', 'restore'];
  for (const event of clearEvents) chart.on(event, clear);
  zr.on('globalout', clear);
  return { clear, dispose() {
    chart.off('updateAxisPointer', update);
    for (const event of clearEvents) chart.off(event, clear);
    zr.off('globalout', clear);
    clear();
  } };
}
