import { tool } from "@langchain/core/tools";

export const pokemonTool = tool(
  async ({ name }) => {
    console.log("⚡ Pokémon tool called:", name);

    const res = await fetch(`https://pokeapi.co/api/v2/pokemon/${name}`);
    const data = await res.json();

    return `Pokémon ${data.name}: height ${data.height}, weight ${data.weight}`;
  },
  {
    name: "get_pokemon",
    description: "Get Pokémon information by name",
    schema: {
      name: { type: "string" },
    },
  }
);
