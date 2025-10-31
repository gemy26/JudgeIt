export class MailDto {
  to: string | string[];
  subject: string;
  html?: string;
  text?: string;
  templateName?: string;
  templateData?: Record<string, string | number>;
  from?: string;
}
