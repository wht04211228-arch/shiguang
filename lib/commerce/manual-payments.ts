export const manualPaymentChannels = ["wechat", "alipay", "other"] as const;
export type ManualPaymentChannel = (typeof manualPaymentChannels)[number];
export type ManualPaymentReviewStatus = "submitted" | "reviewing" | "approved" | "rejected";

export type ManualPaymentProofRow = {
  id: string;
  order_id: string;
  owner_id: string;
  payment_channel: ManualPaymentChannel;
  amount: number;
  transaction_reference: string;
  proof_path: string;
  paid_at: string;
  review_status: ManualPaymentReviewStatus;
  reviewer_id: string | null;
  reviewed_at: string | null;
  review_note: string | null;
  created_at: string;
  updated_at: string;
};

export function getManualPaymentConfig() {
  return {
    wechatQrPath: process.env.MANUAL_WECHAT_QR_PATH?.trim() || "",
    alipayQrPath: process.env.MANUAL_ALIPAY_QR_PATH?.trim() || "",
    wechatQrUrl: process.env.MANUAL_WECHAT_QR_URL?.trim() || "",
    alipayQrUrl: process.env.MANUAL_ALIPAY_QR_URL?.trim() || "",
    customerService: process.env.CUSTOMER_SERVICE_CONTACT?.trim() || "请联系网站客服获取付款方式",
    instructions: (process.env.MANUAL_PAYMENT_INSTRUCTIONS || "付款时请备注订单号后 8 位；完成后上传付款截图并填写完整交易单号；管理员核对实际到账后才会开通制作权限。")
      .split(/(?:\r?\n|\\n)/u)
      .map((item) => item.trim())
      .filter(Boolean),
  };
}

export function manualPaymentChannelName(channel: string): string {
  if (channel === "wechat") return "微信";
  if (channel === "alipay") return "支付宝";
  return "其他人工收款方式";
}

export function manualPaymentStatusName(status: string | null | undefined): string {
  if (status === "submitted") return "已提交，等待核对";
  if (status === "reviewing") return "正在核对到账";
  if (status === "approved") return "已确认到账";
  if (status === "rejected") return "凭证未通过，请重新提交";
  return "尚未提交付款凭证";
}
