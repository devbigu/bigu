export type StorageResourceType = 'image' | 'raw' | 'auto';

export type UploadAssetInput = {
  buffer: Buffer;
  originalName: string;
  mimeType: string;
  folder: string;
  resourceType: StorageResourceType;
  transformation?: 'profile-square';
};

export type UploadedAsset = {
  publicId: string;
  secureUrl: string;
  resourceType: string;
  format?: string;
  bytes: number;
  width?: number;
  height?: number;
};

export interface StorageProvider {
  upload(input: UploadAssetInput): Promise<UploadedAsset>;
  delete(publicId: string, resourceType?: StorageResourceType): Promise<void>;
}
