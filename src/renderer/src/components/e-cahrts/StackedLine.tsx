import * as echarts from 'echarts'
import { useEffect, useRef } from 'react'

type EChartsOption = echarts.EChartsOption



export interface StackedLineProps {
  option: {
    title?: EChartsOption['title']
    series: EChartsOption['series']
    xAxis: EChartsOption['xAxis']
  }
}

const StackedLine = ({ option }: StackedLineProps) => {
  const containerRef = useRef<HTMLDivElement>(null)
  const chartRef = useRef<echarts.ECharts | null>(null)


  // legend 自动从 series name 派生，保证一致
  const buildOption = (_option: StackedLineProps['option']): EChartsOption => {
    const series = _option.series ?? []
    const legendData: string[] = [];
    const legendDescription: Record<string, string> = {};
    (series as Array<{ name?: string, description?: string }>).forEach((s) => {
      legendData.push(s.name || '')
      legendDescription[s.name || ''] = s.description || ''
    })

    return {
      title: _option.title,
      tooltip: { trigger: 'axis' },
      legend: {
        top: 50,
        icon: 'circle',
        left: 'center',
        itemWidth: 30,
        itemHeight: 14,
        selectedMode: 'single',
        tooltip: {
            show: true,
            triggerOn:'mousemove',
            formatter: (params) => legendDescription[params.name] || ''
        },
        data: legendData
      },
      grid: {
        left: '3%',
        right: '4%',
        bottom: '3%',
        top: 90,
        containLabel: true
      },
      xAxis: _option.xAxis,
      yAxis: { type: 'value' },
      series: _option.series
    }
  }

  useEffect(() => {
    if (!containerRef.current) return
    const chart = echarts.init(containerRef.current)
    chart.setOption(buildOption(option), true)
    chartRef.current = chart

    const handleResize = () => chart.resize()
    window.addEventListener('resize', handleResize)

    return () => {
      window.removeEventListener('resize', handleResize)
      chart.dispose()
    }
  }, [])

  useEffect(() => {
    chartRef.current?.setOption(buildOption(option), true)
  }, [option])

  return (
    <div
      ref={containerRef}
      style={{ width: '100%',boxSizing: 'border-box', height: 400, padding: '0 20px' }}
    />
  )
}

export default StackedLine
