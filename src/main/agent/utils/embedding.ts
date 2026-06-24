import { pipeline, env } from '@xenova/transformers'
import { app } from 'electron'
import { join } from 'path'

// 仅在开发环境加载本地模型，生产环境从 Resources 读取
const MODEL_BASE = app.isPackaged
  ? join(process.resourcesPath!, 'models')
  : join(__dirname, '..', '..', 'models')

env.allowRemoteModels = false
env.allowLocalModels = true
env.localModelPath = MODEL_BASE

let _extractor: any = null

async function getExtractor() {
  if (!_extractor) {
    _extractor = await pipeline('feature-extraction', 'Xenova/all-MiniLM-L6-v2')
  }
  return _extractor
}

// 生成文本向量，384 维
export async function generateEmbedding(text: string): Promise<number[]> {
  const pipe = await getExtractor()
  const output = await pipe(text, { pooling: 'mean', normalize: true })
  return Array.from(output.data)
}
