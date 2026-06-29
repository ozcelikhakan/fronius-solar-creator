using MongoDB.Bson;
using MongoDB.Bson.Serialization.Attributes;

namespace project_service.Models;
public class User

{
    [BsonId]
    [BsonRepresentation(BsonType.ObjectId)]
    public string Id {get; set;} = ObjectId.GenerateNewId().ToString();

    public string Email { get; set; } = string.Empty;

    //Store only the hash - plain text password never persisted

    public string PasswordHash { get; set; } = string.Empty;

    public DateTime CreatedAt { get; set;} = DateTime.UtcNow;
}