using Minio;
using Minio.DataModel.Args;

namespace report_service.Services;

public class StorageService
{
    private readonly IMinioClient _minio;
    private readonly string _bucket;

    public StorageService(IConfiguration config)
    {
        _bucket = config["MinIO:BucketName"]!;

        // MinIO mirrors Azure Blob Storage API — swap endpoint for prod Azure connection
        _minio = new MinioClient()
            .WithEndpoint(config["MinIO:Endpoint"]!)
            .WithCredentials(config["MinIO:AccessKey"]!, config["MinIO:SecretKey"]!)
            .WithSSL(bool.Parse(config["MinIO:UseSSL"] ?? "false"))
            .Build();
    }

    public async Task<string> UploadAsync(string projectId, byte[] pdf, CancellationToken ct)
    {
        await EnsureBucketExistsAsync(ct);

        var objectName = $"{projectId}/{DateTime.UtcNow:yyyyMMdd-HHmmss}.pdf";

        using var stream = new MemoryStream(pdf);
        await _minio.PutObjectAsync(new PutObjectArgs()
            .WithBucket(_bucket)
            .WithObject(objectName)
            .WithStreamData(stream)
            .WithObjectSize(pdf.Length)
            .WithContentType("application/pdf"), ct);

        // Return object path — API Gateway constructs the full download URL
        return objectName;
    }

    public async Task<Stream> DownloadAsync(string objectName, CancellationToken ct)
    {
        var ms = new MemoryStream();
        await _minio.GetObjectAsync(new GetObjectArgs()
            .WithBucket(_bucket)
            .WithObject(objectName)
            .WithCallbackStream(stream => stream.CopyTo(ms)), ct);
        ms.Position = 0;
        return ms;
    }

    private async Task EnsureBucketExistsAsync(CancellationToken ct)
    {
        var exists = await _minio.BucketExistsAsync(
            new BucketExistsArgs().WithBucket(_bucket), ct);

        if (!exists)
            await _minio.MakeBucketAsync(
                new MakeBucketArgs().WithBucket(_bucket), ct);
    }
}