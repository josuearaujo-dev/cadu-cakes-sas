export type BaseEntity = {
  id: string;
  company_id: string;
  created_at: string;
  updated_at: string;
};

export type Employee = BaseEntity & {
  name: string;
  role: string | null;
  hourly_rate: number;
  active: boolean;
};

export type Supplier = BaseEntity & {
  name: string;
  contact_name: string | null;
  phone: string | null;
  notes: string | null;
  active: boolean;
};

export type IncomeSource = BaseEntity & {
  name: string;
  description: string | null;
  active: boolean;
};

export type CategoryType = "income" | "expense";

export type Category = BaseEntity & {
  name: string;
  type: CategoryType;
  active: boolean;
};

export type PaymentMethod = "cash" | "transfer" | "cheque";
export type TransactionStatus = "pending" | "paid" | "cancelled";

export type FinancialTransaction = BaseEntity & {
  type: CategoryType;
  amount: number;
  category_id: string;
  employee_id: string | null;
  supplier_id: string | null;
  income_source_id: string | null;
  payment_method: PaymentMethod;
  status: TransactionStatus;
  transaction_date: string;
  due_date: string | null;
  paid_at: string | null;
  description: string | null;
};

export type TransactionFilters = {
  from?: string;
  to?: string;
  type?: CategoryType;
  status?: TransactionStatus;
};

export type EmployeePaymentStatus = "pending" | "paid" | "cancelled";

export type EmployeePayment = BaseEntity & {
  employee_id: string;
  week_start: string;
  hours_worked: number | null;
  amount: number;
  status: EmployeePaymentStatus;
  payment_date: string | null;
  /** Despesa em `transactions` criada ao marcar como pago (como `cheques.transaction_id`). */
  transaction_id: string | null;
  notes: string | null;
};

export type ChequeStatus = "scheduled" | "compensated" | "returned" | "cancelled";

export type Cheque = BaseEntity & {
  /** Quem recebe o cheque (pagamento a fornecedor). */
  supplier_id: string | null;
  /** Legado: vínculo antigo com tabela customers, se existir no banco. */
  customer_id: string | null;
  /** Legado: nome em texto livre. */
  customer_name: string | null;
  /** Lançamento gerado ao marcar como compensado (livro caixa). */
  transaction_id: string | null;
  cheque_date: string;
  amount: number;
  status: ChequeStatus;
  notes: string | null;
};
