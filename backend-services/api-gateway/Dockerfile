# Multi-stage build — keeps final image small by excluding SDK tools.
# Stage 1 (build): full SDK needed to compile
# Stage 2 (runtime): only ASP.NET runtime, no SDK

FROM mcr.microsoft.com/dotnet/sdk:10.0 AS build
WORKDIR /src

# Copy csproj first and restore — Docker layer cache prevents re-restoring on code-only changes
COPY src/api-gateway/api-gateway.csproj ./
RUN dotnet restore

COPY src/api-gateway/ ./
RUN dotnet publish -c Release -o /app/publish --no-restore

# Runtime stage — smaller base image (no compiler tools)
FROM mcr.microsoft.com/dotnet/aspnet:10.0 AS runtime
WORKDIR /app

# Non-root user — security best practice for containers
RUN adduser --disabled-password --gecos "" appuser && chown -R appuser /app
USER appuser

COPY --from=build /app/publish .

EXPOSE 5000
ENTRYPOINT ["dotnet", "api-gateway.dll"]