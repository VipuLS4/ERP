/*
  # Raj & Brothers Management System Database Schema

  ## Overview
  Complete database schema for a rice bran filtration company ERP system.

  ## New Tables

  ### 1. vendors
  - `id` (uuid, primary key)
  - `vendor_id` (text, unique) - Custom vendor ID (e.g., VEN001)
  - `name` (text) - Vendor name
  - `mobile` (text) - Mobile number
  - `address` (text, nullable) - Vendor address
  - `balance` (decimal) - Outstanding balance
  - `created_at` (timestamptz)
  - `updated_at` (timestamptz)

  ### 2. purchases
  - `id` (uuid, primary key)
  - `purchase_date` (date) - Date of purchase
  - `vendor_id` (uuid, foreign key) - Reference to vendors
  - `quantity_kg` (decimal) - Quantity in kilograms
  - `rate_per_kg` (decimal) - Purchase rate per kg
  - `total_amount` (decimal) - Total purchase amount
  - `payment_made` (decimal) - Payment made on this purchase
  - `balance_amount` (decimal) - Balance amount
  - `created_at` (timestamptz)
  - `updated_at` (timestamptz)

  ### 3. stock
  - `id` (uuid, primary key)
  - `product_name` (text) - Product name (Rice Bran)
  - `current_stock_kg` (decimal) - Current stock in kg
  - `last_updated` (timestamptz)

  ### 4. customers
  - `id` (uuid, primary key)
  - `customer_id` (text, unique) - Custom customer ID
  - `name` (text) - Customer name
  - `mobile` (text, nullable) - Mobile number
  - `address` (text, nullable) - Customer address
  - `balance` (decimal) - Outstanding balance
  - `created_at` (timestamptz)
  - `updated_at` (timestamptz)

  ### 5. sales
  - `id` (uuid, primary key)
  - `invoice_number` (text, unique) - Invoice number
  - `sale_date` (date) - Date of sale
  - `customer_id` (uuid, foreign key) - Reference to customers
  - `customer_name` (text) - Customer name (for walk-ins)
  - `product_name` (text) - Product name
  - `quantity_kg` (decimal) - Quantity in kg
  - `rate_per_kg` (decimal) - Sale rate per kg
  - `total_amount` (decimal) - Total sale amount
  - `payment_received` (decimal) - Payment received
  - `outstanding_balance` (decimal) - Outstanding balance
  - `created_at` (timestamptz)
  - `updated_at` (timestamptz)

  ### 6. plant_expenses
  - `id` (uuid, primary key)
  - `expense_date` (date) - Date of expense
  - `expense_type` (text) - Type (Electricity, Diesel, Maintenance, Transport, Other)
  - `amount` (decimal) - Expense amount
  - `notes` (text, nullable) - Additional notes
  - `created_at` (timestamptz)
  - `updated_at` (timestamptz)

  ### 7. employees
  - `id` (uuid, primary key)
  - `employee_id` (text, unique) - Custom employee ID
  - `name` (text) - Employee name
  - `mobile` (text, nullable) - Mobile number
  - `designation` (text, nullable) - Job designation
  - `monthly_salary` (decimal) - Monthly salary amount
  - `salary_balance` (decimal) - Outstanding salary balance
  - `status` (text) - Active/Inactive
  - `joined_date` (date, nullable) - Date of joining
  - `created_at` (timestamptz)
  - `updated_at` (timestamptz)

  ### 8. salary_payments
  - `id` (uuid, primary key)
  - `employee_id` (uuid, foreign key) - Reference to employees
  - `payment_date` (date) - Date of payment
  - `amount_paid` (decimal) - Amount paid
  - `month_year` (text) - Month and year (e.g., "January 2024")
  - `notes` (text, nullable) - Additional notes
  - `created_at` (timestamptz)
  - `updated_at` (timestamptz)

  ### 9. vendor_transactions
  - `id` (uuid, primary key)
  - `vendor_id` (uuid, foreign key) - Reference to vendors
  - `transaction_date` (date) - Date of transaction
  - `transaction_type` (text) - Purchase or Payment
  - `purchase_id` (uuid, nullable) - Reference to purchases if type is Purchase
  - `amount` (decimal) - Transaction amount
  - `debit` (decimal) - Debit amount (purchases)
  - `credit` (decimal) - Credit amount (payments)
  - `balance` (decimal) - Running balance
  - `notes` (text, nullable)
  - `created_at` (timestamptz)

  ## Security
  - Enable RLS on all tables
  - Add policies for authenticated admin users
*/

-- Create vendors table
CREATE TABLE IF NOT EXISTS vendors (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  vendor_id text UNIQUE NOT NULL,
  name text NOT NULL,
  mobile text NOT NULL,
  address text,
  balance decimal(12,2) DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create purchases table
CREATE TABLE IF NOT EXISTS purchases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  purchase_date date NOT NULL DEFAULT CURRENT_DATE,
  vendor_id uuid NOT NULL REFERENCES vendors(id) ON DELETE CASCADE,
  quantity_kg decimal(12,2) NOT NULL,
  rate_per_kg decimal(10,2) NOT NULL,
  total_amount decimal(12,2) NOT NULL,
  payment_made decimal(12,2) DEFAULT 0,
  balance_amount decimal(12,2) NOT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create stock table
CREATE TABLE IF NOT EXISTS stock (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_name text NOT NULL DEFAULT 'Rice Bran',
  current_stock_kg decimal(12,2) DEFAULT 0,
  last_updated timestamptz DEFAULT now()
);

-- Create customers table
CREATE TABLE IF NOT EXISTS customers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id text UNIQUE NOT NULL,
  name text NOT NULL,
  mobile text,
  address text,
  balance decimal(12,2) DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create sales table
CREATE TABLE IF NOT EXISTS sales (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_number text UNIQUE NOT NULL,
  sale_date date NOT NULL DEFAULT CURRENT_DATE,
  customer_id uuid REFERENCES customers(id) ON DELETE SET NULL,
  customer_name text NOT NULL,
  product_name text NOT NULL,
  quantity_kg decimal(12,2) NOT NULL,
  rate_per_kg decimal(10,2) NOT NULL,
  total_amount decimal(12,2) NOT NULL,
  payment_received decimal(12,2) DEFAULT 0,
  outstanding_balance decimal(12,2) NOT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create plant_expenses table
CREATE TABLE IF NOT EXISTS plant_expenses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  expense_date date NOT NULL DEFAULT CURRENT_DATE,
  expense_type text NOT NULL,
  amount decimal(12,2) NOT NULL,
  notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create employees table
CREATE TABLE IF NOT EXISTS employees (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id text UNIQUE NOT NULL,
  name text NOT NULL,
  mobile text,
  designation text,
  monthly_salary decimal(12,2) DEFAULT 0,
  salary_balance decimal(12,2) DEFAULT 0,
  status text DEFAULT 'Active',
  joined_date date,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create salary_payments table
CREATE TABLE IF NOT EXISTS salary_payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id uuid NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  payment_date date NOT NULL DEFAULT CURRENT_DATE,
  amount_paid decimal(12,2) NOT NULL,
  month_year text NOT NULL,
  notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create vendor_transactions table
CREATE TABLE IF NOT EXISTS vendor_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  vendor_id uuid NOT NULL REFERENCES vendors(id) ON DELETE CASCADE,
  transaction_date date NOT NULL DEFAULT CURRENT_DATE,
  transaction_type text NOT NULL,
  purchase_id uuid REFERENCES purchases(id) ON DELETE SET NULL,
  amount decimal(12,2) NOT NULL,
  debit decimal(12,2) DEFAULT 0,
  credit decimal(12,2) DEFAULT 0,
  balance decimal(12,2) NOT NULL,
  notes text,
  created_at timestamptz DEFAULT now()
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_purchases_vendor_id ON purchases(vendor_id);
CREATE INDEX IF NOT EXISTS idx_purchases_date ON purchases(purchase_date);
CREATE INDEX IF NOT EXISTS idx_sales_customer_id ON sales(customer_id);
CREATE INDEX IF NOT EXISTS idx_sales_date ON sales(sale_date);
CREATE INDEX IF NOT EXISTS idx_vendor_transactions_vendor_id ON vendor_transactions(vendor_id);
CREATE INDEX IF NOT EXISTS idx_salary_payments_employee_id ON salary_payments(employee_id);
CREATE INDEX IF NOT EXISTS idx_plant_expenses_date ON plant_expenses(expense_date);

-- Initialize stock with Rice Bran
INSERT INTO stock (product_name, current_stock_kg)
SELECT 'Rice Bran', 0
WHERE NOT EXISTS (SELECT 1 FROM stock WHERE product_name = 'Rice Bran');

-- Enable Row Level Security
ALTER TABLE vendors ENABLE ROW LEVEL SECURITY;
ALTER TABLE purchases ENABLE ROW LEVEL SECURITY;
ALTER TABLE stock ENABLE ROW LEVEL SECURITY;
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE sales ENABLE ROW LEVEL SECURITY;
ALTER TABLE plant_expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE employees ENABLE ROW LEVEL SECURITY;
ALTER TABLE salary_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE vendor_transactions ENABLE ROW LEVEL SECURITY;

-- Create policies for authenticated users (admin role)
CREATE POLICY "Authenticated users can view vendors"
  ON vendors FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can insert vendors"
  ON vendors FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update vendors"
  ON vendors FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Authenticated users can delete vendors"
  ON vendors FOR DELETE
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can view purchases"
  ON purchases FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can insert purchases"
  ON purchases FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update purchases"
  ON purchases FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Authenticated users can delete purchases"
  ON purchases FOR DELETE
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can view stock"
  ON stock FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can update stock"
  ON stock FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Authenticated users can view customers"
  ON customers FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can insert customers"
  ON customers FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update customers"
  ON customers FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Authenticated users can delete customers"
  ON customers FOR DELETE
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can view sales"
  ON sales FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can insert sales"
  ON sales FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update sales"
  ON sales FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Authenticated users can delete sales"
  ON sales FOR DELETE
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can view plant_expenses"
  ON plant_expenses FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can insert plant_expenses"
  ON plant_expenses FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update plant_expenses"
  ON plant_expenses FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Authenticated users can delete plant_expenses"
  ON plant_expenses FOR DELETE
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can view employees"
  ON employees FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can insert employees"
  ON employees FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update employees"
  ON employees FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Authenticated users can delete employees"
  ON employees FOR DELETE
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can view salary_payments"
  ON salary_payments FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can insert salary_payments"
  ON salary_payments FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update salary_payments"
  ON salary_payments FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Authenticated users can delete salary_payments"
  ON salary_payments FOR DELETE
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can view vendor_transactions"
  ON vendor_transactions FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can insert vendor_transactions"
  ON vendor_transactions FOR INSERT
  TO authenticated
  WITH CHECK (true);