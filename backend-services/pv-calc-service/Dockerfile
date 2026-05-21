
# Multi-stage build — keeps final image small by excluding SDK tools.

FROM mcr.microsoft.com/dotnet/sdk:10.0 AS build

WORKDIR /src

COPY src/pv-calc-service/pv-calc-service.csproj ./

RUN dotnet restore

COPY src/pv-calc-service/ ./

RUN dotnet publish -c Release -o /app/publish --no-restore

FROM mcr.microsoft.com/dotnet/aspnet:10.0 AS runtime

WORKDIR /app

RUN adduser --disabled-password --gecos "" appuser && chown -R appuser /app

USER appuser

COPY --from=build /app/publish .

EXPOSE 5003

ENTRYPOINT ["dotnet", "pv-calc-service.dll"]

