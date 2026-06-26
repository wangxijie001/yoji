import { tool } from "langchain";
import { TavilySearch } from "@langchain/tavily";
import { z } from "zod";
import { modelConfig, envConfig } from '../../config'

export const internetSearch = tool(
    async ({
        query,
        maxResults = 5,
        topic = "general",
        includeRawContent = false,
    }: {
        query: string;
        maxResults?: number;
        topic?: "general" | "news" | "finance";
        includeRawContent?: boolean;
    }) => {
        const activeProvider = envConfig.get<string>('activeProvider') || 'deepseek'
        const providerConfig = modelConfig.get<any>(activeProvider) || {}
        const tavilyApiKey = providerConfig.tavilyApiKey || ''

        if (!tavilyApiKey) {
            return '未配置 Tavily API Key，请在设置中填写 tavily-key 后重试'
        }

        const tavilySearch = new TavilySearch({
            maxResults,
            tavilyApiKey,
            includeRawContent,
            topic,
        });
        return await tavilySearch._call({ query });
    },
    {
        name: "internet_search",
        description: "联网检索工具",
        schema: z.object({
            query: z.string().describe("需要联网检索的问题或内容"),
            maxResults: z.number().optional().default(5).describe("要返回的最大结果数"),
            topic: z.enum(["general", "news", "finance"]).optional().default("general").describe("搜索主题类别"),
            includeRawContent: z.boolean().optional().default(false).describe("搜索结果中是否返回网页的原始（或解析后的）内容"),
        })
    },
);
