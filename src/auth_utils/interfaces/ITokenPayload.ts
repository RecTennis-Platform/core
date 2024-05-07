export interface ITokenPayload {
  sub: string;
  email: string;
  iat?: number;
  exp?: number;
  groupId?: number;
}
