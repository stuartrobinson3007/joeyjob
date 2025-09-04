import { z } from "zod";

import { dataTableConfig } from "../config/data-table";


const sortingItemSchema = z.object({
  id: z.string(),
  desc: z.boolean(),
});

const filterItemSchema = z.object({
  id: z.string(),
  value: z.union([z.string(), z.array(z.string())]),
  variant: z.enum(dataTableConfig.filterVariants),
  operator: z.enum(dataTableConfig.operators),
  filterId: z.string(),
});

export type FilterItemSchema = z.infer<typeof filterItemSchema>;

// These parsers are now just schema validators, 
// the actual URL state management should be handled by apps
export const sortingItemValidator = sortingItemSchema;
export const filterItemValidator = filterItemSchema;