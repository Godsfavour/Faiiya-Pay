export type WalletStatus = 'active' | 'frozen' | 'suspended';
export type KycStatus = 'unverified' | 'verified';

export type TransactionType =
  | 'deposit'
  | 'debit_order'
  | 'referral_bonus'
  | 'refund'
  | 'admin_adjustment'
  | 'withdrawal'
  | 'withdrawal_refund';

export type TransactionStatus = 'pending' | 'completed' | 'failed' | 'reversed';

export interface VirtualAccount {
  id: number;
  userId: number;
  accountReference: string;
  bankName: string;
  bankCode: string;
  accountNumber: string;
  accountName: string;
  reservationStatus: 'active' | 'expired' | 'inactive';
  createdAt: string;
}

export interface Wallet {
  id: number;
  userId: number;
  balance: number;
  currency: string;
  status: WalletStatus;
  kycStatus: KycStatus;
  freezeReason?: string;
  frozenAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface Transaction {
  id: number;
  txnUuid: string;
  walletId: number;
  userId: number;
  type: TransactionType;
  amount: number;
  balanceBefore: number;
  balanceAfter: number;
  reference: string;
  metadata: Record<string, any>;
  status: TransactionStatus;
  createdAt: string;
}

export interface WithdrawalRequest {
  id: number;
  requestUuid: string;
  userId: number;
  accountNumber: string;
  bankCode: string;
  bankName: string;
  accountName: string;
  amount: number;
  fee: number;
  netPayout: number;
  status: 'pending' | 'approved' | 'rejected';
  adminReason?: string;
  transactionReference?: string;
  createdAt: string;
  processedAt?: string;
}

export interface NotificationLog {
  id: number;
  userId: number;
  channel: 'sms' | 'email';
  recipient: string;
  eventType:
    | 'deposit_success'
    | 'withdrawal_request'
    | 'withdrawal_approved'
    | 'withdrawal_rejected'
    | 'order_debited'
    | 'referral_bonus'
    | 'account_frozen'
    | 'account_unfrozen'
    | 'admin_adjustment';
  subject: string;
  body: string;
  deliveryStatus: 'delivered' | 'sent';
  timestamp: string;
}

export interface MerchantFloatStats {
  settledMerchantBalance: number;
  customerLiabilities: number;
  netLiquidFloat: number;
  unallocatedFloat: number;
  monnifySettlementAccount: string;
  gatewayStatus: 'healthy' | 'operational';
  lastSyncedAt: string;
}

export interface Referral {
  id: number;
  referrerId: number;
  refereeId: number;
  referralCode: string;
  rewardAmount: number;
  status: 'pending' | 'credited' | 'cancelled';
  creditedAt?: string | null;
  createdAt: string;
}

export interface WebhookLog {
  id: number;
  gateway: string;
  eventType: string;
  transactionReference: string;
  requestHash: string;
  payload: string;
  processedStatus: 'received' | 'processed' | 'duplicate' | 'failed';
  createdAt: string;
}

export interface User {
  id: number;
  username: string;
  email: string;
  firstName: string;
  otherNames?: string;
  lastName: string;
  phoneNumber?: string;
  maskedBvn?: string;
  referralCode: string;
  referredBy?: string;
  role: 'customer' | 'administrator';
  kycStatus?: KycStatus;
}

export interface PluginSettings {
  monnifyMode: 'live';
  monnifyApiKey: string;
  monnifySecretKey: string;
  monnifyContractCode: string;
  adminSecurityPin: string;
  feeBearer: 'merchant' | 'customer';
  depositFeeType: 'flat' | 'percentage';
  depositFeeValue: number;
  depositFeeCap: number;
  withdrawalFeeType: 'flat' | 'percentage';
  withdrawalFeeValue: number;
  minDeposit: number;
  maxDepositTier1: number;
  minWithdrawal: number;
  maxWithdrawalTier1: number;
  referralEnabled: boolean;
  referralRewardAmount: number;
  referralTrigger: 'on_first_wallet_deposit' | 'on_registration';
  notificationsSmsEnabled: boolean;
  notificationsEmailEnabled: boolean;
}

export interface StoreProduct {
  id: number;
  name: string;
  category: string;
  price: number;
  image: string;
  description: string;
  inStock: boolean;
}

export interface StoreOrder {
  id: number;
  orderNumber: string;
  userId: number;
  items: {
    productId: number;
    productName: string;
    price: number;
    quantity: number;
  }[];
  total: number;
  paymentMethod: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  txnUuid?: string;
  notes: string[];
  createdAt: string;
}
