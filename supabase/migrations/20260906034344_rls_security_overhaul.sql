-- RLS Security Overhaul: Role-Based Access Control

-- Helper functions
CREATE OR REPLACE FUNCTION public.get_current_role_key()
RETURNS text LANGUAGE sql SECURITY DEFINER STABLE AS $$
  SELECT r.role_key FROM public.user_profiles up
  JOIN public.roles r ON r.id = up.role_id
  WHERE up.user_id = auth.uid() LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.is_super_admin()
RETURNS boolean LANGUAGE sql SECURITY DEFINER STABLE AS $$
  SELECT public.get_current_role_key() = 'super_admin';
$$;

CREATE OR REPLACE FUNCTION public.has_role(role_keys text[])
RETURNS boolean LANGUAGE sql SECURITY DEFINER STABLE AS $$
  SELECT public.get_current_role_key() = ANY(role_keys);
$$;

ALTER TABLE public.roles ENABLE ROW LEVEL SECURITY;

-- Drop ALL existing policies on ALL tables
DO $$ DECLARE r record;
BEGIN
  FOR r IN SELECT schemaname, tablename, policyname FROM pg_policies WHERE schemaname = 'public'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON %I.%I', r.policyname, r.schemaname, r.tablename);
  END LOOP;
END $$;

-- ROLES: SELECT only
CREATE POLICY "roles_select" ON roles FOR SELECT TO authenticated USING (true);

-- USER_PROFILES: super_admin full CRUD; others read own only
CREATE POLICY "up_select" ON user_profiles FOR SELECT TO authenticated USING (public.is_super_admin() OR auth.uid() = user_id);
CREATE POLICY "up_insert" ON user_profiles FOR INSERT TO authenticated WITH CHECK (public.is_super_admin());
CREATE POLICY "up_update" ON user_profiles FOR UPDATE TO authenticated USING (public.is_super_admin()) WITH CHECK (public.is_super_admin());
CREATE POLICY "up_delete" ON user_profiles FOR DELETE TO authenticated USING (public.is_super_admin());

-- AUDIT_LOGS
CREATE POLICY "al_select" ON audit_logs FOR SELECT TO authenticated USING (public.is_super_admin());
CREATE POLICY "al_insert" ON audit_logs FOR INSERT TO authenticated WITH CHECK (true);

-- VENDORS
CREATE POLICY "vendors_select" ON vendors FOR SELECT TO authenticated USING (public.has_role(ARRAY['super_admin','purchase_employee','accountant','viewer']));
CREATE POLICY "vendors_insert" ON vendors FOR INSERT TO authenticated WITH CHECK (public.has_role(ARRAY['super_admin','purchase_employee']));
CREATE POLICY "vendors_update" ON vendors FOR UPDATE TO authenticated USING (public.has_role(ARRAY['super_admin','purchase_employee','accountant'])) WITH CHECK (public.has_role(ARRAY['super_admin','purchase_employee','accountant']));
CREATE POLICY "vendors_delete" ON vendors FOR DELETE TO authenticated USING (public.is_super_admin());

-- CUSTOMERS
CREATE POLICY "customers_select" ON customers FOR SELECT TO authenticated USING (public.has_role(ARRAY['super_admin','sales_employee','accountant','viewer']));
CREATE POLICY "customers_insert" ON customers FOR INSERT TO authenticated WITH CHECK (public.has_role(ARRAY['super_admin','sales_employee']));
CREATE POLICY "customers_update" ON customers FOR UPDATE TO authenticated USING (public.has_role(ARRAY['super_admin','sales_employee','accountant'])) WITH CHECK (public.has_role(ARRAY['super_admin','sales_employee','accountant']));
CREATE POLICY "customers_delete" ON customers FOR DELETE TO authenticated USING (public.is_super_admin());

-- PURCHASES
CREATE POLICY "purchases_select" ON purchases FOR SELECT TO authenticated USING (public.has_role(ARRAY['super_admin','purchase_employee','accountant','viewer']));
CREATE POLICY "purchases_insert" ON purchases FOR INSERT TO authenticated WITH CHECK (public.has_role(ARRAY['super_admin','purchase_employee','accountant']));
CREATE POLICY "purchases_update" ON purchases FOR UPDATE TO authenticated USING (public.has_role(ARRAY['super_admin','purchase_employee','accountant'])) WITH CHECK (public.has_role(ARRAY['super_admin','purchase_employee','accountant']));
CREATE POLICY "purchases_delete" ON purchases FOR DELETE TO authenticated USING (public.is_super_admin());

-- SALES
CREATE POLICY "sales_select" ON sales FOR SELECT TO authenticated USING (public.has_role(ARRAY['super_admin','sales_employee','accountant','viewer']));
CREATE POLICY "sales_insert" ON sales FOR INSERT TO authenticated WITH CHECK (public.has_role(ARRAY['super_admin','sales_employee']));
CREATE POLICY "sales_update" ON sales FOR UPDATE TO authenticated USING (public.has_role(ARRAY['super_admin','sales_employee','accountant'])) WITH CHECK (public.has_role(ARRAY['super_admin','sales_employee','accountant']));
CREATE POLICY "sales_delete" ON sales FOR DELETE TO authenticated USING (public.is_super_admin());

-- PLANT_EXPENSES
CREATE POLICY "expenses_select" ON plant_expenses FOR SELECT TO authenticated USING (public.has_role(ARRAY['super_admin','accountant','viewer']));
CREATE POLICY "expenses_insert" ON plant_expenses FOR INSERT TO authenticated WITH CHECK (public.has_role(ARRAY['super_admin','accountant']));
CREATE POLICY "expenses_update" ON plant_expenses FOR UPDATE TO authenticated USING (public.has_role(ARRAY['super_admin','accountant'])) WITH CHECK (public.has_role(ARRAY['super_admin','accountant']));
CREATE POLICY "expenses_delete" ON plant_expenses FOR DELETE TO authenticated USING (public.is_super_admin());

-- EMPLOYEES
CREATE POLICY "employees_select" ON employees FOR SELECT TO authenticated USING (public.has_role(ARRAY['super_admin','accountant','viewer']));
CREATE POLICY "employees_insert" ON employees FOR INSERT TO authenticated WITH CHECK (public.is_super_admin());
CREATE POLICY "employees_update" ON employees FOR UPDATE TO authenticated USING (public.is_super_admin()) WITH CHECK (public.is_super_admin());
CREATE POLICY "employees_delete" ON employees FOR DELETE TO authenticated USING (public.is_super_admin());

-- SALARY_PAYMENTS
CREATE POLICY "salary_select" ON salary_payments FOR SELECT TO authenticated USING (public.has_role(ARRAY['super_admin','accountant','viewer']));
CREATE POLICY "salary_insert" ON salary_payments FOR INSERT TO authenticated WITH CHECK (public.has_role(ARRAY['super_admin','accountant']));
CREATE POLICY "salary_update" ON salary_payments FOR UPDATE TO authenticated USING (public.has_role(ARRAY['super_admin','accountant'])) WITH CHECK (public.has_role(ARRAY['super_admin','accountant']));
CREATE POLICY "salary_delete" ON salary_payments FOR DELETE TO authenticated USING (public.is_super_admin());

-- STOCK
CREATE POLICY "stock_select" ON stock FOR SELECT TO authenticated USING (public.has_role(ARRAY['super_admin','plant_manager','production_supervisor','store_employee','purchase_employee','sales_employee','viewer']));
CREATE POLICY "stock_insert" ON stock FOR INSERT TO authenticated WITH CHECK (public.has_role(ARRAY['super_admin','plant_manager','store_employee']));
CREATE POLICY "stock_update" ON stock FOR UPDATE TO authenticated USING (public.has_role(ARRAY['super_admin','plant_manager','production_supervisor','store_employee','purchase_employee','sales_employee'])) WITH CHECK (public.has_role(ARRAY['super_admin','plant_manager','production_supervisor','store_employee','purchase_employee','sales_employee']));
CREATE POLICY "stock_delete" ON stock FOR DELETE TO authenticated USING (public.is_super_admin());

-- STOCK_MOVEMENTS
CREATE POLICY "sm_select" ON stock_movements FOR SELECT TO authenticated USING (public.has_role(ARRAY['super_admin','plant_manager','production_supervisor','store_employee','purchase_employee','sales_employee','viewer']));
CREATE POLICY "sm_insert" ON stock_movements FOR INSERT TO authenticated WITH CHECK (public.has_role(ARRAY['super_admin','plant_manager','production_supervisor','store_employee','purchase_employee','sales_employee']));
CREATE POLICY "sm_update" ON stock_movements FOR UPDATE TO authenticated USING (public.is_super_admin()) WITH CHECK (public.is_super_admin());
CREATE POLICY "sm_delete" ON stock_movements FOR DELETE TO authenticated USING (public.is_super_admin());

-- STOCK_ADJUSTMENTS
CREATE POLICY "sa_select" ON stock_adjustments FOR SELECT TO authenticated USING (public.has_role(ARRAY['super_admin','plant_manager','viewer']));
CREATE POLICY "sa_insert" ON stock_adjustments FOR INSERT TO authenticated WITH CHECK (public.has_role(ARRAY['super_admin','plant_manager']));
CREATE POLICY "sa_update" ON stock_adjustments FOR UPDATE TO authenticated USING (public.is_super_admin()) WITH CHECK (public.is_super_admin());
CREATE POLICY "sa_delete" ON stock_adjustments FOR DELETE TO authenticated USING (public.is_super_admin());

-- PRODUCTS
CREATE POLICY "prod_select" ON products FOR SELECT TO authenticated USING (true);
CREATE POLICY "prod_insert" ON products FOR INSERT TO authenticated WITH CHECK (public.is_super_admin());
CREATE POLICY "prod_update" ON products FOR UPDATE TO authenticated USING (public.is_super_admin()) WITH CHECK (public.is_super_admin());
CREATE POLICY "prod_delete" ON products FOR DELETE TO authenticated USING (public.is_super_admin());

-- MACHINES
CREATE POLICY "mac_select" ON machines FOR SELECT TO authenticated USING (public.has_role(ARRAY['super_admin','plant_manager','production_supervisor','viewer']));
CREATE POLICY "mac_insert" ON machines FOR INSERT TO authenticated WITH CHECK (public.is_super_admin());
CREATE POLICY "mac_update" ON machines FOR UPDATE TO authenticated USING (public.is_super_admin()) WITH CHECK (public.is_super_admin());
CREATE POLICY "mac_delete" ON machines FOR DELETE TO authenticated USING (public.is_super_admin());

-- MACHINE_DOWNTIME
CREATE POLICY "md_select" ON machine_downtime FOR SELECT TO authenticated USING (public.has_role(ARRAY['super_admin','plant_manager','production_supervisor','viewer']));
CREATE POLICY "md_insert" ON machine_downtime FOR INSERT TO authenticated WITH CHECK (public.has_role(ARRAY['super_admin','plant_manager','production_supervisor']));
CREATE POLICY "md_update" ON machine_downtime FOR UPDATE TO authenticated USING (public.has_role(ARRAY['super_admin','plant_manager','production_supervisor'])) WITH CHECK (public.has_role(ARRAY['super_admin','plant_manager','production_supervisor']));
CREATE POLICY "md_delete" ON machine_downtime FOR DELETE TO authenticated USING (public.is_super_admin());

-- MATERIAL_RECEIPTS
CREATE POLICY "mr_select" ON material_receipts FOR SELECT TO authenticated USING (public.has_role(ARRAY['super_admin','plant_manager','store_employee','purchase_employee','viewer']));
CREATE POLICY "mr_insert" ON material_receipts FOR INSERT TO authenticated WITH CHECK (public.has_role(ARRAY['super_admin','store_employee','purchase_employee']));
CREATE POLICY "mr_update" ON material_receipts FOR UPDATE TO authenticated USING (public.has_role(ARRAY['super_admin','store_employee','purchase_employee'])) WITH CHECK (public.has_role(ARRAY['super_admin','store_employee','purchase_employee']));
CREATE POLICY "mr_delete" ON material_receipts FOR DELETE TO authenticated USING (public.is_super_admin());

-- PRODUCTION_BATCHES
CREATE POLICY "pb_select" ON production_batches FOR SELECT TO authenticated USING (public.has_role(ARRAY['super_admin','plant_manager','production_supervisor','viewer']));
CREATE POLICY "pb_insert" ON production_batches FOR INSERT TO authenticated WITH CHECK (public.has_role(ARRAY['super_admin','plant_manager','production_supervisor']));
CREATE POLICY "pb_update" ON production_batches FOR UPDATE TO authenticated USING (public.has_role(ARRAY['super_admin','plant_manager','production_supervisor'])) WITH CHECK (public.has_role(ARRAY['super_admin','plant_manager','production_supervisor']));
CREATE POLICY "pb_delete" ON production_batches FOR DELETE TO authenticated USING (public.is_super_admin());

-- PRODUCTION_OUTPUTS
CREATE POLICY "po_select" ON production_outputs FOR SELECT TO authenticated USING (public.has_role(ARRAY['super_admin','plant_manager','production_supervisor','viewer']));
CREATE POLICY "po_insert" ON production_outputs FOR INSERT TO authenticated WITH CHECK (public.has_role(ARRAY['super_admin','plant_manager','production_supervisor']));
CREATE POLICY "po_update" ON production_outputs FOR UPDATE TO authenticated USING (public.has_role(ARRAY['super_admin','plant_manager','production_supervisor'])) WITH CHECK (public.has_role(ARRAY['super_admin','plant_manager','production_supervisor']));
CREATE POLICY "po_delete" ON production_outputs FOR DELETE TO authenticated USING (public.is_super_admin());

-- VENDOR_TRANSACTIONS
CREATE POLICY "vt_select" ON vendor_transactions FOR SELECT TO authenticated USING (public.has_role(ARRAY['super_admin','purchase_employee','accountant','viewer']));
CREATE POLICY "vt_insert" ON vendor_transactions FOR INSERT TO authenticated WITH CHECK (public.has_role(ARRAY['super_admin','purchase_employee','accountant']));
CREATE POLICY "vt_update" ON vendor_transactions FOR UPDATE TO authenticated USING (public.has_role(ARRAY['super_admin','purchase_employee','accountant'])) WITH CHECK (public.has_role(ARRAY['super_admin','purchase_employee','accountant']));
CREATE POLICY "vt_delete" ON vendor_transactions FOR DELETE TO authenticated USING (public.is_super_admin());

-- CUSTOMER_TRANSACTIONS
CREATE POLICY "ct_select" ON customer_transactions FOR SELECT TO authenticated USING (public.has_role(ARRAY['super_admin','sales_employee','accountant','viewer']));
CREATE POLICY "ct_insert" ON customer_transactions FOR INSERT TO authenticated WITH CHECK (public.has_role(ARRAY['super_admin','sales_employee','accountant']));
CREATE POLICY "ct_update" ON customer_transactions FOR UPDATE TO authenticated USING (public.has_role(ARRAY['super_admin','sales_employee','accountant'])) WITH CHECK (public.has_role(ARRAY['super_admin','sales_employee','accountant']));
CREATE POLICY "ct_delete" ON customer_transactions FOR DELETE TO authenticated USING (public.is_super_admin());

-- CASH_BANK_ACCOUNTS
CREATE POLICY "cba_select" ON cash_bank_accounts FOR SELECT TO authenticated USING (public.has_role(ARRAY['super_admin','accountant','viewer']));
CREATE POLICY "cba_insert" ON cash_bank_accounts FOR INSERT TO authenticated WITH CHECK (public.is_super_admin());
CREATE POLICY "cba_update" ON cash_bank_accounts FOR UPDATE TO authenticated USING (public.has_role(ARRAY['super_admin','accountant'])) WITH CHECK (public.has_role(ARRAY['super_admin','accountant']));
CREATE POLICY "cba_delete" ON cash_bank_accounts FOR DELETE TO authenticated USING (public.is_super_admin());

-- CASH_BANK_TRANSACTIONS
CREATE POLICY "cbt_select" ON cash_bank_transactions FOR SELECT TO authenticated USING (public.has_role(ARRAY['super_admin','accountant','viewer']));
CREATE POLICY "cbt_insert" ON cash_bank_transactions FOR INSERT TO authenticated WITH CHECK (public.has_role(ARRAY['super_admin','accountant']));
CREATE POLICY "cbt_update" ON cash_bank_transactions FOR UPDATE TO authenticated USING (public.is_super_admin()) WITH CHECK (public.is_super_admin());
CREATE POLICY "cbt_delete" ON cash_bank_transactions FOR DELETE TO authenticated USING (public.is_super_admin());

-- SETTINGS
CREATE POLICY "set_select" ON settings FOR SELECT TO authenticated USING (true);
CREATE POLICY "set_insert" ON settings FOR INSERT TO authenticated WITH CHECK (public.is_super_admin());
CREATE POLICY "set_update" ON settings FOR UPDATE TO authenticated USING (public.is_super_admin()) WITH CHECK (public.is_super_admin());

-- SHIFTS
CREATE POLICY "sh_select" ON shifts FOR SELECT TO authenticated USING (true);
CREATE POLICY "sh_insert" ON shifts FOR INSERT TO authenticated WITH CHECK (public.is_super_admin());
CREATE POLICY "sh_update" ON shifts FOR UPDATE TO authenticated USING (public.is_super_admin()) WITH CHECK (public.is_super_admin());
CREATE POLICY "sh_delete" ON shifts FOR DELETE TO authenticated USING (public.is_super_admin());
