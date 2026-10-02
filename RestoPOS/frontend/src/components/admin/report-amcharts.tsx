"use client";

import { useLayoutEffect, useRef } from "react";
import * as am5 from "@amcharts/amcharts5";
import * as am5percent from "@amcharts/amcharts5/percent";
import * as am5xy from "@amcharts/amcharts5/xy";
import am5themes_Animated from "@amcharts/amcharts5/themes/Animated";

export type ReportChartPoint = Record<string, string | number | null | undefined>;

type ChartMode = "line" | "bar" | "pie" | "heatmap";
type ChartOrientation = "horizontal" | "vertical";

type ReportAmChartProps = {
  mode: ChartMode;
  data: ReportChartPoint[];
  categoryField: string;
  valueField: string;
  label: string;
  orientation?: ChartOrientation;
  color?: string;
  colors?: string[];
  colorField?: string;
  donut?: boolean;
  valueScale?: number;
  tooltipField?: string;
  formatValue?: (value: number, point: ReportChartPoint) => string;
  formatAxisValue?: (value: number) => string;
  onPointClick?: (point: ReportChartPoint) => void;
  xField?: string;
  yField?: string;
  xCategories?: string[];
  yCategories?: string[];
};

export function ReportAmChart({
  mode,
  data,
  categoryField,
  valueField,
  label,
  orientation = "horizontal",
  color = "#2563EB",
  colors,
  colorField,
  donut = false,
  valueScale = 1,
  tooltipField,
  formatValue,
  formatAxisValue,
  onPointClick,
  xField,
  yField,
  xCategories,
  yCategories,
}: ReportAmChartProps) {
  const hostRef = useRef<HTMLDivElement>(null);
  const pointClickRef = useRef(onPointClick);
  const valueFormatterRef = useRef(formatValue);
  const axisFormatterRef = useRef(formatAxisValue);

  pointClickRef.current = onPointClick;
  valueFormatterRef.current = formatValue;
  axisFormatterRef.current = formatAxisValue;
  const isInteractive = Boolean(onPointClick);

  useLayoutEffect(() => {
    if (!hostRef.current) return;

    const root = am5.Root.new(hostRef.current);
    root.setThemes([am5themes_Animated.new(root)]);
    root.numberFormatter.set("numberFormat", "#,###.##");

    const chartRows = data.map((point) => {
      const rawValue = Number(point[valueField] ?? 0);
      const chartValue = rawValue * valueScale;
      const tooltipValue = tooltipField
        ? String(point[tooltipField] ?? "")
        : valueFormatterRef.current?.(chartValue, point) ?? chartValue.toLocaleString("fa-IR");

      return { ...point, __chartValue: chartValue, __chartTooltipValue: tooltipValue };
    });

    if (mode === "pie") {
      const chart = root.container.children.push(
        am5percent.PieChart.new(root, {
          layout: root.verticalLayout,
          ...(donut ? { innerRadius: am5.percent(58) } : {}),
        }),
      );
      const series = chart.series.push(
        am5percent.PieSeries.new(root, {
          valueField: "__chartValue",
          categoryField,
          alignLabels: false,
        }),
      );

      if (colors?.length) {
        series.get("colors")?.set("colors", colors.map(toColor));
      }
      series.slices.template.setAll({
        stroke: am5.color(0xffffff),
        strokeWidth: 2,
        tooltipText: "{category}: {__chartTooltipValue}",
      });
      series.labels.template.setAll({ forceHidden: true });
      series.ticks.template.setAll({ forceHidden: true });
      series.data.setAll(chartRows);

      const legend = chart.children.push(
        am5.Legend.new(root, {
          centerX: am5.p50,
          x: am5.p50,
          layout: root.horizontalLayout,
          marginTop: 6,
        }),
      );
      legend.labels.template.setAll({ fontSize: 11, maxWidth: 150, oversizedBehavior: "truncate" });
      legend.valueLabels.template.setAll({ text: "{valuePercentTotal.formatNumber('0.0')}%", fontSize: 11 });
      legend.data.setAll(series.dataItems);
    } else {
      const chart = root.container.children.push(
        am5xy.XYChart.new(root, {
          panX: false,
          panY: false,
          wheelX: "none",
          wheelY: "none",
          layout: root.verticalLayout,
          paddingTop: 8,
          paddingRight: 10,
          paddingBottom: 4,
        }),
      );

      if (mode === "heatmap") {
        const heatmapXField = xField ?? "hour";
        const heatmapYField = yField ?? "day";
        const xRenderer = am5xy.AxisRendererX.new(root, { minGridDistance: 18, inversed: true });
        xRenderer.labels.template.setAll({ fontSize: 9, fill: am5.color(0x64748b), paddingTop: 4 });
        xRenderer.grid.template.setAll({ strokeOpacity: 0.08 });
        const yRenderer = am5xy.AxisRendererY.new(root, { minGridDistance: 24 });
        yRenderer.labels.template.setAll({ fontSize: 10, fill: am5.color(0x475569), maxWidth: 76, oversizedBehavior: "truncate" });
        yRenderer.grid.template.setAll({ strokeOpacity: 0.08 });

        const xAxis = chart.xAxes.push(
          am5xy.CategoryAxis.new(root, { renderer: xRenderer, categoryField: heatmapXField }),
        );
        const yAxis = chart.yAxes.push(
          am5xy.CategoryAxis.new(root, { renderer: yRenderer, categoryField: heatmapYField }),
        );
        xAxis.data.setAll((xCategories ?? []).map((category) => ({ [heatmapXField]: category })));
        yAxis.data.setAll((yCategories ?? []).map((category) => ({ [heatmapYField]: category })));

        const series = chart.series.push(
          am5xy.ColumnSeries.new(root, {
            calculateAggregates: true,
            clustered: false,
            xAxis,
            yAxis,
            categoryXField: heatmapXField,
            categoryYField: heatmapYField,
            valueField,
          }),
        );
        series.columns.template.setAll({
          width: am5.percent(100),
          height: am5.percent(100),
          stroke: am5.color(0xffffff),
          strokeOpacity: 0.8,
          strokeWidth: 1,
          tooltipText: "{categoryY} · {categoryX}:00\n{__chartTooltipValue}",
        });
        series.set("heatRules", [{
          target: series.columns.template,
          dataField: valueField,
          key: "fill",
          min: am5.color(0xffe4e6),
          max: am5.color(0xc41e3a),
        }]);
        series.data.setAll(chartRows);
      } else {
        const horizontal = mode === "bar" && orientation === "horizontal";
        const categoryRenderer = horizontal
          ? am5xy.AxisRendererY.new(root, { minGridDistance: 18, inversed: true })
          : am5xy.AxisRendererX.new(root, { minGridDistance: mode === "line" ? 24 : 18 });
        categoryRenderer.labels.template.setAll({
          fontSize: 10,
          fill: am5.color(0x475569),
          ...(horizontal ? { maxWidth: 135, oversizedBehavior: "truncate" as const, paddingRight: 8 } : {}),
          ...(mode === "line" ? { rotation: -25, centerY: am5.p50, centerX: am5.p100, paddingTop: 8 } : {}),
        });
        categoryRenderer.grid.template.setAll({ strokeOpacity: horizontal ? 0 : 0.08 });

        const valueRenderer = horizontal
          ? am5xy.AxisRendererX.new(root, {})
          : am5xy.AxisRendererY.new(root, {});
        valueRenderer.labels.template.setAll({ fontSize: 10, fill: am5.color(0x64748b) });
        valueRenderer.grid.template.setAll({ stroke: am5.color(0xe2e8f0), strokeOpacity: 0.65 });

        const categoryAxis = horizontal
          ? chart.yAxes.push(am5xy.CategoryAxis.new(root, { renderer: categoryRenderer, categoryField }))
          : chart.xAxes.push(am5xy.CategoryAxis.new(root, { renderer: categoryRenderer, categoryField }));
        const valueAxis = horizontal
          ? chart.xAxes.push(am5xy.ValueAxis.new(root, { min: 0, extraMax: 0.08, numberFormat: "#,###", renderer: valueRenderer }))
          : chart.yAxes.push(am5xy.ValueAxis.new(root, { min: 0, extraMax: 0.08, numberFormat: "#,###", renderer: valueRenderer }));
        categoryAxis.data.setAll(chartRows);
        valueRenderer.labels.template.adapters.add("text", (text, target) => {
          const dataItem = target.dataItem as am5.DataItem<am5xy.IValueAxisDataItem> | undefined;
          const axisValue = dataItem?.get("value");
          return typeof axisValue === "number" ? axisFormatterRef.current?.(axisValue) ?? text : text;
        });

        const tooltipText = horizontal
          ? "{categoryY}: {__chartTooltipValue}"
          : "{categoryX}: {__chartTooltipValue}";
        if (mode === "line") {
          const series = chart.series.push(
            am5xy.LineSeries.new(root, {
              xAxis: categoryAxis as am5xy.CategoryAxis<am5xy.AxisRendererX>,
              yAxis: valueAxis as am5xy.ValueAxis<am5xy.AxisRendererY>,
              categoryXField: categoryField,
              valueYField: "__chartValue",
              tooltip: am5.Tooltip.new(root, { labelText: tooltipText }),
            }),
          );
          series.strokes.template.setAll({ stroke: toColor(color), strokeWidth: 2.5 });
          series.fills.template.setAll({ fill: toColor(color), fillOpacity: 0.12, visible: true });
          series.bullets.push(() => {
            const point = am5.Circle.new(root, {
              radius: isInteractive ? 4 : 3,
              fill: toColor(color),
              stroke: am5.color(0xffffff),
              strokeWidth: 2,
              interactive: isInteractive,
              cursorOverStyle: isInteractive ? "pointer" : "default",
            });
            point.events.on("click", (event) => {
              const context = event.target.dataItem?.dataContext;
              if (context && typeof context === "object") {
                pointClickRef.current?.(context as ReportChartPoint);
              }
            });
            return am5.Bullet.new(root, { sprite: point });
          });
          series.data.setAll(chartRows);
          chart.set("cursor", am5xy.XYCursor.new(root, { behavior: "none" }));
        } else {
          const series = chart.series.push(
            am5xy.ColumnSeries.new(root, {
              xAxis: horizontal
                ? valueAxis as am5xy.ValueAxis<am5xy.AxisRendererX>
                : categoryAxis as am5xy.CategoryAxis<am5xy.AxisRendererX>,
              yAxis: horizontal
                ? categoryAxis as am5xy.CategoryAxis<am5xy.AxisRendererY>
                : valueAxis as am5xy.ValueAxis<am5xy.AxisRendererY>,
              ...(horizontal
                ? { valueXField: "__chartValue", categoryYField: categoryField }
                : { valueYField: "__chartValue", categoryXField: categoryField }),
              tooltip: am5.Tooltip.new(root, { labelText: tooltipText }),
            }),
          );
          series.columns.template.setAll({
            height: horizontal ? am5.percent(72) : am5.percent(80),
            width: horizontal ? undefined : am5.percent(80),
            fill: toColor(color),
            stroke: toColor(color),
            cursorOverStyle: isInteractive ? "pointer" : "default",
          });
          if (colorField) {
            series.columns.template.adapters.add("fill", (fill, target) => {
              const point = target.dataItem?.dataContext as ReportChartPoint | undefined;
              const pointColor = point?.[colorField];
              return typeof pointColor === "string" ? toColor(pointColor) : fill;
            });
            series.columns.template.adapters.add("stroke", (stroke, target) => {
              const point = target.dataItem?.dataContext as ReportChartPoint | undefined;
              const pointColor = point?.[colorField];
              return typeof pointColor === "string" ? toColor(pointColor) : stroke;
            });
          }
          if (isInteractive) {
            series.columns.template.events.on("click", (event) => {
              const context = event.target.dataItem?.dataContext;
              if (context && typeof context === "object") {
                pointClickRef.current?.(context as ReportChartPoint);
              }
            });
          }
          series.data.setAll(chartRows);
        }
      }
    }

    return () => root.dispose();
  }, [
    categoryField,
    color,
    colorField,
    colors,
    data,
    donut,
    mode,
    isInteractive,
    orientation,
    tooltipField,
    valueField,
    valueScale,
    xCategories,
    xField,
    yCategories,
    yField,
  ]);

  return <div ref={hostRef} className="h-full w-full min-w-0" role="img" aria-label={label} dir="ltr" />;
}

function toColor(hex: string) {
  return am5.color(Number.parseInt(hex.replace("#", ""), 16));
}
