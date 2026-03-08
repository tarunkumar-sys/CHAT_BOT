import { RecursiveCharacterTextSplitter } from '@langchain/textsplitters';

export async function chunkText(pages: string[]): Promise<string[]> {
  const splitter = new RecursiveCharacterTextSplitter({
    chunkSize: 400,
    chunkOverlap: 50,
  });

  const chunks: string[] = [];
  for (const page of pages) {
    const pageChunks = await splitter.splitText(page);
    chunks.push(...pageChunks);
  }
  return chunks;
}