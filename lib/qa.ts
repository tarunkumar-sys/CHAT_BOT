import { QdrantVectorStore } from '@langchain/qdrant';
import { PromptTemplate } from '@langchain/core/prompts';
import { StringOutputParser } from '@langchain/core/output_parsers';
import { RunnableSequence } from '@langchain/core/runnables';
import { getQdrantClient, resolveWebsiteDomain, getCollectionName } from './vectorstore';
import { getLLM, getEmbeddings } from './llm';

export async function getQaChain(websiteUrlOrName: string) {
  // Resolve to stored domain (handles partial names + full URLs)
  let domain: string;
  try {
    const resolved = await resolveWebsiteDomain(websiteUrlOrName);
    if (resolved) {
      domain = resolved;
    } else {
      domain = new URL(
        websiteUrlOrName.startsWith('http') ? websiteUrlOrName : 'https://' + websiteUrlOrName
      ).hostname.replace(/\./g, '_');
    }
  } catch {
    domain = websiteUrlOrName.replace(/[\.\-\/\:]/g, '_').toLowerCase();
  }

  const embeddings = getEmbeddings();
  const client = getQdrantClient();
  const collectionName = await getCollectionName();

  const vectorStore = new QdrantVectorStore(embeddings, {
    client,
    collectionName: collectionName,
  });

  const retriever = vectorStore.asRetriever({
    k: 8,
    filter: {
      must: [{ key: 'metadata.domain', match: { value: domain } }],
    },
  });

  const llm = getLLM({ numPredict: 600 });

  const prompt = PromptTemplate.fromTemplate(`You are a website content analyst. Your job is to answer questions about website content using ONLY the provided context chunks. Format responses beautifully using markdown.

STRICT FORMATTING RULES:
1. ALWAYS start with a 1-sentence summary in plain text (no heading)
2. Use **bold headers** for each section (e.g. **About**, **Services**, **Contact**)
3. Put a blank line between every section
4. Format ALL links as clickable markdown: [Link Text](https://full-url.com)
5. Format ALL email addresses as: [email@domain.com](mailto:email@domain.com)
6. Format ALL phone numbers as: [+91XXXXXXXXXX](tel:+91XXXXXXXXXX)
7. Use bullet points (- item) for lists of items, skills, services, features
8. Never output raw URLs like "https://..." — always wrap in [text](url)
9. Keep the total response under 220 words
10. If contact info exists, always end with a **Contact** section

SECTION STRUCTURE TO USE (only include sections that have data):

**About**
[2-3 sentence description]

**Services** (or **Products** / **Features** / **Skills** depending on site type)
- Service one
- Service two

**Projects** (if portfolio site)
- [Project Name](url-if-available) — brief description

**Contact**
[name@email.com](mailto:name@email.com) · [+91XXXXXXXXXX](tel:+91XXXXXXXXXX) · [Website](https://url)

CONTEXT FROM WEBSITE:
{context}

USER QUESTION:
{input}

ANSWER (follow all formatting rules above, use exact markdown syntax):`);

  const chain = RunnableSequence.from([
    {
      context: async (input: { input: string }) => {
        const docs = await retriever.invoke(input.input);
        const context = docs.map(doc => doc.pageContent).join('\n\n');
        return context.length > 3500 ? context.substring(0, 3500) + '...' : context;
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
