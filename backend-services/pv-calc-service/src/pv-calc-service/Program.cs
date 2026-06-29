using pv_calc_service.Endpoints;

var builder = WebApplication.CreateBuilder(args);

//Orleans silo : hosts the grain runtime inside this asp.net process
builder.UseOrleans(silo =>
{
    silo.UseLocalhostClustering(); //Single-node cluster for local/dev environment

    // In memory storage: grain state is ephemeral but sufficient for the portfolio demo
    // Production would swap this for a durable provider (e.g Azure Table Storage)
    silo.AddMemoryGrainStorageAsDefault();
});

var app = builder.Build();

app.MapSimulationEndpoints();

app.Run();