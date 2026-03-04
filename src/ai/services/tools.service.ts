import { Injectable, Logger } from '@nestjs/common';
import { tool } from '@langchain/core/tools';
import { z } from 'zod';
import type { StructuredToolInterface } from '@langchain/core/tools';

@Injectable()
export class ToolsService {
  private readonly logger = new Logger(ToolsService.name);

  /**
   * Generates all available tools for the Real Estate Agent.
   * Based on the user roles and context, we can conditionally add tools here.
   */
  getAvailableTools(userRoles: string[]): StructuredToolInterface[] {
    const defaultTools: StructuredToolInterface[] = [
      this.searchPropertyDatabase(),
      this.predictPropertyPrice(),
      this.getComparableProperties(),
      this.getRecommendations(),
    ];

    // Example of Role-based tool access (RBAC)
    if (
      userRoles.includes('PREMIUM_SUBSCRIBER') ||
      userRoles.includes('ADMIN')
    ) {
      // Add exclusive tools like Deep Market Analysis
      this.logger.debug('Adding premium market analysis tools for user.');
    }

    return defaultTools;
  }

  // 1. Tool-calling Agent: Query internal property database
  private searchPropertyDatabase() {
    return tool(
      ({ location, maxPrice, propertyType }) => {
        this.logger.log(
          `Searching DB for: ${location}, <${maxPrice}, type: ${propertyType}`,
        );
        // TODO: Call your actual Backend API here
        return JSON.stringify([
          {
            id: '101',
            title: 'Modern Villa Da Nang',
            price: 2800000000,
            type: 'Villa',
          },
          {
            id: '102',
            title: 'Cozy Apartment Da Nang',
            price: 1500000000,
            type: 'Apartment',
          },
        ]);
      },
      {
        name: 'search_property_database',
        description:
          'Queries the internal real estate database for active listings matching criteria. Always call this when a user asks to find or search for properties.',
        schema: z.object({
          location: z
            .string()
            .describe('The geographical location, eg city or district.'),
          maxPrice: z
            .number()
            .optional()
            .describe('Maximum allowed price in VND.'),
          propertyType: z
            .string()
            .optional()
            .describe('Type of property: Apartment, Villa, Land, etc.'),
        }),
      },
    );
  }

  // 2. Trigger price prediction model
  private predictPropertyPrice() {
    return tool(
      ({ propertyId }) => {
        this.logger.log(
          `Triggering Price Model for Property ID: ${propertyId}`,
        );
        // TODO: Call your ML Backend API
        return JSON.stringify({
          estimated_value: 2950000000,
          confidence_score: 0.88,
        });
      },
      {
        name: 'predict_property_price',
        description:
          'Triggers the AI price prediction model to estimate the current market value of a specific property.',
        schema: z.object({
          propertyId: z
            .string()
            .describe('The unique identifier of the property.'),
        }),
      },
    );
  }

  // 3. Retrieve comparable properties
  private getComparableProperties() {
    return tool(
      ({ propertyId }) => {
        this.logger.log(`Fetching comps for Property ID: ${propertyId}`);
        // TODO: Call Backend Comps API
        return JSON.stringify([
          {
            title: 'Neighboring Villa 1',
            sold_price: 2700000000,
            date: '2026-01-15',
          },
          {
            title: 'Neighboring Villa 2',
            sold_price: 3100000000,
            date: '2025-11-20',
          },
        ]);
      },
      {
        name: 'get_comparable_properties',
        description:
          'Retrieves recently sold or listed comparable properties (comps) similar to a given property to evaluate market status.',
        schema: z.object({
          propertyId: z
            .string()
            .describe('The unique identifier of the target property.'),
        }),
      },
    );
  }

  // 4. Recommendation Engine
  private getRecommendations() {
    return tool(
      ({ userContext }) => {
        this.logger.log(
          `Fetching recommendations for user context: ${JSON.stringify(userContext)}`,
        );
        // TODO: Call Backend Recommendation Engine API
        return JSON.stringify([
          { title: 'Seaview Penthouse', reason: 'Matches your past views' },
          { title: 'Suburban Tech Hub Condo', reason: 'High projected ROI' },
        ]);
      },
      {
        name: 'get_recommendations',
        description:
          'Fetches personalized property recommendations for the user based on their historical behavior and preferences.',
        schema: z.object({
          userContext: z
            .string()
            .describe('A summary of what the user is looking for.'),
        }),
      },
    );
  }
}
