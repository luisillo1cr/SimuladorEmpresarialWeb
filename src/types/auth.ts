export type UserRole = 'admin' | 'professor' | 'student';
export type UserStatus = 'active' | 'inactive' | 'invited';

export type UserProfile = {
  uid: string;
  firstName: string;
  lastName: string;
  email: string;
  role: UserRole;
  teamId: string | null;
  status: UserStatus;
};