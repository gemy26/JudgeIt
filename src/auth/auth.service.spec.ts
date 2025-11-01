import { Test, TestingModule } from '@nestjs/testing';
import { AuthService } from './auth.service';
import { UsersService } from '../users/users.service';
import { AuthDto } from '../dto';
import * as argon2 from 'argon2';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { EmailService } from '../email/email.service';
import { PasswordResetRepository } from './password-reset.repository';
import { ConflictException, ForbiddenException } from '@nestjs/common';

jest.mock('argon2', () => ({
  verify: jest.fn(),
  hash: jest.fn(),
}));


describe('AuthService', () => {
  let service: AuthService;
  let usersService: Partial<UsersService>;

  beforeEach(async () => {
    usersService = {
      findUser: jest.fn(),
      updateRtHash: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: UsersService, useValue: usersService },
        { provide: PasswordResetRepository, useValue: {} },
        { provide: EmailService, useValue: {} },
        { provide: JwtService, useValue: { signAsync: jest.fn() } },
        { provide: ConfigService, useValue: { get: jest.fn() } },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
  });

  it('should return tokens when user credentials are valid', async () => {
    const dto: AuthDto = {
      email: 'ag08885653@gmail.com',
      password: 'Aahmed',
      username: 'ahmed',
    };

    const mockUser = { id: 1, email: dto.email, hash: 'hashed', role: ['USER'] };

    const hashedRefreshToken = 'hashed_refresh_token';

    (usersService.findUser as jest.Mock).mockResolvedValue(mockUser);
    jest.spyOn(argon2, 'verify').mockResolvedValue(true);

    jest.spyOn(service, 'getTokens').mockResolvedValue({
      access_token: 'access_token',
      refresh_token: 'refresh_token',
    });

    (argon2.hash as jest.Mock).mockResolvedValue(hashedRefreshToken);

    const result = await service.signinLocal(dto);

    expect(result).toEqual({
      access_token: 'access_token',
      refresh_token: 'refresh_token',
    });

    expect(usersService.findUser).toHaveBeenCalledWith(dto);
    expect(argon2.verify).toHaveBeenCalledWith(mockUser.hash, dto.password);
    expect(service.getTokens).toHaveBeenCalledWith(mockUser.id, mockUser.email, mockUser.role);
    expect(argon2.hash).toHaveBeenCalledWith('refresh_token');
    expect(usersService.updateRtHash).toHaveBeenCalledWith(mockUser.id, hashedRefreshToken);
  });
  it('should return Forbidden exception if user not found', async () => {
    const dto: AuthDto = {
      email: 'ag08885653@gmail.com',
      password: 'Aahmed',
      username: 'ahmed',
    };

    (usersService.findUser as jest.Mock).mockResolvedValue(undefined);
    await expect(service.signinLocal(dto)).rejects.toThrow(ForbiddenException);
  })
  it('should return ConflictException if password not correct', async () => {
    const dto: AuthDto = {
      email: 'ag08885653@gmail.com',
      password: 'Aahmed',
      username: 'ahmed',
    };
    const mockUser = { id: 1, email: dto.email, hash: 'hashed', role: ['USER'] };

    jest.spyOn(argon2, 'verify').mockResolvedValue(false);
    (usersService.findUser as jest.Mock).mockResolvedValue(mockUser);

    await expect(service.signinLocal(dto)).rejects.toThrow(ConflictException);
    await expect(service.signinLocal(dto)).rejects.toThrow('Not valid credintial');
  })
  it('should throw ForbiddenException if user has no hash (OAuth user)', async () => {
    const dto: AuthDto = {
      email: 'oauth@gmail.com',
      password: 'password',
      username: 'oauth',
    };

    const mockOAuthUser = {
      id: 1,
      email: dto.email,
      hash: null, // or undefined - OAuth users don't have password hash
      role: ['USER']
    };

    (usersService.findUser as jest.Mock).mockResolvedValue(mockOAuthUser);

    await expect(service.signinLocal(dto)).rejects.toThrow(ForbiddenException);
    await expect(service.signinLocal(dto)).rejects.toThrow(
      'This account uses OAuth login. Please sign in with Google.'
    );
  });

});
