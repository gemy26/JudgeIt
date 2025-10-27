import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { Account, User } from '@prisma/client';
import { GoogleProfileDto } from 'src/dto';
import { UserProfile } from '../types';
import { getId } from '../common/utils';

@Injectable()
export class UsersRepository {
  constructor(private prisma: PrismaService) { }

  async createUser(email: string, username: string, password: string): Promise<User> {
     return this.prisma.user.create({
      data: {
        email,
        username,
        hash: password
      }
    });
  }

  async findByEmail(email: string): Promise<User | null> {
    return this.prisma.user.findUnique({
      where: { email },
    });
  }

  async findById(id: string): Promise<User | null> {
    const Id = parseInt(id);
    console.log("UsersRepo");
    console.log("id ", id);
    return this.prisma.user.findFirst({
      where: { id: Id },
    });
  }

  async deleteUser(id: string): Promise<User> {
    const Id = parseInt(id);
    return this.prisma.user.delete({
      where: { id: Id },
    });
  }

  async updateRtHash(userId: number, rt: string) {
    return this.prisma.user.update({
      where: {
        id: userId
      },
      data: {
        hashedRt: rt
      }
    })
  }

  async deleteRt(userId: number) {
    return this.prisma.user.updateMany({
      where: {
        id: userId,
        hashedRt: {
          not: null
        }
      },
      data: {
        hashedRt: null
      }
    })
  }

  async findAccountByProvider(
    provider: string,
    providerAccountId: string,
  ): Promise<(Account & { user: User }) | null> {
    return this.prisma.account.findUnique({
      where: {
        provider_providerAccountId: { provider, providerAccountId },
      },
      include: { user: true },
    });
  }

  async updateOauthAccount(
    account: Account,
    accessToken: string,
    refreshToken: string,
  ): Promise<Account> {
    return this.prisma.account.update({
      where: { id: account.id },
      data: {
        accessToken,
        refreshToken,
        expiresAt: new Date(Date.now() + 3600 * 1000), // 1 hour
        updatedAt: new Date(),
      },
    });
  }

  async linkOauthUser(
    user: User,
    provider: string,
    googleProfile: GoogleProfileDto,
    accessToken: string,
    refreshToken: string,
  ): Promise<Account> {
    return this.prisma.account.create({
      data: {
        userId: user.id,
        provider,
        providerAccountId: googleProfile.id,
        accessToken,
        refreshToken,
        expiresAt: new Date(Date.now() + 3600 * 1000),
        tokenType: 'Bearer',
        scope: 'email profile',
      },
    });
  }

  async createOauthUser(
    provider: string,
    googleProfile: GoogleProfileDto,
    accessToken: string,
    refreshToken: string,
  ): Promise<User> {
    return this.prisma.user.create({
      data: {
        email: googleProfile.email,
        // hash is null for OAuth users
        username: googleProfile.firstName + getId(4),
        accounts: {
          create: {
            provider,
            providerAccountId: googleProfile.id,
            accessToken,
            refreshToken,
            expiresAt: new Date(Date.now() + 3600 * 1000),
            tokenType: 'Bearer',
            scope: 'email profile',
          },
        },
      },
      include: {
        accounts: true,
      },
    });
  }

  async getProfile(userId: string): Promise<UserProfile>{
    const user = await this.findById(userId);
    // TODO: Implement
    return { } as UserProfile;
    // TODO: get the fields from submissions module
  }

}