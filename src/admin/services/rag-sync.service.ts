import { Injectable, Logger } from '@nestjs/common';
import { Document } from '@langchain/core/documents';
import {
  BackendApiService,
  LocationDistrictDto,
  LocationWardDto,
} from '../../ai/services/backend-api.service';
import { QdrantService } from '../../ai/services/qdrant.service';

/** Category tag used for location knowledge documents in Qdrant */
const LOCATION_CATEGORY = 'location';

export interface SyncResult {
  category: string;
  documentsUpserted: number;
  durationMs: number;
}

@Injectable()
export class RagSyncService {
  private readonly logger = new Logger(RagSyncService.name);

  constructor(
    private readonly backendApiService: BackendApiService,
    private readonly qdrantService: QdrantService,
  ) {}

  /**
   * Sync location knowledge into Qdrant.
   *
   * 1. Fetch all districts (with wards) from Spring Boot backend
   * 2. Delete existing location documents in Qdrant (idempotent re-sync)
   * 3. Generate one natural-language document per district
   * 4. Embed + upsert into Qdrant
   */
  async syncLocations(): Promise<SyncResult> {
    const start = Date.now();
    this.logger.log('Starting location knowledge sync...');

    // 1. Fetch districts from backend
    const districts = await this.backendApiService.getLocations();

    if (districts.length === 0) {
      this.logger.warn(
        'No districts returned from backend. Skipping location sync.',
      );
      return {
        category: LOCATION_CATEGORY,
        documentsUpserted: 0,
        durationMs: Date.now() - start,
      };
    }

    this.logger.log(`Fetched ${districts.length} districts from backend`);

    // 2. Delete existing location documents (clean re-sync, no duplicates)
    await this.qdrantService.deleteByCategory(LOCATION_CATEGORY);

    // 3. Generate documents
    const documents = this.generateLocationDocuments(districts);

    this.logger.log(`Generated ${documents.length} location documents`);

    // 4. Upsert to Qdrant (batch to avoid overwhelming the embedding API)
    const BATCH_SIZE = 20;
    let totalUpserted = 0;

    for (let i = 0; i < documents.length; i += BATCH_SIZE) {
      const batch = documents.slice(i, i + BATCH_SIZE);
      const upserted = await this.qdrantService.upsertDocuments(batch);
      totalUpserted += upserted;

      this.logger.log(
        `Batch ${Math.floor(i / BATCH_SIZE) + 1}: upserted ${upserted} documents`,
      );
    }

    const durationMs = Date.now() - start;
    this.logger.log(
      `Location sync complete: ${totalUpserted} documents in ${durationMs}ms`,
    );

    return {
      category: LOCATION_CATEGORY,
      documentsUpserted: totalUpserted,
      durationMs,
    };
  }

  /**
   * Transform each district into a natural-language Vietnamese document
   * suitable for RAG retrieval.
   *
   * Documents include location UUIDs inline so the LLM can extract them
   * and pass the correct locationId to the search_property_database tool.
   *
   * Format examples:
   *   City:     "Thành phố Đà Nẵng (locationId: "abc-123") bao gồm..."
   *   District: "Quận Hải Châu (locationId: "def-456") thuộc thành phố Đà Nẵng (locationId: "abc-123")."
   *   Wards:    "Hải Châu 1 (locationId: "jkl-012"), Hải Châu 2 (locationId: "mno-345")"
   */
  private generateLocationDocuments(
    districts: LocationDistrictDto[],
  ): Document[] {
    // Group districts by city for city-level summary documents
    const citiesMap = new Map<
      string,
      { cityId: string; cityName: string; districts: LocationDistrictDto[] }
    >();

    for (const d of districts) {
      const existing = citiesMap.get(d.cityId);
      if (existing) {
        existing.districts.push(d);
      } else {
        citiesMap.set(d.cityId, {
          cityId: d.cityId,
          cityName: d.cityName,
          districts: [d],
        });
      }
    }

    const documents: Document[] = [];

    // City-level summary document (one per city)
    for (const [, city] of citiesMap) {
      const districtEntries = city.districts
        .map((d) => `${d.name} (locationId: "${d.id}")`)
        .join(', ');

      const pageContent =
        `Thành phố ${city.cityName} (locationId: "${city.cityId}") bao gồm các quận/huyện sau: ${districtEntries}. ` +
        `Tổng cộng có ${city.districts.length} quận/huyện.`;

      documents.push(
        new Document({
          pageContent,
          metadata: {
            category: LOCATION_CATEGORY,
            cityId: city.cityId,
            city: city.cityName,
            type: 'CITY_SUMMARY',
            updatedAt: new Date().toISOString(),
          },
        }),
      );
    }

    // District-level documents (one per district, includes ward UUIDs)
    for (const district of districts) {
      const wardList =
        district.wards.length > 0
          ? district.wards
              .map((w: LocationWardDto) => `${w.name} (locationId: "${w.id}")`)
              .join(', ')
          : 'Chưa có thông tin phường/xã';

      const pageContent =
        `${district.name} (locationId: "${district.id}") thuộc thành phố ${district.cityName} (locationId: "${district.cityId}"). ` +
        `Các phường/xã trực thuộc ${district.name}: ${wardList}.`;

      documents.push(
        new Document({
          pageContent,
          metadata: {
            category: LOCATION_CATEGORY,
            cityId: district.cityId,
            city: district.cityName,
            districtId: district.id,
            district: district.name,
            type: 'DISTRICT',
            updatedAt: new Date().toISOString(),
          },
        }),
      );
    }

    return documents;
  }
}
