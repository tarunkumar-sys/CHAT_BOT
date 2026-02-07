import { DuckDuckGoSearch } from "@langchain/community/tools/duckduckgo_search";
import { Calculator } from "@langchain/community/tools/calculator";
import { tool } from "@langchain/core/tools";
import { z } from "zod";


// 1. Search Tool
export const searchTool = new DuckDuckGoSearch({
  maxResults: 3,
});

// 2. Calculator Tool
export const calculatorTool = new Calculator();


// 4. Time Tool
export const timeTool = tool(
  async () => {
    return new Date().toLocaleString("en-IN", {
      timeZone: "Asia/Kolkata",
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      hour12: true,
    });
  },
  {
    name: "current_time",
    description: "Returns the current date and time in Indian Standard Time (IST).",
    schema: z.object({}),
  }
);

// Pokemon Tool
export const pokemonTool = tool(
  async ({ name, field }) => {
    const res = await fetch(
      `https://pokeapi.co/api/v2/pokemon/${name.toLowerCase()}`
    );

    if (!res.ok) {
      return `Pokemon "${name}" not found`;
    }

    const data = await res.json();

    // If user asked for specific field
    if (field) {
      switch (field) {
        case "height":
          return `${data.name} height is ${data.height}`;
        case "weight":
          return `${data.name} weight is ${data.weight}`;
        case "type":
          return data.types.map((t: any) => t.type.name);
        case "ability":
          return data.abilities.map((a: any) => a.ability.name);
        case "image":
          return data.sprites.front_default;
        default:
          return "Invalid field requested";
      }
    }

    // Default response (basic info)
    return {
      name: data.name,
      image: data.sprites.front_default,
    };
  },
  {
    name: "pokemon_info",
    description:
      "Get pokemon info. Default gives name and image. Use field for specific info like height, type, image.",
    schema: z.object({
      name: z.string().describe("Pokemon name like pikachu or charizard"),
      field: z
        .enum(["height", "weight", "type", "ability", "image"])
        .optional()
        .describe("Specific info user wants"),
    }),
  }
);



export const tools = [searchTool, calculatorTool, timeTool, pokemonTool];