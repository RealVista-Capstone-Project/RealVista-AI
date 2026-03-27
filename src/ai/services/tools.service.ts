import { Injectable, Logger } from '@nestjs/common';
import { tool } from '@langchain/core/tools';
import { z } from 'zod';
import type { StructuredToolInterface } from '@langchain/core/tools';
import { BackendApiService } from './backend-api.service.js';

@Injectable()
export class ToolsService {
  private readonly logger = new Logger(ToolsService.name);

  constructor(private readonly backendApiService: BackendApiService) {}

  /**
   * Returns the tools available for the Real Estate Chat Agent.
   * RBAC can conditionally add premium tools based on user roles.
   */
  getAvailableTools(userRoles: string[]): StructuredToolInterface[] {
    const defaultTools: StructuredToolInterface[] = [
      this.searchPropertyDatabase(),
    ];

    // Premium tools (e.g. deep market analysis) can be unlocked here
    if (
      userRoles.includes('PREMIUM_SUBSCRIBER') ||
      userRoles.includes('ADMIN')
    ) {
      this.logger.debug('Adding premium tools for user.');
      // TODO: add premium tools when available
    }

    return defaultTools;
  }

  /**
   * Search listings from the Spring Boot backend.
   * Returns up to 10 matching listings as compact JSON for the LLM to reason over.
   */
  private searchPropertyDatabase() {
    return tool(
      async ({ locationId, minPrice, maxPrice, listingType, propertyType }) => {
        this.logger.log(
          `[Tool] search_property_database — locationId="${locationId}", type=${listingType}, propertyType=${propertyType}, price=${minPrice}–${maxPrice}`,
        );

        const results = await this.backendApiService.searchListings({
          locationId,
          minPrice,
          maxPrice,
          listingType,
          propertyType,
          size: 10,
        });

        if (!results.length) {
          return JSON.stringify({
            found: 0,
            message:
              'Không tìm thấy bất động sản nào phù hợp với tiêu chí tìm kiếm. Hãy thử mở rộng điều kiện tìm kiếm.',
          });
        }

        return JSON.stringify({ found: results.length, listings: results });
      },
      {
        name: 'search_property_database',
        description:
          'Searches the RealVista database for active property listings that match the given criteria. ' +
          'Call this whenever the user wants to find, browse, or search for properties. ' +
          'Always call this tool before presenting any listing — never invent property data.',
        schema: z.object({
          locationId: z
            .string()
            .describe(
              'UUID of the city, district, or ward to search in. ' +
                'Extract this from the [RAG Knowledge] section — look for "(locationId: ...)". ' +
                'NEVER guess or fabricate a locationId. If you cannot find a matching location, ask the user to clarify.',
            ),
          minPrice: z
            .number()
            .optional()
            .describe('Minimum price in VND (e.g. 1000000000 for 1 tỷ).'),
          maxPrice: z
            .number()
            .optional()
            .describe('Maximum price in VND (e.g. 3000000000 for 3 tỷ).'),
          listingType: z
            .enum(['SALE', 'RENT'])
            .optional()
            .describe(
              'Whether to search for properties for sale (SALE) or for rent (RENT). Omit if not specified.',
            ),
          propertyType: z
            .string()
            .optional()
            .describe(
              'Type of property, e.g. "Apartment" (căn hộ), "Villa" (biệt thự), "Land" (đất nền), "House" (nhà phố).',
            ),
        }),
      },
    );
  }
}
