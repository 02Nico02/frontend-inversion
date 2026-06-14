import * as echarts from 'echarts/core';
import {
  AxisPointerComponent,
  DataZoomComponent,
  GridComponent,
  LegendComponent,
  GraphicComponent,
  MarkLineComponent,
  MarkPointComponent,
  TitleComponent,
  ToolboxComponent,
  TooltipComponent
} from 'echarts/components';
import { BarChart, LineChart } from 'echarts/charts';
import { CanvasRenderer } from 'echarts/renderers';
import { LabelLayout, UniversalTransition } from 'echarts/features';

echarts.use([
  AxisPointerComponent,
  BarChart,
  CanvasRenderer,
  DataZoomComponent,
  GridComponent,
  LabelLayout,
  GraphicComponent,
  LegendComponent,
  LineChart,
  MarkLineComponent,
  MarkPointComponent,
  TitleComponent,
  ToolboxComponent,
  TooltipComponent,
  UniversalTransition
]);

export { echarts };
