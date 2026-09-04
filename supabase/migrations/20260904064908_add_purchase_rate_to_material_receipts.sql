/*
# Add purchase rate and total purchase value to material_receipts

## Overview
Extends the existing material_receipts table with two new columns:
- purchase_rate_per_kg: the rate per kg paid to the vendor
- total_purchase_value: net_weight * purchase_rate_per_kg

## Modified Tables
- material_receipts: add purchase_rate_per_kg (decimal), total_purchase_value (decimal)

## Security
- No changes to RLS or policies. Existing policies remain intact.

## Notes
- Non-destructive: uses ADD COLUMN IF NOT EXISTS
- Existing rows get default values of 0
- No data is lost or modified beyond setting defaults on existing rows
*/

DO $$ BEGIN
  ALTER TABLE material_receipts ADD COLUMN IF NOT EXISTS purchase_rate_per_kg decimal(10,2) DEFAULT 0;
  ALTER TABLE material_receipts ADD COLUMN IF NOT EXISTS total_purchase_value decimal(12,2) DEFAULT 0;
EXCEPTION WHEN OTHERS THEN NULL; END $$;
