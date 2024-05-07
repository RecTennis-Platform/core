import { Logger } from '@nestjs/common';
import { getStorage } from 'firebase-admin/storage';

const parseFileName = (publicUrl: string) => {
  const urlParts = publicUrl.split('/');
  const filenameAndQuery = urlParts[urlParts.length - 1];
  const [filenameWithFolder] = filenameAndQuery.split('?');
  const [folder, fileName] = decodeURIComponent(filenameWithFolder).split('/');

  return {
    fileName,
    folder,
  };
};

/**
 * Hàm dùng để xóa files trên Firebase Storage, lưu ý khi xóa cũng xóa url của nó trong DB
 *
 * @param urls  urls của các file cần xóa
 *
 * @returns Promise { success: boolean, urls: string[] } success là trạng thái
 */
export const deleteFilesFromFirebase = async (urls: string[]) => {
  const bucket = getStorage().bucket();

  try {
    await Promise.all(
      urls.map(async (item) => {
        try {
          const { fileName, folder } = parseFileName(item);
          const fileDestination = `${folder}/${fileName}`;
          const file = bucket.file(fileDestination);
          return await file.delete();
        } catch (e) {
          // silent
        }
      }),
    );
    return {
      success: true,
    };
  } catch (error) {
    Logger.error('Error deleting file from Firebase Storage:', error);
    return {
      success: false,
    };
  }
};
