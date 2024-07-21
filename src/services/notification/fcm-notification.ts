import { Injectable } from '@nestjs/common';
import * as admin from 'firebase-admin';

@Injectable()
export class FcmNotificationService {
  constructor() {}

  async sendingNotificationOneUser(
    token: string,
    data: any,
    notification: any,
  ) {
    const payload = {
      token: token,
      notification,
      data,
    };
    return admin
      .messaging()
      .send(payload)
      .then((res) => {
        console.log(res);
        return {
          success: true,
        };
      })
      .catch((error) => {
        console.log(error);
        return {
          success: false,
          message: error.message,
        };
      });
  }
}
