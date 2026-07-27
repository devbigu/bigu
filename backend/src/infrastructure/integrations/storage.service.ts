import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  type UploadApiErrorResponse,
  type UploadApiOptions,
  type UploadApiResponse,
  v2 as cloudinary,
} from 'cloudinary';
import { randomUUID } from 'node:crypto';
import {
  type StorageProvider,
  type StorageResourceType,
  type UploadAssetInput,
  type UploadedAsset,
} from './storage-provider.interface';

export class StorageProviderError extends Error {
  constructor(
    public readonly operation: 'upload' | 'delete',
    public readonly providerStatus?: number,
  ) {
    super('The storage provider operation failed.');
  }
}

@Injectable()
export class StorageService implements StorageProvider {
  private readonly logger = new Logger(StorageService.name);

  constructor(private readonly config: ConfigService) {
    cloudinary.config({
      cloud_name: config.getOrThrow<string>('CLOUDINARY_CLOUD_NAME'),
      api_key: config.getOrThrow<string>('CLOUDINARY_API_KEY'),
      api_secret: config.getOrThrow<string>('CLOUDINARY_API_SECRET'),
      secure: true,
    });
  }

  profileFolder() {
    return `${this.baseFolder()}/profile-photos`;
  }

  clientFileFolder(clientId: string, conversationId: string) {
    return `${this.baseFolder()}/client-files/${clientId}/${conversationId}`;
  }

  upload(input: UploadAssetInput): Promise<UploadedAsset> {
    const options: UploadApiOptions = {
      folder: input.folder,
      public_id: randomUUID(),
      resource_type: input.resourceType,
      use_filename: false,
      unique_filename: true,
      overwrite: false,
    };
    if (input.transformation === 'profile-square') {
      options.transformation = [
        {
          width: 512,
          height: 512,
          crop: 'fill',
          gravity: 'auto',
          flags: 'no_overflow',
          quality: 'auto',
          fetch_format: 'auto',
        },
      ];
    }

    return new Promise((resolve, reject) => {
      const upload = cloudinary.uploader.upload_stream(
        options,
        (
          error: UploadApiErrorResponse | undefined,
          result: UploadApiResponse | undefined,
        ) => {
          if (error || !result) {
            this.logger.error(
              `Cloudinary upload failed (status ${error?.http_code ?? 'unknown'}).`,
            );
            reject(new StorageProviderError('upload', error?.http_code));
            return;
          }
          resolve({
            publicId: result.public_id,
            secureUrl: result.secure_url,
            resourceType: result.resource_type,
            format: result.format,
            bytes: result.bytes,
            width: result.width,
            height: result.height,
          });
        },
      );
      upload.end(input.buffer);
    });
  }

  async delete(publicId: string, resourceType: StorageResourceType = 'image') {
    try {
      const result = (await cloudinary.uploader.destroy(publicId, {
        resource_type: resourceType,
        invalidate: true,
      })) as { result?: string };
      if (!['ok', 'not found'].includes(result.result ?? '')) {
        throw new StorageProviderError('delete');
      }
    } catch (error: unknown) {
      if (error instanceof StorageProviderError) throw error;
      const status =
        typeof error === 'object' &&
        error !== null &&
        'http_code' in error &&
        typeof error.http_code === 'number'
          ? error.http_code
          : undefined;
      this.logger.error(
        `Cloudinary delete failed (status ${status ?? 'unknown'}).`,
      );
      throw new StorageProviderError('delete', status);
    }
  }

  private baseFolder() {
    return this.config
      .getOrThrow<string>('CLOUDINARY_FOLDER')
      .replace(/\/+$/, '');
  }
}
