import { Injectable } from '@nestjs/common';
import * as nodemailer from 'nodemailer';
import { ConfigService } from '@nestjs/config';
import { Transporter } from 'nodemailer';
import { MailDto } from '../dto';
import path from 'node:path';
import * as fs from 'node:fs';
import * as Handlebars from 'handlebars';


@Injectable()
export class EmailService {
  constructor(private config: ConfigService) {}

  mailTransport() {
    const transport = nodemailer.createTransport({
      host: this.config.get('EMAIL_HOST'),
      port: Number(this.config.get('EMAIL_PORT')),
      secure: false,
      auth: {
        user: this.config.get('EMAIL_USER'),
        pass: this.config.get('EMAIL_PASSWORD'),
      },
    });
    return transport;
  }

  private renderTemplate(
    templateName: string,
    replacements: Record<string, string | number>,
  ) {
    const templatePath = path.join(
      __dirname,
      '..',
      'email',
      'templates',
      `${templateName}.html`,
    );
    const source = fs.readFileSync(templatePath, 'utf8');
    const compiled = Handlebars.compile(source);
    return compiled(replacements);
  }

  async sendMail(dto: MailDto) {
    const transporter = this.mailTransport();

    const { to, from, subject, html, text, templateName, templateData } = dto;

    const finalHtml = templateName
      ? this.renderTemplate(templateName, templateData || {})
      : html;

    const mailOptions: nodemailer.SendMailOptions = {
      from: from || `"${this.config.get('APP_NAME')}" <${this.config.get('EMAIL_USER')}>`,
      to,
      subject,
      html: finalHtml,
      text,
    };

    try {
      const result = await transporter.sendMail(mailOptions);
      return result;
    } catch (err) {
      console.error('❌ Failed to send email:', err);
      throw err;
    }
  }
}
