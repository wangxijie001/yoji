
type WeatherData = {
    province: string, //城市
    city: string, //城市
    district: string, //区域
    adcode: string, //区域编码
    weather: string, //天气
    weather_icon: string, //天气标志位
    temperature: number,//温度
    wind_direction: string,//风向
    wind_power: string,//风力
    humidity: number,//湿度
    report_time: string,//报告时间
}
//查询当前城市当前天气
export const getWeather = async():Promise<WeatherData | string> => {
    try {
        const response = await fetch(`https://uapis.cn/api/v1/misc/weather`);
        if (!response.ok) {
            throw new Error(`API 请求失败: ${response.status}`);
        }
        const data = await response.json() as WeatherData;
        return data;
    } catch (error) {
        return JSON.stringify({ error: `查询当前城市天气失败: ${error}` });
    }
}
