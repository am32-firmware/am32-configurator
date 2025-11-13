import * as Minio from 'minio';

export const useMinio = () => new Minio.Client({
    endPoint: process.env.MINIO_URL ?? '',
    port: 443,
    useSSL: true,
    accessKey: process.env.MINIO_ACCESS_KEY ?? '',
    secretKey: process.env.MINIO_SECRET_KEY ?? ''
});
