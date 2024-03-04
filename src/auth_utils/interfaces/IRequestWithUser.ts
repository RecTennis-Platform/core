import { Request } from 'express';
import { TokenPayloadDto } from '../dto';
export interface IRequestWithUser extends Request {
  user: TokenPayloadDto;
}
