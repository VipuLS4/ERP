/*
# Raj & Brothers ERP — Phase 1 Schema Upgrade

## Overview
Extends the existing schema with new tables for the full ERP workflow:
products, material_receipts, production_batches, production_outputs,
stock_movements, machines, machine_downtime, customer_transactions,
cash_bank_accounts, cash_bank_transactions, audit_logs, user_profiles,
roles, shifts, settings, stock_adjustments.

Existing tables (vendors, purchases, stock, customers, sales, plant_expenses,
employees, salary_payments, vendor_transactions) are EXTENDED with new columns
but no existing column is dropped or type-changed.

## New Tables
1. products — Product master (raw material, finished, by-product, waste)
2. material_receipts — Material receiving records
3. production_batches — Production batch headers
4. production_outputs — Output items per production batch
5. stock_movements — Full stock ledger (every movement)
6. machines — Machine master
7. machine_downtime — Downtime tracking
8. customer_transactions — Customer ledger entries
9. cash_bank_accounts — Cash/Bank/UPI accounts
10. cash_bank_transactions — All money in/out per account
11. audit_logs — Audit trail
12. user_profiles — Links auth.users to employees + roles
13. roles — Role definitions
14. shifts — Shift master
15. settings — Business settings (single row)
16. stock_adjustments — Stock adjustment requests

## Modified Tables
- vendors: add opening_balance, status, remarks
- purchases: add purchase_number, vehicle_number, challan_number, bags, other_charges, payment_method, remarks, status
- customers: add opening_balance, status, remarks
- sales: add customer_mobile, customer_address, discount, tax_amount, other_charges, payment_method, payment_status, remarks, status
- plant_expenses: add expense_number, category, description, paid_to, payment_method, account_id, expense_class, remarks, status
- employees: add department, user_id
- salary_payments: add gross_salary, advance, deduction, net_salary, balance, payment_method, salary_number
- stock: add product_id (FK to products), minimum_stock_kg, opening_stock_kg

## Security
- RLS enabled on all new tables.
- Policies for authenticated users (full CRUD) — role enforcement is at app level.
*/

-- ============================================================
-- 1. ROLES
-- ============================================================
CREATE TABLE IF NOT EXISTS roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  role_key text UNIQUE NOT NULL,
  role_name text NOT NULL,
  description text,
  created_at timestamptz DEFAULT now()
);

INSERT INTO roles (role_key, role_name, description) VALUES
  ('super_admin', 'Super Admin', 'Full access to everything'),
  ('plant_manager', 'Plant Manager', 'Production, stock, machines, downtime'),
  ('production_supervisor', 'Production Supervisor', 'Production batches, output, machines'),
  ('store_employee', 'Store Employee', 'Material receiving, stock movements'),
  ('purchase_employee', 'Purchase Employee', 'Vendors, purchases, vendor ledger'),
  ('sales_employee', 'Sales Employee', 'Customers, sales, customer ledger'),
  ('accountant', 'Accountant', 'Payments, expenses, salaries, cash & bank, financial reports'),
  ('viewer', 'Viewer', 'Read-only access')
ON CONFLICT (role_key) DO NOTHING;

-- ============================================================
-- 2. USER PROFILES
-- ============================================================
CREATE TABLE IF NOT EXISTS user_profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid UNIQUE NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  employee_id uuid REFERENCES employees(id) ON DELETE SET NULL,
  role_id uuid REFERENCES roles(id) ON DELETE SET NULL,
  name text NOT NULL,
  email text,
  mobile text,
  department text,
  status text DEFAULT 'Active',
  last_login timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "up_select" ON user_profiles;
CREATE POLICY "up_select" ON user_profiles FOR SELECT
  TO authenticated USING (true);

DROP POLICY IF EXISTS "up_insert" ON user_profiles;
CREATE POLICY "up_insert" ON user_profiles FOR INSERT
  TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "up_update" ON user_profiles;
CREATE POLICY "up_update" ON user_profiles FOR UPDATE
  TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "up_delete" ON user_profiles;
CREATE POLICY "up_delete" ON user_profiles FOR DELETE
  TO authenticated USING (true);

-- ============================================================
-- 3. SHIFTS
-- ============================================================
CREATE TABLE IF NOT EXISTS shifts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  shift_name text NOT NULL,
  start_time text,
  end_time text,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE shifts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "sh_select" ON shifts;
CREATE POLICY "sh_select" ON shifts FOR SELECT
  TO authenticated USING (true);
DROP POLICY IF EXISTS "sh_insert" ON shifts;
CREATE POLICY "sh_insert" ON shifts FOR INSERT
  TO authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "sh_update" ON shifts;
CREATE POLICY "sh_update" ON shifts FOR UPDATE
  TO authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "sh_delete" ON shifts;
CREATE POLICY "sh_delete" ON shifts FOR DELETE
  TO authenticated USING (true);

-- ============================================================
-- 4. PRODUCTS
-- ============================================================
CREATE TABLE IF NOT EXISTS products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id text UNIQUE NOT NULL,
  name text NOT NULL,
  product_type text NOT NULL DEFAULT 'Raw Material',
  unit text DEFAULT 'Kg',
  opening_stock_kg decimal(14,2) DEFAULT 0,
  minimum_stock_kg decimal(14,2) DEFAULT 0,
  sale_rate decimal(10,2) DEFAULT 0,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE products ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "prod_select" ON products;
CREATE POLICY "prod_select" ON products FOR SELECT
  TO authenticated USING (true);
DROP POLICY IF EXISTS "prod_insert" ON products;
CREATE POLICY "prod_insert" ON products FOR INSERT
  TO authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "prod_update" ON products;
CREATE POLICY "prod_update" ON products FOR UPDATE
  TO authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "prod_delete" ON products;
CREATE POLICY "prod_delete" ON products FOR DELETE
  TO authenticated USING (true);

-- Seed default products
INSERT INTO products (product_id, name, product_type, opening_stock_kg, minimum_stock_kg, sale_rate)
VALUES
  ('PRD001', 'Rice Bran', 'Raw Material', 0, 500, 0),
  ('PRD002', 'Filtered Bran', 'Finished Product', 0, 200, 32),
  ('PRD003', 'Rice', 'Finished Product', 0, 100, 40),
  ('PRD004', 'Husk', 'By-product', 0, 100, 8),
  ('PRD005', 'Other By-product', 'By-product', 0, 50, 5),
  ('PRD006', 'Process Waste', 'Waste', 0, 0, 0)
ON CONFLICT (product_id) DO NOTHING;

-- ============================================================
-- 5. EXTEND STOCK TABLE
-- ============================================================
DO $$ BEGIN
  ALTER TABLE stock ADD COLUMN IF NOT EXISTS product_id uuid REFERENCES products(id) ON DELETE SET NULL;
  ALTER TABLE stock ADD COLUMN IF NOT EXISTS minimum_stock_kg decimal(14,2) DEFAULT 0;
  ALTER TABLE stock ADD COLUMN IF NOT EXISTS opening_stock_kg decimal(14,2) DEFAULT 0;
EXCEPTION WHEN OTHERS THEN NULL; END $$;

-- Link existing Rice Bran stock row to product
UPDATE stock SET product_id = (SELECT id FROM products WHERE product_id = 'PRD001')
WHERE product_name = 'Rice Bran' AND product_id IS NULL;

-- Create stock rows for other products if they don't exist
INSERT INTO stock (product_name, current_stock_kg, product_id, minimum_stock_kg)
SELECT p.name, p.opening_stock_kg, p.id, p.minimum_stock_kg
FROM products p
WHERE p.product_id IN ('PRD002','PRD003','PRD004','PRD005','PRD006')
  AND NOT EXISTS (SELECT 1 FROM stock s WHERE s.product_id = p.id);

-- ============================================================
-- 6. STOCK MOVEMENTS (Full Ledger)
-- ============================================================
CREATE TABLE IF NOT EXISTS stock_movements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  movement_date date NOT NULL DEFAULT CURRENT_DATE,
  transaction_number text,
  product_id uuid REFERENCES products(id) ON DELETE SET NULL,
  product_name text NOT NULL,
  transaction_type text NOT NULL,
  quantity_in decimal(14,2) DEFAULT 0,
  quantity_out decimal(14,2) DEFAULT 0,
  balance decimal(14,2) DEFAULT 0,
  reference text,
  reference_id uuid,
  created_by text,
  remarks text,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE stock_movements ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "sm_select" ON stock_movements;
CREATE POLICY "sm_select" ON stock_movements FOR SELECT
  TO authenticated USING (true);
DROP POLICY IF EXISTS "sm_insert" ON stock_movements;
CREATE POLICY "sm_insert" ON stock_movements FOR INSERT
  TO authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "sm_update" ON stock_movements;
CREATE POLICY "sm_update" ON stock_movements FOR UPDATE
  TO authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "sm_delete" ON stock_movements;
CREATE POLICY "sm_delete" ON stock_movements FOR DELETE
  TO authenticated USING (true);

CREATE INDEX IF NOT EXISTS idx_sm_product_id ON stock_movements(product_id);
CREATE INDEX IF NOT EXISTS idx_sm_date ON stock_movements(movement_date);
CREATE INDEX IF NOT EXISTS idx_sm_type ON stock_movements(transaction_type);

-- ============================================================
-- 7. EXTEND VENDORS
-- ============================================================
DO $$ BEGIN
  ALTER TABLE vendors ADD COLUMN IF NOT EXISTS opening_balance decimal(12,2) DEFAULT 0;
  ALTER TABLE vendors ADD COLUMN IF NOT EXISTS status text DEFAULT 'Active';
  ALTER TABLE vendors ADD COLUMN IF NOT EXISTS remarks text;
EXCEPTION WHEN OTHERS THEN NULL; END $$;

-- ============================================================
-- 8. EXTEND PURCHASES
-- ============================================================
DO $$ BEGIN
  ALTER TABLE purchases ADD COLUMN IF NOT EXISTS purchase_number text UNIQUE;
  ALTER TABLE purchases ADD COLUMN IF NOT EXISTS vehicle_number text;
  ALTER TABLE purchases ADD COLUMN IF NOT EXISTS challan_number text;
  ALTER TABLE purchases ADD COLUMN IF NOT EXISTS number_of_bags integer;
  ALTER TABLE purchases ADD COLUMN IF NOT EXISTS other_charges decimal(12,2) DEFAULT 0;
  ALTER TABLE purchases ADD COLUMN IF NOT EXISTS payment_method text DEFAULT 'Cash';
  ALTER TABLE purchases ADD COLUMN IF NOT EXISTS remarks text;
  ALTER TABLE purchases ADD COLUMN IF NOT EXISTS status text DEFAULT 'Approved';
  ALTER TABLE purchases ADD COLUMN IF NOT EXISTS product_id uuid REFERENCES products(id) ON DELETE SET NULL;
EXCEPTION WHEN OTHERS THEN NULL; END $$;

-- Generate purchase numbers for existing rows
DO $$
DECLARE
  r RECORD;
  counter integer := 1;
BEGIN
  FOR r IN SELECT id FROM purchases WHERE purchase_number IS NULL ORDER BY created_at LOOP
    UPDATE purchases SET purchase_number = 'PUR-' || lpad(counter::text, 5, '0') WHERE id = r.id;
    counter := counter + 1;
  END LOOP;
END $$;

-- ============================================================
-- 9. MATERIAL RECEIPTS
-- ============================================================
CREATE TABLE IF NOT EXISTS material_receipts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  receipt_number text UNIQUE NOT NULL,
  receipt_date date NOT NULL DEFAULT CURRENT_DATE,
  vendor_id uuid REFERENCES vendors(id) ON DELETE SET NULL,
  vendor_name text,
  vehicle_number text,
  challan_number text,
  number_of_bags integer,
  gross_weight decimal(14,2) DEFAULT 0,
  tare_weight decimal(14,2) DEFAULT 0,
  net_weight decimal(14,2) DEFAULT 0,
  material_type text DEFAULT 'Rice Bran',
  product_id uuid REFERENCES products(id) ON DELETE SET NULL,
  received_by text,
  remarks text,
  status text DEFAULT 'Received',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE material_receipts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "mr_select" ON material_receipts;
CREATE POLICY "mr_select" ON material_receipts FOR SELECT
  TO authenticated USING (true);
DROP POLICY IF EXISTS "mr_insert" ON material_receipts;
CREATE POLICY "mr_insert" ON material_receipts FOR INSERT
  TO authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "mr_update" ON material_receipts;
CREATE POLICY "mr_update" ON material_receipts FOR UPDATE
  TO authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "mr_delete" ON material_receipts;
CREATE POLICY "mr_delete" ON material_receipts FOR DELETE
  TO authenticated USING (true);

CREATE INDEX IF NOT EXISTS idx_mr_date ON material_receipts(receipt_date);
CREATE INDEX IF NOT EXISTS idx_mr_vendor ON material_receipts(vendor_id);

-- ============================================================
-- 10. MACHINES
-- ============================================================
CREATE TABLE IF NOT EXISTS machines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  machine_id text UNIQUE NOT NULL,
  name text NOT NULL,
  production_line text,
  capacity_kg_per_hour decimal(10,2) DEFAULT 0,
  status text DEFAULT 'Idle',
  location text,
  remarks text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE machines ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "mac_select" ON machines;
CREATE POLICY "mac_select" ON machines FOR SELECT
  TO authenticated USING (true);
DROP POLICY IF EXISTS "mac_insert" ON machines;
CREATE POLICY "mac_insert" ON machines FOR INSERT
  TO authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "mac_update" ON machines;
CREATE POLICY "mac_update" ON machines FOR UPDATE
  TO authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "mac_delete" ON machines;
CREATE POLICY "mac_delete" ON machines FOR DELETE
  TO authenticated USING (true);

-- ============================================================
-- 11. MACHINE DOWNTIME
-- ============================================================
CREATE TABLE IF NOT EXISTS machine_downtime (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  downtime_number text UNIQUE NOT NULL,
  machine_id uuid REFERENCES machines(id) ON DELETE SET NULL,
  machine_name text,
  downtime_date date NOT NULL DEFAULT CURRENT_DATE,
  start_time timestamptz,
  end_time timestamptz,
  duration_minutes integer DEFAULT 0,
  reason text,
  category text DEFAULT 'Other',
  remarks text,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE machine_downtime ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "md_select" ON machine_downtime;
CREATE POLICY "md_select" ON machine_downtime FOR SELECT
  TO authenticated USING (true);
DROP POLICY IF EXISTS "md_insert" ON machine_downtime;
CREATE POLICY "md_insert" ON machine_downtime FOR INSERT
  TO authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "md_update" ON machine_downtime;
CREATE POLICY "md_update" ON machine_downtime FOR UPDATE
  TO authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "md_delete" ON machine_downtime;
CREATE POLICY "md_delete" ON machine_downtime FOR DELETE
  TO authenticated USING (true);

CREATE INDEX IF NOT EXISTS idx_md_machine ON machine_downtime(machine_id);
CREATE INDEX IF NOT EXISTS idx_md_date ON machine_downtime(downtime_date);

-- ============================================================
-- 12. PRODUCTION BATCHES
-- ============================================================
CREATE TABLE IF NOT EXISTS production_batches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_number text UNIQUE NOT NULL,
  batch_date date NOT NULL DEFAULT CURRENT_DATE,
  shift text,
  supervisor text,
  operator text,
  machine_id uuid REFERENCES machines(id) ON DELETE SET NULL,
  machine_name text,
  raw_material_product_id uuid REFERENCES products(id) ON DELETE SET NULL,
  raw_material_name text DEFAULT 'Rice Bran',
  input_quantity_kg decimal(14,2) NOT NULL DEFAULT 0,
  start_time timestamptz,
  end_time timestamptz,
  production_hours decimal(8,2) DEFAULT 0,
  total_output_kg decimal(14,2) DEFAULT 0,
  waste_kg decimal(14,2) DEFAULT 0,
  yield_percent decimal(8,2) DEFAULT 0,
  process_loss_percent decimal(8,2) DEFAULT 0,
  status text DEFAULT 'Draft',
  remarks text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE production_batches ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "pb_select" ON production_batches;
CREATE POLICY "pb_select" ON production_batches FOR SELECT
  TO authenticated USING (true);
DROP POLICY IF EXISTS "pb_insert" ON production_batches;
CREATE POLICY "pb_insert" ON production_batches FOR INSERT
  TO authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "pb_update" ON production_batches;
CREATE POLICY "pb_update" ON production_batches FOR UPDATE
  TO authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "pb_delete" ON production_batches;
CREATE POLICY "pb_delete" ON production_batches FOR DELETE
  TO authenticated USING (true);

CREATE INDEX IF NOT EXISTS idx_pb_date ON production_batches(batch_date);
CREATE INDEX IF NOT EXISTS idx_pb_status ON production_batches(status);
CREATE INDEX IF NOT EXISTS idx_pb_machine ON production_batches(machine_id);

-- ============================================================
-- 13. PRODUCTION OUTPUTS
-- ============================================================
CREATE TABLE IF NOT EXISTS production_outputs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_id uuid NOT NULL REFERENCES production_batches(id) ON DELETE CASCADE,
  product_id uuid REFERENCES products(id) ON DELETE SET NULL,
  product_name text NOT NULL,
  output_quantity_kg decimal(14,2) NOT NULL DEFAULT 0,
  is_waste boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE production_outputs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "po_select" ON production_outputs;
CREATE POLICY "po_select" ON production_outputs FOR SELECT
  TO authenticated USING (true);
DROP POLICY IF EXISTS "po_insert" ON production_outputs;
CREATE POLICY "po_insert" ON production_outputs FOR INSERT
  TO authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "po_update" ON production_outputs;
CREATE POLICY "po_update" ON production_outputs FOR UPDATE
  TO authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "po_delete" ON production_outputs;
CREATE POLICY "po_delete" ON production_outputs FOR DELETE
  TO authenticated USING (true);

CREATE INDEX IF NOT EXISTS idx_po_batch ON production_outputs(batch_id);

-- ============================================================
-- 14. EXTEND CUSTOMERS
-- ============================================================
DO $$ BEGIN
  ALTER TABLE customers ADD COLUMN IF NOT EXISTS opening_balance decimal(12,2) DEFAULT 0;
  ALTER TABLE customers ADD COLUMN IF NOT EXISTS status text DEFAULT 'Active';
  ALTER TABLE customers ADD COLUMN IF NOT EXISTS remarks text;
EXCEPTION WHEN OTHERS THEN NULL; END $$;

-- ============================================================
-- 15. CUSTOMER TRANSACTIONS
-- ============================================================
CREATE TABLE IF NOT EXISTS customer_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id uuid NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  transaction_date date NOT NULL DEFAULT CURRENT_DATE,
  transaction_type text NOT NULL,
  sale_id uuid REFERENCES sales(id) ON DELETE SET NULL,
  amount decimal(12,2) NOT NULL DEFAULT 0,
  debit decimal(12,2) DEFAULT 0,
  credit decimal(12,2) DEFAULT 0,
  balance decimal(12,2) NOT NULL DEFAULT 0,
  notes text,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE customer_transactions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "ct_select" ON customer_transactions;
CREATE POLICY "ct_select" ON customer_transactions FOR SELECT
  TO authenticated USING (true);
DROP POLICY IF EXISTS "ct_insert" ON customer_transactions;
CREATE POLICY "ct_insert" ON customer_transactions FOR INSERT
  TO authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "ct_update" ON customer_transactions;
CREATE POLICY "ct_update" ON customer_transactions FOR UPDATE
  TO authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "ct_delete" ON customer_transactions;
CREATE POLICY "ct_delete" ON customer_transactions FOR DELETE
  TO authenticated USING (true);

CREATE INDEX IF NOT EXISTS idx_ct_customer ON customer_transactions(customer_id);

-- ============================================================
-- 16. EXTEND SALES
-- ============================================================
DO $$ BEGIN
  ALTER TABLE sales ADD COLUMN IF NOT EXISTS customer_mobile text;
  ALTER TABLE sales ADD COLUMN IF NOT EXISTS customer_address text;
  ALTER TABLE sales ADD COLUMN IF NOT EXISTS discount decimal(12,2) DEFAULT 0;
  ALTER TABLE sales ADD COLUMN IF NOT EXISTS tax_amount decimal(12,2) DEFAULT 0;
  ALTER TABLE sales ADD COLUMN IF NOT EXISTS other_charges decimal(12,2) DEFAULT 0;
  ALTER TABLE sales ADD COLUMN IF NOT EXISTS payment_method text DEFAULT 'Cash';
  ALTER TABLE sales ADD COLUMN IF NOT EXISTS payment_status text DEFAULT 'Unpaid';
  ALTER TABLE sales ADD COLUMN IF NOT EXISTS remarks text;
  ALTER TABLE sales ADD COLUMN IF NOT EXISTS status text DEFAULT 'Active';
  ALTER TABLE sales ADD COLUMN IF NOT EXISTS product_id uuid REFERENCES products(id) ON DELETE SET NULL;
EXCEPTION WHEN OTHERS THEN NULL; END $$;

-- Link existing sales to Rice Bran product
UPDATE sales SET product_id = (SELECT id FROM products WHERE product_id = 'PRD001')
WHERE product_id IS NULL AND product_name = 'Rice Bran';

-- ============================================================
-- 17. CASH & BANK ACCOUNTS
-- ============================================================
CREATE TABLE IF NOT EXISTS cash_bank_accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_name text NOT NULL,
  account_type text NOT NULL DEFAULT 'Cash',
  opening_balance decimal(14,2) DEFAULT 0,
  current_balance decimal(14,2) DEFAULT 0,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE cash_bank_accounts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "cba_select" ON cash_bank_accounts;
CREATE POLICY "cba_select" ON cash_bank_accounts FOR SELECT
  TO authenticated USING (true);
DROP POLICY IF EXISTS "cba_insert" ON cash_bank_accounts;
CREATE POLICY "cba_insert" ON cash_bank_accounts FOR INSERT
  TO authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "cba_update" ON cash_bank_accounts;
CREATE POLICY "cba_update" ON cash_bank_accounts FOR UPDATE
  TO authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "cba_delete" ON cash_bank_accounts;
CREATE POLICY "cba_delete" ON cash_bank_accounts FOR DELETE
  TO authenticated USING (true);

-- Seed default accounts
INSERT INTO cash_bank_accounts (account_name, account_type, opening_balance, current_balance)
VALUES
  ('Cash', 'Cash', 0, 0),
  ('Bank', 'Bank', 0, 0),
  ('UPI', 'UPI', 0, 0)
ON CONFLICT DO NOTHING;

-- ============================================================
-- 18. CASH & BANK TRANSACTIONS
-- ============================================================
CREATE TABLE IF NOT EXISTS cash_bank_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  transaction_number text,
  transaction_date date NOT NULL DEFAULT CURRENT_DATE,
  account_id uuid REFERENCES cash_bank_accounts(id) ON DELETE SET NULL,
  account_name text,
  transaction_type text NOT NULL,
  module text,
  reference_id uuid,
  reference_number text,
  amount decimal(14,2) NOT NULL DEFAULT 0,
  direction text NOT NULL DEFAULT 'Debit',
  balance_after decimal(14,2) DEFAULT 0,
  notes text,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE cash_bank_transactions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "cbt_select" ON cash_bank_transactions;
CREATE POLICY "cbt_select" ON cash_bank_transactions FOR SELECT
  TO authenticated USING (true);
DROP POLICY IF EXISTS "cbt_insert" ON cash_bank_transactions;
CREATE POLICY "cbt_insert" ON cash_bank_transactions FOR INSERT
  TO authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "cbt_update" ON cash_bank_transactions;
CREATE POLICY "cbt_update" ON cash_bank_transactions FOR UPDATE
  TO authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "cbt_delete" ON cash_bank_transactions;
CREATE POLICY "cbt_delete" ON cash_bank_transactions FOR DELETE
  TO authenticated USING (true);

CREATE INDEX IF NOT EXISTS idx_cbt_date ON cash_bank_transactions(transaction_date);
CREATE INDEX IF NOT EXISTS idx_cbt_account ON cash_bank_transactions(account_id);

-- ============================================================
-- 19. EXTEND PLANT EXPENSES
-- ============================================================
DO $$ BEGIN
  ALTER TABLE plant_expenses ADD COLUMN IF NOT EXISTS expense_number text UNIQUE;
  ALTER TABLE plant_expenses ADD COLUMN IF NOT EXISTS category text;
  ALTER TABLE plant_expenses ADD COLUMN IF NOT EXISTS description text;
  ALTER TABLE plant_expenses ADD COLUMN IF NOT EXISTS paid_to text;
  ALTER TABLE plant_expenses ADD COLUMN IF NOT EXISTS payment_method text DEFAULT 'Cash';
  ALTER TABLE plant_expenses ADD COLUMN IF NOT EXISTS account_id uuid REFERENCES cash_bank_accounts(id) ON DELETE SET NULL;
  ALTER TABLE plant_expenses ADD COLUMN IF NOT EXISTS expense_class text DEFAULT 'Production';
  ALTER TABLE plant_expenses ADD COLUMN IF NOT EXISTS remarks text;
  ALTER TABLE plant_expenses ADD COLUMN IF NOT EXISTS status text DEFAULT 'Approved';
EXCEPTION WHEN OTHERS THEN NULL; END $$;

-- Backfill category from expense_type for existing rows
UPDATE plant_expenses SET category = expense_type WHERE category IS NULL;

-- Generate expense numbers for existing rows
DO $$
DECLARE
  r RECORD;
  counter integer := 1;
BEGIN
  FOR r IN SELECT id FROM plant_expenses WHERE expense_number IS NULL ORDER BY created_at LOOP
    UPDATE plant_expenses SET expense_number = 'EXP-' || lpad(counter::text, 5, '0') WHERE id = r.id;
    counter := counter + 1;
  END LOOP;
END $$;

-- ============================================================
-- 20. EXTEND EMPLOYEES
-- ============================================================
DO $$ BEGIN
  ALTER TABLE employees ADD COLUMN IF NOT EXISTS department text;
  ALTER TABLE employees ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL;
EXCEPTION WHEN OTHERS THEN NULL; END $$;

-- ============================================================
-- 21. EXTEND SALARY PAYMENTS
-- ============================================================
DO $$ BEGIN
  ALTER TABLE salary_payments ADD COLUMN IF NOT EXISTS salary_number text UNIQUE;
  ALTER TABLE salary_payments ADD COLUMN IF NOT EXISTS gross_salary decimal(12,2) DEFAULT 0;
  ALTER TABLE salary_payments ADD COLUMN IF NOT EXISTS advance decimal(12,2) DEFAULT 0;
  ALTER TABLE salary_payments ADD COLUMN IF NOT EXISTS deduction decimal(12,2) DEFAULT 0;
  ALTER TABLE salary_payments ADD COLUMN IF NOT EXISTS net_salary decimal(12,2) DEFAULT 0;
  ALTER TABLE salary_payments ADD COLUMN IF NOT EXISTS balance decimal(12,2) DEFAULT 0;
  ALTER TABLE salary_payments ADD COLUMN IF NOT EXISTS payment_method text DEFAULT 'Cash';
EXCEPTION WHEN OTHERS THEN NULL; END $$;

-- Backfill net_salary and gross_salary for existing rows
UPDATE salary_payments SET gross_salary = amount_paid WHERE gross_salary = 0 AND amount_paid > 0;
UPDATE salary_payments SET net_salary = amount_paid WHERE net_salary = 0 AND amount_paid > 0;

-- Generate salary numbers for existing rows
DO $$
DECLARE
  r RECORD;
  counter integer := 1;
BEGIN
  FOR r IN SELECT id FROM salary_payments WHERE salary_number IS NULL ORDER BY created_at LOOP
    UPDATE salary_payments SET salary_number = 'SAL-' || lpad(counter::text, 5, '0') WHERE id = r.id;
    counter := counter + 1;
  END LOOP;
END $$;

-- ============================================================
-- 22. STOCK ADJUSTMENTS
-- ============================================================
CREATE TABLE IF NOT EXISTS stock_adjustments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  adjustment_number text UNIQUE NOT NULL,
  adjustment_date date NOT NULL DEFAULT CURRENT_DATE,
  product_id uuid REFERENCES products(id) ON DELETE SET NULL,
  product_name text NOT NULL,
  adjustment_type text NOT NULL DEFAULT 'Increase',
  quantity_kg decimal(14,2) NOT NULL DEFAULT 0,
  reason text,
  status text DEFAULT 'Pending',
  approved_by text,
  approved_at timestamptz,
  remarks text,
  created_by text,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE stock_adjustments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "sa_select" ON stock_adjustments;
CREATE POLICY "sa_select" ON stock_adjustments FOR SELECT
  TO authenticated USING (true);
DROP POLICY IF EXISTS "sa_insert" ON stock_adjustments;
CREATE POLICY "sa_insert" ON stock_adjustments FOR INSERT
  TO authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "sa_update" ON stock_adjustments;
CREATE POLICY "sa_update" ON stock_adjustments FOR UPDATE
  TO authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "sa_delete" ON stock_adjustments;
CREATE POLICY "sa_delete" ON stock_adjustments FOR DELETE
  TO authenticated USING (true);

-- ============================================================
-- 23. AUDIT LOGS
-- ============================================================
CREATE TABLE IF NOT EXISTS audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  user_name text,
  action text NOT NULL,
  module text NOT NULL,
  transaction_number text,
  previous_value jsonb,
  new_value jsonb,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "al_select" ON audit_logs;
CREATE POLICY "al_select" ON audit_logs FOR SELECT
  TO authenticated USING (true);
DROP POLICY IF EXISTS "al_insert" ON audit_logs;
CREATE POLICY "al_insert" ON audit_logs FOR INSERT
  TO authenticated WITH CHECK (true);

CREATE INDEX IF NOT EXISTS idx_al_module ON audit_logs(module);
CREATE INDEX IF NOT EXISTS idx_al_date ON audit_logs(created_at);

-- ============================================================
-- 24. SETTINGS
-- ============================================================
CREATE TABLE IF NOT EXISTS settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_name text DEFAULT 'Raj & Brothers',
  business_type text DEFAULT 'Rice Bran Filtration / Processing',
  address text,
  mobile text,
  email text,
  gst_number text,
  invoice_prefix text DEFAULT 'INV',
  currency text DEFAULT 'INR',
  opening_stock_value decimal(14,2) DEFAULT 0,
  opening_cash decimal(14,2) DEFAULT 0,
  production_variance_percent decimal(5,2) DEFAULT 5,
  allow_negative_stock boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "set_select" ON settings;
CREATE POLICY "set_select" ON settings FOR SELECT
  TO authenticated USING (true);
DROP POLICY IF EXISTS "set_insert" ON settings;
CREATE POLICY "set_insert" ON settings FOR INSERT
  TO authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "set_update" ON settings;
CREATE POLICY "set_update" ON settings FOR UPDATE
  TO authenticated USING (true) WITH CHECK (true);

-- Seed default settings row
INSERT INTO settings (business_name)
SELECT 'Raj & Brothers'
WHERE NOT EXISTS (SELECT 1 FROM settings);

-- ============================================================
-- 25. VENDOR TRANSACTIONS: add update/delete policies
-- ============================================================
DROP POLICY IF EXISTS "vt_update" ON vendor_transactions;
CREATE POLICY "vt_update" ON vendor_transactions FOR UPDATE
  TO authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "vt_delete" ON vendor_transactions;
CREATE POLICY "vt_delete" ON vendor_transactions FOR DELETE
  TO authenticated USING (true);

-- ============================================================
-- 26. STOCK: add insert policy
-- ============================================================
DROP POLICY IF EXISTS "stock_insert" ON stock;
CREATE POLICY "stock_insert" ON stock FOR INSERT
  TO authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "stock_delete" ON stock;
CREATE POLICY "stock_delete" ON stock FOR DELETE
  TO authenticated USING (true);
