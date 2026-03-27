import { Injectable, Logger } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { firstValueFrom } from 'rxjs';
import { AxiosError } from 'axios';

// ── Location types ──────────────────────────────────────────────────────────

export interface LocationWardDto {
  id: string; // UUID
  name: string;
}

export interface LocationDistrictDto {
  id: string; // UUID
  name: string;
  type: string; // "DISTRICT"
  cityId: string; // UUID of parent city
  cityName: string;
  wards: LocationWardDto[];
}

interface LocationApiResponse {
  success: boolean;
  data: LocationDistrictDto[];
}

// ── Listing search types ────────────────────────────────────────────────────

export interface ListingSearchParams {
  locationId: string; // UUID — city, district, or ward level
  minPrice?: number;
  maxPrice?: number;
  listingType?: 'SALE' | 'RENT';
  propertyType?: string;
  size?: number;
}

export interface ListingSearchResult {
  listingId: string;
  name: string;
  listingType: string;
  price: number;
  area: number;
  fullAddress: string;
  thumbnail: string;
  url: string;
  attributes: string; // compact summary string for LLM context
  publishedAt: string;
}

interface AttributeDto {
  attribute_name: string;
  display_value: string;
  unit?: string;
}

interface ListingDto {
  listingId: string;
  name: string;
  slug: string;
  listingType: string;
  price: number;
  area: number;
  full_address: string;
  thumbnail: string;
  publishedAt: string;
  attributes?: AttributeDto[];
}

interface PageResponse {
  content: ListingDto[];
}

interface ApiResponse {
  success: boolean;
  data: PageResponse;
}

@Injectable()
export class BackendApiService {
  private readonly logger = new Logger(BackendApiService.name);
  private readonly backendUrl: string;
  private readonly serviceApiKey: string;
  private readonly frontendUrl: string;

  constructor(
    private readonly httpService: HttpService,
    private readonly configService: ConfigService,
  ) {
    this.backendUrl = this.configService.getOrThrow<string>('BACKEND_API_URL');
    this.serviceApiKey =
      this.configService.getOrThrow<string>('SERVICE_API_KEY');
    this.frontendUrl = this.configService.get<string>(
      'FRONTEND_URL',
      'http://localhost:3000',
    );
  }

  /**
   * Fetch all districts with ward names from the Spring Boot backend.
   * Used by the RAG sync pipeline to generate location knowledge documents.
   */
  async getLocations(): Promise<LocationDistrictDto[]> {
    this.logger.log('Fetching locations from backend...');

    try {
      const response = await firstValueFrom(
        this.httpService.get<LocationApiResponse>(
          `${this.backendUrl}/internal/ai/locations`,
          {
            headers: { 'x-service-api-key': this.serviceApiKey },
          },
        ),
      );

      const locations = response.data?.data ?? [];
      this.logger.log(`Fetched ${locations.length} districts from backend`);
      return locations;
    } catch (error) {
      if (error instanceof AxiosError) {
        this.logger.error(
          `Backend locations fetch failed: ${error.response?.status} ${error.message}`,
        );
      } else if (error instanceof Error) {
        this.logger.error(`Backend locations error: ${error.message}`);
      }
      return [];
    }
  }

  /**
   * Search listings from the Spring Boot backend AI-dedicated endpoint.
   * Returns up to `size` (default 10) compact listings ready for LLM context.
   */
  async searchListings(
    params: ListingSearchParams,
  ): Promise<ListingSearchResult[]> {
    const {
      locationId,
      minPrice,
      maxPrice,
      listingType,
      propertyType,
      size = 10,
    } = params;

    this.logger.log(
      `Calling backend search: locationId=${locationId}, listingType=${listingType}, maxPrice=${maxPrice}`,
    );

    try {
      const response = await firstValueFrom(
        this.httpService.get<ApiResponse>(
          `${this.backendUrl}/internal/ai/listings`,
          {
            params: {
              locationId,
              ...(minPrice !== undefined && { minPrice }),
              ...(maxPrice !== undefined && { maxPrice }),
              ...(listingType && { listingType }),
              ...(propertyType && { propertyType }),
              size,
            },
            headers: {
              'x-service-api-key': this.serviceApiKey,
            },
          },
        ),
      );

      const listings: ListingDto[] = response.data?.data?.content ?? [];

      return listings.map((l) => this.mapToSearchResult(l));
    } catch (error) {
      if (error instanceof AxiosError) {
        this.logger.error(
          `Backend search failed: ${error.response?.status} ${error.message}`,
        );
      } else if (error instanceof Error) {
        this.logger.error(`Backend search error: ${error.message}`);
      }
      // Return empty array — the LLM will handle the no-results case gracefully
      return [];
    }
  }

  private mapToSearchResult(l: ListingDto): ListingSearchResult {
    // Summarise attributes into a compact string so the LLM doesn't get overwhelmed
    const attributeSummary =
      l.attributes
        ?.filter((a) => a.display_value)
        .map((a) =>
          a.unit
            ? `${a.attribute_name}: ${a.display_value} ${a.unit}`
            : `${a.attribute_name}: ${a.display_value}`,
        )
        .join(', ') ?? '';

    return {
      listingId: l.listingId,
      name: l.name,
      listingType: l.listingType,
      price: l.price,
      area: l.area,
      fullAddress: l.full_address,
      thumbnail: l.thumbnail ?? '',
      url: `${this.frontendUrl}/listings/${l.slug}`,
      attributes: attributeSummary,
      publishedAt: l.publishedAt,
    };
  }
}
