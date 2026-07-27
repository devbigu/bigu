import { ConfigService } from '@nestjs/config';
import {
  type UploadApiErrorResponse,
  type UploadApiResponse,
  v2 as cloudinary,
} from 'cloudinary';
import { StorageProviderError, StorageService } from './storage.service';

jest.mock('cloudinary', () => ({
  v2: {
    config: jest.fn(),
    uploader: {
      upload_stream: jest.fn(),
      destroy: jest.fn(),
    },
  },
}));

describe('StorageService', () => {
  type UploadStreamMock = (
    options: Record<string, unknown>,
    callback: (
      error?: UploadApiErrorResponse,
      result?: UploadApiResponse,
    ) => void,
  ) => { end: () => void };
  const uploadStream = jest.mocked(
    cloudinary.uploader.upload_stream,
  ) as unknown as jest.MockedFunction<UploadStreamMock>;
  const destroy = jest.mocked(cloudinary.uploader.destroy);
  const config = {
    getOrThrow: jest.fn((key: string) => {
      const values: Record<string, string> = {
        CLOUDINARY_CLOUD_NAME: 'test-cloud',
        CLOUDINARY_API_KEY: 'test-key',
        CLOUDINARY_API_SECRET: 'test-secret',
        CLOUDINARY_FOLDER: 'bigu',
      };
      return values[key];
    }),
  };
  let service: StorageService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new StorageService(config as unknown as ConfigService);
  });

  it('derives only trusted profile and client folders', () => {
    expect(service.profileFolder()).toBe('bigu/profile-photos');
    expect(service.clientFileFolder('client-1', 'conversation-1')).toBe(
      'bigu/client-files/client-1/conversation-1',
    );
  });

  it('uploads profile images with a square no-upscale transformation', async () => {
    uploadStream.mockImplementation((options, callback) => {
      const stream = {
        end: () =>
          callback(undefined, {
            public_id: 'bigu/profile-photos/id',
            secure_url: 'https://res.cloudinary.com/test/id.jpg',
            resource_type: 'image',
            format: 'jpg',
            bytes: 42,
            width: 512,
            height: 512,
          } as UploadApiResponse),
      };
      return stream;
    });
    const result = await service.upload({
      buffer: Buffer.from([0xff, 0xd8, 0xff]),
      originalName: 'avatar.jpg',
      mimeType: 'image/jpeg',
      folder: service.profileFolder(),
      resourceType: 'image',
      transformation: 'profile-square',
    });
    expect(result.publicId).toBe('bigu/profile-photos/id');
    expect(uploadStream).toHaveBeenCalledWith(
      expect.objectContaining({
        folder: 'bigu/profile-photos',
        resource_type: 'image',
        transformation: [expect.objectContaining({ flags: 'no_overflow' })],
      }),
      expect.any(Function),
    );
  });

  it('deletes using the matching stored resource type', async () => {
    destroy.mockResolvedValue({ result: 'ok' });
    await service.delete('bigu/client-files/id', 'raw');
    expect(destroy).toHaveBeenCalledWith('bigu/client-files/id', {
      resource_type: 'raw',
      invalidate: true,
    });
  });

  it('returns a provider-safe error without credential data', async () => {
    uploadStream.mockImplementation((_options, callback) => {
      return {
        end: () =>
          callback({
            http_code: 503,
            message: 'provider failed',
          } as UploadApiErrorResponse),
      };
    });
    const promise = service.upload({
      buffer: Buffer.from('file'),
      originalName: 'file.txt',
      mimeType: 'text/plain',
      folder: 'bigu/client-files/client/conversation',
      resourceType: 'raw',
    });
    await expect(promise).rejects.toBeInstanceOf(StorageProviderError);
    await expect(promise).rejects.not.toThrow('test-secret');
  });
});
