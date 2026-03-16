import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { QdrantVectorStore } from '@langchain/qdrant';
import { GoogleGenerativeAIEmbeddings } from '@langchain/google-genai';
import { Document } from '@langchain/core/documents';
import { AI_MODELS } from '../ai.config.js';

@Injectable()
export class QdrantService implements OnModuleInit {
  private readonly logger = new Logger(QdrantService.name);
  private vectorStore: QdrantVectorStore;
  private embeddings: GoogleGenerativeAIEmbeddings;

  constructor(private configService: ConfigService) {
    this.embeddings = new GoogleGenerativeAIEmbeddings({
      apiKey: this.configService.getOrThrow<string>('GOOGLE_API_KEY'),
      model: AI_MODELS.EMBEDDING_MODEL,
    });
  }

  async onModuleInit() {
    const qdrantUrl = this.configService.get<string>(
      'QDRANT_URL',
      'http://localhost:6333',
    );
    const qdrantApiKey = this.configService.get<string>('QDRANT_API_KEY');
    const collectionName = this.configService.get<string>(
      'QDRANT_COLLECTION_NAME',
      'realestate_knowledge',
    );

    this.logger.log(`Initializing Qdrant Vector Store at ${qdrantUrl}...`);

    try {
      this.vectorStore = await QdrantVectorStore.fromExistingCollection(
        this.embeddings,
        {
          url: qdrantUrl,
          apiKey: qdrantApiKey,
          collectionName: collectionName,
        },
      );
      this.logger.log(`Connected to Qdrant collection: ${collectionName}`);
    } catch (error) {
      this.logger.warn(
        `Failed to connect to existing Qdrant collection '${collectionName}'. Ensure Qdrant is running and the collection exists.`,
      );
      if (error instanceof Error) {
        this.logger.debug(error.message);
      }

      // Attempt to initialize a new one if it didn't exist (this creates the collection)
      try {
        this.logger.log('Attempting to create a new Qdrant collection...');

        this.vectorStore = await QdrantVectorStore.fromTexts(
          [
            'Mock initialization document. Real data should be loaded via a separate pipeline.',
          ],
          [{ id: 'init-doc' }],
          this.embeddings,
          {
            url: qdrantUrl,
            apiKey: qdrantApiKey,
            collectionName: collectionName,
          },
        );
        this.logger.log(
          `Successfully created Qdrant collection: ${collectionName}`,
        );
      } catch (creationError) {
        if (creationError instanceof Error) {
          this.logger.error(
            'Could not initialize Qdrant. Vector search will fail.',
            creationError.stack,
          );
        } else {
          this.logger.error(
            'Could not initialize Qdrant. Vector search will fail.',
            String(creationError),
          );
        }
      }
    }
  }

  /**
   * Search the vector store for context related to a query
   * @param query The user's query
   * @param k Number of documents to return
   * @returns Formatted string of retrieved context
   */
  async searchContext(query: string, k: number = 3): Promise<string> {
    if (!this.vectorStore) {
      this.logger.warn(
        'Qdrant vector store is not initialized. Returning empty context.',
      );
      return '';
    }

    try {
      this.logger.debug(`Searching Qdrant for: "${query}"`);

      const results: Document[] = await this.vectorStore.similaritySearch(
        query,
        k,
      );

      if (results.length === 0) {
        return 'No relevant market insights found in the knowledge base.';
      }

      const contextItems = results.map(
        (doc: Document, idx: number) =>
          `[Source ${idx + 1}]: ${doc.pageContent}`,
      );
      return contextItems.join('\n\n');
    } catch (error) {
      if (error instanceof Error) {
        this.logger.error(`Error during Qdrant similarity search`, error.stack);
      } else {
        this.logger.error(
          `Error during Qdrant similarity search`,
          String(error),
        );
      }
      return 'Error retrieving market insights.';
    }
  }
}
