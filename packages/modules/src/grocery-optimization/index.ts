import { z } from 'zod';
import type { AppContext, Module, ModuleRegistration } from '@arrivalos/core';

export const GroceryOptimizationInputSchema = z.object({
  monthlyBudget: z.number().positive(),
  householdSize: z.number().int().positive().default(1),
  dietaryRestrictions: z.array(z.enum([
    'vegetarian', 'vegan', 'halal', 'kosher', 'gluten-free', 'lactose-free',
  ])).default([]),
  preferredStores: z.array(z.enum([
    'aldi', 'lidl', 'rewe', 'edeka', 'netto', 'penny', 'turkish-market', 'asian-market',
  ])).default([]),
  city: z.string().optional(),
});

export const GroceryOptimizationOutputSchema = z.object({
  budgetBreakdown: z.object({
    total: z.number(),
    perPerson: z.number(),
    perDay: z.number(),
    perMeal: z.number(),
  }),
  storeRecommendations: z.array(z.object({
    store: z.string(),
    strategy: z.string(),
    estimatedSavings: z.string(),
  })),
  shoppingPlan: z.array(z.object({
    category: z.string(),
    items: z.array(z.string()),
    estimatedCost: z.number(),
    tip: z.string().optional(),
  })),
  decisions: z.array(z.object({
    title: z.string(),
    description: z.string(),
    impact: z.enum(['high', 'medium', 'low']),
  })),
});

export type GroceryOptimizationInput = z.infer<typeof GroceryOptimizationInputSchema>;
export type GroceryOptimizationOutput = z.infer<typeof GroceryOptimizationOutputSchema>;

const BASE_STAPLES = [
  { category: 'Grains & Bread', items: ['Reisbrot', 'Haferflocken', 'Nudeln', 'Reis'], costRatio: 0.12 },
  { category: 'Proteins', items: ['Hähnchen', 'Eier', 'Linsen', 'Tofu'], costRatio: 0.25 },
  { category: 'Vegetables', items: ['Kartoffeln', 'Zwiebeln', 'Möhren', 'Seasonal greens'], costRatio: 0.20 },
  { category: 'Fruits', items: ['Äpfel', 'Bananen', 'Seasonal fruit'], costRatio: 0.10 },
  { category: 'Dairy & Alternatives', items: ['Milch', 'Joghurt', 'Käse'], costRatio: 0.15 },
  { category: 'Pantry', items: ['Öl', 'Gewürze', 'Tomatenmark', 'Hefe'], costRatio: 0.08 },
  { category: 'Beverages', items: ['Wasser', 'Tee', 'Saft'], costRatio: 0.05 },
  { category: 'Snacks & Extras', items: ['Nüsse', 'Schokolade'], costRatio: 0.05 },
];

export const groceryOptimizationModule: Module<GroceryOptimizationInput, GroceryOptimizationOutput> = {
  id: 'grocery-optimization',
  name: 'Grocery Optimization Module',
  version: '1.0.0',
  description: 'Optimizes food budget with store strategies and shopping plans for migrant households',
  inputSchema: GroceryOptimizationInputSchema,
  outputSchema: GroceryOptimizationOutputSchema,

  async execute(input, _context: AppContext): Promise<GroceryOptimizationOutput> {
    const perPerson = input.monthlyBudget / input.householdSize;
    const perDay = input.monthlyBudget / 30;
    const perMeal = perDay / 3;

    const storeRecommendations = [
      {
        store: 'Aldi / Lidl',
        strategy: 'Buy staples, dairy, and frozen goods here — 20–30% cheaper than Rewe/Edeka',
        estimatedSavings: '€30–60/month',
      },
      {
        store: 'Turkish / Asian Market',
        strategy: 'Bulk spices, rice, lentils, fresh produce at lower prices',
        estimatedSavings: '€15–40/month',
      },
    ];

    if (input.preferredStores.includes('rewe') || input.preferredStores.includes('edeka')) {
      storeRecommendations.push({
        store: 'Rewe / Edeka',
        strategy: 'Use for fresh produce and items not available at discount stores — shop reduced items (30% Rabatt) in evening',
        estimatedSavings: '€10–20/month with timing strategy',
      });
    }

    const shoppingPlan = BASE_STAPLES.map((staple) => {
      let items = [...staple.items];
      if (input.dietaryRestrictions.includes('vegetarian') || input.dietaryRestrictions.includes('vegan')) {
        items = items.filter((i) => !['Hähnchen'].includes(i));
      }
      if (input.dietaryRestrictions.includes('vegan')) {
        items = items.filter((i) => !['Eier', 'Milch', 'Joghurt', 'Käse'].includes(i));
        items.push('Hafermilch', 'Kichererbsen');
      }

      return {
        category: staple.category,
        items,
        estimatedCost: Math.round(input.monthlyBudget * staple.costRatio),
        tip: staple.category === 'Vegetables'
          ? 'Buy seasonal — Spargel in spring, Kürbis in autumn are cheapest'
          : undefined,
      };
    });

    const decisions: GroceryOptimizationOutput['decisions'] = [];

    if (perPerson < 150) {
      decisions.push({
        title: 'Tight budget detected',
        description: `€${Math.round(perPerson)}/person/month is below average. Prioritize staples at Aldi/Lidl and ethnic markets.`,
        impact: 'high',
      });
    }

    if (perMeal < 2) {
      decisions.push({
        title: 'Very low per-meal budget',
        description: 'Focus on bulk cooking: Eintopf, Linsensuppe, and rice-based meals stretch budget furthest.',
        impact: 'high',
      });
    }

    decisions.push({
      title: 'Pfand system reminder',
      description: 'Return bottles (Pfand) for €0.08–0.25 each. Use Pfandbon at same store chain.',
      impact: 'low',
    });

    if (input.householdSize > 1) {
      decisions.push({
        title: 'Batch cooking strategy',
        description: `Cook for ${input.householdSize} in large batches on weekends — saves time and reduces per-meal cost by ~15%.`,
        impact: 'medium',
      });
    }

    return {
      budgetBreakdown: {
        total: input.monthlyBudget,
        perPerson: Math.round(perPerson * 100) / 100,
        perDay: Math.round(perDay * 100) / 100,
        perMeal: Math.round(perMeal * 100) / 100,
      },
      storeRecommendations,
      shoppingPlan,
      decisions,
    };
  },
};

export const groceryOptimizationRegistration: ModuleRegistration = {
  ...groceryOptimizationModule,
  enabled: true,
  featureFlags: { priceComparison: false },
  module: groceryOptimizationModule,
};
