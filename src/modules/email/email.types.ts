export type LeadForEmail = {
  id: string;
  businessName: string;
  businessAddress: string;
  contactName: string;
  phone: string;
  email: string;
  currentProvider: string;
  plan?: string;
  employees?: string;
  comments?: string;
  ipAddress?: string;
  createdAt: string;
};

export type EmailJobData =
  | { type: 'lead-notification'; lead: LeadForEmail }
  | { type: 'lead-confirmation'; lead: LeadForEmail }
  | { type: 'custom-email'; lead: LeadForEmail; subject: string; body: string }
  | { type: 'password-reset'; recipient: string; adminName: string; resetUrl: string };
