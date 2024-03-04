export interface ITokenPayload {
  sub: number;
  email: string;
  role: string;
  iat?: number;
  exp?: number;
}
