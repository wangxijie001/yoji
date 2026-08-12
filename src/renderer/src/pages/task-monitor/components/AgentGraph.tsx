import { useEffect, useRef } from 'react'
import { Graph, Selection } from '@antv/x6'
import { DagreLayout } from '@antv/layout'

interface AgentGraphProps {
  /** agent 状态图数据（JSON 字符串）：{ nodes: [{id, shape, data:{name, type}}], edges: [{id, source, target, data:{conditional}}] } */
  graph: string | null
  /** 当前正在执行的节点名称，如 'model_request' */
  currentNode?: string | null
}

const NODE_WIDTH = 220
const NODE_HEIGHT = 40

/** 用 dagre 算法计算布局，自动处理循环边和层级 */
async function computeLayout(graphData: { nodes: any[]; edges: any[] }) {
  const { nodes, edges } = graphData

  const dagre = new DagreLayout({
    rankdir: 'TB',
    nodesep: 40,
    ranksep: 60,
    nodeSize: [NODE_WIDTH, NODE_HEIGHT]
  })

  // execute 构建内部模型，结果通过 forEachNode 读取
  const data = {
    nodes: nodes.map((n) => ({ id: n.id })),
    edges: edges.map((e) => ({ source: e.source, target: e.target }))
  }
  await dagre.execute(data)

  // dagre 算出的坐标是节点中心点，X6 需要左上角
  const posMap: Record<string, { x: number; y: number }> = {}
  dagre.forEachNode((node: any) => {
    posMap[node.id] = { x: node.x - NODE_WIDTH / 2, y: node.y - NODE_HEIGHT / 2 }
  })
  dagre.destroy()

  const x6Nodes = nodes.map((n) => {
    const name = n.data?.name || n.id
    const pos = posMap[n.id] || { x: 0, y: 0 }

    return {
      id: n.id,
      shape: 'rect',
      x: pos.x,
      y: pos.y,
      width: NODE_WIDTH,
      height: NODE_HEIGHT,
      label: name,
      attrs: {
        body: {
          fill: '#f2f0ff',
          stroke: '#d9d9d9',
          strokeWidth: 1,
          rx: 8,
          ry: 8
        },
        label: {
          fontSize: 16,
          fill: '#333',
          textWrap: { width: NODE_WIDTH - 20, height: NODE_HEIGHT, ellipsis: true }
        }
      }
    }
  })

  const x6Edges = edges.map((e) => ({
    id: e.id,
    source: e.source,
    target: e.target,
    attrs: {
      line: {
        stroke: '#bfb6fc',
        strokeWidth: 1.5,
        // 条件边用虚线
        strokeDasharray: e.data?.conditional ? '5 4' : undefined,
        targetMarker: { name: 'block', width: 8, height: 6 }
      }
    }
  }))

  return { nodes: x6Nodes, edges: x6Edges }
}

const AgentGraph = ({ graph, currentNode }: AgentGraphProps) => {
  const containerRef = useRef<HTMLDivElement>(null)
  const graphRef = useRef<Graph | null>(null)

  // JSON 解析 + 缓存，graph 字符串内容不变时不重新解析
  const graphData = useRef<{ nodes: any[]; edges: any[] } | null>(null)
  const graphStrRef = useRef<string | null>(null)

  // 最新 currentNode，供异步渲染完成后读取
  const currentNodeRef = useRef<string | null>(null)
  currentNodeRef.current = currentNode || null

  const applyHighlight = () => {
    const x6Graph = graphRef.current
    if (!x6Graph) return
    x6Graph.cleanSelection()
    const id = currentNodeRef.current 
    if (id) {
      const cell = x6Graph.getCellById(id)
      if (cell) x6Graph.select(cell)
    }
  }

  if (graphStrRef.current !== graph) {
    graphStrRef.current = graph
    try {
      graphData.current = graph ? JSON.parse(graph) : null
    } catch {
      console.error('[AgentGraph] JSON 解析失败:', graph)
      graphData.current = null
    }
  }

  // 初始化画布
  useEffect(() => {
    if (!containerRef.current) return

    const x6Graph = new Graph({
      container: containerRef.current,
      autoResize: true,
      background: { color: 'transparent' },
      interacting: { nodeMovable: false },
      panning: true,
      mousewheel: { enabled: true, modifiers: ['ctrl', 'meta'] }
    })

    // X6 v3：选中功能是插件，需显式注册
    x6Graph.use(
      new Selection({
        enabled: true,
        multiple: false,
        rubberband: false,
        movable: false,
        showNodeSelectionBox: true
      })
    )
    graphRef.current = x6Graph

    // 画布尺寸变化后重新适配内容
    x6Graph.on('resize', () => {
      x6Graph.zoomToFit({ padding: 30, maxScale: 1 })
      x6Graph.centerContent()
    })

    return () => {
      x6Graph.dispose()
      graphRef.current = null
    }
  }, [])

  // 渲染图数据（依赖 graph 字符串本身，按值比较，内容不变不触发）
  useEffect(() => {
    const x6Graph = graphRef.current
    if (!x6Graph || !graphData.current) return

    let disposed = false
    computeLayout(graphData.current).then((layout) => {
      if (disposed) return
      x6Graph.clearCells()
      x6Graph.fromJSON(layout)
      x6Graph.zoomToFit({ padding: 30, maxScale: 1 })
      x6Graph.centerContent()
      applyHighlight() // 渲染完成后立即高亮
    })

    return () => {
      disposed = true
    }
  }, [graph])

  // 当前执行节点变化时高亮
  useEffect(() => {
    applyHighlight()
  }, [currentNode])

  return <div ref={containerRef} style={{ width: '100%', height: '100%' }} />
}

export default AgentGraph
