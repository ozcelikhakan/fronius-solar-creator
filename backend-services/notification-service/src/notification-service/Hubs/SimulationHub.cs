using Microsoft.AspNetCore.SignalR;

namespace notification_service.Hubs;

public class SimulationHub : Hub
{
    // Angular calls this to join a project-specific group so it only receives its own events

    public async Task JoinProject(string projectId)
    {
        await Groups.AddToGroupAsync(Context.ConnectionId, $"project-{projectId}");
    }

    public async Task LeaveProject(string projectId)
    {
        await Groups.RemoveFromGroupAsync(Context.ConnectionId, $"project-{projectId}");
    }
}