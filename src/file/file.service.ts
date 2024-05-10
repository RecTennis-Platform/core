import { BadRequestException, Injectable } from '@nestjs/common';
import { CreateFileDto } from './dto/create-file.dto';
import { UpdateFileDto } from './dto/update-file.dto';
import {
  EUploadFolder,
  uploadFilesFromFirebase,
} from 'src/services/files/upload';
import { deleteFilesFromFirebase } from 'src/services/files/delete';

@Injectable()
export class FileService {
  async create(file: Express.Multer.File) {
    if (!file) {
      throw new BadRequestException({
        message: 'File is required',
        statusCode: '400',
        error: 'Bad Request',
      });
    }
    let imageUrls = [];
    try {
      const uploadImagesData = await uploadFilesFromFirebase(
        [file],
        EUploadFolder.storage,
      );

      if (!uploadImagesData.success) {
        throw new Error('Failed to upload file!');
      }

      imageUrls = uploadImagesData.urls;

      return {
        url: imageUrls[0],
      };
    } catch (error) {
      console.log('Error:', error.message);
      if (!imageUrls.length) await deleteFilesFromFirebase(imageUrls);

      throw new BadRequestException({
        message: 'Failed to upload file',
        data: null,
      });
    }
  }

  findAll() {
    return `This action returns all file`;
  }

  findOne(id: number) {
    return `This action returns a #${id} file`;
  }

  update(id: number, updateFileDto: UpdateFileDto) {
    return `This action updates a #${id} file`;
  }

  remove(id: number) {
    return `This action removes a #${id} file`;
  }
}
