import { getStorage } from 'firebase-admin/storage';

export enum EUploadFolder {
  user = 'user',
  news = 'news',
  group = 'group',
  group_tournament = 'group-tournament',
  tournament = 'tournament',
}

/**
 * Hàm dùng để upload files lên Firebase Storage
 * Lưu ý không validate gì ở đây, validate tại REST
 *
 * @param filesContent  truyền file data
 * @param uploadFolder thư mục tại Storage up file
 *
 * @returns Promise { success: boolean, urls: string[] } success là trạng thái, urls là các links của các file vừa up
 */
export const uploadFilesFromFirebase = async (
  filesContent: Express.Multer.File[],
  uploadFolder: EUploadFolder,
) => {
  try {
    const result = await Promise.all(
      filesContent.map(async (item) => {
        try {
          const buffer = item.buffer;
          const bf = Buffer.from(buffer);
          const bucket = getStorage().bucket();
          const filename =
            new Date().valueOf().toString() + '-' + item.originalname;
          const file = bucket.file(`${uploadFolder}/` + filename);

          await file.save(bf, {
            contentType: item.mimetype,
          });

          await file.makePublic();

          return `https://firebasestorage.googleapis.com/v0/b/${process.env.FIREBASE_PROJECT_ID}.appspot.com/o/${uploadFolder}%2F${filename}?alt=media`;
        } catch (error) {
          // silent
          return ``;
        }
      }),
    );
    return {
      success: true,
      urls: result,
    };
  } catch (error) {
    return {
      success: false,
      urls: [],
    };
  }
};
