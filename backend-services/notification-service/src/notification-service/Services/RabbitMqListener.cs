using System.Text;
using System.Text.Json;
using Microsoft.AspNetCore.SignalR;
using notification_service.Hubs;
using RabbitMQ.Client;
using RabbitMQ.Client.Events;

namespace notification_service.Services;

// BackgroundService keeps the RabbitMQ consumer alive for the lifetime of the app
public class RabbitMqListener : BackgroundService
{
    private readonly IHubContext<SimulationHub> _hub;
    private readonly IConfiguration _config;

    public RabbitMqListener(IHubContext<SimulationHub> hub, IConfiguration config)
    {
        _hub = hub;
        _config = config;
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        var factory = new ConnectionFactory
        {
            Uri = new Uri(_config["RabbitMQ:ConnectionString"]!)
        };

        await using var connection = await factory.CreateConnectionAsync(stoppingToken);
        await using var channel = await connection.CreateChannelAsync(cancellationToken: stoppingToken);

        await channel.QueueDeclareAsync("simulation.completed", durable: true,
            exclusive: false, autoDelete: false, cancellationToken: stoppingToken);

        var consumer = new AsyncEventingBasicConsumer(channel);

        consumer.ReceivedAsync += async (_, ea) =>
        {
            var json = Encoding.UTF8.GetString(ea.Body.ToArray());
            var payload = JsonSerializer.Deserialize<SimulationCompletedEvent>(json);

            if (payload?.ProjectId is not null)
            {
                // Push to the project group — only the Angular client watching this project receives it
                await _hub.Clients
                    .Group($"project-{payload.ProjectId}")
                    .SendAsync("SimulationCompleted", payload.ProjectId, stoppingToken);
            }

            await channel.BasicAckAsync(ea.DeliveryTag, multiple: false, stoppingToken);
        };

        await channel.BasicConsumeAsync("simulation.completed",
            autoAck: false, consumer: consumer, cancellationToken: stoppingToken);

        // Block until the service is stopped
        await Task.Delay(Timeout.Infinite, stoppingToken);
    }
}

internal record SimulationCompletedEvent(string ProjectId);