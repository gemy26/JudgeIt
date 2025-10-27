export interface GoogleProfileDto {
  id: string;                    // providerAccountId
  email: string;                 // Primary email
  firstName: string;             // Given name
  lastName: string;              // Family name
  displayName: string;           // Full name
  picture: string;               // Avatar URL
  emailVerified: boolean;        // Is email verified
}