import { Test, TestingModule } from '@nestjs/testing';
import { AuthService } from './auth.service';
import { UsersService } from '../users/users.service';
import { AuthDto, ChangePasswordDto, GoogleProfileDto } from '../dto';
import * as argon2 from 'argon2';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { EmailService } from '../email/email.service';
import { PasswordResetRepository } from './password-reset.repository';
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import spyOn = jest.spyOn;

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
      hasAccount: jest.fn(),
      createUser: jest.fn(),
      findByEmail: jest.fn(),
      findById: jest.fn(),
      changePass: jest.fn(),
      findAccountByProvider: jest.fn(),
      updateOauthAccount: jest.fn(),
      createOauthUser: jest.fn(),
      linkOauthUser: jest.fn(),
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

  afterEach(async () => {
    jest.clearAllMocks();
  })

  describe('signinLocal', () => {
    const dto: AuthDto = { email: 'oauth@gmail.com', password: 'password', username: 'oauth', };
    const mockUser = { id: 1, email: dto.email, hash: 'hashed', role: ['USER'] };
    const mockOAuthUser = { id: 1, email: dto.email, hash: null, role: ['USER'] };
    const hashedRefreshToken = 'hashed_refresh_token';

    it('should return tokens when user credentials are valid', async () => {
      (usersService.findUser as jest.Mock).mockResolvedValue(mockUser);
      (usersService.hasAccount as jest.Mock).mockResolvedValue(true);
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
      (usersService.findUser as jest.Mock).mockResolvedValue(undefined);
      await expect(service.signinLocal(dto)).rejects.toThrow(ForbiddenException);
    })
    it('should return ConflictException if password not correct', async () => {
      jest.spyOn(argon2, 'verify').mockResolvedValue(false);
      (usersService.findUser as jest.Mock).mockResolvedValue(mockUser);

      await expect(service.signinLocal(dto)).rejects.toThrow(ConflictException);
      await expect(service.signinLocal(dto)).rejects.toThrow('Not valid credintial');
    })
    it('should throw ForbiddenException if user has no hash (OAuth user)', async () => {
      (usersService.findUser as jest.Mock).mockResolvedValue(mockOAuthUser);
      (usersService.hasAccount as jest.Mock).mockResolvedValue(false);
      await expect(service.signinLocal(dto)).rejects.toThrow(ForbiddenException);
      await expect(service.signinLocal(dto)).rejects.toThrow(
        'This account uses OAuth login. Please sign in with Google.'
      );
    });
  });

  describe('signupLocal', () => {
    const dto: AuthDto = {
      email: 'oauth@gmail.com',
      password: 'password',
      username: 'oauth'
    };
    const hashedPassword = 'hashed_password';
    const mockUser = {
      id: 1,
      email: dto.email,
      hash: hashedPassword,
      role: ['USER']
    };
    const hashedRefreshToken = 'hashed_refresh_token';

    it('should return tokens after creating new user', async () => {
      (argon2.hash as jest.Mock)
        .mockResolvedValueOnce(hashedPassword)
        .mockResolvedValueOnce(hashedRefreshToken);

      (usersService.createUser as jest.Mock).mockResolvedValue(mockUser);
      (usersService.updateRtHash as jest.Mock).mockResolvedValue(undefined);

      jest.spyOn(service, 'getTokens').mockResolvedValue({
        access_token: 'access_token',
        refresh_token: 'refresh_token',
      });

      const result = await service.signupLocal(dto);

      expect(result).toEqual({
        access_token: 'access_token',
        refresh_token: 'refresh_token',
      });

      expect(usersService.createUser).toHaveBeenCalledWith({
        ...dto,
        password: hashedPassword
      });

      expect(service.getTokens).toHaveBeenCalledWith(
        mockUser.id,
        mockUser.email,
        mockUser.role
      );

      expect(usersService.updateRtHash).toHaveBeenCalledWith(
        mockUser.id,
        hashedRefreshToken
      );
    });
    it('should throw ConflictException if the user already exists', async () => {
      (usersService.findUser as jest.Mock).mockResolvedValue(mockUser);
      await expect(service.signinLocal(dto)).rejects.toThrow(ConflictException);
    })
  });

  describe('refreshTokens', () => {
    const dto: AuthDto = {
      email: 'oauth@gmail.com',
      password: 'password',
      username: 'oauth'
    };
    const hashedPassword = 'hashed_password';

    const mockUser = {
      id: 1,
      email: dto.email,
      hash: hashedPassword,
      hashedRt: 'hashed_refresh_token',
      role: ['USER']
    };

    const mockTokens = {
      access_token: 'new_access_token',
      refresh_token: 'new_refresh_token'
    };

    const refreshToken = 'valid_refresh_token';
    const hashedNewRefreshToken = 'hashed_new_refresh_token';

    it('should return new tokens when refresh token is valid', async () => {
      (usersService.findById as jest.Mock).mockResolvedValue(mockUser);
      jest.spyOn(argon2, 'verify').mockResolvedValue(true);
      jest.spyOn(argon2, 'hash').mockResolvedValue(hashedNewRefreshToken);
      jest.spyOn(service, 'getTokens').mockResolvedValue(mockTokens);
      (usersService.updateRtHash as jest.Mock).mockResolvedValue(undefined);

      const result = await service.refreshTokens(String(mockUser.id), refreshToken);

      expect(result).toEqual(mockTokens);
      expect(usersService.findById).toHaveBeenCalledWith(String(mockUser.id));
      expect(argon2.verify).toHaveBeenCalledWith(mockUser.hashedRt, refreshToken);
      expect(service.getTokens).toHaveBeenCalledWith(
        mockUser.id,
        mockUser.email,
        mockUser.role
      );
      expect(argon2.hash).toHaveBeenCalledWith(mockTokens.refresh_token);
      expect(usersService.updateRtHash).toHaveBeenCalledWith(
        mockUser.id,
        hashedNewRefreshToken
      );
    });

    it('Should return ForbiddenException if user is not found', async () => {
      (usersService.findById as jest.Mock).mockResolvedValue(null);

      await expect(service.refreshTokens(String(mockUser.id), refreshToken)).rejects.toThrow(ForbiddenException);
      expect(usersService.findById).toHaveBeenCalledWith(String(mockUser.id));
    })

    it("Should return ForbiddenException if refresh token doesn't match", async () => {
      (usersService.findById as jest.Mock).mockResolvedValue(mockUser);
      jest.spyOn(argon2, 'verify').mockResolvedValue(false);

      await expect(service.refreshTokens(String(mockUser.id), refreshToken)).rejects.toThrow(ForbiddenException);
      await expect(
        service.refreshTokens(String(mockUser.id), refreshToken)
      ).rejects.toThrow('Access denied, Refresh token does not match');
    })
  });

  describe('change password',  () => {
    const id = "1";
    const newPassHash = "new_password_hashed";
    const dto: ChangePasswordDto = {oldPass: "old_password", newPass: "new_password"};
    const mockUser = { id: 1, email: "ahmed@gamil.com", hash: 'hashed', role: ['USER'] };

    it("change password success path", async () => {
      (usersService.findById as jest.Mock).mockResolvedValue(mockUser);
      (usersService.hasAccount as jest.Mock).mockResolvedValue(false);
      spyOn(argon2, 'verify').mockResolvedValue(true);
      spyOn(argon2, 'hash').mockResolvedValue(newPassHash);
      (usersService.changePass as jest.Mock).mockResolvedValue({ success: true });

      const result = await service.changePassword(id, dto);

      expect(result).toEqual({ success: true });
      expect(usersService.findById).toHaveBeenCalledWith(id);
      expect(usersService.hasAccount).toHaveBeenCalledWith(mockUser.email);
      expect(argon2.verify).toHaveBeenCalledWith(mockUser.hash, dto.oldPass);
      expect(argon2.hash).toHaveBeenCalledWith(dto.newPass);
      expect(usersService.changePass).toHaveBeenCalledWith(mockUser.id, newPassHash);
    });

    it('should throw NotFoundException if user not found', async () => {
      (usersService.findById as jest.Mock).mockResolvedValue(null);

      await expect(service.changePassword(id, dto)).rejects.toThrow(NotFoundException);
      await expect(service.changePassword(id, dto)).rejects.toThrow('User not found');

      expect(usersService.findById).toHaveBeenCalledWith(id);
    });

    it('should throw BadRequestException if user is registered with Google', async () => {
      (usersService.findById as jest.Mock).mockResolvedValue(mockUser);
      (usersService.hasAccount as jest.Mock).mockResolvedValue(true);

      await expect(service.changePassword(id, dto)).rejects.toThrow(BadRequestException);
      await expect(service.changePassword(id, dto)).rejects.toThrow(
        'User is registered with google'
      );

      expect(usersService.findById).toHaveBeenCalledWith(id);
      expect(usersService.hasAccount).toHaveBeenCalledWith(mockUser.email);
    });

    it('should throw BadRequestException if user has no password hash', async () => {
      const userWithoutHash = { ...mockUser, hash: null };

      (usersService.findById as jest.Mock).mockResolvedValue(userWithoutHash);
      (usersService.hasAccount as jest.Mock).mockResolvedValue(false);

      await expect(service.changePassword(id, dto)).rejects.toThrow(BadRequestException);
      await expect(service.changePassword(id, dto)).rejects.toThrow(
        'User has no password hash'
      );

      expect(usersService.findById).toHaveBeenCalledWith(id);
      expect(usersService.hasAccount).toHaveBeenCalledWith(userWithoutHash.email);
    });

    it('should throw BadRequestException if old password is incorrect', async () => {
      (usersService.findById as jest.Mock).mockResolvedValue(mockUser);
      (usersService.hasAccount as jest.Mock).mockResolvedValue(false);
      jest.spyOn(argon2, 'verify').mockResolvedValue(false);

      await expect(service.changePassword(id, dto)).rejects.toThrow(BadRequestException);
      await expect(service.changePassword(id, dto)).rejects.toThrow(
        'Incorrect old password'
      );

      expect(usersService.findById).toHaveBeenCalledWith(id);
      expect(usersService.hasAccount).toHaveBeenCalledWith(mockUser.email);
      expect(argon2.verify).toHaveBeenCalledWith(mockUser.hash, dto.oldPass);
    });

    it('should throw BadRequestException if user hash is undefined', async () => {
      const userWithUndefinedHash = { ...mockUser, hash: undefined };

      (usersService.findById as jest.Mock).mockResolvedValue(userWithUndefinedHash);
      (usersService.hasAccount as jest.Mock).mockResolvedValue(false);

      await expect(service.changePassword(id, dto)).rejects.toThrow(BadRequestException);
      await expect(service.changePassword(id, dto)).rejects.toThrow(
        'User has no password hash'
      );
    });

    it('should throw BadRequestException if user hash is empty string', async () => {
      const userWithEmptyHash = { ...mockUser, hash: '' };

      (usersService.findById as jest.Mock).mockResolvedValue(userWithEmptyHash);
      (usersService.hasAccount as jest.Mock).mockResolvedValue(false);

      await expect(service.changePassword(id, dto)).rejects.toThrow(BadRequestException);
      await expect(service.changePassword(id, dto)).rejects.toThrow(
        'User has no password hash'
      );
    });
  });

  describe('validateOAuthLogin', () => {
    const mockGoogleProfile: GoogleProfileDto = {
      id: 'google-123',
      email: 'oauth@example.com',
      emailVerified: true,
      firstName: 'John',
      lastName: 'Doe',
      picture: 'profile.jpg',
      displayName: "haha"
    };
    const mockUser = { id: 'user-123', email: mockGoogleProfile.email, role: ['USER'] };
    const mockAccount = {
      id: 1,
      user: { id: 'user-123', email: mockGoogleProfile.email, role: ['USER'] }
    };
    const accessToken = 'oauth_access_token';
    const refreshToken = 'oauth_refresh_token';
    const provider = 'google';

    it('should throw UnauthorizedException if email not provided', async () => {
      const profileWithoutEmail = { ...mockGoogleProfile, email: '' };

      await expect(
        service.validateOAuthLogin(
          profileWithoutEmail,
          accessToken,
          refreshToken,
          provider,
        ),
      ).rejects.toThrow(UnauthorizedException);
      await expect(
        service.validateOAuthLogin(
          profileWithoutEmail,
          accessToken,
          refreshToken,
          provider,
        ),
      ).rejects.toThrow('Email not provided by OAuth provider');
    });
    it("should throw UnauthorizedException if email not verified", async () => {
      const profileWithoutVerifiedEmail = { ...mockGoogleProfile, emailVerified: false };
      await expect(service.validateOAuthLogin(profileWithoutVerifiedEmail, accessToken, refreshToken, provider),)
        .rejects.toThrow(UnauthorizedException);
    });
    it("should update and return existing account if provider account exists", async () => {
      (usersService.findAccountByProvider as jest.Mock).mockResolvedValue(mockAccount);

      const result = await service.validateOAuthLogin(
        mockGoogleProfile,
        accessToken,
        refreshToken,
        provider
      );
      expect(result).toEqual(mockAccount.user);
      expect(usersService.findAccountByProvider).toHaveBeenCalledWith(provider, mockGoogleProfile.id);
      expect(usersService.updateOauthAccount).toHaveBeenCalledWith(
        mockAccount,
        accessToken,
        refreshToken
      );
    });
    it('should link OAuth account to existing user if user exists', async () => {
      (usersService.findAccountByProvider as jest.Mock).mockResolvedValue(null);
      (usersService.findByEmail as jest.Mock).mockResolvedValue(mockUser);

      const result = await service.validateOAuthLogin(
        mockGoogleProfile,
        accessToken,
        refreshToken,
        provider
      );

      expect(result).toEqual(mockUser);
      expect(usersService.findAccountByProvider).toHaveBeenCalledWith(provider, mockGoogleProfile.id);
      expect(usersService.findByEmail).toHaveBeenCalledWith(mockGoogleProfile.email);
      expect(usersService.linkOauthUser).toHaveBeenCalledWith(
        mockUser,
        provider,
        mockGoogleProfile,
        accessToken,
        refreshToken
      );
    });
    it('should create new OAuth user if no existing user or account', async () => {
      const newUser = { id: 'new-user-123', email: mockGoogleProfile.email, role: ['USER'] };

      (usersService.findAccountByProvider as jest.Mock).mockResolvedValue(null);
      (usersService.findByEmail as jest.Mock).mockResolvedValue(null);
      (usersService.createOauthUser as jest.Mock).mockResolvedValue(newUser);

      const result = await service.validateOAuthLogin(
        mockGoogleProfile,
        accessToken,
        refreshToken,
        provider
      );

      expect(result).toEqual(newUser);
      expect(usersService.findAccountByProvider).toHaveBeenCalledWith(provider, mockGoogleProfile.id);
      expect(usersService.findByEmail).toHaveBeenCalledWith(mockGoogleProfile.email);
      expect(usersService.createOauthUser).toHaveBeenCalledWith(
        provider,
        mockGoogleProfile,
        accessToken,
        refreshToken
      );
    });
  });
  });

