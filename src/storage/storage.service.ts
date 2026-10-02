import { Injectable, BadRequestException, InternalServerErrorException, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { v2 as cloudinary, UploadApiResponse, UploadApiErrorResponse } from 'cloudinary';
import * as streamifier from 'streamifier';
import * as path from 'path';

@Injectable()
export class StorageService {
  private readonly logger = new Logger(StorageService.name);
  private readonly isCloudinaryConfigured: boolean;

  constructor(private readonly configService: ConfigService) {
    const cloudName = this.configService.get<string>('CLOUDINARY_CLOUD_NAME');
    const apiKey = this.configService.get<string>('CLOUDINARY_API_KEY');
    const apiSecret = this.configService.get<string>('CLOUDINARY_API_SECRET');
    const cloudinaryUrl = this.configService.get<string>('CLOUDINARY_URL');

    const isValidUrl = cloudinaryUrl && !cloudinaryUrl.includes('<');

    if (cloudName && apiKey && apiSecret) {
      cloudinary.config({
        cloud_name: cloudName.trim(),
        api_key: apiKey.trim(),
        api_secret: apiSecret.trim(),
        secure: true,
      });
      this.isCloudinaryConfigured = true;
      this.logger.log(`Cloudinary successfully configured for cloud: ${cloudName.trim()}`);
    } else if (isValidUrl) {
      cloudinary.config({ cloudinary_url: cloudinaryUrl.trim() });
      this.isCloudinaryConfigured = true;
      this.logger.log('Cloudinary successfully configured via CLOUDINARY_URL');
    } else {
      this.isCloudinaryConfigured = false;
      this.logger.error('Cloudinary credentials missing or invalid in environment variables.');
    }
  }

  /**
   * Upload image directly to Cloudinary.
   */
  async uploadFile(
    file: Express.Multer.File,
    folder: string = 'general',
  ): Promise<string> {
    if (!file) {
      throw new BadRequestException('No file provided for upload');
    }

    const allowedMimeTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
    if (!allowedMimeTypes.includes(file.mimetype)) {
      throw new BadRequestException('Only image files (JPEG, PNG, WEBP, GIF) are allowed');
    }

    if (!this.isCloudinaryConfigured) {
      throw new InternalServerErrorException(
        'Cloudinary service is not configured. Please provide CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, and CLOUDINARY_API_SECRET in .env',
      );
    }

    try {
      const url = await this.uploadToCloudinary(file, folder);
      this.logger.log(`File successfully uploaded to Cloudinary: ${url}`);
      return url;
    } catch (error) {
      this.logger.error(`Cloudinary upload failed: ${error?.message || error}`, error?.stack);
      throw new InternalServerErrorException(`Cloudinary upload failed: ${error?.message || 'Unknown error'}`);
    }
  }

  /**
   * Alias for backward compatibility
   */
  async saveFile(file: Express.Multer.File, folder: string = 'products'): Promise<string> {
    return this.uploadFile(file, folder);
  }


  /**
   * Delete an image from Cloudinary or local storage.
   */
  async deleteFile(imagePathOrUrl?: string | null): Promise<boolean> {
    if (!imagePathOrUrl) return false;

    // Delete from Cloudinary
    if (!this.isCloudinaryConfigured) return false;
    try {
      const publicId = this.extractPublicIdFromUrl(imagePathOrUrl);
      if (publicId) {
        const result = await cloudinary.uploader.destroy(publicId);
        this.logger.log(`Deleted Cloudinary image: ${publicId} - result: ${result.result}`);
        return result.result === 'ok';
      }
    } catch (error) {
      this.logger.error(`Failed to delete Cloudinary image: ${error.message}`);
    }
    return false;
  }

  private uploadToCloudinary(
    file: Express.Multer.File,
    folder: string,
  ): Promise<string> {
    return new Promise((resolve, reject) => {
      const options = {
        folder: `product_app/${folder}`,
        resource_type: 'auto' as const,
      };

      if (file.buffer) {
        const uploadStream = cloudinary.uploader.upload_stream(
          options,
          (error: UploadApiErrorResponse | undefined, result: UploadApiResponse | undefined) => {
            if (error || !result) {
              return reject(error || new Error('Cloudinary upload returned no result'));
            }
            resolve(result.secure_url);
          },
        );

        streamifier.createReadStream(file.buffer).pipe(uploadStream);
      } else if (file.path) {
        cloudinary.uploader.upload(file.path, options, (error, result) => {
          if (error || !result) {
            return reject(error || new Error('Cloudinary upload returned no result'));
          }
          resolve(result.secure_url);
        });
      } else {
        reject(new Error('Uploaded file has neither buffer nor path'));
      }
    });
  }


  private extractPublicIdFromUrl(url: string): string | null {
    try {
      // Example URL: https://res.cloudinary.com/cloud_name/image/upload/v123456789/product_app/products/sample.jpg
      const uploadIndex = url.indexOf('/upload/');
      if (uploadIndex === -1) return null;

      let publicPath = url.substring(uploadIndex + '/upload/'.length);
      // Remove version string if present (e.g., v123456789/)
      if (/^v\d+\//.test(publicPath)) {
        publicPath = publicPath.replace(/^v\d+\//, '');
      }

      // Remove file extension (.jpg, .png, etc.)
      const lastDotIndex = publicPath.lastIndexOf('.');
      if (lastDotIndex !== -1) {
        publicPath = publicPath.substring(0, lastDotIndex);
      }

      return publicPath;
    } catch {
      return null;
    }
  }
}

