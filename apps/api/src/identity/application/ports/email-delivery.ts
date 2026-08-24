export type EmailMessage = {
  recipient: string;
  actionUrl: string;
  templateData: Record<string, string>;
};

export interface EmailDelivery {
  sendVerification(message: EmailMessage): Promise<void>;
  sendPasswordReset(message: EmailMessage): Promise<void>;
  sendEmailChange(message: EmailMessage): Promise<void>;
  sendInvitation(message: EmailMessage): Promise<void>;
}
