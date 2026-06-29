using MongoDB.Driver;
using project_service.Models;

namespace project_service.Repositories;

// Single class owns all MongoDB I/O — keeps endpoint handlers free of driver details
public class ProjectRepository
{
    private readonly IMongoCollection<Project> _projects;
    private readonly IMongoCollection<User> _users;

    public ProjectRepository(IConfiguration config)
    {
        var client = new MongoClient(config["MongoDB:ConnectionString"]);
        var db = client.GetDatabase(config["MongoDB:DatabaseName"]);

        _projects = db.GetCollection<Project>("projects");
        _users = db.GetCollection<User>("users");

        // Index on email enforces uniqueness and speeds up login lookup
        _users.Indexes.CreateOne(
            new CreateIndexModel<User>(
                Builders<User>.IndexKeys.Ascending(u => u.Email),
                new CreateIndexOptions { Unique = true }
            )
        );
    }

    // ── Project CRUD ──────────────────────────────────────────────────────────

    public async Task<List<Project>> GetAllAsync(CancellationToken ct) =>
        await _projects.Find(_ => true).ToListAsync(ct);

    public async Task<Project?> GetByIdAsync(string id, CancellationToken ct) =>
        await _projects.Find(p => p.Id == id).FirstOrDefaultAsync(ct);

    public async Task<Project> CreateAsync(Project project, CancellationToken ct)
    {
        await _projects.InsertOneAsync(project, cancellationToken: ct);
        return project;
    }

    public async Task<bool> DeleteAsync(string id, CancellationToken ct)
    {
        var result = await _projects.DeleteOneAsync(p => p.Id == id, ct);
        return result.DeletedCount > 0;
    }

    // ── User Auth ─────────────────────────────────────────────────────────────

    public async Task<User?> FindByEmailAsync(string email, CancellationToken ct) =>
        await _users.Find(u => u.Email == email).FirstOrDefaultAsync(ct);

    public async Task CreateUserAsync(User user, CancellationToken ct) =>
        await _users.InsertOneAsync(user, cancellationToken: ct);
}