-- GST invoicing support: add HSN code, GST rate to products; state to customers and settings; tax breakdown to sales

-- Products: HSN/SAC code and default GST rate
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS hsn_code text DEFAULT '';
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS gst_rate numeric DEFAULT 5;

-- Customers: state for intra/inter-state determination
ALTER TABLE public.customers ADD COLUMN IF NOT EXISTS state text DEFAULT '';

-- Settings: business home state
ALTER TABLE public.settings ADD COLUMN IF NOT EXISTS state text DEFAULT '';

-- Sales: full GST tax breakdown
ALTER TABLE public.sales ADD COLUMN IF NOT EXISTS tax_rate numeric DEFAULT 0;
ALTER TABLE public.sales ADD COLUMN IF NOT EXISTS cgst_amount numeric DEFAULT 0;
ALTER TABLE public.sales ADD COLUMN IF NOT EXISTS sgst_amount numeric DEFAULT 0;
ALTER TABLE public.sales ADD COLUMN IF NOT EXISTS igst_amount numeric DEFAULT 0;
ALTER TABLE public.sales ADD COLUMN IF NOT EXISTS is_inter_state boolean DEFAULT false;
ALTER TABLE public.sales ADD COLUMN IF NOT EXISTS customer_state text DEFAULT '';
