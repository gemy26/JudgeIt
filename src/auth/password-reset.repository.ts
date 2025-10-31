import { PrismaService } from '../prisma/prisma.service';
import { Injectable } from '@nestjs/common';

@Injectable()
export class PasswordResetRepository{
  constructor(private prisma: PrismaService) {}

  async createPasswordResetToken(userId: number, hashedToken: string, expiresAt: Date){
    return this.prisma.passwordResetToken.create({
      data: {
        userId: userId,
        tokenHash: hashedToken,
        expiresAt: expiresAt
      }
    });
  }

  async getPasswordResetToken(token: string){
    return this.prisma.passwordResetToken.findFirst({
      where: { tokenHash: token },
      orderBy: { createdAt: 'desc' },
    });
  }

  async markTokenUsed(id: number) {
    return this.prisma.passwordResetToken.update({
      where: { id },
      data: { used: true },
    });
  }
}