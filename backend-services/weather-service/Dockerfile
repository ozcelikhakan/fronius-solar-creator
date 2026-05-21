
# Multi-stage build — keeps final image small by excluding SDK tools.

FROM mcr.microsoft.com/dotnet/sdk:10.0 AS build

WORKDIR /src

COPY src/weather-service/weather-service.csproj ./

RUN dotnet restore

COPY src/weather-service/ ./

RUN dotnet publish -c Release -o /app/publish --no-restore

FROM mcr.microsoft.com/dotnet/aspnet:10.0 AS runtime

WORKDIR /app

RUN adduser --disabled-password --gecos "" appuser && chown -R appuser /app

USER appuser

COPY --from=build /app/publish .

EXPOSE 5002

ENTRYPOINT ["dotnet", "weather-service.dll"]

