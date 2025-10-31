import { BadRequestException, ConflictException, Injectable } from '@nestjs/common';
import { AuthDto } from 'src/dto/auth.dto';
import { UsersRepository } from './users.repository';
import { Account, Prisma, User } from '@prisma/client';
import { GoogleProfileDto } from 'src/dto';

@Injectable()
export class UsersService {
  constructor(private usersRepo: UsersRepository) { }

  async createUser(dto: AuthDto) {
    const { email, username, password } = dto;

    const existingUser = await this.usersRepo.findByEmail(email);
    if (existingUser) {
      throw new ConflictException('User already exists');
    }

    return this.usersRepo.createUser(email, username, password);
  }

  async findUser(dto: AuthDto) {
    const user = await this.usersRepo.findByEmail(dto.email);
    if (!user) {
      throw new BadRequestException("User is not found");
    }

    return user;
  }

  async findById(userId: string) {
    return this.usersRepo.findById(userId);
  }

  async findByEmail(email: string) {
    if(!email)
    {
      throw new BadRequestException("Email doesn't exist");
    }
    return this.usersRepo.findByEmail(email);
  }

  async updateRtHash(userId: number, rt: string) {
    return this.usersRepo.updateRtHash(userId, rt);
  }

  async deleteRt(userId: number) {
    return this.usersRepo.deleteRt(userId);
  }


  async findAccountByProvider(
    provider: string,
    providerAccountId: string,
  ): Promise<(Account & { user: User }) | null> {
    return this.usersRepo.findAccountByProvider(provider, providerAccountId);
  }

  async updateOauthAccount(
    account: Account,
    accessToken: string,
    refreshToken: string,
  ): Promise<Account> {
    return this.usersRepo.updateOauthAccount(
      account,
      accessToken,
      refreshToken,
    );
  }

  async linkOauthUser(
    user: User,
    provider: string,
    googleProfile: GoogleProfileDto,
    accessToken: string,
    refreshToken: string,
  ): Promise<Account> {
    return this.usersRepo.linkOauthUser(
      user,
      provider,
      googleProfile,
      accessToken,
      refreshToken,
    );
  }

  async createOauthUser(
    provider: string,
    googleProfile: GoogleProfileDto,
    accessToken: string,
    refreshToken: string,
  ): Promise<User> {
    return this.usersRepo.createOauthUser(
      provider,
      googleProfile,
      accessToken,
      refreshToken,
    );
  }

  async getProfile(userId: string){
    return this.usersRepo.getProfile(userId);
  }

  async hasAccount(email: string){
    return this.usersRepo.hasAccount(email);
  }

  async changePass(id: number, newPass: string){
    return this.usersRepo.changePassword(id, newPass);
  }
}
