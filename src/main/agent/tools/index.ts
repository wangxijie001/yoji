import { tool } from "langchain";
import dayjs from 'dayjs'
import { z } from "zod";
import { searchMemories, fetchRawMessages, queryMessageDatabase } from './search-memories'
import { searchEmotionLog } from './search-emotion-log'

export const queryCurrentTime = tool(
    async ({}:{}) => {
        try {
            return '当前时间：' +  dayjs().format("YYYY-MM-DD HH:mm:ss");

        } catch (error) {
            return JSON.stringify({ error: `查询当前时间失败: ${error}` });
        }
    },
    {
        name: "query_current_time",
        description: "问题涉及时间时调用该工具，查询当前时间，返回当前时间",
        schema: z.object({}),
    }
);


export const toolList = [ queryCurrentTime, searchMemories, fetchRawMessages, queryMessageDatabase, searchEmotionLog ];
