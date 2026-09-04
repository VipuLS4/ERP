export type RoleKey =
  | 'super_admin'
  | 'plant_manager'
  | 'production_supervisor'
  | 'store_employee'
  | 'purchase_employee'
  | 'sales_employee'
  | 'accountant'
  | 'viewer';

export interface Role {
  id: string;
  role_key: RoleKey;
  role_name: string;
  description: string | null;
}

export interface UserProfile {
  id: string;
  user_id: string;
  employee_id: string | null;
  role_id: string | null;
  name: string;
  email: string | null;
  mobile: string | null;
  department: string | null;
  status: string;
  last_login: string | null;
  roles?: Role | null;
}

export interface Product {
  id: string;
  product_id: string;
  name: string;
  product_type: string;
  unit: string;
  opening_stock_kg: number;
  minimum_stock_kg: number;
  sale_rate: number;
  is_active: boolean;
}

export interface StockItem {
  id: string;
  product_id: string | null;
  product_name: string;
  current_stock_kg: number;
  minimum_stock_kg: number;
  opening_stock_kg: number;
  last_updated: string;
}

export interface StockMovement {
  id: string;
  movement_date: string;
  transaction_number: string | null;
  product_id: string | null;
  product_name: string;
  transaction_type: string;
  quantity_in: number;
  quantity_out: number;
  balance: number;
  reference: string | null;
  created_by: string | null;
  remarks: string | null;
}

export interface Vendor {
  id: string;
  vendor_id: string;
  name: string;
  mobile: string;
  address: string | null;
  balance: number;
  opening_balance: number;
  status: string;
  remarks: string | null;
  created_at: string;
}

export interface VendorTransaction {
  id: string;
  vendor_id: string;
  transaction_date: string;
  transaction_type: string;
  purchase_id: string | null;
  amount: number;
  debit: number;
  credit: number;
  balance: number;
  notes: string | null;
}

export interface Customer {
  id: string;
  customer_id: string;
  name: string;
  mobile: string | null;
  address: string | null;
  balance: number;
  opening_balance: number;
  status: string;
  remarks: string | null;
  created_at: string;
}

export interface CustomerTransaction {
  id: string;
  customer_id: string;
  transaction_date: string;
  transaction_type: string;
  sale_id: string | null;
  amount: number;
  debit: number;
  credit: number;
  balance: number;
  notes: string | null;
}

export interface Purchase {
  id: string;
  purchase_number: string | null;
  purchase_date: string;
  vendor_id: string;
  vendors?: { name: string; vendor_id: string };
  quantity_kg: number;
  rate_per_kg: number;
  total_amount: number;
  other_charges: number;
  payment_made: number;
  balance_amount: number;
  vehicle_number: string | null;
  challan_number: string | null;
  number_of_bags: number | null;
  payment_method: string;
  remarks: string | null;
  status: string;
}

export interface MaterialReceipt {
  id: string;
  receipt_number: string;
  receipt_date: string;
  vendor_id: string | null;
  vendor_name: string | null;
  vehicle_number: string | null;
  challan_number: string | null;
  number_of_bags: number | null;
  gross_weight: number;
  tare_weight: number;
  net_weight: number;
  material_type: string;
  purchase_rate_per_kg: number;
  total_purchase_value: number;
  received_by: string | null;
  remarks: string | null;
  status: string;
}

export interface ProductionBatch {
  id: string;
  batch_number: string;
  batch_date: string;
  shift: string | null;
  supervisor: string | null;
  operator: string | null;
  machine_id: string | null;
  machine_name: string | null;
  raw_material_product_id: string | null;
  raw_material_name: string;
  input_quantity_kg: number;
  start_time: string | null;
  end_time: string | null;
  production_hours: number;
  total_output_kg: number;
  waste_kg: number;
  yield_percent: number;
  process_loss_percent: number;
  status: string;
  remarks: string | null;
}

export interface ProductionOutput {
  id: string;
  batch_id: string;
  product_id: string | null;
  product_name: string;
  output_quantity_kg: number;
  is_waste: boolean;
}

export interface Sale {
  id: string;
  invoice_number: string;
  sale_date: string;
  customer_id: string | null;
  customer_name: string;
  customer_mobile: string | null;
  customer_address: string | null;
  product_name: string;
  product_id: string | null;
  quantity_kg: number;
  rate_per_kg: number;
  total_amount: number;
  discount: number;
  tax_amount: number;
  other_charges: number;
  payment_received: number;
  outstanding_balance: number;
  payment_method: string;
  payment_status: string;
  remarks: string | null;
  status: string;
}

export interface Expense {
  id: string;
  expense_number: string | null;
  expense_date: string;
  expense_type: string;
  category: string | null;
  description: string | null;
  amount: number;
  paid_to: string | null;
  payment_method: string;
  account_id: string | null;
  expense_class: string;
  remarks: string | null;
  status: string;
  notes: string | null;
}

export interface Employee {
  id: string;
  employee_id: string;
  name: string;
  mobile: string | null;
  designation: string | null;
  department: string | null;
  monthly_salary: number;
  salary_balance: number;
  status: string;
  joined_date: string | null;
}

export interface SalaryPayment {
  id: string;
  salary_number: string | null;
  employee_id: string;
  employees?: { name: string; employee_id: string };
  payment_date: string;
  amount_paid: number;
  month_year: string;
  gross_salary: number;
  advance: number;
  deduction: number;
  net_salary: number;
  balance: number;
  payment_method: string;
  notes: string | null;
}

export interface Machine {
  id: string;
  machine_id: string;
  name: string;
  production_line: string | null;
  capacity_kg_per_hour: number;
  status: string;
  location: string | null;
  remarks: string | null;
}

export interface MachineDowntime {
  id: string;
  downtime_number: string;
  machine_id: string | null;
  machine_name: string | null;
  downtime_date: string;
  start_time: string | null;
  end_time: string | null;
  duration_minutes: number;
  reason: string | null;
  category: string;
  remarks: string | null;
}

export interface CashBankAccount {
  id: string;
  account_name: string;
  account_type: string;
  opening_balance: number;
  current_balance: number;
  is_active: boolean;
}

export interface CashBankTransaction {
  id: string;
  transaction_number: string | null;
  transaction_date: string;
  account_id: string | null;
  account_name: string | null;
  transaction_type: string;
  module: string | null;
  reference_number: string | null;
  amount: number;
  direction: string;
  balance_after: number;
  notes: string | null;
}

export interface StockAdjustment {
  id: string;
  adjustment_number: string;
  adjustment_date: string;
  product_id: string | null;
  product_name: string;
  adjustment_type: string;
  quantity_kg: number;
  reason: string | null;
  status: string;
  approved_by: string | null;
  remarks: string | null;
}

export interface AuditLog {
  id: string;
  user_name: string | null;
  action: string;
  module: string;
  transaction_number: string | null;
  created_at: string;
}

export interface Settings {
  id: string;
  business_name: string;
  business_type: string;
  address: string | null;
  mobile: string | null;
  email: string | null;
  gst_number: string | null;
  invoice_prefix: string;
  currency: string;
  opening_stock_value: number;
  opening_cash: number;
  production_variance_percent: number;
  allow_negative_stock: boolean;
}

export interface Shift {
  id: string;
  shift_name: string;
  start_time: string | null;
  end_time: string | null;
}
