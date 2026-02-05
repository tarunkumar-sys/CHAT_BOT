import { tool } from "@langchain/core/tools";

export const weatherTool = tool(
  async ({ city }) => {
    console.log("🌤 Weather tool called:", city);

    const API_KEY = process.env.OPENWEATHER_API_KEY;

    const res = await fetch(
      `https://api.openweathermap.org/data/2.5/weather?q=${city}&units=metric&appid=${API_KEY}`
    );

    if (!res.ok) {
      throw new Error("Failed to fetch weather");
    }

    const data = await res.json();

    return `Weather in ${data.name}: ${data.main.temp}°C, ${data.weather[0].description}`;
  },
  {
    name: "get_weather",
    description: "Get current weather for a city",
    schema: {
      type: "object",
      properties: {
        city: { type: "string" }
      },
      required: ["city"]
    }
  }
);
