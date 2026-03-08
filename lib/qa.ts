import { QdrantVectorStore } from '@langchain/qdrant';
import { OllamaEmbeddings } from '@langchain/ollama';
import { ChatOllama } from '@langchain/ollama';
import { PromptTemplate } from '@langchain/core/prompts';
import { StringOutputParser } from '@langchain/core/output_parsers';
import { RunnableSequence } from '@langchain/core/runnables';
import { getQdrantClient } from './vectorstore';

const COLLECTION_NAME = 'website_chunks';

export async function getQaChain(websiteUrl: string) {
  const domain = new URL(websiteUrl).hostname.replace(/\./g, '_');
  const embeddings = new OllamaEmbeddings({
    model: 'nomic-embed-text',
    baseUrl: process.env.OLLAMA_BASE_URL || 'http://localhost:11434',
  });

  const client = getQdrantClient();
  const vectorStore = new QdrantVectorStore(embeddings, {
    client,
    collectionName: COLLECTION_NAME,
  });

  const retriever = vectorStore.asRetriever({
    k: 8, // Increased from 5 to 8 for more pages
    filter: {
      must: [{ key: 'metadata.domain', match: { value: domain } }],
    },
  });

  const llm = new ChatOllama({
    model: process.env.OLLAMA_MODEL || 'qwen2.5:1.5b',
    baseUrl: process.env.OLLAMA_BASE_URL || 'http://localhost:11434',
    temperature: 0,
    numPredict: 300, // Limit output length for faster responses
  });

  const prompt = PromptTemplate.fromTemplate(`
You are analyzing website content to provide clear, well-formatted answers.

FORMATTING RULES (CRITICAL):
1. Use markdown with proper spacing
2. Add blank lines between sections
3. Format links: [Text](URL)
4. Format emails: [email](mailto:email)
5. Format phones: [phone](tel:phone)
6. Use bullet points with proper spacing:
   - Item 1
   - Item 2
   
7. Use sections with spacing:

**Section Title**

Content here

**Next Section**

Content here

RESPONSE STRUCTURE:
- Start with 1-2 sentence overview
- Use clear sections with **bold headers**
- Add blank line after each section
- Use bullet points for lists
- Keep total response under 200 words
- Be concise and direct

EXAMPLE FORMAT:

This is a [portfolio website](https://example.com) for John Doe, a software engineer.

**About**

John specializes in web development and AI systems.

**Skills**

- Python and JavaScript
- Machine Learning
- Web Development

**Contact**

[john@example.com](mailto:john@example.com) | [LinkedIn](https://linkedin.com/in/john) | [+1234567890](tel:+1234567890)

Context from website:
{context}

Question:
{input}

Answer (use exact format above with proper spacing):
`);

  // Create a chain that retrieves documents and answers questions
  const chain = RunnableSequence.from([
    {
      context: async (input: { input: string }) => {
        const docs = await retriever.invoke(input.input);
        // Limit context to prevent timeout - max 2500 chars
        const context = docs.map(doc => doc.pageContent).join('\n\n');
        return context.length > 2500 ? context.substring(0, 2500) + '...' : context;
      },
      input: (input: { input: string }) => input.input,
    },
    prompt,
    llm,
    new StringOutputParser(),
  ]);

  return {
    invoke: async (input: { input: string }) => {
      const answer = await chain.invoke(input);
      return { answer };
    },
  };
}
